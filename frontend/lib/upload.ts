import { API_URL } from '../constants/api';

export type UploadInput = {
  id: string;
  exerciseName: string;
  videoUri: string;
  startTimeSec: number;
  endTimeSec: number;
};

export type UploadResult = {
  remoteSessionId: number;
  poseCount: number;
  imageCount: number;
};

export async function uploadSession(s: UploadInput): Promise<UploadResult> {
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
