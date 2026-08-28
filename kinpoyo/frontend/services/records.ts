import { apiFetch } from './api';

export type PeriodKey = 'week' | 'month' | 'year';
export type HistoryPeriodKey = 'all' | 'month' | 'week';

export type VolumeSummaryPoint = {
  period_start: string; // ISO date (YYYY-MM-DD)
  volume: string | number;
  session_count: number;
};
export type VolumeSummaryOut = {
  period: PeriodKey;
  points: VolumeSummaryPoint[];
  total_volume: string | number;
  total_sessions: number;
};

export type MaxWeightPoint = {
  session_date: string; // ISO date
  max_weight_kg: string | number;
};
export type MaxWeightOut = {
  exercise_id: number;
  exercise_name: string;
  points: MaxWeightPoint[];
};

export type HistoryExerciseSummary = {
  exercise_id: number;
  exercise_name: string;
  muscle_group_id: number;
  muscle_group_name: string;
  muscle_group_color: string | null;
  sets_count: number;
  max_weight_kg: string | number | null;
};
export type HistoryItem = {
  session_id: number;
  scheduled_date: string | null; // ISO date
  title: string | null;
  duration_sec: number | null;
  exercises: HistoryExerciseSummary[];
};

export type AchievementsOut = {
  total_volume: string | number;
  total_workouts: number;
  total_duration_sec: number;
  weekly_streak: number;
};

export function fetchVolumeSummary(token: string | null, period: PeriodKey): Promise<VolumeSummaryOut> {
  return apiFetch<VolumeSummaryOut>(`/records/summary?period=${period}`, { token });
}

// プロフィール画面の「実績」セクション用（総ボリューム・合計ワークアウト数・
// トレーニング時間・週間ストリーク、いずれも全期間累計）。
export function fetchAchievements(token: string | null): Promise<AchievementsOut> {
  return apiFetch<AchievementsOut>('/records/achievements', { token });
}

export function fetchMaxWeight(token: string | null, exerciseId: number): Promise<MaxWeightOut> {
  return apiFetch<MaxWeightOut>(`/records/max-weight?exercise_id=${exerciseId}`, { token });
}

// muscle_group_idはbackend側では単一値のみ対応（複数部位の絞り込みUIはフロント側で
// 全件取得してからクライアントサイドでフィルタする。records.tsx参照）。
export function fetchHistory(token: string | null, period: HistoryPeriodKey = 'all'): Promise<HistoryItem[]> {
  return apiFetch<HistoryItem[]>(`/records/history?period=${period}`, { token });
}

// ── BIG3の合計(1RM)（プロフィール画面。2026-08-25追加）───────────
export type Big3ExerciseOut = {
  exercise_id: number;
  exercise_name: string;
  best_1rm_kg: string | number | null;
  source: 'workout' | 'manual' | null;
};
export type Big3Out = {
  squat: Big3ExerciseOut;
  bench: Big3ExerciseOut;
  deadlift: Big3ExerciseOut;
  total_kg: string | number | null;
};
export type ExerciseMaxOut = {
  id: number;
  exercise_id: number;
  weight_kg: string | number;
  recorded_at: string; // ISO date
};

export function fetchBig3(token: string | null): Promise<Big3Out> {
  return apiFetch<Big3Out>('/records/big3', { token });
}

// 1RM（自己ベスト重量）の手入力登録。recorded_atを省略すると今日の日付になる。
export function registerExerciseMax(
  token: string | null,
  exerciseId: number,
  weightKg: number,
  recordedAt?: string,
): Promise<ExerciseMaxOut> {
  return apiFetch<ExerciseMaxOut>('/records/exercise-max', {
    method: 'POST',
    token,
    body: { exercise_id: exerciseId, weight_kg: weightKg, recorded_at: recordedAt },
  });
}
