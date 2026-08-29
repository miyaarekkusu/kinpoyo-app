import { API_BASE_URL, ApiError, apiFetch } from './api';

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
  training_goal: string | null;
};

export type UserProfileUpdate = Partial<{
  display_name: string;
  avatar_url: string | null;
  bio: string;
  birth_date: string;
  gender_id: number;
  height_cm: number;
  weight_kg: number;
  body_fat_pct: number;
  muscle_mass_kg: number;
  experience_level_id: number;
  training_goal: string;
}>;

export function fetchMyProfile(token: string | null): Promise<UserProfileOut> {
  return apiFetch<UserProfileOut>('/users/me/profile', { token });
}

export function updateMyProfile(token: string | null, data: UserProfileUpdate): Promise<UserProfileOut> {
  return apiFetch<UserProfileOut>('/users/me/profile', { method: 'PUT', body: data, token });
}

// アバター画像はこのエンドポイントでアップロードすると同時にprofile.avatar_urlに
// 保存される（投稿画像と違い1枚だけなので、アップロードと確定を1回で済ませる）。
// apiFetchはJSON/urlencodedしか送れないため、multipartはここで直接fetchする。
export async function uploadAvatarImage(token: string | null, localUri: string): Promise<string> {
  const form = new FormData();
  const filename = localUri.split('/').pop() || 'avatar.jpg';
  const ext = (/\.(\w+)$/.exec(filename)?.[1] || 'jpg').toLowerCase();
  const type =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  form.append('image', { uri: localUri, name: filename, type } as unknown as Blob);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/users/me/avatar`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError(0, 'サーバーに接続できません');
  }

  if (!response.ok) {
    let detail = `画像のアップロードに失敗しました（${response.status}）`;
    try {
      const data = await response.json();
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      // JSONでなければデフォルトメッセージのまま
    }
    throw new ApiError(response.status, detail);
  }

  const data = await response.json();
  return data.avatar_url as string;
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

// 2026-08-30追加：フォロー機能拡充（他ユーザーのプロフィール表示画面・
// フォロワー/フォロー中一覧）。自分専用のUserProfileOut（身体情報等を含む）とは
// 別に、公開範囲だけに絞ったPublicProfileOutを新設。
export type PublicProfileOut = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_following: boolean;
  followers_count: number;
  following_count: number;
  total_workouts: number;
  total_duration_sec: number;
  weekly_streak: number;
};

export function fetchUserProfile(token: string | null, userId: number): Promise<PublicProfileOut> {
  return apiFetch<PublicProfileOut>(`/users/${userId}`, { token });
}

export function fetchFollowers(token: string | null, userId: number): Promise<UserSearchResult[]> {
  return apiFetch<UserSearchResult[]>(`/users/${userId}/followers`, { token });
}

export function fetchFollowing(token: string | null, userId: number): Promise<UserSearchResult[]> {
  return apiFetch<UserSearchResult[]>(`/users/${userId}/following`, { token });
}
