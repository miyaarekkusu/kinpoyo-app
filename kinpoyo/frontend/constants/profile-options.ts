// profile-edit.tsx（編集用）とprofile.tsx（表示用）で共用する選択肢マスタ
// （2026-08-30：プロフィール画面にも表示するようになったため重複定義をやめ共通化）。

// scripts/seed_masters.pyのGenderシード値と対応
export const GENDER_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: '男性' },
  { id: 2, label: '女性' },
  { id: 3, label: 'その他' },
];

export const TRAINING_GOAL_OPTIONS: { key: string; label: string }[] = [
  { key: 'lose', label: '痩せたい' },
  { key: 'gain', label: '筋肉を増やしたい' },
  { key: 'maintain', label: '体型を維持したい' },
];
