import { API_URL } from '../constants/api';
import type { LocalSession } from './storage';

export type UploadResult = {
  remoteSessionId: number;
  poseCount: number;
  imageCount: number;
};

export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export type PreviewFrame = {
  frame_number: number;
  pose_landmarks: PoseLandmark[] | null;
  image_base64: string | null;
};

export type PreviewResult = {
  fps: number;
  total_frames_in_range: number;
  pose_count: number;
  image_count: number;
  image_sample_interval: number;
  frames: PreviewFrame[];
};

/**
 * Send the local video + selected range to the FastAPI /preview endpoint
 * and return the extracted pose data + sampled frame images.
 * This does not persist anything on the server.
 */
export async function fetchPreview(s: LocalSession): Promise<PreviewResult> {
  const form = new FormData();
  form.append('video', {
    uri: s.videoUri,
    name: `preview_${s.id}.mp4`,
    type: 'video/mp4',
  } as unknown as Blob);
  form.append('start_time_sec', String(s.startTimeSec));
  form.append('end_time_sec', String(s.endTimeSec));

  const res = await fetch(`${API_URL}/preview`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`preview failed: HTTP ${res.status}`);
  }
  return (await res.json()) as PreviewResult;
}

/**
 * Upload a saved local session to the FastAPI backend in a single request.
 * The server processes the video, persists pose + sampled images to the DB,
 * and discards the video file.
 */
export async function uploadSession(s: LocalSession): Promise<UploadResult> {
  const form = new FormData();
  form.append('exercise_name', s.exerciseName);
  form.append('video', {
    uri: s.videoUri,
    name: `recording_${s.id}.mp4`,
    type: 'video/mp4',
  } as unknown as Blob);
  form.append('start_time_sec', String(s.startTimeSec));
  form.append('end_time_sec', String(s.endTimeSec));

  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`upload failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    session_id: number;
    pose_count: number;
    image_count: number;
  };

  return {
    remoteSessionId: json.session_id,
    poseCount: json.pose_count,
    imageCount: json.image_count,
  };
}
