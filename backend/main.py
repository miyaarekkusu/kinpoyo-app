import base64
import json
import os
import uuid
from pathlib import Path

import cv2
import mediapipe as mp
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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


# --- Single-shot upload + range save (async job) ---


class SessionCreatedResponse(BaseModel):
    """Returned immediately after the upload is accepted. The MediaPipe run
    and per-frame INSERTs happen in a background task; clients should poll
    /sessions/{id}/progress to observe completion."""

    session_id: int
    fps: float
    total_frames: int
    start_frame: int
    end_frame: int
    total_frames_expected: int
    processing_status: str
    image_sample_interval: int


def _update_progress(session_id: int, processed: int) -> None:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE RecordingSession SET processed_frames = ? WHERE id = ?",
                (processed, session_id),
            )
            conn.commit()
    except Exception as exc:
        print(f"[progress] update failed for session {session_id}: {exc}")


def _mark_session_done(session_id: int, processed: int) -> None:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE RecordingSession
                SET processing_status = 'done', processed_frames = ?, processing_error = NULL
                WHERE id = ?
                """,
                (processed, session_id),
            )
            conn.commit()
    except Exception as exc:
        print(f"[done] update failed for session {session_id}: {exc}")


def _mark_session_error(session_id: int, message: str) -> None:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE RecordingSession
                SET processing_status = 'error', processing_error = ?
                WHERE id = ?
                """,
                (message[:500], session_id),
            )
            conn.commit()
    except Exception as exc:
        print(f"[error-mark] update failed for session {session_id}: {exc}")


def _process_session_job(
    session_id: int,
    tmp_path_str: str,
    start_frame: int,
    end_frame: int,
) -> None:
    """Background worker: run MediaPipe on the saved video, INSERT one frame
    at a time, and bump processed_frames every PROGRESS_BATCH frames so the
    client's progress bar advances smoothly."""
    PROGRESS_BATCH = 10
    tmp_path = Path(tmp_path_str)
    cap = None
    try:
        cap = cv2.VideoCapture(tmp_path_str)
        if not cap.isOpened():
            raise RuntimeError("cannot open buffered video")

        try:
            cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
        except Exception:
            pass

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        processed = 0
        with get_connection() as conn:
            cursor = conn.cursor()
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
                    processed += 1
                    frame_no += 1

                    if processed % PROGRESS_BATCH == 0:
                        conn.commit()
                        _update_progress(session_id, processed)
            conn.commit()
        _mark_session_done(session_id, processed)
    except Exception as exc:
        print(f"[process] session {session_id} failed: {exc}")
        _mark_session_error(session_id, str(exc))
    finally:
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


@app.post(
    "/sessions",
    response_model=SessionCreatedResponse,
    status_code=202,
)
async def create_session(
    background_tasks: BackgroundTasks,
    exercise_name: str = Form(...),
    video: UploadFile = File(...),
    start_time_sec: float = Form(...),
    end_time_sec: float = Form(...),
):
    """Accept the video + range, persist the row, and hand off the MediaPipe
    pass to a background task. The response returns as soon as the upload
    has been buffered and the session row exists, so the client can start
    polling /sessions/{id}/progress immediately."""
    if end_time_sec < start_time_sec:
        raise HTTPException(status_code=400, detail="end < start")

    suffix = Path(video.filename or "").suffix or ".mp4"
    tmp_path = UPLOAD_DIR / f"session_{uuid.uuid4().hex}{suffix}"

    with tmp_path.open("wb") as f:
        f.write(await video.read())

    cap = cv2.VideoCapture(str(tmp_path))
    if not cap.isOpened():
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Could not open uploaded video.")

    try:
        cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    except Exception:
        pass

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()

    if fps <= 0:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="invalid fps")

    start_frame = int(round(start_time_sec * fps))
    end_frame = int(round(end_time_sec * fps))
    total_frames_expected = max(0, end_frame - start_frame + 1)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO RecordingSession
                (exercise_name, fps, total_frames, start_frame, end_frame,
                 processing_status, processed_frames, total_frames_expected)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, 'processing', 0, ?)
            """,
            (
                exercise_name,
                fps,
                total_frames,
                start_frame,
                end_frame,
                total_frames_expected,
            ),
        )
        session_id = int(cursor.fetchone()[0])
        conn.commit()

    background_tasks.add_task(
        _process_session_job,
        session_id,
        str(tmp_path),
        start_frame,
        end_frame,
    )

    return SessionCreatedResponse(
        session_id=session_id,
        fps=fps,
        total_frames=total_frames,
        start_frame=start_frame,
        end_frame=end_frame,
        total_frames_expected=total_frames_expected,
        processing_status="processing",
        image_sample_interval=IMAGE_SAMPLE_INTERVAL,
    )


class SessionProgressResponse(BaseModel):
    session_id: int
    processing_status: str  # 'processing' | 'done' | 'error'
    processed_frames: int
    total_frames_expected: int | None
    processing_error: str | None


@app.get("/sessions/{session_id}/progress", response_model=SessionProgressResponse)
def get_session_progress(session_id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT processing_status, processed_frames, total_frames_expected,
                   processing_error, deleted
            FROM RecordingSession
            WHERE id = ?
            """,
            (session_id,),
        )
        row = cursor.fetchone()
    if row is None or bool(row[4]):
        raise HTTPException(status_code=404, detail="session not found")
    return SessionProgressResponse(
        session_id=session_id,
        processing_status=str(row[0]),
        processed_frames=int(row[1]),
        total_frames_expected=int(row[2]) if row[2] is not None else None,
        processing_error=row[3],
    )


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


_SORT_COLUMNS = {
    "id": "id",
    "exercise_name": "exercise_name",
    "recorded_at": "recorded_at",
    "total_frames": "total_frames",
}


@app.get("/sessions")
def list_sessions(
    search: str | None = None,
    used: str | None = None,  # "used" | "unused" | None
    sort: str = "id",
    order: str = "desc",
):
    """List sessions with optional filters used by the analyzer app."""
    sort_col = _SORT_COLUMNS.get(sort, "id")
    order_dir = "ASC" if order.lower() == "asc" else "DESC"

    where_parts: list[str] = ["s.deleted = 0", "s.processing_status = 'done'"]
    params: list = []
    if search:
        where_parts.append("LOWER(s.exercise_name) LIKE ?")
        params.append(f"%{search.lower()}%")
    if used == "used":
        where_parts.append(
            "EXISTS (SELECT 1 FROM AnalysisInputSession ais WHERE ais.session_id = s.id)"
        )
    elif used == "unused":
        where_parts.append(
            "NOT EXISTS (SELECT 1 FROM AnalysisInputSession ais WHERE ais.session_id = s.id)"
        )
    where_clause = "WHERE " + " AND ".join(where_parts)

    sql = f"""
        SELECT s.id, s.exercise_name, s.recorded_at, s.fps, s.total_frames,
               s.start_frame, s.end_frame,
               CASE WHEN EXISTS (
                   SELECT 1 FROM AnalysisInputSession ais WHERE ais.session_id = s.id
               ) THEN 1 ELSE 0 END AS used
        FROM RecordingSession s
        {where_clause}
        ORDER BY s.{sort_col} {order_dir}
    """

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
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
                "used": bool(r[7]),
            }
            for r in rows
        ]


def _ensure_session_alive(cursor, session_id: int) -> None:
    cursor.execute(
        "SELECT deleted FROM RecordingSession WHERE id = ?", (session_id,)
    )
    row = cursor.fetchone()
    if row is None or bool(row[0]):
        raise HTTPException(status_code=404, detail="session not found")


@app.get("/sessions/{session_id}/frames")
def list_session_frames(
    session_id: int,
    start: int = 0,
    limit: int | None = None,
):
    """Return frame_number + pose_landmarks for the requested chunk of a
    session (no image bytes). Pass start/limit to page through; omit limit
    to keep the legacy behavior of returning every frame at once.

    Response always includes the total frame count so the analyzer can drive
    a progress bar while it pulls successive chunks."""
    with get_connection() as conn:
        cursor = conn.cursor()
        _ensure_session_alive(cursor, session_id)

        cursor.execute(
            "SELECT COUNT(*) FROM FrameSample WHERE session_id = ?",
            (session_id,),
        )
        total = int(cursor.fetchone()[0])

        if limit is None:
            cursor.execute(
                """
                SELECT frame_number, pose_landmarks,
                       CASE WHEN image IS NULL THEN 0 ELSE 1 END AS has_image
                FROM FrameSample
                WHERE session_id = ?
                ORDER BY frame_number
                """,
                (session_id,),
            )
        else:
            safe_start = max(0, int(start))
            safe_limit = max(0, int(limit))
            cursor.execute(
                """
                SELECT frame_number, pose_landmarks,
                       CASE WHEN image IS NULL THEN 0 ELSE 1 END AS has_image
                FROM FrameSample
                WHERE session_id = ?
                ORDER BY frame_number
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                """,
                (session_id, safe_start, safe_limit),
            )

        frames = [
            {
                "frame_number": int(r[0]),
                "pose_landmarks": json.loads(r[1]) if r[1] else None,
                "has_image": bool(r[2]),
            }
            for r in cursor.fetchall()
        ]

    return {"total": total, "start": start, "frames": frames}


@app.get("/sessions/{session_id}/frame-image/{frame_number}")
def get_session_frame_image(session_id: int, frame_number: int):
    """Return the JPEG bytes for a single frame so the analyzer can lazy-load
    images while scrubbing."""
    with get_connection() as conn:
        cursor = conn.cursor()
        _ensure_session_alive(cursor, session_id)
        cursor.execute(
            """
            SELECT image FROM FrameSample
            WHERE session_id = ? AND frame_number = ?
            """,
            (session_id, frame_number),
        )
        row = cursor.fetchone()
    if row is None or row[0] is None:
        raise HTTPException(status_code=404, detail="frame image not found")
    return Response(content=bytes(row[0]), media_type="image/jpeg")


def _hard_delete_sessions(session_ids: list[int]) -> None:
    """Physically delete sessions and their FrameSample rows.

    Why: the user-facing DELETE returns 204 immediately after flipping the
    deleted flag; the actual VARBINARY purge happens here so the request
    isn't blocked on it."""
    if not session_ids:
        return
    placeholders = ",".join(["?"] * len(session_ids))
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"DELETE FROM FrameSample WHERE session_id IN ({placeholders})",
                tuple(session_ids),
            )
            cursor.execute(
                f"DELETE FROM RecordingSession WHERE id IN ({placeholders})",
                tuple(session_ids),
            )
            conn.commit()
    except Exception as exc:
        print(f"[hard-delete] failed for {session_ids}: {exc}")


@app.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, background_tasks: BackgroundTasks):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE RecordingSession SET deleted = 1 WHERE id = ? AND deleted = 0",
            (session_id,),
        )
        conn.commit()
    background_tasks.add_task(_hard_delete_sessions, [session_id])
    return None


class BulkDeleteRequest(BaseModel):
    ids: list[int]


@app.post("/sessions/bulk-delete")
def bulk_delete_sessions(body: BulkDeleteRequest, background_tasks: BackgroundTasks):
    if not body.ids:
        return {"deleted": 0}
    placeholders = ",".join(["?"] * len(body.ids))
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE RecordingSession SET deleted = 1 "
            f"WHERE id IN ({placeholders}) AND deleted = 0",
            tuple(body.ids),
        )
        deleted = cursor.rowcount
        conn.commit()
    background_tasks.add_task(_hard_delete_sessions, list(body.ids))
    return {"deleted": deleted}


# --- Tags ---


class TagCreateRequest(BaseModel):
    name: str
    description: str | None = None
    monitored_joints: list[str] | None = None


class TagUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    monitored_joints: list[str] | None = None


def _validate_monitored_joints(joints: list[str] | None) -> str | None:
    """Filter to canonical names, dedupe, store as JSON. None -> NULL."""
    from pose_analysis import JOINT_DEFINITIONS_JA

    if joints is None:
        return None
    valid = [n for n in JOINT_DEFINITIONS_JA if n in set(joints)]
    return json.dumps(valid, ensure_ascii=False)


def _parse_monitored_joints(raw: str | None) -> list[str]:
    """JSON column -> list. Bad/empty -> []."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
    except (ValueError, TypeError):
        pass
    return []


@app.get("/joints")
def list_joints():
    """Canonical joint names so the analyzer UI can render checkboxes without
    duplicating the list."""
    from pose_analysis import JOINT_DEFINITIONS_JA

    return list(JOINT_DEFINITIONS_JA.keys())


@app.get("/tags")
def list_tags():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT t.id, t.name, t.description, t.monitored_joints, t.created_at,
                   (SELECT COUNT(*) FROM AnalysisResult ar WHERE ar.tag_id = t.id) AS analysis_count,
                   (SELECT COUNT(DISTINCT ais.session_id)
                    FROM AnalysisResult ar
                    JOIN AnalysisInputSession ais ON ais.analysis_id = ar.id
                    WHERE ar.tag_id = t.id) AS session_count
            FROM Tag t
            ORDER BY t.name
            """
        )
        return [
            {
                "id": r[0],
                "name": r[1],
                "description": r[2],
                "monitored_joints": _parse_monitored_joints(r[3]),
                "created_at": r[4].isoformat() if r[4] else None,
                "analysis_count": r[5],
                "session_count": r[6],
            }
            for r in cursor.fetchall()
        ]


@app.get("/tags/{tag_id}")
def get_tag(tag_id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, description, monitored_joints FROM Tag WHERE id = ?",
            (tag_id,),
        )
        row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="tag not found")
    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "monitored_joints": _parse_monitored_joints(row[3]),
    }


@app.post("/tags", status_code=201)
def create_tag(body: TagCreateRequest):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    joints_json = _validate_monitored_joints(body.monitored_joints)
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO Tag (name, description, monitored_joints)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?)
                """,
                (name, body.description, joints_json),
            )
            tag_id = int(cursor.fetchone()[0])
            conn.commit()
        except Exception as exc:
            raise HTTPException(status_code=409, detail=f"tag exists: {exc}")
    return {
        "id": tag_id,
        "name": name,
        "description": body.description,
        "monitored_joints": _parse_monitored_joints(joints_json),
    }


@app.patch("/tags/{tag_id}")
def update_tag(tag_id: int, body: TagUpdateRequest):
    sets: list[str] = []
    params: list = []
    if body.name is not None:
        trimmed = body.name.strip()
        if not trimmed:
            raise HTTPException(status_code=400, detail="name cannot be empty")
        sets.append("name = ?")
        params.append(trimmed)
    if body.description is not None:
        sets.append("description = ?")
        params.append(body.description)
    if body.monitored_joints is not None:
        sets.append("monitored_joints = ?")
        params.append(_validate_monitored_joints(body.monitored_joints))
    if not sets:
        raise HTTPException(status_code=400, detail="nothing to update")

    params.append(tag_id)
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"UPDATE Tag SET {', '.join(sets)} WHERE id = ?", tuple(params)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="tag not found")
            conn.commit()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=409, detail=f"update failed: {exc}")
    return get_tag(tag_id)


@app.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Tag WHERE id = ?", (tag_id,))
        conn.commit()
    return None


# --- Analysis ---


class AnalyzeRequest(BaseModel):
    tag_id: int
    session_ids: list[int]


def _collect_session_ids_for_tag(cursor, tag_id: int) -> set[int]:
    cursor.execute(
        """
        SELECT DISTINCT ais.session_id
        FROM AnalysisResult ar
        JOIN AnalysisInputSession ais ON ais.analysis_id = ar.id
        WHERE ar.tag_id = ?
        """,
        (tag_id,),
    )
    return {int(r[0]) for r in cursor.fetchall()}


def _fetch_frames(cursor, session_ids: list[int]):
    if not session_ids:
        return
    placeholders = ",".join(["?"] * len(session_ids))
    cursor.execute(
        f"""
        SELECT session_id, frame_number, pose_landmarks
        FROM FrameSample
        WHERE session_id IN ({placeholders})
          AND pose_landmarks IS NOT NULL
        ORDER BY session_id, frame_number
        """,
        tuple(session_ids),
    )
    while True:
        row = cursor.fetchone()
        if row is None:
            break
        yield int(row[0]), int(row[1]), row[2]


@app.post("/analyses/preview")
def analyze_preview(body: AnalyzeRequest):
    """Combine the selected sessions with existing tag sessions and return
    a freshly computed analysis without persisting anything."""
    from pose_analysis import analyze_sessions  # local import for App Service cold path

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT monitored_joints FROM Tag WHERE id = ?", (body.tag_id,))
        tag_row = cursor.fetchone()
        if tag_row is None:
            raise HTTPException(status_code=404, detail="tag not found")
        monitored = _parse_monitored_joints(tag_row[0])

        existing = _collect_session_ids_for_tag(cursor, body.tag_id)
        combined = sorted(existing | set(body.session_ids))
        if not combined:
            return {
                "session_count": 0,
                "joints": {},
                "landmark_mean": [],
                "monitored_joints": monitored,
                "new_session_ids": [],
                "existing_session_ids": [],
            }

        new_ids = set(body.session_ids) - existing
        result = analyze_sessions(
            _fetch_frames(cursor, combined),
            new_session_ids=new_ids,
            existing_session_ids=existing,
            monitored_joints=monitored or None,
        )

    result["new_session_ids"] = sorted(new_ids)
    result["existing_session_ids"] = sorted(existing)
    result["monitored_joints"] = monitored
    return result


class AnalysisSaveRequest(BaseModel):
    tag_id: int
    session_ids: list[int]
    summary_json: str


@app.post("/analyses", status_code=201)
def save_analysis(body: AnalysisSaveRequest):
    """Persist an analysis result and link the input sessions so they show up
    as 'used' for future selections."""
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM Tag WHERE id = ?", (body.tag_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="tag not found")

        cursor.execute(
            """
            INSERT INTO AnalysisResult (tag_id, summary_json)
            OUTPUT INSERTED.id
            VALUES (?, ?)
            """,
            (body.tag_id, body.summary_json),
        )
        analysis_id = int(cursor.fetchone()[0])

        # Combine new + previously-used (so a saved analysis carries the full set).
        existing = _collect_session_ids_for_tag(cursor, body.tag_id)
        all_ids = sorted(existing | set(body.session_ids))
        for sid in all_ids:
            cursor.execute(
                """
                IF NOT EXISTS (
                    SELECT 1 FROM AnalysisInputSession
                    WHERE analysis_id = ? AND session_id = ?
                )
                INSERT INTO AnalysisInputSession (analysis_id, session_id)
                VALUES (?, ?)
                """,
                (analysis_id, sid, analysis_id, sid),
            )
        conn.commit()

    return {"id": analysis_id, "tag_id": body.tag_id, "session_count": len(all_ids)}


@app.get("/tags/{tag_id}/analyses")
def list_analyses_for_tag(tag_id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT ar.id, ar.created_at,
                   (SELECT COUNT(*) FROM AnalysisInputSession ais
                    WHERE ais.analysis_id = ar.id) AS session_count
            FROM AnalysisResult ar
            WHERE ar.tag_id = ?
            ORDER BY ar.id DESC
            """,
            (tag_id,),
        )
        return [
            {
                "id": r[0],
                "created_at": r[1].isoformat() if r[1] else None,
                "session_count": r[2],
            }
            for r in cursor.fetchall()
        ]


@app.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT ar.id, ar.tag_id, ar.summary_json, ar.created_at, t.name
            FROM AnalysisResult ar
            JOIN Tag t ON t.id = ar.tag_id
            WHERE ar.id = ?
            """,
            (analysis_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="analysis not found")
        return {
            "id": row[0],
            "tag_id": row[1],
            "summary_json": row[2],
            "created_at": row[3].isoformat() if row[3] else None,
            "tag_name": row[4],
        }
