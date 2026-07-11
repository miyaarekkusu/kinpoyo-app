import React, { createContext, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';

import { setUnauthorizedHandler } from '@/services/api';
import { fetchMe, loginApi, registerApi } from '@/services/auth';
import { deleteToken, getToken, setToken } from '@/services/token-storage';

const TOKEN_KEY = 'kinpoyo_access_token';

type AuthContextValue = {
  isLoggedIn: boolean;
  isRestoring: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const storedToken = await getToken(TOKEN_KEY);
      if (storedToken) {
        try {
          await fetchMe(storedToken);
          setTokenState(storedToken);
          setIsLoggedIn(true);
        } catch {
          await deleteToken(TOKEN_KEY);
        }
      }
      setIsRestoring(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { access_token } = await loginApi(email, password);
    await setToken(TOKEN_KEY, access_token);
    setTokenState(access_token);
    setIsLoggedIn(true);
  };

  const register = async (username: string, email: string, password: string) => {
    await registerApi(username, email, password);
    const { access_token } = await loginApi(email, password);
    await setToken(TOKEN_KEY, access_token);
    setTokenState(access_token);
    // オンボーディングが残っているため isLoggedIn はまだ true にしない
  };

  const completeOnboarding = () => {
    setIsLoggedIn(true);
  };

  const signOut = async () => {
    await deleteToken(TOKEN_KEY);
    setTokenState(null);
    setIsLoggedIn(false);
    // Stack.Protected のガード切替だけだと、切替前にいた画面名に応じてExpo Routerが
    // 意図しない画面（(auth)グループ内の別ルート）に着地することがあるため明示的に遷移する
    router.replace('/login');
  };

  useEffect(() => {
    // トークン付きAPI呼び出しがどこかで401（期限切れ・無効）になったら自動的にサインアウトし、
    // Stack.Protected の isLoggedIn ガードによりログイン画面へ戻す
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isRestoring, token, login, register, completeOnboarding, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
