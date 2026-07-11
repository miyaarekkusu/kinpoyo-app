import Constants from 'expo-constants';

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:8000`;

  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

// トークン付きリクエストが401（期限切れ・無効）になった時にAuthProviderへ通知するためのフック。
// api.ts はReactの外にあるモジュールなので、use-auth.tsx側でこの関数にsignOut相当の処理を登録する。
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  form?: Record<string, string>;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token, form } = options;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let requestBody: string | undefined;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    requestBody = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: requestBody,
    });
  } catch {
    throw new ApiError(0, 'サーバーに接続できません');
  }

  if (!response.ok) {
    let detail = `リクエストに失敗しました（${response.status}）`;
    try {
      const data = await response.json();
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      // レスポンスがJSONでない場合はデフォルトメッセージのまま
    }
    // token付きで呼んだのに401＝トークン期限切れ/無効。ログイン自体の401（token無し）と区別する
    if (response.status === 401 && token) {
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}
