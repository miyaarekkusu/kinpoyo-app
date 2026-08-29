// オンボーディング画面（性別・身長・体重・体重目標・生まれ年・筋トレ目標）の
// 入力値を、画面をまたいで保持し、完了時にまとめてバックエンドへ保存するための
// Context。以前は各画面がローカルstateのみを持ち、次の画面に遷移すると値が
// 消えていた（=登録した内容がどこにも保存されない）バグの修正として追加
// （2026-08-30）。AuthProviderと同じ階層（root _layout.tsx）でラップし、
// (onboarding)グループと(auth)/success.tsxの両方から参照できるようにしている。
import React, { createContext, useContext, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { updateMyWeightGoal } from '@/services/body';
import { updateMyProfile } from '@/services/user';

export type OnboardingGender = 'male' | 'female' | 'other';
export type OnboardingTrainingGoal = 'lose' | 'gain' | 'maintain';

// scripts/seed_masters.pyのGenderシード値と対応（id=1男性/2女性/3その他）
const GENDER_ID: Record<OnboardingGender, number> = { male: 1, female: 2, other: 3 };

type OnboardingData = {
  gender: OnboardingGender | null;
  heightCm: number | null;
  weightKg: number | null;
  weightGoalKg: number | null;
  birthYear: number | null;
  trainingGoal: OnboardingTrainingGoal | null;
};

type OnboardingContextValue = OnboardingData & {
  setGender: (value: OnboardingGender) => void;
  setHeightCm: (value: number) => void;
  setWeightKg: (value: number) => void;
  setWeightGoalKg: (value: number) => void;
  setBirthYear: (value: number) => void;
  setTrainingGoal: (value: OnboardingTrainingGoal) => void;
  submit: () => Promise<void>;
};

const initialData: OnboardingData = {
  gender: null,
  heightCm: null,
  weightKg: null,
  weightGoalKg: null,
  birthYear: null,
  trainingGoal: null,
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [data, setData] = useState<OnboardingData>(initialData);

  const submit = async () => {
    await updateMyProfile(token, {
      ...(data.gender ? { gender_id: GENDER_ID[data.gender] } : {}),
      ...(data.heightCm != null ? { height_cm: data.heightCm } : {}),
      ...(data.weightKg != null ? { weight_kg: data.weightKg } : {}),
      ...(data.birthYear != null ? { birth_date: `${data.birthYear}-01-01` } : {}),
      ...(data.trainingGoal ? { training_goal: data.trainingGoal } : {}),
    });
    if (data.weightGoalKg != null) {
      await updateMyWeightGoal(token, { target_value: data.weightGoalKg });
    }
    setData(initialData);
  };

  return (
    <OnboardingContext.Provider
      value={{
        ...data,
        setGender: value => setData(prev => ({ ...prev, gender: value })),
        setHeightCm: value => setData(prev => ({ ...prev, heightCm: value })),
        setWeightKg: value => setData(prev => ({ ...prev, weightKg: value })),
        setWeightGoalKg: value => setData(prev => ({ ...prev, weightGoalKg: value })),
        setBirthYear: value => setData(prev => ({ ...prev, birthYear: value })),
        setTrainingGoal: value => setData(prev => ({ ...prev, trainingGoal: value })),
        submit,
      }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
