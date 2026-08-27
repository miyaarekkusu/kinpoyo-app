import { apiFetch } from './api';

export type UserProfileOut = {
  id: number;
  user_id: number;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null; // ISO date
  gender_id: number | null;
  height_cm: number | string | null;
  weight_kg: number | string | null;
  body_fat_pct: number | string | null;
  muscle_mass_kg: number | string | null;
  experience_level_id: number;
};

export type UserProfileUpdate = Partial<{
  display_name: string;
  avatar_url: string;
  bio: string;
  birth_date: string;
  gender_id: number;
  height_cm: number;
  weight_kg: number;
  body_fat_pct: number;
  muscle_mass_kg: number;
  experience_level_id: number;
}>;

export function fetchMyProfile(token: string | null): Promise<UserProfileOut> {
  return apiFetch<UserProfileOut>('/users/me/profile', { token });
}

export function updateMyProfile(token: string | null, data: UserProfileUpdate): Promise<UserProfileOut> {
  return apiFetch<UserProfileOut>('/users/me/profile', { method: 'PUT', body: data, token });
}

export type UserSearchResult = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
};

export function searchUsers(token: string | null, q: string): Promise<UserSearchResult[]> {
  return apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`, { token });
}

export function followUser(token: string | null, userId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}/follow`, { method: 'POST', token });
}

export function unfollowUser(token: string | null, userId: number): Promise<void> {
  return apiFetch<void>(`/users/${userId}/follow`, { method: 'DELETE', token });
}
