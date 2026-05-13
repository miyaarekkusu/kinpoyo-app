import base64
import json
import os
import uuid
from pathlib import Path

import cv2
import mediapipe as mp
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_connection, init_schema

load_dotenv()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_SAMPLE_INTERVAL = int(os.getenv("IMAGE_SAMPLE_INTERVAL", "1"))

app = FastAPI(title="kinpoyo backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_pose = mp.solutions.pose


@app.on_event("startup")
def on_startup():
    try:
        init_schema()
    except Exception as exc:
        # Don't crash the API if DB is unreachable in dev; just log.
        print(f"[startup] schema init skipped: {exc}")


@app.get("/")
def root():
    return {"message": "kinpoyo backend is running"}


# --- Single-shot upload + range save ---


class SessionSavedResponse(BaseModel):
    session_id: int
    fps: float
    total_frames: int
    pose_count: int
    image_count: int
    image_sample_interval: int


@app.post("/sessions", response_model=SessionSavedResponse)
async def create_session(
    exercise_name: str = Form(...),
    video: UploadFile = File(...),
    start_time_sec: float = Form(...),
    end_time_sec: float = Form(...),
):
    """
    Receive the video + exercise + selected range in a single request,
    run MediaPipe on the range, persist pose + sampled images to the DB,
    and discard the video. The server never keeps the video file.
    """
    if end_time_sec < start_time_sec:
        raise HTTPException(status_code=400, detail="end < start")

    suffix = Path(video.filename or "").suffix or ".mp4"
    tmp_path = UPLOAD_DIR / f"session_{uuid.uuid4().hex}{suffix}"

    try:
        with tmp_path.open("wb") as f:
            f.write(await video.read())

        cap = cv2.VideoCapture(str(tmp_path))
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open uploaded video.")

        try:
            cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
        except Exception:
            pass

        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        if fps <= 0:
            cap.release()
            raise HTTPException(status_code=400, detail="invalid fps")
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

        start_frame = int(round(start_time_sec * fps))
        end_frame = int(round(end_time_sec * fps))

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO RecordingSession
                    (exercise_name, fps, total_frames, start_frame, end_frame)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?)
                """,
                (exercise_name, fps, total_frames, start_frame, end_frame),
            )
            session_id = int(cursor.fetchone()[0])

            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            pose_count = 0
            image_count = 0

            with mp_pose.Pose(static_image_mode=False, model_complexity=1) as pose:
                frame_no = start_frame
                while frame_no <= end_frame:
                    ok, frame_bgr = cap.read()
                    if not ok:
                        break

                    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                    result = pose.process(frame_rgb)
                    if result.pose_landmarks:
                        landmarks = [
                            {
                                "x": lm.x,
                                "y": lm.y,
                                "z": lm.z,
                                "visibility": lm.visibility,
                            }
                            for lm in result.pose_landmarks.landmark
                        ]
                    else:
                        landmarks = None

                    image_bytes = None
                    relative_index = frame_no - start_frame
                    if relative_index % IMAGE_SAMPLE_INTERVAL == 0:
                        encoded_ok, buf = cv2.imencode(".jpg", frame_bgr)
                        if encoded_ok:
                            image_bytes = buf.tobytes()
                            image_count += 1

                    cursor.execute(
                        """
                        INSERT INTO FrameSample
                            (session_id, frame_number, image, pose_landmarks)
                        VALUES (?, ?, ?, ?)
                        """,
                        (
                            session_id,
                            frame_no,
                            image_bytes,
                            json.dumps(landmarks) if landmarks is not None else None,
                        ),
                    )
                    pose_count += 1
                    frame_no += 1

            conn.commit()

        cap.release()

        return SessionSavedResponse(
            session_id=session_id,
            fps=fps,
            total_frames=total_frames,
            pose_count=pose_count,
            image_count=image_count,
            image_sample_interval=IMAGE_SAMPLE_INTERVAL,
        )
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


# --- Read-back endpoints for verification ---


# --- Preview endpoint: process without DB persistence ---


class PreviewFrame(BaseModel):
    frame_number: int
    pose_landmarks: list[dict] | None
    image_base64: str | None


class PreviewResponse(BaseModel):
    fps: float
    total_frames_in_range: int
    pose_count: int
    image_count: int
    image_sample_interval: int
    frames: list[PreviewFrame]


@app.post("/preview", response_model=PreviewResponse)
async def preview(
    video: UploadFile = File(...),
    start_time_sec: float = Form(...),
    end_time_sec: float = Form(...),
):
    """
    Stateless preview: run MediaPipe on the uploaded video within the
    selected time range and return per-frame pose data + sampled images
    as base64. Nothing is written to disk persistently or to the DB.
    """
    if end_time_sec < start_time_sec:
        raise HTTPException(status_code=400, detail="end < start")

    # Save to a temp file (OpenCV needs a path)
    suffix = Path(video.filename or "").suffix or ".mp4"
    tmp_path = UPLOAD_DIR / f"preview_{uuid.uuid4().hex}{suffix}"
    try:
        with tmp_path.open("wb") as f:
            f.write(await video.read())

        cap = cv2.VideoCapture(str(tmp_path))
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="cannot open video")

        # Respect rotation metadata so iOS-recorded portrait videos
        # are decoded upright instead of sideways.
        try:
            cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
        except Exception:
            pass

        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        if fps <= 0:
            cap.release()
            raise HTTPException(status_code=400, detail="invalid fps")

        start_frame = int(round(start_time_sec * fps))
        end_frame = int(round(end_time_sec * fps))

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        frames: list[PreviewFrame] = []
        pose_count = 0
        image_count = 0

        with mp_pose.Pose(static_image_mode=False, model_complexity=1) as pose:
            frame_no = start_frame
            while frame_no <= end_frame:
                ok, frame_bgr = cap.read()
                if not ok:
                    break

                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                result = pose.process(frame_rgb)
                if result.pose_landmarks:
                    landmarks = [
                        {
                            "x": lm.x,
                            "y": lm.y,
                            "z": lm.z,
                            "visibility": lm.visibility,
                        }
                        for lm in result.pose_landmarks.landmark
                    ]
                    pose_count += 1
                else:
                    landmarks = None

                image_b64: str | None = None
                relative = frame_no - start_frame
                if relative % IMAGE_SAMPLE_INTERVAL == 0:
                    encoded_ok, buf = cv2.imencode(
                        ".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 70]
                    )
                    if encoded_ok:
                        image_b64 = base64.b64encode(buf.tobytes()).decode("ascii")
                        image_count += 1

                frames.append(
                    PreviewFrame(
                        frame_number=frame_no,
                        pose_landmarks=landmarks,
                        image_base64=image_b64,
                    )
                )
                frame_no += 1

        cap.release()

        return PreviewResponse(
            fps=fps,
            total_frames_in_range=len(frames),
            pose_count=pose_count,
            image_count=image_count,
            image_sample_interval=IMAGE_SAMPLE_INTERVAL,
            frames=frames,
        )
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/sessions")
def list_sessions():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, exercise_name, recorded_at, fps, total_frames, start_frame, end_frame
            FROM RecordingSession
            ORDER BY id DESC
            """
        )
        rows = cursor.fetchall()
        return [
            {
                "id": r[0],
                "exercise_name": r[1],
                "recorded_at": r[2].isoformat() if r[2] else None,
                "fps": r[3],
                "total_frames": r[4],
                "start_frame": r[5],
                "end_frame": r[6],
            }
            for r in rows
        ]
