import { apiFetch } from './api';

// AI回数カウント：1レップサイクルの判定内訳（デバッグ・レビュー生成用）。
// period_secはcount-repsレスポンスのcycles[].period（フレーム数）をfpsで割って
// 秒に変換したもの（呼び出し側で変換すること）。
// 2026-08-24変更：「カウント」と「フォーム評価」を分離。counted=falseは
// 測定不能（短すぎる）な場合のみで、フォーム品質はcounted=trueのレップにのみ
// form_qualityで付与される。
export type RepCycleJson = {
  start: number;
  end: number;
  counted: boolean;
  form_quality: 'good' | 'needs_improvement' | null;
  distance: number | null;
  bottom_deg: number | null;
  top_deg: number | null;
  period_sec: number | null;
};
export type SessionSetCreate = {
  set_number?: number;
  weight_kg?: number;
  reps?: number;
  rpe?: number;
  duration_sec?: number;
  is_warmup?: boolean;
  ai_counted_reps?: number;
  rep_cycles_json?: RepCycleJson[];
  // このセットの後に取る休憩時間(秒)。2026-08-24、セットごとにカスタムな休憩を
  // 挟められるようにするためsession_exercises.rest_interval_secから移行。
  rest_after_sec?: number;
};
// リトライ時に新しいセットを作らず上書きするための部分更新（未指定フィールドは変更しない）。
export type SessionSetUpdate = Partial<SessionSetCreate>;
export type SessionSetOut = {
  id: number; set_number: number; weight_kg: string | number | null; reps: number | null;
  rpe: string | number | null; duration_sec: number | null; is_warmup: boolean;
  ai_counted_reps: number | null; rest_after_sec: number | null; completed_at: string | null;
};
export type SessionExerciseCreate = {
  exercise_id: number; order_index?: number; target_sets?: number;
  rest_interval_sec?: number; memo?: string; sets: SessionSetCreate[];
};
export type SessionExerciseOut = {
  id: number; exercise_id: number; exercise_name: string; order_index: number;
  target_sets: number | null; rest_interval_sec: number | null; memo: string | null;
  sets: SessionSetOut[];
};
export type WorkoutSessionCreate = {
  scheduled_date: string; title?: string; memo?: string; exercises: SessionExerciseCreate[];
};
export type WorkoutSessionOut = {
  id: number; status_id: number;
  status_code: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  title: string | null; memo: string | null; scheduled_date: string | null;
  started_at: string | null; ended_at: string | null; duration_sec: number | null;
  total_volume: string | number | null; exercises: SessionExerciseOut[];
};

export function createWorkout(token: string | null, data: WorkoutSessionCreate): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>('/workouts', { method: 'POST', body: data, token });
}
export function fetchWorkoutsByDate(token: string | null, isoDate: string): Promise<WorkoutSessionOut[]> {
  return apiFetch<WorkoutSessionOut[]>(`/workouts?date=${isoDate}`, { token });
}
export async function fetchWorkoutsForDates(
  token: string | null,
  isoDates: string[],
): Promise<Record<string, WorkoutSessionOut[]>> {
  const results = await Promise.all(isoDates.map(d => fetchWorkoutsByDate(token, d)));
  const map: Record<string, WorkoutSessionOut[]> = {};
  isoDates.forEach((d, i) => { map[d] = results[i]; });
  return map;
}
export function startWorkout(token: string | null, id: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${id}/start`, { method: 'POST', token });
}
export function endWorkout(token: string | null, id: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${id}/end`, { method: 'POST', token });
}
export function fetchWorkout(token: string | null, id: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${id}`, { token });
}
// セッション内の特定の種目（session_exercise）に1セットを追加する。
// AI回数カウント（workout-camera.tsx）から、計測結果を`ai_counted_reps`/`rep_cycles_json`
// として保存する用途で使う。
export function addSessionSet(
  token: string | null,
  sessionId: number,
  sessionExerciseId: number,
  data: SessionSetCreate,
): Promise<SessionSetOut> {
  return apiFetch<SessionSetOut>(`/workouts/${sessionId}/exercises/${sessionExerciseId}/sets`, {
    method: 'POST',
    body: data,
    token,
  });
}

// AIレビュー：保存済みの計測データ（rep_cycles_json等）をもとに、AIトレーナーの
// フォームレビューをbackend側（DeepSeek API連携）で生成する。リクエストボディなし。
export type AiReviewOut = {
  id: number;
  session_exercise_id: number;
  model_version: string;
  feedback_text: string;
  matched_part_codes_json: string[] | null;
  generated_at: string;
};
export function generateAiReview(
  token: string | null,
  sessionId: number,
  sessionExerciseId: number,
): Promise<AiReviewOut> {
  return apiFetch<AiReviewOut>(
    `/workouts/${sessionId}/exercises/${sessionExerciseId}/generate-review`,
    { method: 'POST', token },
  );
}
export function cancelWorkout(token: string | null, id: number): Promise<void> {
  return apiFetch<void>(`/workouts/${id}`, { method: 'DELETE', token });
}
// 録画リトライ時、直前に作ったセットを上書きするための更新（AGENTS.md『現状の
// 問題（今回の発端）』参照：以前はリトライのたびにセットが際限なく増えていた）。
export function updateSessionSet(
  token: string | null,
  sessionId: number,
  sessionExerciseId: number,
  setId: number,
  data: SessionSetUpdate,
): Promise<SessionSetOut> {
  return apiFetch<SessionSetOut>(
    `/workouts/${sessionId}/exercises/${sessionExerciseId}/sets/${setId}`,
    { method: 'PUT', body: data, token },
  );
}

// 筋トレレポート：セッション全体（複数種目）の実績サマリー＋AIレビュー。
// 「筋トレを終了する」ボタン押下→endWorkout成功後に自動で呼ぶ想定。
export type WorkoutSessionReportOut = {
  id: number;
  workout_session_id: number;
  feedback_text: string;
  matched_part_codes_json: string[] | null;
  planned_vs_actual_json: {
    exercises: {
      exercise_id: number;
      exercise_name: string;
      target_sets: number | null;
      actual_sets: number;
      achievement_pct: number | null;
      avg_weight_kg: number | null;
      avg_reps: number | null;
      avg_rpe: number | null;
      prev_avg_weight_kg: number | null;
      prev_avg_reps: number | null;
      prev_avg_rpe: number | null;
      weight_change_pct: number | null;
      // 2026-08-25追加：自己ベスト推定1RMからの予測RPEと実測との差、停滞判定。
      // AIレビューmatched_part_codes_json経由でフィードバック文には反映されるが、
      // 専用UIはまだ無い（フロントは今のところ表示していない）。
      predicted_rpe: number | null;
      rpe_deviation: number | null;
      is_plateaued: boolean;
    }[];
    overall_achievement_pct: number | null;
    has_comparison: boolean;
  } | null;
  compared_session_id: number | null;
  model_version: string;
  generated_at: string;
};
// 計測を途中で中断したときに「予定済み」へ戻す（＝最初からやり直せる状態）。
// キャンセル（メニューごと取り消し）とも終了とも違う。計測結果もクリアされる。
export function abortWorkout(token: string | null, sessionId: number): Promise<WorkoutSessionOut> {
  return apiFetch<WorkoutSessionOut>(`/workouts/${sessionId}/abort`, { method: 'POST', token });
}
export function generateWorkoutReport(token: string | null, sessionId: number): Promise<WorkoutSessionReportOut> {
  return apiFetch<WorkoutSessionReportOut>(`/workouts/${sessionId}/generate-report`, {
    method: 'POST',
    token,
  });
}
// 過去に生成済みのレポートを取得する（再生成はしない）。記録タブの筋トレ履歴から
// タップして見る用途。生成前（通常は無いはずだが念のため）は404になる。
export function fetchWorkoutReport(token: string | null, sessionId: number): Promise<WorkoutSessionReportOut> {
  return apiFetch<WorkoutSessionReportOut>(`/workouts/${sessionId}/report`, { token });
}
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
