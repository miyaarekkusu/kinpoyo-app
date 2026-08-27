import tempfile
import uuid
from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core import rep_model
from app.core.deps import get_current_user, get_db
from app.core.pose import close_pose_detector, create_pose_detector, extract_landmarks_from_frame
from app.core.pose_analysis import compute_joint_angles
from app.crud import exercise as exercise_crud
from app.models.user import User
from app.schemas.exercise import CountRepsResult, ExerciseOut, RepCountModelOut, RepCycleOut

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(db: Session = Depends(get_db)):
    return [exercise_crud.exercise_to_out(e) for e in exercise_crud.list_exercises(db)]


@router.get("/{exercise_id}/rep-model", response_model=RepCountModelOut)
def get_exercise_rep_model(exercise_id: int, db: Session = Depends(get_db)):
    """AI回数カウント用の較正済み設定を返す。未登録の種目は404。"""
    model = exercise_crud.get_rep_count_model(db, exercise_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail="この種目にはまだ回数カウントモデルが登録されていません",
        )
    return RepCountModelOut(
        exercise_id=model.exercise_id,
        config=model.config_json,
        mae=float(model.mae) if model.mae is not None else None,
        exact_match_rate=(
            float(model.exact_match_rate) if model.exact_match_rate is not None else None
        ),
        session_count=model.session_count,
    )


@router.post("/{exercise_id}/count-reps", response_model=CountRepsResult)
def count_reps_from_video(
    exercise_id: int,
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """録画済み動画をアップロードして回数カウントする（バッチ処理・同期）。

    model-studio（変更禁止）の `POST /models/{id}/count` と同じ設計：動画全体を
    まとめてMediaPipeで解析し、結果をその場で返す。フレーム画像・ランドマークは
    DBに永続化しない（処理後に一時ファイルも破棄する）。

    リアルタイムのWebSocketストリーミング版（/ws/pose、廃止済み）と違い、
    1レップ形状テンプレート照合・統計ゲートまで含むフル版のアルゴリズム
    （app/core/rep_model.py、model-studioでmae=0.0の実績）で判定する。

    通常のFastAPIの def（非async）エンドポイントはスレッドプールで実行される
    ため、ここでのCPUバウンドな動画処理（OpenCV・MediaPipe）がイベントループを
    ブロックしない。UploadFileの読み込みも同期API（video.file.read()）を使う。
    """
    model = exercise_crud.get_rep_count_model(db, exercise_id)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail="この種目にはまだ回数カウントモデルが登録されていません",
        )

    cfg, candidates, main_joint, template, shape_threshold, cycle_stats = (
        rep_model.model_from_dict(model.config_json)
    )
    joints_to_track = list(dict.fromkeys(candidates + ([main_joint] if main_joint else [])))
    if not joints_to_track:
        raise HTTPException(status_code=500, detail="この種目の設定に監視関節がありません")

    suffix = Path(video.filename or "").suffix or ".mp4"
    tmp_path = Path(tempfile.gettempdir()) / f"count_{uuid.uuid4().hex}{suffix}"
    video_bytes = video.file.read()
    with tmp_path.open("wb") as f:
        f.write(video_bytes)

    # 実装確認用：model-studioの結果と直接比較するため、アップロードされた動画を
    # 一時的に保存しておく（デバッグ用途のみ。恒久的な保存はしない）。
    debug_dir = Path(__file__).resolve().parent.parent.parent / "debug_uploads"
    debug_dir.mkdir(exist_ok=True)
    (debug_dir / f"last_upload{suffix}").write_bytes(video_bytes)

    detector = create_pose_detector()
    collected: list[tuple[int, list]] = []
    fps = 0.0
    total_frames = 0
    try:
        cap = cv2.VideoCapture(str(tmp_path))
        try:
            if not cap.isOpened():
                raise HTTPException(status_code=400, detail="動画を開けませんでした")

            # スマホ縦撮り動画は横長ピクセルバッファ+90度回転メタデータで保存されて
            # いることが多い。これを適用しないとMediaPipeに横倒しの画像を渡すことに
            # なり、姿勢推定が大きく崩れる（実際にこれが原因で股関節角度が実際より
            # 大幅に低く出ていたことを、デコード結果を画像化して目視確認で特定した）。
            # model-studioとの数値比較用に一度削除したが、model-studio側の較正・検証
            # 動画がそもそも縦向きで保存されたファイルだったため露呈しなかっただけで、
            # この処理自体は必要。
            try:
                cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
            except Exception:
                pass

            # model-studio（変更禁止）のmain.pyと同じく、読み込み直後に明示的に
            # フレーム0へシークする。一見無意味（既にフレーム0にいる）だが、この
            # 呼び出しの有無でOpenCVの内部デコード状態が変わり、同じ動画・同じ
            # mediapipe設定でも関節角度の計算結果が大きく変わることを実測で確認した。
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

            fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
            frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
            print(
                f"[count-reps] 動画読み込み: fps={fps:.1f} total_frames={total_frames} "
                f"width={frame_w} height={frame_h}"
            )

            frame_no = 0
            while True:
                ok, frame_bgr = cap.read()
                if not ok:
                    break
                if frame_no == 0:
                    print(f"[count-reps] 実際にデコードされたフレームshape: {frame_bgr.shape}")
                landmarks = extract_landmarks_from_frame(detector, frame_bgr)
                if landmarks is not None:
                    collected.append((frame_no, landmarks))
                    angles = compute_joint_angles(landmarks, joints_to_track)
                    joint_strs = " ".join(f"{j}={a:.1f}°" for j, a in angles.items())
                    print(f"[count-reps] frame={frame_no}/{total_frames} {joint_strs}")
                else:
                    print(f"[count-reps] frame={frame_no}/{total_frames} 検出なし")
                frame_no += 1
        finally:
            # Windowsではハンドルが残ったままだと一時ファイルのunlinkがPermissionErrorになる
            # ため、途中で例外が起きても必ずここでreleaseする。
            cap.release()
    finally:
        close_pose_detector(detector)
        tmp_path.unlink(missing_ok=True)

    joint_series = rep_model.joint_series_from_frames(collected, joints_to_track)
    res = rep_model.count_with_template(
        joint_series, candidates, cfg, main_joint, template, shape_threshold, cycle_stats
    )

    print(
        f"[count-reps] 結果: joint={res['joint']} count={res['count']} "
        f"good_form={res['good_form_count']} needs_improvement={res['needs_improvement_count']} "
        f"pose_frames={len(collected)}"
    )
    for c in res["cycles"]:
        status = "カウント外(測定不能)" if not c["counted"] else (
            "良いフォーム" if c["form_quality"] == "good" else "改善余地あり"
        )
        print(
            f"[count-reps]   cycle {c['start']}-{c['end']}: {status} "
            f"bottom={c.get('bottomDeg')}° top={c.get('topDeg')}° distance={c.get('distance')}"
        )

    cycles_out = [
        RepCycleOut(
            start=c["start"],
            end=c["end"],
            counted=c["counted"],
            form_quality=c.get("form_quality"),
            distance=c.get("distance"),
            bottom_deg=c.get("bottomDeg"),
            top_deg=c.get("topDeg"),
            period=c.get("period"),
        )
        for c in res["cycles"]
    ]

    return CountRepsResult(
        exercise_id=exercise_id,
        joint=res["joint"],
        count=res["count"],
        rom=round(res["rom"], 1),
        good_form_count=res["good_form_count"],
        needs_improvement_count=res["needs_improvement_count"],
        segments=res["segments"],
        total_frames=total_frames,
        pose_frames=len(collected),
        fps=fps,
        cycles=cycles_out,
    )
