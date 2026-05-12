import json
import os
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

IMAGE_SAMPLE_INTERVAL = int(os.getenv("IMAGE_SAMPLE_INTERVAL", "10"))

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


# --- Session creation + video upload ---


class SessionCreated(BaseModel):
    session_id: int
    total_frames: int
    fps: float
    duration_sec: float


@app.post("/sessions/upload", response_model=SessionCreated)
async def upload_session(
    exercise_name: str = Form(...),
    video: UploadFile = File(...),
):
    """
    Create a RecordingSession row and store the uploaded video on disk
    keyed by session_id. Returns video metadata for the client to use
    when picking start/end frames.
    """
    # 1) Insert session row
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO RecordingSession (exercise_name) OUTPUT INSERTED.id VALUES (?)",
            (exercise_name,),
        )
        session_id = int(cursor.fetchone()[0])
        conn.commit()

    # 2) Save uploaded video to disk
    suffix = Path(video.filename or "").suffix or ".mp4"
    video_path = UPLOAD_DIR / f"session_{session_id}{suffix}"
    with video_path.open("wb") as f:
        f.write(await video.read())

    # 3) Read video meta with OpenCV
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not open uploaded video.")
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()

    duration = total_frames / fps if fps else 0.0

    # 4) Update session meta
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE RecordingSession SET fps=?, total_frames=? WHERE id=?",
            (fps, total_frames, session_id),
        )
        conn.commit()

    return SessionCreated(
        session_id=session_id,
        total_frames=total_frames,
        fps=fps,
        duration_sec=duration,
    )


# --- Range selection -> save pose every frame, image every N frames ---


class SaveRangeRequest(BaseModel):
    start_frame: int
    end_frame: int


class SaveRangeResponse(BaseModel):
    session_id: int
    pose_count: int
    image_count: int
    image_sample_interval: int


@app.post("/sessions/{session_id}/save", response_model=SaveRangeResponse)
def save_range(session_id: int, body: SaveRangeRequest):
    if body.end_frame < body.start_frame:
        raise HTTPException(status_code=400, detail="end_frame must be >= start_frame")

    # Find the saved video
    matches = list(UPLOAD_DIR.glob(f"session_{session_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Video for session not found.")
    video_path = str(matches[0])

    pose_count = 0
    image_count = 0

    with mp_pose.Pose(static_image_mode=False, model_complexity=1) as pose:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open stored video.")

        # Seek to start once; afterwards iterate sequentially for speed
        cap.set(cv2.CAP_PROP_POS_FRAMES, body.start_frame)

        with get_connection() as conn:
            cursor = conn.cursor()
            frame_no = body.start_frame
            while frame_no <= body.end_frame:
                ok, frame_bgr = cap.read()
                if not ok:
                    break

                # Pose extraction on every frame
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

                # Image only at sampling interval
                image_bytes = None
                relative_index = frame_no - body.start_frame
                if relative_index % IMAGE_SAMPLE_INTERVAL == 0:
                    encoded_ok, buf = cv2.imencode(".jpg", frame_bgr)
                    if encoded_ok:
                        image_bytes = buf.tobytes()
                        image_count += 1

                cursor.execute(
                    """
                    INSERT INTO FrameSample (session_id, frame_number, image, pose_landmarks)
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

            # Update session with chosen range
            cursor.execute(
                "UPDATE RecordingSession SET start_frame=?, end_frame=? WHERE id=?",
                (body.start_frame, body.end_frame, session_id),
            )
            conn.commit()
        cap.release()

    return SaveRangeResponse(
        session_id=session_id,
        pose_count=pose_count,
        image_count=image_count,
        image_sample_interval=IMAGE_SAMPLE_INTERVAL,
    )


# --- Read-back endpoints for verification ---


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
