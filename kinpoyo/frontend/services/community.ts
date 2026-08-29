import { API_BASE_URL, ApiError, apiFetch } from './api';

export type FeedScope = 'all' | 'following';

export type PostAuthor = {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

// 2026-08-30再設計：コミュニティー投稿は「その日の完了済みトレーニング記録」に
// 限定した（自由なQ&A/フィード投稿は廃止。AGENTS.md『コミュニティー再設計』参照）。
export type PostWorkoutExercise = {
  exercise_name: string;
  sets_count: number;
  total_reps: number;
  max_weight_kg: number | null;
};

export type PostWorkoutSummary = {
  scheduled_date: string | null;
  duration_sec: number | null;
  total_volume: number | null;
  exercises: PostWorkoutExercise[];
};

export type PostOut = {
  id: number;
  author: PostAuthor;
  title: string | null;
  body: string;
  image_urls: string[];
  workout_session_id: number | null;
  workout_summary: PostWorkoutSummary | null;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  created_at: string;
  updated_at: string;
};

// 投稿作成時に選ぶ「今日の投稿可能なトレーニング記録」一覧用。
export type PostableSessionExercise = {
  exercise_name: string;
  sets_count: number;
};
export type PostableSessionOut = {
  id: number;
  scheduled_date: string | null;
  duration_sec: number | null;
  total_volume: number | null;
  exercises: PostableSessionExercise[];
};

export type PostCreateInput = {
  workout_session_id: number;
  body?: string;
  image_urls?: string[];
};

export type PostUpdateInput = Partial<{
  body: string;
  image_urls: string[];
}>;

export type CommentOut = {
  id: number;
  post_id: number;
  author: PostAuthor;
  parent_id: number | null;
  body: string;
  likes_count: number;
  created_at: string;
};

export function fetchPosts(token: string | null, scope: FeedScope = 'all'): Promise<PostOut[]> {
  return apiFetch<PostOut[]>(`/posts?scope=${scope}`, { token });
}

export function fetchPostableSessions(token: string | null): Promise<PostableSessionOut[]> {
  return apiFetch<PostableSessionOut[]>('/posts/postable-sessions', { token });
}

export function createPost(token: string | null, data: PostCreateInput): Promise<PostOut> {
  return apiFetch<PostOut>('/posts', { method: 'POST', token, body: data });
}

export function updatePost(
  token: string | null,
  postId: number,
  data: PostUpdateInput,
): Promise<PostOut> {
  return apiFetch<PostOut>(`/posts/${postId}`, { method: 'PUT', token, body: data });
}

export function deletePost(token: string | null, postId: number): Promise<void> {
  return apiFetch<void>(`/posts/${postId}`, { method: 'DELETE', token });
}

export function likePost(token: string | null, postId: number): Promise<PostOut> {
  return apiFetch<PostOut>(`/posts/${postId}/likes`, { method: 'POST', token });
}

export function unlikePost(token: string | null, postId: number): Promise<PostOut> {
  return apiFetch<PostOut>(`/posts/${postId}/likes`, { method: 'DELETE', token });
}

export function fetchComments(token: string | null, postId: number): Promise<CommentOut[]> {
  return apiFetch<CommentOut[]>(`/posts/${postId}/comments`, { token });
}

export function addComment(
  token: string | null,
  postId: number,
  body: string,
  parentId?: number,
): Promise<CommentOut> {
  return apiFetch<CommentOut>(`/posts/${postId}/comments`, {
    method: 'POST',
    token,
    body: { body, parent_id: parentId ?? null },
  });
}

// 画像は先にこのエンドポイントでアップロードし、返ってきた相対URLをPostCreate/
// PostUpdateのimage_urlsに渡す（apiFetchはJSON/urlencodedしか送れないため、
// multipartはここで直接fetchする）。
export async function uploadPostImages(token: string | null, localUris: string[]): Promise<string[]> {
  if (localUris.length === 0) return [];

  const form = new FormData();
  localUris.forEach((uri, i) => {
    const filename = uri.split('/').pop() || `image_${i}.jpg`;
    const ext = (/\.(\w+)$/.exec(filename)?.[1] || 'jpg').toLowerCase();
    const type =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    // React NativeのFormDataは{uri, name, type}形式のオブジェクトをファイルとして扱う
    form.append('images', { uri, name: filename, type } as unknown as Blob);
  });

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/posts/images`, { method: 'POST', headers, body: form });
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
  return data.urls as string[];
}
