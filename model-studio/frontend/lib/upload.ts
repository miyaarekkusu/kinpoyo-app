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
  processedFrames: number;
  totalFramesExpected: number;
};

export type UploadProgress = {
  phase: 'uploading' | 'processing';
  processed: number;
  total: number;
};

export type UploadOptions = {
  onProgress?: (p: UploadProgress) => void;
  pollIntervalMs?: number;
  signal?: AbortSignal;
};

type SessionCreatedResponse = {
  session_id: number;
  fps: number;
  total_frames: number;
  start_frame: number;
  end_frame: number;
  total_frames_expected: number;
  processing_status: string;
  image_sample_interval: number;
};

type SessionProgressResponse = {
  session_id: number;
  processing_status: 'processing' | 'done' | 'error';
  processed_frames: number;
  total_frames_expected: number | null;
  processing_error: string | null;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const MIME_BY_EXT: Record<string, string> = {
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mp4: 'video/mp4',
};

// フォトライブラリから選んだ動画は .mov のこともある。バックエンドは送られた
// ファイル名の拡張子で一時ファイルを作るので、実体と合う拡張子を送る。
function videoPart(uri: string, id: string) {
  const ext = (uri.split('.').pop() ?? 'mp4').toLowerCase();
  const safeExt = ext in MIME_BY_EXT ? ext : 'mp4';
  return {
    uri,
    name: `recording_${id}.${safeExt}`,
    type: MIME_BY_EXT[safeExt],
  };
}

export async function uploadSession(
  s: UploadInput,
  opts: UploadOptions = {},
): Promise<UploadResult> {
  const form = new FormData();
  form.append('exercise_name', s.exerciseName);
  form.append('video', videoPart(s.videoUri, s.id) as unknown as Blob);
  form.append('start_time_sec', String(s.startTimeSec));
  form.append('end_time_sec', String(s.endTimeSec));

  opts.onProgress?.({ phase: 'uploading', processed: 0, total: 1 });

  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    body: form,
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`upload failed: HTTP ${res.status}`);
  }
  const created = (await res.json()) as SessionCreatedResponse;

  const total = created.total_frames_expected;
  opts.onProgress?.({ phase: 'processing', processed: 0, total });

  const intervalMs = opts.pollIntervalMs ?? 800;
  // Poll /progress until the background MediaPipe job reports done/error.
  while (true) {
    if (opts.signal?.aborted) throw new Error('aborted');
    await sleep(intervalMs);
    const pr = await fetch(
      `${API_URL}/sessions/${created.session_id}/progress`,
      { signal: opts.signal },
    );
    if (!pr.ok) {
      throw new Error(`progress poll failed: HTTP ${pr.status}`);
    }
    const progress = (await pr.json()) as SessionProgressResponse;
    const processed = progress.processed_frames;
    const reportedTotal = progress.total_frames_expected ?? total;
    opts.onProgress?.({
      phase: 'processing',
      processed,
      total: reportedTotal,
    });
    if (progress.processing_status === 'done') {
      return {
        remoteSessionId: created.session_id,
        processedFrames: processed,
        totalFramesExpected: reportedTotal,
      };
    }
    if (progress.processing_status === 'error') {
      throw new Error(progress.processing_error ?? 'processing failed');
    }
  }
}
