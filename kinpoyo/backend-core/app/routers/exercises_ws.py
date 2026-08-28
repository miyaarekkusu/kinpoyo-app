"""AI回数カウント（リアルタイム版）のWebSocketストリーミング。

Expo Go で iOS 実機を動かすという制約から、端末側でMediaPipeを回す方式は取れない
（Expo Go は Expo SDK の固定セットを内蔵した既製アプリで、react-native-vision-camera
や react-native-mediapipe のようなカスタムネイティブモジュールを読み込めない）。
そこで**姿勢推定はサーバー側で行い、端末はフレームを送るだけ**にする。

この構成には副次的な利点がある：backend は model-studio と同じ **legacy API**
（`mp.solutions.pose`）を使うため、`rep_count_models` の較正済み絶対角度と完全に
噛み合う。オンデバイス方式（MediaPipe Tasks）で懸念していた骨格モデル差による
角度のズレが、そもそも発生しない。

プロトコル::

    接続 : ws://<host>/exercises/{exercise_id}/count-reps/stream?token=<JWT>
           （React Native の WebSocket はヘッダを付けられないのでクエリで渡す）

    受信 : {"t": <そのセットの計測開始からの秒>, "image": "<base64 JPEG>"}
           {"type": "reset"}   … 1セット終了。集計を返してカウンタを作り直す
           {"type": "stop"}    … 計測全体を終了

    送信 : {"type": "ready",  "main_joint": "左股関節", "bottom_deg": [...], ...}
           {"type": "sample", "t": 1.23, "angle": 142.5, "count": 2,
            "joints_ok": true}   … 監視関節が全て信頼できる可視性で映っているか
           {"type": "rep",    "counted": true, ...RepEvent...}
           {"type": "set_done", "count": 3, "events": [...]}   … reset への応答
           {"type": "done",   "count": 5, "events": [...]}
           {"type": "error",  "detail": "..."}

MediaPipe の推論はCPUバウンドな同期処理なので、必ずスレッドプールへ逃がす
（`asyncio.to_thread`）。イベントループを塞ぐと受信が詰まってフレームが溜まる。

フレームが処理より速く届く場合は**古いフレームを捨てる**。溜めると計測時刻と実時間が
ずれていき、テンポ判定が壊れる。捨てたことは `sample` を返さないことで暗黙に伝わる。
"""
from __future__ import annotations

import asyncio
import base64
import json
import time
from pathlib import Path
from dataclasses import asdict
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core import realtime_rep_counter as rt
from app.core.pose import (
    close_pose_detector,
    create_pose_detector,
    extract_landmarks_from_frame,
)
from app.core.pose_analysis import JOINT_DEFINITIONS_JA, angle_at
from app.core.security import decode_access_token
from app.crud import exercise as exercise_crud
from app.database import SessionLocal
from app.models.user import User

router = APIRouter(prefix="/exercises", tags=["exercises"])


# 連写方式（低fps）向けのしきい値プリセット。実測に基づく調整の根拠は
# app/core/realtime_rep_counter.py の STREAMING_CONFIG のコメントを参照。
STREAMING_CONFIG = rt.STREAMING_CONFIG


def _authenticate(token: Optional[str], db: Session) -> Optional[User]:
    """WebSocket はヘッダを付けられないため、クエリで渡されたJWTを自前で検証する。
    `decode_access_token` は subject（= email）を返す（app/core/deps.py の
    get_current_user と同じ扱い）。"""
    if not token:
        return None
    try:
        email = decode_access_token(token)
    except Exception:
        return None
    if not email:
        return None
    return db.query(User).filter(User.email == email).first()


def _event_to_dict(event: rt.RepEvent) -> dict:
    """RepEvent をJSON化する（Enum は文字列に落とす）。"""
    d = asdict(event)
    d["not_counted_reason"] = (
        event.not_counted_reason.value if event.not_counted_reason is not None else None
    )
    return d


# 「その関節がちゃんと映っている」とみなす可視性のしきい値。MediaPipe の visibility は
# 0〜1で、隠れている・フレーム外の関節は低い値になる。
#
# ⚠️ 0.7 にしてはいけない。スクワットは深さを見るため横向きに撮るのが自然で、その
# とき奥側の半身は体に隠れて visibility が上がらない。実測（295フレーム）では
# 左股関節・左膝の中央値が 0.84 / 0.80 なのに対し、**右膝は最大でも 0.69**、
# 右股関節は 0.7以上が 2.5% しかなく、joints_ok が一度も True にならずに計測が
# 始まらなかった。
#
# 0.2 は「隠れていてもフレーム内にはいる」を拾う値。同じ実測で4関節の最小値は
# 25%点 0.29 / 中央値 0.40 なので、大半のフレームが通る。厳しくしたくなったら
# ここだけ上げること。
VISIBILITY_THRESHOLD = 0.2


def _decode_and_measure(
    detector, image_b64: str, joint_name: str, monitored_joints: list[str]
) -> tuple[Optional[float], bool, dict]:
    """base64 JPEG 1枚 -> (主役関節の絶対角度, 監視関節が全て信頼できるか)。

    ⚠️ 角度計算には必ず world ランドマークを使う（`extract_landmarks_from_frame` が
    `pose_world_landmarks` を返す）。画像正規化座標を混ぜると無意味な角度になる。

    2つ目の戻り値は「計測を始めてよいか」の判断材料。主役関節の角度が1つ取れただけでは
    体の一部しか映っていない可能性があるため、**そのモデルが見る全ての関節**
    （config_json の candidates）を構成するランドマークが揃って十分な可視性を持つことを
    確認する。
    """
    debug: dict = {}
    try:
        raw = base64.b64decode(image_b64)
    except Exception:
        debug["error"] = "base64デコード失敗"
        return None, False, debug
    buf = np.frombuffer(raw, dtype=np.uint8)
    frame_bgr = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame_bgr is None:
        debug["error"] = "JPEGデコード失敗"
        return None, False, debug

    h, w = frame_bgr.shape[:2]
    debug["size"] = f"{w}x{h}"
    debug["frame"] = frame_bgr
    # ⚠️ 端末が縦持ちなのにここが横長（w>h）なら、向き補正されていない画像が来ている。
    # 横倒しの人物はMediaPipeの姿勢推定が大きく劣化し、visibilityが落ちて計測が
    # 始まらない（AGENTS.md『実装中に判明した重要な制約』5と同じ罠）。
    debug["landscape"] = w > h

    landmarks = extract_landmarks_from_frame(detector, frame_bgr)
    if landmarks is None or len(landmarks) < 33:
        debug["error"] = "姿勢未検出"
        return None, False, debug

    # 監視関節に使うランドマークが全て十分な可視性を持つか。
    # どの関節のどの点が足りないのかログで分かるように、最小値を記録する。
    joints_ok = bool(monitored_joints)
    vis: dict[str, float] = {}
    for name in monitored_joints:
        indices = JOINT_DEFINITIONS_JA.get(name)
        if indices is None:
            joints_ok = False
            continue
        worst = 1.0
        for i in indices:
            try:
                worst = min(worst, float(landmarks[i].get("visibility", 0.0)))
            except (IndexError, KeyError, TypeError, ValueError):
                worst = 0.0
        vis[name] = round(worst, 2)
        if worst < VISIBILITY_THRESHOLD:
            joints_ok = False
    debug["visibility"] = vis

    definition = JOINT_DEFINITIONS_JA.get(joint_name)
    if definition is None:
        return None, joints_ok, debug
    ai, bi, ci = definition
    try:
        return angle_at(landmarks[ai], landmarks[bi], landmarks[ci]), joints_ok, debug
    except (IndexError, KeyError, TypeError):
        return None, joints_ok, debug


@router.websocket("/{exercise_id}/count-reps/stream")
async def count_reps_stream(websocket: WebSocket, exercise_id: int, token: str = "") -> None:
    await websocket.accept()

    db = SessionLocal()
    detector = None
    try:
        user = _authenticate(token, db)
        if user is None:
            await websocket.send_json({"type": "error", "detail": "認証に失敗しました"})
            await websocket.close()
            return

        model = exercise_crud.get_rep_count_model(db, exercise_id)
        if model is None:
            await websocket.send_json(
                {"type": "error", "detail": "この種目にはまだ回数カウントモデルが登録されていません"}
            )
            await websocket.close()
            return

        built = rt.build_counter(model.config_json, STREAMING_CONFIG)
        if built is None:
            await websocket.send_json(
                {"type": "error", "detail": "較正済みモデルの形式が想定と違います"}
            )
            await websocket.close()
            return
        counter, main_joint = built
        counter.start()
        # そのモデルが見る関節（較正時に監視対象とした関節）。計測開始の判定に使う。
        monitored_joints = [
            str(j) for j in (model.config_json.get("candidates") or [])
            if str(j) in JOINT_DEFINITIONS_JA
        ] or [main_joint]

        # ⚠️ static_image_mode=True（毎フレーム全体から検出）を試したが、実機では
        # 4回連続で1回もカウントされず、追跡モードのままの方が明確に良かった。
        # 理屈の上ではフレーム間隔が空く用途に True が合うはずだが、実測が優先。
        detector = create_pose_detector()
        # 実際に何が写っているかを1枚だけ保存する。可視性が 0.0 近辺のとき、
        # 「人が小さすぎる／暗い／フレーム外」のどれなのかはログの数値だけでは
        # 分からない。目で見て切り分けるための最短手段。
        debug_dir = Path("debug_frames")
        debug_dir.mkdir(exist_ok=True)
        saved_frame = False
        raw = counter.raw
        print(
            f"[ws] 接続: exercise_id={exercise_id} 主役関節={main_joint} "
            f"監視関節={monitored_joints} 可視性しきい値={VISIBILITY_THRESHOLD} "
            f"ボトム={raw.bottom_min}〜{raw.bottom_max} トップ={raw.top_min}〜{raw.top_max}",
            flush=True,
        )
        await websocket.send_json(
            {
                "type": "ready",
                "main_joint": main_joint,
                "monitored_joints": monitored_joints,
                "bottom_deg": [raw.bottom_min, raw.bottom_max],
                "top_deg": [raw.top_min, raw.top_max],
                "rom_deg": [raw.rom_min, raw.rom_max],
            }
        )

        # 処理中に届いたフレームは捨てる（溜めない）。計測時刻と実時間がずれると
        # テンポ判定が壊れるため。
        busy = False
        while True:
            message = await websocket.receive_text()
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                continue

            if payload.get("type") == "stop":
                break

            if payload.get("type") == "reset":
                # 1セット終了。そのセットの集計を返してカウンタを作り直す。
                # 接続を張り直さないのは、姿勢検出器（MediaPipeのPose）の生成が
                # 重く、セットごとに作り直すと休憩明けの初動が遅れるため。
                counter.stop()
                await websocket.send_json(
                    {
                        "type": "set_done",
                        "count": counter.count,
                        "events": [_event_to_dict(e) for e in counter.events],
                    }
                )
                built = rt.build_counter(model.config_json, STREAMING_CONFIG)
                assert built is not None
                counter, _ = built
                counter.start()
                continue

            image_b64 = payload.get("image")
            t_sec = payload.get("t")
            if not isinstance(image_b64, str) or not isinstance(t_sec, (int, float)):
                continue
            if busy:
                continue

            busy = True
            proc_began = time.perf_counter()
            try:
                angle, joints_ok, debug = await asyncio.to_thread(
                    _decode_and_measure, detector, image_b64, main_joint, monitored_joints
                )
            finally:
                busy = False
            proc_ms = (time.perf_counter() - proc_began) * 1000

            # 診断ログ。計測が始まらないときに「何が足りないのか」が分かるように、
            # 監視関節ごとの可視性の最小値と画像の向きを毎フレーム出す。
            vis_str = " ".join(
                f"{k}={v}{'x' if v < VISIBILITY_THRESHOLD else ''}"
                for k, v in (debug.get("visibility") or {}).items()
            )
            print(
                f"[ws] t={float(t_sec):5.2f} "
                f"img={debug.get('size', '?')}{'(横長!)' if debug.get('landscape') else ''} "
                f"angle={'--' if angle is None else f'{angle:6.1f}'} "
                f"joints_ok={joints_ok} count={counter.count} 処理={proc_ms:.0f}ms "
                f"{vis_str}{' ' + str(debug['error']) if debug.get('error') else ''}",
                flush=True,
            )

            frame_img = debug.pop("frame", None)
            if not saved_frame and frame_img is not None:
                saved_frame = True
                path = debug_dir / f"frame_{int(time.time())}.jpg"
                try:
                    cv2.imwrite(str(path), frame_img)
                    print(f"[ws] 検証用に1枚保存: {path}", flush=True)
                except Exception as exc:  # noqa: BLE001
                    print(f"[ws] フレーム保存に失敗: {exc}", flush=True)

            event = counter.update(float(t_sec), angle)
            await websocket.send_json(
                {
                    "type": "sample",
                    "t": round(float(t_sec), 3),
                    "angle": None if angle is None else round(angle, 1),
                    "count": counter.count,
                    "joints_ok": joints_ok,
                }
            )
            if event is not None:
                print(
                    f"[ws]   -> レップ確定: counted={event.counted} "
                    f"reason={event.not_counted_reason.value if event.not_counted_reason else '-'} "
                    f"bottom={event.bottom_deg} rom={event.rom_deg} period={event.period_sec}s",
                    flush=True,
                )
                await websocket.send_json({"type": "rep", **_event_to_dict(event)})

        counter.stop()
        await websocket.send_json(
            {
                "type": "done",
                "count": counter.count,
                "events": [_event_to_dict(e) for e in counter.events],
            }
        )

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 - 切断時の握りつぶしを避けて理由を返す
        try:
            await websocket.send_json({"type": "error", "detail": str(exc)})
        except Exception:
            pass
    finally:
        if detector is not None:
            close_pose_detector(detector)
        db.close()
        try:
            await websocket.close()
        except Exception:
            pass
