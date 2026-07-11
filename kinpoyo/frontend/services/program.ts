import { apiFetch } from './api';

export type ProgramOut = {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  difficulty_level_id: number | null;
  difficulty_name: string | null;
  duration_weeks: number | null;
  frequency_per_week: number | null;
  thumbnail_url: string | null;
  is_public: boolean;
};

export type UserProgramOut = {
  id: number;
  program_id: number;
  program_name: string;
  status_id: number;
  status_code: 'active' | 'paused' | 'completed' | 'dropped';
  current_week: number;
  current_day: number;
  started_at: string;
  completed_at: string | null;
};

export type ProgramExerciseOut = {
  id: number;
  exercise_id: number;
  exercise_name: string;
  week_number: number;
  day_number: number;
  order_index: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_interval_sec: number | null;
  note: string | null;
};

export function fetchPrograms(): Promise<ProgramOut[]> {
  return apiFetch<ProgramOut[]>('/programs');
}

export function fetchMyPrograms(token: string | null): Promise<UserProgramOut[]> {
  return apiFetch<UserProgramOut[]>('/user-programs/me', { token });
}

export function fetchProgramExercises(
  programId: number,
  week: number,
  day: number
): Promise<ProgramExerciseOut[]> {
  return apiFetch<ProgramExerciseOut[]>(`/programs/${programId}/exercises?week=${week}&day=${day}`);
}

export function advanceProgram(token: string | null, userProgramId: number): Promise<UserProgramOut> {
  return apiFetch<UserProgramOut>(`/user-programs/${userProgramId}/advance`, { method: 'POST', token });
}

export function joinProgram(token: string | null, programId: number): Promise<UserProgramOut> {
  return apiFetch<UserProgramOut>(`/programs/${programId}/join`, { method: 'POST', token });
}

export function leaveProgram(token: string | null, userProgramId: number): Promise<UserProgramOut> {
  return apiFetch<UserProgramOut>(`/user-programs/${userProgramId}/leave`, { method: 'POST', token });
}

export type ProgramExerciseCreate = {
  exercise_id: number;
  sets: number;
  reps_min?: number;
  reps_max?: number;
  note?: string;
};

export type ProgramCreateInput = {
  name: string;
  description?: string;
  exercises: ProgramExerciseCreate[];
};

export function createProgram(token: string | null, data: ProgramCreateInput): Promise<ProgramOut> {
  return apiFetch<ProgramOut>('/programs', { method: 'POST', token, body: data });
}

export function fetchMyCreatedPrograms(token: string | null): Promise<ProgramOut[]> {
  return apiFetch<ProgramOut[]>('/programs/mine', { token });
}
