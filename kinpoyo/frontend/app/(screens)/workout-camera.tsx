// AI回数カウント：筋トレ開始時に動画を録画し、終了後にbackend-coreへアップロードして
// まとめて解析する（バッチ処理）。model-studio（変更禁止）の POST /models/{id}/count と
// 同じ設計。判定（1レップ形状テンプレート照合）は全てbackend側（app/core/rep_model.py）
// で行うため、フロントは録画とアップロード、結果表示だけを担う。
//
// リアルタイム（WebSocket）版は2026-08-24に削除した（シャッター音・低フレーム
// レートでの精度に課題があり、根本解決にはカメラ処理の刷新が必要だったため。
// バックアップは _backup/realtime-ai-count-2026-08-24/ に保存済み。詳細はAGENTS.md参照）。
// 本バッチ版が引き続き唯一の本番導線。
//
// 2026-08-24：筋トレフロー刷新。1セット終わるごとに「セット保存→AIレビュー自動
// 生成→休憩（設定があればカウントダウン、無ければ手動再開）→次セット」という
// フローに変更。さらに同日、レビュー生成中の表示と休憩セクションを別画面に分けず、
// 結果画面（'result'状態）1枚に統合（上からAIトレーナーのメッセージボックス
// 〔レビュー生成中はこの中にスピナー〕→回数カウント結果→休憩セクションの順に
// 縦並び）。録画・アップロード・解析・レビュー生成が完全に終わった後
// （ready状態、またはresult状態でレビュー生成完了後）でのみ「停止」できる
// （AGENTS.md『筋トレフロー刷新』参照）。
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSize, FontWeight, Radius, Shadow, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { countRepsFromVideo, fetchRepModel, type CountRepsResult } from '@/services/exercises';
import {
  addSessionSet,
  fetchWorkout,
  generateAiReview,
  updateSessionSet,
  type RepCycleJson,
} from '@/services/workout';
import { TrainerAvatar } from '@/components/ui/trainer-avatar';

type ScreenState =
  | 'loading'
  | 'not-registered'
  | 'error'
  | 'ready'
  | 'recording'
  | 'uploading'
  | 'result';

export default function WorkoutCameraScreen() {
  const params = useLocalSearchParams<{
    exerciseId: string;
    exerciseName?: string;
    sessionId?: string;
    sessionExerciseId?: string;
  }>();
  const exerciseId = Number(params.exerciseId);
  const exerciseName = params.exerciseName ?? '種目';
  // セット保存・AIレビュー生成に必要（(tabs)/workout.tsxのhandleStartから渡される想定）。
  // 古い遷移経路（AI回数カウント対応前）から来た場合は未指定のことがあるため、
  // その場合は保存・レビュー導線をまるごとスキップする。
  const sessionId = params.sessionId !== undefined ? Number(params.sessionId) : NaN;
  const sessionExerciseId = params.sessionExerciseId !== undefined ? Number(params.sessionExerciseId) : NaN;
  const canSaveResult = Number.isFinite(sessionId) && Number.isFinite(sessionExerciseId);

  const { token } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [state, setState] = useState<ScreenState>('loading');
  const [facing, setFacing] = useState<CameraType>('front');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CountRepsResult | null>(null);
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // AIレビューを生成中かどうか（2026-08-24、'reviewing'画面を廃止し結果画面内の
  // メッセージボックスのスピナー表示に切り替えたため導入）。
  const [reviewLoading, setReviewLoading] = useState(false);
  const [stopModalVisible, setStopModalVisible] = useState(false);

  // 「次に録るべきセット」の判断用（AGENTS.md『新しいセットごとのフロー』参照）。
  const [targetSets, setTargetSets] = useState<number | null>(null);
  const [completedSetsCount, setCompletedSetsCount] = useState(0);
  // 今のセットが最後のセットかどうか（休憩useEffectより前に必要なため、
  // stateの直後で算出しておく）。
  const isLastSet = targetSets != null && completedSetsCount >= targetSets;
  // 今まさに入っている休憩の長さ（直前に終えたセットのrest_after_sec。
  // 2026-08-24、種目単位の一律restIntervalSecからセットごとのカスタム休憩へ移行）。
  const [currentRestSec, setCurrentRestSec] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);

  const cameraRef = useRef<CameraView>(null);
  const mountedRef = useRef(true);
  // 録画リトライ時、新しいセットを作らずこのセットを上書きするためのID。
  // nullなら次のuploadAndCountは新規セット作成、値があれば上書き（PUT）。
  // 休憩を経て次のセットに進む時、まだ未記録の計画済みセット（slotsRef内で
  // recorded=falseのもの）のIDへ差し替える（無ければnull＝新規作成）。
  const lastSetIdRef = useRef<number | null>(null);
  // 筋トレ登録画面で作られた「計画済みセット」の一覧（AI計測がまだ入っていない
  // 空のセット行も含む）。録画のたびに新しいセットを作るのではなく、まず未記録の
  // 計画済みセットを埋めていく（AGENTS.md『現状の問題（今回の発端）』の再発防止）。
  // restAfterSecはそのセットの後に取る休憩時間（登録画面でセットごとに設定）。
  const slotsRef = useRef<{ id: number; recorded: boolean; restAfterSec: number | null }[]>([]);

  useEffect(() => {
    (async () => {
      if (!Number.isFinite(exerciseId)) {
        setState('error');
        return;
      }
      try {
        const model = await fetchRepModel(exerciseId);
        if (!mountedRef.current) return;
        if (!model) {
          setState('not-registered');
          return;
        }
        if (canSaveResult && token) {
          try {
            const session = await fetchWorkout(token, sessionId);
            const se = session.exercises.find((e) => e.id === sessionExerciseId);
            if (se && mountedRef.current) {
              slotsRef.current = se.sets.map((s) => ({
                id: s.id,
                recorded: s.ai_counted_reps != null,
                // 個々のセットにrest_after_secが無ければ、種目単位の旧設定
                // （rest_interval_sec）にフォールバックする（後方互換）。
                restAfterSec: s.rest_after_sec ?? se.rest_interval_sec ?? null,
              }));
              const pending = slotsRef.current.find((s) => !s.recorded);
              lastSetIdRef.current = pending ? pending.id : null;
              setTargetSets(se.target_sets ?? (slotsRef.current.length || null));
              setCompletedSetsCount(slotsRef.current.filter((s) => s.recorded).length);
            }
          } catch (e) {
            console.log('[workout-camera] fetchWorkout（セット状況の取得）に失敗', e);
          }
        }
        if (mountedRef.current) setState('ready');
      } catch (e) {
        console.log('[workout-camera] fetchRepModel failed', e);
        if (mountedRef.current) setState('error');
      }
    })();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  // 休憩カウントダウン（結果画面内の休憩セクション。このセットにカスタム休憩が
  // 設定されている時のみ）。0になったら自動的に次のセットへ進む。
  useEffect(() => {
    if (state !== 'result' || isLastSet || currentRestSec == null) return;
    setRestRemaining(currentRestSec);
    const timer = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (mountedRef.current) advanceToNextSet();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state, currentRestSec, isLastSet]);

  const ensurePermissions = async (): Promise<boolean> => {
    let camGranted = cameraPermission?.granted ?? false;
    let micGranted = micPermission?.granted ?? false;
    if (!camGranted) {
      const res = await requestCameraPermission();
      camGranted = res.granted;
    }
    if (!mountedRef.current) return false;
    if (!micGranted) {
      const res = await requestMicPermission();
      micGranted = res.granted;
    }
    return mountedRef.current && camGranted && micGranted;
  };

  const handleStartRecording = async () => {
    setErrorMessage(null);
    const ok = await ensurePermissions();
    if (!mountedRef.current || !ok || !cameraRef.current) return;

    setState('recording');
    try {
      // stopRecording() が呼ばれるまで（終了ボタン押下まで）待つ。
      const video = await cameraRef.current.recordAsync({
        // iOSのみ有効。HEVC(hvc1)だとbackend-coreのOpenCVがデコードできないことが
        // あるためH.264(avc1)を明示的に指定する（model-studioでも同種の問題があった）。
        codec: 'avc1',
      });
      if (!mountedRef.current) return;
      if (!video?.uri) {
        setErrorMessage('録画に失敗しました');
        setState('ready');
        return;
      }
      console.log('[workout-camera] recorded video uri=', video.uri);
      await uploadAndCount(video.uri);
    } catch (e) {
      console.log('[workout-camera] recording failed', e);
      if (mountedRef.current) {
        setErrorMessage('録画に失敗しました');
        setState('ready');
      }
    }
  };

  const handleStopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  // 実装確認用：model-studioなど別の場所で使ったのと同じ動画ファイルを選んで
  // アップロードできるようにする（同一動画での結果比較のため）。
  const handlePickFromLibrary = async () => {
    setErrorMessage(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMessage('写真ライブラリへのアクセス許可が必要です');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    console.log('[workout-camera] picked video uri=', asset.uri, 'mimeType=', asset.mimeType);
    await uploadAndCount(asset.uri, asset.mimeType ?? undefined, asset.fileName ?? undefined);
  };

  const uploadAndCount = async (videoUri: string, mimeType?: string, fileName?: string) => {
    if (!token) return;
    setState('uploading');
    try {
      const res = await countRepsFromVideo(token, exerciseId, videoUri, mimeType, fileName);
      // 実装確認用：関節・回数の内訳をターミナルに出力（詳細な毎フレームのログは
      // backend-core側のターミナルに出る。ここでは最終結果とフォーム品質の内訳のみ）。
      console.log('[workout-camera] count-reps 結果:', JSON.stringify(res, null, 2));

      // 計測結果をセットとして保存（AIレビュー生成の元データになる）。
      // sessionId/sessionExerciseIdが無い古い遷移経路では保存をスキップする。
      // lastSetIdRefに値があれば「もう一度撮る」からのリトライ＝上書き（PUT）、
      // 無ければ新規セット作成（POST）。リトライで際限なくセットが増えるバグの修正
      // （AGENTS.md『現状の問題（今回の発端）』参照）。
      if (canSaveResult) {
        try {
          const fps = res.fps;
          const rep_cycles_json: RepCycleJson[] = res.cycles.map((c) => ({
            start: c.start,
            end: c.end,
            counted: c.counted,
            form_quality: c.form_quality,
            distance: c.distance,
            bottom_deg: c.bottom_deg,
            top_deg: c.top_deg,
            period_sec: fps && c.period != null ? c.period / fps : null,
          }));
          const setData = { ai_counted_reps: res.count, rep_cycles_json };
          if (lastSetIdRef.current != null) {
            // 計画済みセット（未記録）を埋める、またはリトライで同じセットを上書き。
            await updateSessionSet(token, sessionId, sessionExerciseId, lastSetIdRef.current, setData);
            const slot = slotsRef.current.find((s) => s.id === lastSetIdRef.current);
            if (slot && !slot.recorded) {
              slot.recorded = true;
              if (mountedRef.current) setCompletedSetsCount((prev) => prev + 1);
            }
            if (mountedRef.current) setCurrentRestSec(slot?.restAfterSec ?? null);
          } else {
            // 計画済みセットを使い切った（目標以上に録った）場合のみ新規作成。
            // カスタム休憩は未設定（登録時のプランに無いおまけセットのため）。
            const created = await addSessionSet(token, sessionId, sessionExerciseId, setData);
            lastSetIdRef.current = created.id;
            slotsRef.current.push({ id: created.id, recorded: true, restAfterSec: null });
            if (mountedRef.current) {
              setCompletedSetsCount((prev) => prev + 1);
              setCurrentRestSec(null);
            }
          }
        } catch (saveError) {
          console.log('[workout-camera] 計測結果のセット保存に失敗', saveError);
        }
      }

      if (!mountedRef.current) return;
      setResult(res);

      // AIレビュー自動生成（その種目でこれまでにやった全セットをまとめて評価。
      // 既存エンドポイントをそのまま流用。AGENTS.md『新しいセットごとのフロー』参照）。
      // 2026-08-24：結果画面への遷移をレビュー完了まで待たせず、非同期・非
      // ブロッキングで発火するように変更（結果画面内のメッセージボックスで
      // reviewLoadingを見てスピナー表示する）。
      if (canSaveResult) {
        setReviewText(null);
        setReviewError(null);
        setReviewLoading(true);
        generateAiReview(token, sessionId, sessionExerciseId)
          .then((review) => {
            if (mountedRef.current) setReviewText(review.feedback_text);
          })
          .catch((e) => {
            console.log('[workout-camera] AIレビュー生成に失敗', e);
            if (mountedRef.current) setReviewError('レビューの生成に失敗しました');
          })
          .finally(() => {
            if (mountedRef.current) setReviewLoading(false);
          });
      }
      if (mountedRef.current) setState('result');
    } catch (e) {
      console.log('[workout-camera] upload/count failed', e);
      if (mountedRef.current) {
        setErrorMessage(e instanceof Error ? e.message : 'アップロードに失敗しました');
        setState('ready');
      }
    }
  };

  const handleRetry = () => {
    // lastSetIdRefは維持（同じセットを上書きするため）。
    setResult(null);
    setReviewText(null);
    setReviewError(null);
    setErrorMessage(null);
    setState('ready');
  };

  // 次のセットへ＝まだ未記録の計画済みセットがあればそれを埋める対象にする
  // （無ければnull＝次は新規作成）。休憩カウントダウンが0になった時、または
  // 「次のセットへ」ボタン押下時に呼ばれる。
  const advanceToNextSet = () => {
    const pending = slotsRef.current.find((s) => !s.recorded);
    lastSetIdRef.current = pending ? pending.id : null;
    setResult(null);
    setReviewText(null);
    setReviewError(null);
    setCurrentRestSec(null);
    setState('ready');
  };

  const handleFinish = () => {
    router.back();
  };

  const handleStopConfirmed = () => {
    setStopModalVisible(false);
    router.back();
  };

  // 「停止」はセットの録画・アップロード・解析・レビュー生成が完全に終わった後
  // （ready状態、またはresult状態でレビュー生成が完了している）でのみ表示する
  // （2026-08-24追加指示。AGENTS.md参照）。
  const showStopButton = canSaveResult && (state === 'ready' || (state === 'result' && !reviewLoading));

  const stopModal = (
    <Modal
      visible={stopModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setStopModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalDialog}>
          <Text style={styles.modalTitle}>筋トレを停止しますか？</Text>
          <Text style={styles.modalBody}>
            ここまでの記録は保存されています。後でいつでも再開できます。
          </Text>
          <View style={styles.modalButtons}>
            <Pressable style={styles.modalCancelBtn} onPress={() => setStopModalVisible(false)}>
              <Text style={styles.modalCancelBtnText}>戻る</Text>
            </Pressable>
            <Pressable style={styles.modalConfirmBtn} onPress={handleStopConfirmed}>
              <Text style={styles.modalConfirmBtnText}>停止する</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </SafeAreaView>
    );
  }

  if (state === 'not-registered') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.noticeTitle}>まだ登録されていません</Text>
        <Text style={styles.noticeBody}>
          「{exerciseName}」のAI回数カウント設定はまだ登録されていません。
        </Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>戻る</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.noticeTitle}>読み込みに失敗しました</Text>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>戻る</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (state === 'uploading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
        <Text style={styles.noticeBody}>解析中...（動画の長さにより数秒〜数十秒かかります）</Text>
      </SafeAreaView>
    );
  }

  if (state === 'result' && result) {
    return (
      <SafeAreaView style={styles.resultSafe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.resultScrollContent}
          showsVerticalScrollIndicator={false}>
        <Text style={styles.noticeTitle}>{exerciseName}</Text>

        {canSaveResult && (
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <TrainerAvatar size={40} />
              <Text style={styles.aiCardTitle}>AIトレーナーからのレビュー</Text>
            </View>
            {reviewLoading ? (
              <View style={styles.reviewLoadingRow}>
                <ActivityIndicator color={Colors.primaryDark} />
                <Text style={styles.aiComment}>AIレビュー生成中...</Text>
              </View>
            ) : reviewError ? (
              <Text style={styles.reviewErrorText}>{reviewError}</Text>
            ) : (
              <Text style={styles.aiComment}>{reviewText}</Text>
            )}
          </View>
        )}

        <View style={styles.countCard}>
          <View style={styles.resultCountRow}>
            <Text style={styles.resultCount}>{result.count}</Text>
            <Text style={styles.resultUnit}>回</Text>
          </View>
          <Text style={styles.noticeBodySm}>
            関節: {result.joint ?? '-'} / ROM: {result.rom.toFixed(0)}°{'\n'}
            良いフォーム {result.good_form_count} ・ 改善余地あり {result.needs_improvement_count}
          </Text>
        </View>

        {canSaveResult && !isLastSet && (
          <View style={styles.restCard}>
            {currentRestSec != null ? (
              <>
                <Text style={styles.restCardLabel}>休憩</Text>
                <Text style={styles.restCount}>{restRemaining}<Text style={styles.restCountUnit}>秒</Text></Text>
                <Text style={styles.noticeBodySm}>後に自動的に次のセットへ進みます</Text>
              </>
            ) : (
              <>
                <Text style={styles.restCardLabel}>準備ができたら次のセットへ</Text>
                <Pressable style={styles.nextSetBtn} onPress={advanceToNextSet}>
                  <Text style={styles.nextSetBtnText}>次のセットへ</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <View style={styles.resultButtons}>
          <Pressable style={styles.secondaryBtn} onPress={handleRetry}>
            <Text style={styles.secondaryBtnText}>もう一度撮る</Text>
          </Pressable>
          {(!canSaveResult || isLastSet) && (
            <Pressable style={styles.closeBtn} onPress={handleFinish}>
              <Text style={styles.closeBtnText}>完了</Text>
            </Pressable>
          )}
        </View>

        {showStopButton && (
          <Pressable style={styles.stopTextBtn} onPress={() => setStopModalVisible(true)}>
            <Text style={styles.stopTextBtnText}>筋トレを停止する</Text>
          </Pressable>
        )}
        </ScrollView>

        {stopModal}
      </SafeAreaView>
    );
  }

  if (!cameraPermission?.granted || !micPermission?.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.noticeBody}>この機能にはカメラとマイクの権限が必要です</Text>
        <Pressable style={styles.closeBtn} onPress={ensurePermissions}>
          <Text style={styles.closeBtnText}>権限をリクエスト</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ready | recording
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="video" />
      <SafeAreaView style={styles.overlayTop} edges={['top']}>
        <View style={styles.overlayTopRow}>
          <Text style={styles.exerciseLabel}>{exerciseName}</Text>
          {state === 'ready' && (
            <View style={styles.overlayTopButtons}>
              {showStopButton && (
                <Pressable style={styles.stopBtn} onPress={() => setStopModalVisible(true)}>
                  <Text style={styles.stopBtnText}>停止</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.flipBtn}
                onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}>
                <Text style={styles.flipBtnText}>カメラ切替</Text>
              </Pressable>
            </View>
          )}
        </View>
        {errorMessage && <Text style={styles.errorLabel}>{errorMessage}</Text>}
      </SafeAreaView>
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {state === 'recording' ? (
          <Pressable style={[styles.recordBtn, styles.recordBtnActive]} onPress={handleStopRecording}>
            <Text style={styles.recordBtnText}>終了</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.recordBtn} onPress={handleStartRecording}>
              <Text style={styles.recordBtnText}>録画開始</Text>
            </Pressable>
            <Pressable style={styles.libraryBtn} onPress={handlePickFromLibrary}>
              <Text style={styles.libraryBtnText}>ライブラリから選ぶ（実装確認用）</Text>
            </Pressable>
          </>
        )}
      </SafeAreaView>
      {stopModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Space[3],
    backgroundColor: Colors.bgScreen,
    paddingHorizontal: Space[6],
  },
  resultSafe: { flex: 1, backgroundColor: Colors.bgScreen },
  resultScrollContent: {
    flexGrow: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: Space[4],
    paddingHorizontal: Space[5],
    paddingVertical: Space[5],
  },
  noticeTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  noticeBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  noticeBodySm: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  closeBtn: {
    marginTop: Space[2],
    paddingHorizontal: Space[6],
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  closeBtnText: { color: Colors.textOnPrimary, fontWeight: FontWeight.bold },
  secondaryBtn: {
    marginTop: Space[2],
    paddingHorizontal: Space[6],
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  resultButtons: { flexDirection: 'row', gap: Space[3] },
  aiCard: {
    width: '100%',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Space[2], marginBottom: Space[2] },
  aiCardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  aiComment: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.6 },
  reviewLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  reviewErrorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  countCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[5],
    paddingHorizontal: Space[4],
    alignItems: 'center',
    gap: Space[2],
    ...Shadow.sm,
  },
  resultCountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Space[1] },
  resultCount: { fontSize: 64, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  resultUnit: { fontSize: FontSize.lg, color: Colors.textSecondary, marginBottom: Space[2] },
  restCard: {
    width: '100%',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    paddingVertical: Space[5],
    paddingHorizontal: Space[4],
    alignItems: 'center',
    gap: Space[2],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  restCardLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  restCount: { fontSize: 64, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  restCountUnit: { fontSize: FontSize.lg, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  nextSetBtn: {
    marginTop: Space[1],
    paddingHorizontal: Space[6],
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  nextSetBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space[5],
    paddingTop: Space[3],
  },
  overlayTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  overlayTopButtons: { flexDirection: 'row', gap: Space[2] },
  exerciseLabel: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  errorLabel: { color: '#fca5a5', fontSize: FontSize.sm, marginTop: Space[2] },
  flipBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  flipBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  stopBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    backgroundColor: 'rgba(220,38,38,0.75)',
  },
  stopBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  stopTextBtn: { marginTop: Space[4], paddingVertical: Space[2] },
  stopTextBtnText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Space[5],
    paddingBottom: Space[4],
    alignItems: 'center',
  },
  recordBtn: {
    minWidth: 200,
    paddingVertical: Space[3],
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    ...Shadow.md,
  },
  recordBtnActive: {
    backgroundColor: '#F97316',
  },
  recordBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  libraryBtn: {
    marginTop: Space[2],
    paddingVertical: Space[2],
    alignItems: 'center',
  },
  libraryBtnText: { color: '#fff', fontSize: FontSize.xs, textDecorationLine: 'underline' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgOverlay,
    paddingHorizontal: Space[5],
  },
  modalDialog: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    width: '100%',
    padding: Space[5],
    gap: Space[2],
    ...Shadow.md,
  },
  modalTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Space[3],
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelBtnText: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
  },
  modalConfirmBtnText: { color: Colors.textOnPrimary, fontWeight: FontWeight.bold },
});
