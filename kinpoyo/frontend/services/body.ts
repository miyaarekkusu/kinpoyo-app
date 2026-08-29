import { apiFetch } from './api';

export type WeightGoalOut = {
  id: number;
  target_value: number | string;
  current_value: number | string | null;
  deadline: string | null;
  is_achieved: boolean;
};

export type WeightGoalUpdate = {
  target_value: number;
  deadline?: string;
};

export function fetchMyWeightGoal(token: string | null): Promise<WeightGoalOut | null> {
  return apiFetch<WeightGoalOut | null>('/users/me/weight-goal', { token });
}

export function updateMyWeightGoal(token: string | null, data: WeightGoalUpdate): Promise<WeightGoalOut> {
  return apiFetch<WeightGoalOut>('/users/me/weight-goal', { method: 'PUT', body: data, token });
}
