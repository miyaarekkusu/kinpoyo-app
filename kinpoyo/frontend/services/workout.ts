import { apiFetch } from './api';

export type SessionSetCreate = {
  set_number?: number;
  weight_kg?: number;
  reps?: number;
  rpe?: number;
  duration_sec?: number;
  is_warmup?: boolean;
};
export type SessionSetOut = {
  id: number; set_number: number; weight_kg: string | number | null; reps: number | null;
  rpe: string | number | null; duration_sec: number | null; is_warmup: boolean;
  ai_counted_reps: number | null; completed_at: string | null;
};
export type SessionExerciseCreate = {
  exercise_id: number; order_index?: number; target_sets?: number;
  rest_interval_sec?: number; memo?: string; sets: SessionSetCreate[];
};
export type SessionExerciseOut = {
  id: number; exercise_id: number; exercise_name: string; order_index: number;
  target_sets: number | null; rest_interval_sec: number | null; memo: string | null;
  sets: SessionSetOut[];
};
export type WorkoutSessionCreate = {
  scheduled_date: string; title?: string; memo?: string; exercises: SessionExerciseCreate[];
};
export type WorkoutSessionOut = {
  id: number; status_id: number;
  status_code: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  title: string | null; memo: string | null; scheduled_date: string | null;
  started_at: string | null; ended_at: string | null; duration_sec: number | null;
  total_volume: string | number | null; exercises: SessionExerciseOut[];
};

export function createWorkout(token: string | null, data: WorkoutSessionCreate): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>('/workouts', { method: 'POST', body: data, token });
}
export function fetchWorkoutsByDate(token: string | null, isoDate: string): Promise<WorkoutSessionOut[]> {
  return apiFetch<WorkoutSessionOut[]>(`/workouts?date=${isoDate}`, { token });
}
export async function fetchWorkoutsForDates(
  token: string | null,
  isoDates: string[],
): Promise<Record<string, WorkoutSessionOut[]>> {
  const results = await Promise.all(isoDates.map(d => fetchWorkoutsByDate(token, d)));
  const map: Record<string, WorkoutSessionOut[]> = {};
  isoDates.forEach((d, i) => { map[d] = results[i]; });
  return map;
}
export function startWorkout(token: string | null, id: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${id}/start`, { method: 'POST', token });
}
export function endWorkout(token: string | null, id: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${id}/end`, { method: 'POST', token });
}
export function fetchWorkout(token: string | null, id: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${id}`, { token });
}
export function cancelWorkout(token: string | null, id: number): Promise<void> {
  return apiFetch<void>(`/workouts/${id}`, { method: 'DELETE', token });
}
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
