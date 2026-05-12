import cv2
import mediapipe as mp

mp_pose = mp.solutions.pose


def extract_pose_per_frame(video_path: str):
    """
    Read a video frame-by-frame and run MediaPipe Pose on each frame.
    Returns (fps, frames) where frames is a list of dicts:
        { "frame_number": int, "landmarks": [{x,y,z,visibility}, ...] | None }
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    frames = []

    with mp_pose.Pose(static_image_mode=False, model_complexity=1) as pose:
        frame_number = 0
        while True:
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

            frames.append({"frame_number": frame_number, "landmarks": landmarks})
            frame_number += 1

    cap.release()
    return fps, frames


def read_frame_as_jpeg(video_path: str, frame_number: int) -> bytes:
    """Seek to a specific frame number and return it encoded as JPEG bytes."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    ok, frame_bgr = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"Failed to read frame {frame_number}")

    ok, buf = cv2.imencode(".jpg", frame_bgr)
    if not ok:
        raise RuntimeError("Failed to encode frame to JPEG")
    return buf.tobytes()
