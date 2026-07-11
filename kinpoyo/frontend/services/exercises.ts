import { apiFetch } from './api';

export type Movement = 'push' | 'pull' | 'legs';
export type ExerciseOut = {
  id: number;
  name: string;
  movement: Movement;
  muscle: string;
  muscle_color: string | null;
};

export function fetchExercises(): Promise<ExerciseOut[]> {
  return apiFetch<ExerciseOut[]>('/exercises');
}
