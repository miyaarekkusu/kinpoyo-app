"""MediaPipeによる単一フレームのポーズランドマーク抽出。

model-studio（../../../model-studio/backend/pose.py、変更禁止）と完全に同じ
API・同じバージョン範囲（mediapipe>=0.10.14,<0.10.22 のlegacy mp.solutions.pose）
を使う。

経緯：当初はPython 3.14環境の都合でmediapipe 1.0系の新Tasks API
（PoseLandmarker）に書き直していたが、Tasks APIの骨格検出モデルは
mp.solutions.pose（0.10系）とは別に学習・パッケージされた別物であることが
判明した。configやアルゴリズムは同一なのに、同じ動画でmodel-studioでは
正しくカウントされ、kinpoyoでは0になる、という実地の不一致が発生したため、
backend-core全体をPython 3.12＋legacy APIに揃えたが、それでも一致しなかった。

最終的にAzure上に実際にデプロイされているコード（ローカルのmodel-studio
リポジトリのファイルより新しく、ハッシュが不一致だった）を直接確認したところ、
角度計算には`pose_landmarks`（画像正規化座標。x/yが画像の幅・高さで別々に
正規化されアスペクト比の分だけ歪み、zは全く別スケール）ではなく、
`pose_world_landmarks`（腰を原点とする実世界3Dメートル座標。カメラの位置・
動画サイズに依存しない）を使う必要があった。これが根本原因だった。
"""
from __future__ import annotations

import cv2
import mediapipe as mp
import numpy as np

mp_pose = mp.solutions.pose

PoseDetector = mp_pose.Pose


def create_pose_detector(static_image_mode: bool = False) -> PoseDetector:
    """1回の処理（1本の動画・1回のリクエスト）の間だけ使い回す検出器を作る。

    static_image_mode=False: 前フレームの検出結果を使って連続的に追跡する
    モード（model-studioと同じ）。フレームを渡す順序が重要なので、1本の
    動画の処理中のみ使い回すこと。**録画動画のバッチ解析はこちら。**

    static_image_mode=True: 毎フレーム全体から検出し直す。追跡を使わないぶん
    1枚あたりは重いが、フレーム間隔が空く用途ではこちらが正しい。
    リアルタイム版（連写→WebSocket）は実測 2.9fps しか出ておらず、
    350ms 空いたフレーム同士はほぼ無関係。それでも False のまま使うと、
    古い追跡結果を手がかりに誤った領域を追い続ける。実測では
    「姿勢未検出 11%」「隣接サンプル間の角度変化が最大135度（実際の動きは
    1サンプル約19度）」という壊れ方をしていた。
    """
    return mp_pose.Pose(static_image_mode=static_image_mode, model_complexity=1)


def close_pose_detector(detector: PoseDetector) -> None:
    detector.close()


def extract_landmarks_from_frame(detector: PoseDetector, frame_bgr: np.ndarray) -> list[dict] | None:
    """デコード済みのBGRフレーム（OpenCVの生配列）から33点のポーズ*world*ランド
    マークを抽出する。動画をcv2.VideoCaptureで読んだフレームをそのまま渡す用途
    向け（JPEGへの再エンコード・デコードを挟まずに済む）。未検出の場合は None。

    pose_landmarks（画像正規化座標）ではなく pose_world_landmarks（腰を原点と
    する実世界3Dメートル座標）を使うこと。角度は3点の座標系の回転・平行移動に
    対して不変なので、world座標から計算すればカメラ位置・動画サイズに依存しない
    正しい角度になる。画像座標はx/yが画像の幅・高さで別々に正規化されアスペクト比
    の分だけ歪み、zは全く別スケールなので、これらを混ぜた角度は無意味になる。
    """
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    result = detector.process(frame_rgb)
    if not result.pose_world_landmarks:
        return None
    return [
        {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility}
        for lm in result.pose_world_landmarks.landmark
    ]
