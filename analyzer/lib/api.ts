import { API_URL } from '../constants/api';

export type SessionRow = {
  id: number;
  exercise_name: string;
  recorded_at: string | null;
  fps: number | null;
  total_frames: number | null;
  start_frame: number | null;
  end_frame: number | null;
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
