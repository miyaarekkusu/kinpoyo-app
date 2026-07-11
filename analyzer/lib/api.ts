import { API_URL } from '../constants/api';

export type SessionRow = {
  id: number;
  exercise_name: string;
  recorded_at: string | null;
  fps: number | null;
  total_frames: number | null;
  start_frame: number | null;
  end_frame: number | null;
  true_reps: number | null;
  used: boolean;
};

export type Tag = {
  id: number;
  name: string;
  description: string | null;
  monitored_joints: string[];
  created_at: string | null;
  analysis_count: number;
  session_count: number;
};

export type TagDetail = {
  id: number;
  name: string;
  description: string | null;
  monitored_joints: string[];
};

export type JointStats = {
  count: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
};

export type SeriesPoint = { frame: number; angle: number };
export type SessionSeries = { session_id: number; points: SeriesPoint[] };
export type CurvePoint = { t: number; angle: number; n: number };

export type JointResult = {
  stats: JointStats;
  series: SessionSeries[];
  curve_new?: CurvePoint[];
  curve_existing?: CurvePoint[];
};

export type LandmarkMean = {
  index: number;
  label: string;
  x: number;
  y: number;
  z: number;
};

export type AnalyzeResult = {
  session_count: number;
  session_ids: number[];
  frames_per_session: Record<string, number>;
  total_frames: number;
  joints: Record<string, JointResult>;
  landmark_mean: LandmarkMean[];
  new_session_ids: number[];
  existing_session_ids: number[];
  monitored_joints: string[];
};

// Rep-count models (state-machine calibration per label)
export type RepModelConfig = {
  smoothWindow: number;
  enterRatio: number;
  exitRatio: number;
  minPeriodFrames: number;
  minRomDeg: number;
  candidates: string[];
};

export type RepModelSummary = {
  id: number;
  tag_id: number;
  name: string;
  mae: number | null;
  exact_match_rate: number | null;
  session_count: number;
  created_at: string | null;
};

export type RepModelDetail = RepModelSummary & {
  config: RepModelConfig;
};

export type BuildModelResult = {
  id: number;
  tag_id: number;
  name: string;
  config: RepModelConfig;
  main_joint: string | null;
  cycle_count: number;
  mae: number | null;
  exact_match_rate: number | null;
  session_count: number;
};

/** 1レップの正規化標準カーブ（モデルが「これが1回の連続波形」と学習した形）。 */
export type RepTemplate = {
  bins: number;
  /** 各ビンの平均（振幅0..1）。 */
  mean: number[];
  /** 各ビンの標準偏差（許容ゆらぎ帯の幅）。 */
  std: number[];
};

/** 動画から切り出した1サイクルの検証内訳。 */
export type RepCycle = {
  /** サイクルの開始・完了フレーム（動画波形上の位置）。 */
  start: number;
  end: number;
  /** 1回として採用されたか。 */
  accepted: boolean;
  /** 棄却理由。ok=採用 / stats=角度・周期・ROM帯から外れた / shape=形が違う / short=短くて評価不能。 */
  reason: 'ok' | 'stats' | 'shape' | 'short';
  /** モデル標準カーブとの形状距離（小さいほど似ている）。テンプレ無し時は null。 */
  distance: number | null;
  /** このサイクルの振幅・時間正規化カーブ（モデル帯に重ねて描く）。 */
  vector: number[] | null;
  bottomDeg?: number;
  topDeg?: number;
  period?: number;
};

export type CountResult = {
  model_id: number;
  model_name: string;
  count: number;
  joint: string | null;
  rom: number;
  rep_frames: number[];
  segments: number;
  rejected: number;
  fps: number;
  pose_frames: number;
  /** カウントに使った主役関節の生波形（フレーム軸）。 */
  series: SeriesPoint[];
  /** 各候補サイクルの採用/棄却の内訳。 */
  cycles: RepCycle[];
  /** モデルが学習した1レップ標準カーブ。未学習なら null。 */
  template: RepTemplate | null;
  /** 形状距離のしきい値（これ以下なら形が合致とみなす）。 */
  shape_threshold: number;
};

async function jsonFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${path} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Tags
export const listTags = () => jsonFetch<Tag[]>('/tags');
export const getTag = (id: number) => jsonFetch<TagDetail>(`/tags/${id}`);
export const createTag = (
  name: string,
  description?: string,
  monitoredJoints?: string[],
) =>
  jsonFetch<TagDetail>('/tags', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      monitored_joints: monitoredJoints,
    }),
  });
export const updateTag = (
  id: number,
  patch: { name?: string; description?: string | null; monitored_joints?: string[] },
) =>
  jsonFetch<TagDetail>(`/tags/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
export const deleteTag = (id: number) =>
  jsonFetch<void>(`/tags/${id}`, { method: 'DELETE' });

export const listJoints = () => jsonFetch<string[]>('/joints');

// Sessions
export type SessionFilter = {
  search?: string;
  used?: 'used' | 'unused';
  sort?: 'id' | 'exercise_name' | 'recorded_at' | 'total_frames';
  order?: 'asc' | 'desc';
};

export function listSessions(filter: SessionFilter = {}): Promise<SessionRow[]> {
  const params = new URLSearchParams();
  if (filter.search) params.set('search', filter.search);
  if (filter.used) params.set('used', filter.used);
  if (filter.sort) params.set('sort', filter.sort);
  if (filter.order) params.set('order', filter.order);
  const qs = params.toString();
  return jsonFetch<SessionRow[]>(`/sessions${qs ? `?${qs}` : ''}`);
}

export const deleteSession = (id: number) =>
  jsonFetch<void>(`/sessions/${id}`, { method: 'DELETE' });

/** 正解回数(true_reps)を登録/更新。null で未設定に戻す。 */
export const updateSessionTrueReps = (id: number, trueReps: number | null) =>
  jsonFetch<{ id: number; true_reps: number | null }>(`/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ true_reps: trueReps }),
  });

export const bulkDeleteSessions = (ids: number[]) =>
  jsonFetch<{ deleted: number }>('/sessions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });

// Analysis
export const previewAnalysis = (tagId: number, sessionIds: number[]) =>
  jsonFetch<AnalyzeResult>('/analyses/preview', {
    method: 'POST',
    body: JSON.stringify({ tag_id: tagId, session_ids: sessionIds }),
  });

export const saveAnalysis = (
  tagId: number,
  sessionIds: number[],
  summary: AnalyzeResult,
) =>
  jsonFetch<{ id: number; tag_id: number; session_count: number }>('/analyses', {
    method: 'POST',
    body: JSON.stringify({
      tag_id: tagId,
      session_ids: sessionIds,
      summary_json: JSON.stringify(summary),
    }),
  });

export const listAnalysesForTag = (tagId: number) =>
  jsonFetch<{ id: number; created_at: string; session_count: number }[]>(
    `/tags/${tagId}/analyses`,
  );

// Frame-by-frame review
export type SessionFrameRow = {
  frame_number: number;
  pose_landmarks: { x: number; y: number; z: number; visibility?: number }[] | null;
  has_image: boolean;
};

export type SessionFramesPage = {
  total: number;
  start: number;
  frames: SessionFrameRow[];
};

export const listSessionFramesPage = (
  sessionId: number,
  start: number,
  limit: number,
) =>
  jsonFetch<SessionFramesPage>(
    `/sessions/${sessionId}/frames?start=${start}&limit=${limit}`,
  );

export type FetchAllSessionFramesOptions = {
  chunkSize?: number;
  onProgress?: (received: number, total: number) => void;
  signal?: AbortSignal;
};

/** Fetch every frame for a session in chunks so the UI can render a
 * progress bar and the JSON payload doesn't arrive as one giant blob. */
export async function fetchAllSessionFrames(
  sessionId: number,
  opts: FetchAllSessionFramesOptions = {},
): Promise<SessionFrameRow[]> {
  const chunkSize = opts.chunkSize ?? 100;
  const all: SessionFrameRow[] = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    if (opts.signal?.aborted) throw new Error('aborted');
    const page = await listSessionFramesPage(sessionId, start, chunkSize);
    total = page.total;
    all.push(...page.frames);
    start += page.frames.length;
    opts.onProgress?.(all.length, total);
    if (page.frames.length === 0) break;
  }
  return all;
}

export const frameImageUrl = (sessionId: number, frameNumber: number) =>
  `${API_URL}/sessions/${sessionId}/frame-image/${frameNumber}`;

// Rep-count models
/** タグの正解回数つきデータからmodelを較正（学習）してDB保存。model名=タグ名。 */
export const buildModel = (tagId: number) =>
  jsonFetch<BuildModelResult>(`/tags/${tagId}/build-model`, { method: 'POST' });

export const listModels = () => jsonFetch<RepModelSummary[]>('/models');
export const getModel = (id: number) =>
  jsonFetch<RepModelDetail>(`/models/${id}`);
export const deleteModel = (id: number) =>
  jsonFetch<void>(`/models/${id}`, { method: 'DELETE' });

/** 動画をアップロードし、選択したmodelで回数をカウント（チェッカー用）。 */
export async function countWithModel(
  modelId: number,
  videoUri: string,
  startTimeSec: number,
  endTimeSec: number,
): Promise<CountResult> {
  const form = new FormData();
  form.append('video', {
    uri: videoUri,
    name: `check_${modelId}.mp4`,
    type: 'video/mp4',
  } as unknown as Blob);
  form.append('start_time_sec', String(startTimeSec));
  form.append('end_time_sec', String(endTimeSec));

  const res = await fetch(`${API_URL}/models/${modelId}/count`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as CountResult;
}
