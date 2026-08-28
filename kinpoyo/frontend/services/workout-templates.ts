// 「My筋トレ」：よく行う筋トレメニューを保存し、カレンダーからワンタップで
// その日に登録できるようにする機能（2026-08-25追加）。既存のProgram/UserProgram
// とは無関係の独立した仕組み（AGENTS.md『My筋トレ』参照）。
import { apiFetch } from './api';

export type WorkoutTemplateSetInput = {
  weight_kg?: number;
  reps?: number;
  rest_after_sec?: number;
};
export type WorkoutTemplateExerciseInput = {
  exercise_id: number;
  order_index?: number;
  sets: WorkoutTemplateSetInput[];
};
export type WorkoutTemplateCreateInput = {
  name: string;
  exercises: WorkoutTemplateExerciseInput[];
};

export type WorkoutTemplateSetOut = {
  id: number;
  set_number: number;
  weight_kg: string | number | null;
  reps: number | null;
  rest_after_sec: number | null;
};
export type WorkoutTemplateExerciseOut = {
  id: number;
  exercise_id: number;
  exercise_name: string;
  order_index: number;
  sets: WorkoutTemplateSetOut[];
};
export type WorkoutTemplateOut = {
  id: number;
  name: string;
  created_at: string;
  exercises: WorkoutTemplateExerciseOut[];
};
export type WorkoutTemplateListItem = {
  id: number;
  name: string;
  created_at: string;
  exercise_count: number;
};

export function createWorkoutTemplate(
  token: string | null,
  data: WorkoutTemplateCreateInput,
): Promise<WorkoutTemplateOut> {
  return apiFetch<WorkoutTemplateOut>('/workout-templates', { method: 'POST', token, body: data });
}

export function fetchWorkoutTemplates(token: string | null): Promise<WorkoutTemplateListItem[]> {
  return apiFetch<WorkoutTemplateListItem[]>('/workout-templates', { token });
}

export function fetchWorkoutTemplate(token: string | null, templateId: number): Promise<WorkoutTemplateOut> {
  return apiFetch<WorkoutTemplateOut>(`/workout-templates/${templateId}`, { token });
}

export function updateWorkoutTemplate(
  token: string | null,
  templateId: number,
  data: WorkoutTemplateCreateInput,
): Promise<WorkoutTemplateOut> {
  return apiFetch<WorkoutTemplateOut>(`/workout-templates/${templateId}`, { method: 'PUT', token, body: data });
}

export function deleteWorkoutTemplate(token: string | null, templateId: number): Promise<void> {
  return apiFetch<void>(`/workout-templates/${templateId}`, { method: 'DELETE', token });
}

// テンプレートの内容で、指定日に新しい筋トレセッションを作成する。
export function applyWorkoutTemplate(
  token: string | null,
  templateId: number,
  scheduledDate: string,
): Promise<{ id: number }> {
  return apiFetch<{ id: number }>(`/workout-templates/${templateId}/apply`, {
    method: 'POST',
    token,
    body: { scheduled_date: scheduledDate },
  });
}
