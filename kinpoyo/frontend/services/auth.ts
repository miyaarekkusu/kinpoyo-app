import { apiFetch } from './api';

export type UserOut = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export type TokenOut = {
  access_token: string;
  token_type: string;
};

export function registerApi(username: string, email: string, password: string): Promise<UserOut> {
  return apiFetch<UserOut>('/auth/register', {
    method: 'POST',
    body: { username, email, password },
  });
}

export function loginApi(email: string, password: string): Promise<TokenOut> {
  // バックエンドは OAuth2PasswordRequestForm を使っているため、JSONではなく
  // application/x-www-form-urlencoded で username(=メール)/password を送る
  return apiFetch<TokenOut>('/auth/login', {
    method: 'POST',
    form: { username: email, password },
  });
}

export function fetchMe(token: string): Promise<UserOut> {
  return apiFetch<UserOut>('/auth/me', { token });
}
