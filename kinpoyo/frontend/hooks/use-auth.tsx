import React, { createContext, useContext, useEffect, useState } from 'react';

import { fetchMe, loginApi, registerApi } from '@/services/auth';
import { deleteToken, getToken, setToken } from '@/services/token-storage';

const TOKEN_KEY = 'kinpoyo_access_token';

type AuthContextValue = {
  isLoggedIn: boolean;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken(TOKEN_KEY);
      if (token) {
        try {
          await fetchMe(token);
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
    setIsLoggedIn(true);
  };

  const register = async (username: string, email: string, password: string) => {
    await registerApi(username, email, password);
    const { access_token } = await loginApi(email, password);
    await setToken(TOKEN_KEY, access_token);
    // オンボーディングが残っているため isLoggedIn はまだ true にしない
  };

  const completeOnboarding = () => {
    setIsLoggedIn(true);
  };

  const signOut = async () => {
    await deleteToken(TOKEN_KEY);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isRestoring, login, register, completeOnboarding, signOut }}>
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
