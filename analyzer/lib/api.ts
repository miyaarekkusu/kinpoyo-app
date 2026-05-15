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
  created_at: string | null;
  analysis_count: number;
  session_count: number;
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

export type JointResult = {
  stats: JointStats;
  series: SessionSeries[];
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
export const createTag = (name: string, description?: string) =>
  jsonFetch<{ id: number; name: string; description: string | null }>('/tags', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
export const deleteTag = (id: number) =>
  jsonFetch<void>(`/tags/${id}`, { method: 'DELETE' });

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
