import { API_BASE_URL, apiFetch, ApiError } from './api';

export type Movement = 'push' | 'pull' | 'legs';
export type ExerciseOut = {
  id: number;
  name: string;
  movement: Movement;
  muscle: string;
  muscle_color: string | null;
  /** AI回数カウント用の較正済みモデル（rep_count_models）が紐づいているか。 */
  has_rep_model: boolean;
};

/**
 * 種目一覧。
 *
 * aiReadyOnly=true で、AI回数カウント用の較正済みモデルが紐づいている種目だけに
 * 絞る。種目ピッカーはこれを使う——紐づいていない種目を選べてしまうと、その種目
 * ではAI回数カウントが働かないため。
 *
 * 逆に、既に記録済みの筋トレを表示する用途（ホーム画面のID→種目名の解決など）は
 * 絞ってはいけない。過去に登録した種目が表示できなくなる。
 */
export function fetchExercises(aiReadyOnly = false): Promise<ExerciseOut[]> {
  return apiFetch<ExerciseOut[]>(`/exercises${aiReadyOnly ? '?ai_ready=true' : ''}`);
}

// AI回数カウント：model-studioで較正された設定（rep_count_models）。
// 判定（ヒステリシス閾値・1レップ形状テンプレート照合・統計ゲート）は全て
// backend側（app/core/rep_model.py）で行うため、フロントはconfigの中身を
// 直接使わない。ここでは「較正済みモデルが登録されているか」の存在チェックだけに使う。
export type RepCountModelOut = {
  exercise_id: number;
  config: Record<string, unknown>;
  mae: number | null;
  exact_match_rate: number | null;
  session_count: number | null;
};

/** 種目に較正済みモデルが無ければ null を返す（バックエンドは404）。 */
export async function fetchRepModel(exerciseId: number): Promise<RepCountModelOut | null> {
  try {
    return await apiFetch<RepCountModelOut>(`/exercises/${exerciseId}/rep-model`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// AI回数カウント：録画済み動画をアップロードしてまとめて解析する（バッチ処理）。
// model-studioの POST /models/{id}/count と同じ設計。判定内訳（cycles）は
// 実装確認・デバッグ用。
// 2026-08-24変更：「カウント」と「フォーム評価」を分離。測定可能なレップは
// 全てcounted=trueでカウントし、form_qualityで品質をラベル付けするのみ
// （カウントの可否には影響しない）。counted=falseは測定不能（短すぎる）な場合のみ。
export type RepCycle = {
  start: number;
  end: number;
  counted: boolean;
  form_quality: 'good' | 'needs_improvement' | null;
  distance: number | null;
  bottom_deg: number | null;
  top_deg: number | null;
  period: number | null;
};
export type CountRepsResult = {
  exercise_id: number;
  joint: string | null;
  count: number;
  rom: number;
  good_form_count: number;
  needs_improvement_count: number;
  segments: number;
  total_frames: number;
  pose_frames: number;
  fps: number;
  cycles: RepCycle[];
};

export async function countRepsFromVideo(
  token: string,
  exerciseId: number,
  videoUri: string,
  mimeType = 'video/mp4',
  fileName = 'workout.mp4',
): Promise<CountRepsResult> {
  const formData = new FormData();
  // React Native の fetch は {uri, name, type} 形式のオブジェクトをファイルとして
  // multipart/form-data に含めてくれる（Web標準のFile/Blobではない点に注意）。
  // ライブラリから選んだ動画はmov等mp4以外のこともあるため、呼び出し側から
  // 実際のmimeType/ファイル名を渡せるようにしている。
  formData.append('video', {
    uri: videoUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/exercises/${exerciseId}/count-reps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
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
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<CountRepsResult>;
}
