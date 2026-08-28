"""リアルタイムカウンタ（app/core/realtime_rep_counter.py）の検証ハーネス。

2つのモードがある。

合成モード（mediapipe不要・CIでも回せる）::

    python scripts/replay_realtime_count.py --synthetic --config model15.json

    較正済みテンプレートの形そのものから理想レップを合成し、そこに「浅い」
    「深すぎ（座り込み相当）」「途中で止まる」「速すぎ」「姿勢ロスト」といった
    崩し方を加えて、期待どおりカウント／ノーカンされるかを確認する。しきい値を
    いじったときの回帰チェックに使う。

リプレイモード（実動画・mediapipe必要）::

    python scripts/replay_realtime_count.py --video path/to/squat.mp4 --config model15.json

    動画をフレーム順に姿勢推定し、1フレームずつリアルタイムカウンタへ流し込む。
    同じ角度系列をバッチ版（rep_model.count_with_template）にも通して、両者の
    回数を並べて表示する。バッチ版は本番導線として残すため、リアルタイム化で
    結果がどれだけズレるかを常に見えるようにしておく。

--config は rep_count_models.config_json 相当のJSONファイル。省略時はDBから
取得する（DATABASE_URL が必要）。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.realtime_rep_counter import (  # noqa: E402
    NoCountReason,
    RealtimeConfig,
    build_counter,
    derive_raw_cycle_stats,
)

FPS = 30.0  # 合成信号のサンプリングレート（--fps で変更）


# --- 合成モード -------------------------------------------------------------


def _sample_mean(mean: list[float], tau: float) -> float:
    """正規化テンプレート（0〜1）を位相 tau∈[0,1] で線形補間。"""
    tau = max(0.0, min(1.0, tau))
    pos = tau * (len(mean) - 1)
    i = int(pos)
    if i >= len(mean) - 1:
        return mean[-1]
    return mean[i] + (pos - i) * (mean[i + 1] - mean[i])


def synth_series(
    mean: list[float],
    bottom: float,
    top: float,
    period_sec: float,
    *,
    pause_at_tau: float | None = None,
    pause_sec: float = 0.0,
    lost_at_tau: float | None = None,
    lost_sec: float = 0.0,
    stand_before: float = 1.0,
    stand_after: float = 0.6,
) -> list[tuple[float, float | None]]:
    """テンプレート形状に沿った1レップぶんの (時刻, 角度) 列を合成する。

    pause_at_tau: その位相で pause_sec だけ角度を止める（途中で停止するフォーム）。
    lost_at_tau : その位相で lost_sec だけ角度を None にする（姿勢ロスト）。
    """
    dt = 1.0 / FPS
    out: list[tuple[float, float | None]] = []
    t = 0.0

    n_before = int(stand_before * FPS)
    for _ in range(n_before):
        out.append((t, top))
        t += dt

    n_rep = max(2, int(period_sec * FPS))
    paused = False
    lost_done = False
    for i in range(n_rep + 1):
        tau = i / n_rep
        angle = bottom + _sample_mean(mean, tau) * (top - bottom)

        if pause_at_tau is not None and not paused and tau >= pause_at_tau:
            paused = True
            for _ in range(int(pause_sec * FPS)):
                out.append((t, angle))
                t += dt

        if lost_at_tau is not None and not lost_done and tau >= lost_at_tau:
            lost_done = True
            for _ in range(int(lost_sec * FPS)):
                out.append((t, None))
                t += dt

        out.append((t, angle))
        t += dt

    n_after = int(stand_after * FPS)
    for _ in range(n_after):
        out.append((t, top))
        t += dt
    return out


def concat(*series_list: list[tuple[float, float | None]]) -> list[tuple[float, float | None]]:
    """複数のレップ列を時刻を繋ぎ直して連結する（連続レップの合成用）。"""
    dt = 1.0 / FPS
    out: list[tuple[float, float | None]] = []
    t = 0.0
    for series in series_list:
        for _, angle in series:
            out.append((t, angle))
            t += dt
    return out


def add_spikes(
    series: list[tuple[float, float | None]], every: int, amplitude: float
) -> list[tuple[float, float | None]]:
    """単発の外れ値を周期的に混ぜる（MediaPipeの一時的な検出ミス相当）。

    連続逸脱でしかノーカンにしない設計が効いているかの確認用。1フレームだけ
    大きく飛ぶノイズでレップが落ちてはいけない。
    """
    out: list[tuple[float, float | None]] = []
    for i, (t, angle) in enumerate(series):
        if angle is not None and i % every == 0 and i > 0:
            angle = angle + (amplitude if (i // every) % 2 == 0 else -amplitude)
        out.append((t, angle))
    return out


def run_synthetic(config_json: dict, cfg: RealtimeConfig | None = None) -> int:
    built = build_counter(config_json)
    if built is None:
        print("カウンタを組み立てられません（template / cycleStats / mainJoint を確認）")
        return 1
    _, main_joint = built
    raw = derive_raw_cycle_stats(config_json["cycleStats"])
    assert raw is not None
    mean = [float(x) for x in config_json["template"]["mean"]]

    print(f"主役関節      : {main_joint}")
    print(f"実測ボトム帯  : {raw.bottom_min}〜{raw.bottom_max}°  (中央 {raw.bottom_mid:.1f}°)")
    print(f"実測トップ帯  : {raw.top_min}〜{raw.top_max}°  (中央 {raw.top_mid:.1f}°)")
    print(f"実測ROM帯     : {raw.rom_min}〜{raw.rom_max}°")
    print()

    bottom, top = raw.bottom_mid, raw.top_mid
    rom = top - bottom
    ideal = synth_series(mean, bottom, top, 2.0, stand_before=0.5, stand_after=0.5)

    # (ラベル, 信号, 期待カウント数)
    cases: list[tuple[str, list[tuple[float, float | None]], int]] = [
        ("理想レップ（テンプレート通り・2.0秒）", synth_series(mean, bottom, top, 2.0), 1),
        ("ゆっくり（4.0秒）", synth_series(mean, bottom, top, 4.0), 1),
        ("浅いレップ（ROM 45°）", synth_series(mean, top - 45.0, top, 2.0), 1),
        ("座り込み相当（ROM 110°）", synth_series(mean, top - 110.0, top, 2.5), 0),
        # 「流れから外れた」の検知は、**沈み込みの浅い段階で止まった**場合に限る。
        # 深く沈んだ位置での溜めはボトムホールドという正当なフォームであり、因果的な
        # 情報だけでは両者を区別できない（実測: スクワットのtau=0.3での停止は沈み込み
        # 79.6%、腕立ての浅いレップのボトムは79.2%。前者の方が深く、閾値で分けられない）。
        # 長く止まりすぎたレップはテンポ上限（基準周期の2.5倍）が受け持つ。
        ("序盤で1.5秒停止（＝流れから外れた）",
         synth_series(mean, bottom, top, 2.0, pause_at_tau=0.10, pause_sec=1.5), 0),
        ("ボトムで1.5秒溜める（＝正当なフォーム）",
         synth_series(mean, bottom, top, 2.0, pause_at_tau=0.55, pause_sec=1.5), 1),
        ("姿勢ロスト0.1秒（許容内）", synth_series(mean, bottom, top, 2.0, lost_at_tau=0.4, lost_sec=0.1), 1),
        ("姿勢ロスト0.5秒（許容外）", synth_series(mean, bottom, top, 2.0, lost_at_tau=0.4, lost_sec=0.5), 0),
        ("速すぎ（0.5秒）", synth_series(mean, bottom, top, 0.5), 0),
        # --- 実運用でいちばん効く2つ ---
        ("連続3レップ", concat(ideal, ideal, ideal), 3),
        ("連続5レップ（テンポばらつき）", concat(
            synth_series(mean, bottom, top, 1.8, stand_before=0.5, stand_after=0.4),
            synth_series(mean, bottom, top, 2.2, stand_before=0.4, stand_after=0.4),
            synth_series(mean, bottom, top, 2.6, stand_before=0.4, stand_after=0.4),
            synth_series(mean, bottom - 6, top, 3.0, stand_before=0.4, stand_after=0.4),
            synth_series(mean, bottom + 12, top, 3.2, stand_before=0.4, stand_after=0.5),
        ), 5),
        ("単発スパイクノイズ ±18°（3フレームおき）", add_spikes(ideal, 3, 18.0), 1),
        ("単発スパイクノイズ ±30°（5フレームおき）", add_spikes(ideal, 5, 30.0), 1),
    ]

    failures = 0
    for label, series, expected in cases:
        built_case = build_counter(config_json, cfg or RealtimeConfig())
        assert built_case is not None
        counter, _ = built_case
        counter.start()
        events = []
        for t_sec, angle in series:
            ev = counter.update(t_sec, angle)
            if ev is not None:
                events.append(ev)
        tail = counter.stop()
        if tail is not None:
            events.append(tail)

        counted = [e for e in events if e.counted]
        actual = len(counted)
        ok = actual == expected
        failures += 0 if ok else 1
        mark = "OK " if ok else "NG "
        if counted:
            roms = "/".join(str(e.rom_deg) for e in counted)
            devs = "/".join(str(e.depth_gap_deg) for e in counted)
            stalls = "/".join(str(e.max_stall_sec) for e in counted)
            quals = "/".join(str(e.form_quality) for e in counted)
            detail = f"ROM {roms}° 深さ逸脱 {devs}° 停滞 {stalls}s {quals}"
        elif events:
            detail = "理由: " + ", ".join(
                e.not_counted_reason.value for e in events if e.not_counted_reason
            )
        else:
            detail = "イベントなし（追従開始せず）"
        no_count = [e for e in events if not e.counted]
        if counted and no_count:
            detail += f"  ／ノーカン{len(no_count)}件: " + ", ".join(
                e.not_counted_reason.value for e in no_count if e.not_counted_reason
            )
        print(f"{mark} {label:<38} 期待={expected} 実際={actual}  {detail}")

    cfg = cfg or RealtimeConfig()
    print()
    print(f"ROM基準: 実測 {rom:.1f}° / ガード {cfg.rom_min_deg}〜{cfg.rom_max_deg}°")
    print(f"テンポ許容: 基準{cfg.ref_period_sec}秒の {cfg.time_scale_min}〜{cfg.time_scale_max}倍")
    print(f"連続停滞でノーカン: {cfg.ng_sec}秒 / 姿勢ロスト許容: {cfg.gap_sec}秒")
    print("NG件数:", failures)
    return 0 if failures == 0 else 1


# --- model-studio 実データ再生モード ----------------------------------------

MODEL_STUDIO_API_BASE = "https://kinpoyo-api.azurewebsites.net"


def _get_json(path: str):
    import urllib.request

    with urllib.request.urlopen(f"{MODEL_STUDIO_API_BASE}{path}", timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_analysis(config_json: dict, analysis_id: int) -> int:
    """model-studio の AnalysisResult に保存済みの**実測角度系列**を再生する。

    model-studio は変更禁止のため GET のみ。`/analyses/{id}` の summary_json には
    セッションごと・関節ごとの (frame, angle) 列が入っており、これは world ランド
    マークから算出されたもの。つまり動画も MediaPipe も無しで、実データに対して
    リアルタイム版とバッチ版を突き合わせられる。

    ⚠️ analysis 27 は較正に使った2セッション（= 学習データそのもの）なので、
    ここで一致しても汎化の証拠にはならない。あくまで「実データで破綻しないか」の
    確認である。
    """
    from app.core import rep_model

    analysis = _get_json(f"/analyses/{analysis_id}")
    summary = analysis["summary_json"]
    if isinstance(summary, str):
        summary = json.loads(summary)

    built = build_counter(config_json)
    if built is None:
        print("カウンタを組み立てられません")
        return 1
    _, main_joint = built

    joints_data = summary.get("joints") or {}
    if main_joint not in joints_data:
        print(f"この分析に主役関節 '{main_joint}' の系列がありません: {list(joints_data)}")
        return 1

    sessions_meta = {s["id"]: s for s in _get_json("/sessions")}

    # セッションID -> {関節名: points} に組み替える
    by_session: dict[int, dict[str, list[dict]]] = {}
    for joint_name, jd in joints_data.items():
        for entry in jd.get("series", []):
            sid = int(entry["session_id"])
            by_session.setdefault(sid, {})[joint_name] = entry["points"]

    print(f"分析 id={analysis_id}（タグ: {analysis.get('tag_name')}）")
    print(f"主役関節: {main_joint}   セッション: {sorted(by_session)}")
    print()

    cfg_batch, candidates, mj, template, shape_threshold, cycle_stats = (
        rep_model.model_from_dict(config_json)
    )

    total_rt = total_batch = total_true = 0
    for sid in sorted(by_session):
        meta = sessions_meta.get(sid, {})
        fps = float(meta.get("fps") or FPS)
        true_reps = meta.get("true_reps")
        series = by_session[sid]
        pts = series.get(main_joint) or []
        if not pts:
            print(f"session {sid}: 主役関節の系列なし・スキップ")
            continue

        by_frame = {int(p["frame"]): float(p["angle"]) for p in pts}
        first, last = min(by_frame), max(by_frame)

        built_case = build_counter(config_json, cfg or RealtimeConfig())
        assert built_case is not None
        counter, _ = built_case
        counter.start()
        events = []
        for f in range(first, last + 1):
            ev = counter.update(f / fps, by_frame.get(f))
            if ev is not None:
                events.append(ev)
        tail = counter.stop()
        if tail is not None:
            events.append(tail)
        counted = [e for e in events if e.counted]

        batch = rep_model.count_with_template(
            series, candidates, cfg_batch, mj, template, shape_threshold, cycle_stats
        )

        total_rt += len(counted)
        total_batch += batch["count"]
        if true_reps:
            total_true += int(true_reps)

        angles = list(by_frame.values())
        print(
            f"session {sid}: フレーム {first}-{last} ({len(by_frame)}点 / "
            f"{(last - first + 1) / fps:.1f}秒)  角度 {min(angles):.1f}〜{max(angles):.1f}°"
        )
        print(
            f"  正解={true_reps if true_reps is not None else '未ラベル'}  "
            f"リアルタイム={len(counted)}  バッチ={batch['count']}"
            f"(good {batch['good_form_count']}/要改善 {batch['needs_improvement_count']})"
        )
        for i, e in enumerate(events, 1):
            status = "カウント" if e.counted else f"ノーカン({e.not_counted_reason.value})"
            print(
                f"    {i}: {status}  {e.start_sec}s〜{e.end_sec}s  "
                f"bottom={e.bottom_deg}° top={e.top_deg}° rom={e.rom_deg}° "
                f"周期={e.period_sec}s 深さ逸脱={e.depth_gap_deg}° 停滞={e.max_stall_sec}s"
                f" {e.form_quality or ''}"
            )
        print()

    print(f"合計: 正解={total_true}  リアルタイム={total_rt}  バッチ={total_batch}")
    return 0


# --- リプレイモード ---------------------------------------------------------


def run_video(config_json: dict, video_path: str) -> int:
    import cv2  # ローカルimport：合成モードではmediapipe/opencvを要求しない

    from app.core import rep_model
    from app.core.pose import (
        close_pose_detector,
        create_pose_detector,
        extract_landmarks_from_frame,
    )

    built = build_counter(config_json)
    if built is None:
        print("カウンタを組み立てられません")
        return 1
    counter, main_joint = built

    if not Path(video_path).exists():
        print(f"動画が見つかりません: {video_path}")
        return 1

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        cap.release()
        print(f"動画を開けません: {video_path}")
        print("iPhoneのHEVC(H.265)はOpenCVがデコードできないことがあります"
              "（AGENTS.md『実装中に判明した重要な制約』6）。H.264に変換して再試行してください。")
        return 1
    cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)  # 縦撮り動画の回転メタデータを適用
    fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    detector = create_pose_detector()
    frames: list[tuple[int, list]] = []
    decoded = 0
    try:
        frame_number = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            decoded += 1
            landmarks = extract_landmarks_from_frame(detector, frame)
            if landmarks is not None:
                frames.append((frame_number, landmarks))
            frame_number += 1
    finally:
        close_pose_detector(detector)
        cap.release()

    if decoded == 0:
        print("1フレームもデコードできませんでした（コーデック非対応の可能性）")
        return 1

    # バッチ版を不利にしないため、候補関節も含めて角度系列を作る（主役関節が
    # そのクリップに無い場合のフォールバックが働くようにする）。
    _, candidates, mj, template, shape_threshold, cycle_stats = rep_model.model_from_dict(
        config_json
    )
    joints = list(dict.fromkeys([main_joint, *candidates]))
    series = rep_model.joint_series_from_frames(frames, joints)
    pts = series.get(main_joint) or []
    print(
        f"動画: {video_path}\n"
        f"  fps={fps:.1f}  メタ上の総フレーム={total_frames}  デコード={decoded}  "
        f"姿勢検出={len(frames)}  主役関節({main_joint})の角度点={len(pts)}"
    )
    if not pts:
        print("主役関節の角度が1点も取れませんでした（姿勢が映っていない可能性）")
        return 1

    # --- リアルタイム版 ---
    by_frame = {int(p["frame"]): float(p["angle"]) for p in pts}
    last_frame = max(by_frame) if by_frame else 0
    counter.start()
    events = []
    for f in range(last_frame + 1):
        ev = counter.update(f / fps, by_frame.get(f))
        if ev is not None:
            events.append(ev)
    tail = counter.stop()
    if tail is not None:
        events.append(tail)

    counted = [e for e in events if e.counted]
    print(f"\nリアルタイム版: {len(counted)}回（イベント{len(events)}件）")
    for i, e in enumerate(events, 1):
        status = "カウント" if e.counted else f"ノーカン({e.not_counted_reason.value})"
        print(
            f"  {i}: {status}  {e.start_sec}s〜{e.end_sec}s  "
            f"bottom={e.bottom_deg}° rom={e.rom_deg}° 深さ逸脱={e.depth_gap_deg}° "
            f"{e.form_quality or ''}"
        )

    # --- バッチ版（比較用。本番導線として残すため常に並べて見る） ---
    cfg, _, _, _, _, _ = rep_model.model_from_dict(config_json)
    batch = rep_model.count_with_template(
        series, candidates, cfg, mj, template, shape_threshold, cycle_stats
    )
    print(
        f"\nバッチ版      : {batch['count']}回 "
        f"(good {batch['good_form_count']} / 要改善 {batch['needs_improvement_count']}) "
        f"rom={batch['rom']:.1f}°"
    )
    print(f"\n差分: リアルタイム {len(counted)}回 - バッチ {batch['count']}回 "
          f"= {len(counted) - batch['count']:+d}")
    return 0


# --- エントリポイント -------------------------------------------------------


def load_config(path: str | None, exercise_name: str | None) -> dict:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))

    from app.database import SessionLocal
    from app.models.exercise import Exercise, RepCountModel

    db = SessionLocal()
    try:
        q = db.query(RepCountModel)
        if exercise_name:
            q = q.join(Exercise).filter(Exercise.name == exercise_name)
        model = q.first()
        if model is None:
            raise SystemExit("rep_count_models に較正済みモデルがありません")
        return model.config_json
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", help="config_json のJSONファイル（省略時はDBから取得）")
    parser.add_argument("--exercise", help="DBから引くときの種目名（例: スクワット）")
    parser.add_argument("--video", help="リプレイする動画ファイル")
    parser.add_argument("--synthetic", action="store_true", help="合成信号で回帰チェック")
    parser.add_argument("--fps", type=float, default=30.0,
                        help="合成信号のサンプリングレート。連写方式の低fpsを再現する")
    parser.add_argument("--streaming", action="store_true",
                        help="WebSocketストリーミング用の設定（exercises_ws.STREAMING_CONFIG）で回す")
    parser.add_argument("--analysis", type=int,
                        help="model-studio の分析ID。保存済みの実測角度系列を再生する（GETのみ）")
    args = parser.parse_args()

    if not args.video and not args.synthetic and args.analysis is None:
        parser.error("--video / --synthetic / --analysis のいずれかを指定してください")

    global FPS
    FPS = args.fps

    cfg = None
    if args.streaming:
        from app.core.realtime_rep_counter import STREAMING_CONFIG
        cfg = STREAMING_CONFIG

    config_json = load_config(args.config, args.exercise)
    if args.synthetic:
        return run_synthetic(config_json, cfg)
    if args.analysis is not None:
        return run_analysis(config_json, args.analysis)
    return run_video(config_json, args.video)


if __name__ == "__main__":
    raise SystemExit(main())
