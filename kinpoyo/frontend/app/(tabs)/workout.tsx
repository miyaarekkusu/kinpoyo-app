import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { NotificationsModal } from '@/components/notifications-modal';
import { AppHeader, PageTitleBar } from '@/components/ui/app-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  Colors,
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Shadow,
  Space,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import { fetchRepModel } from '@/services/exercises';
import {
  SessionExerciseOut,
  WorkoutSessionOut,
  abortWorkout,
  endWorkout,
  fetchWorkoutsByDate,
  generateWorkoutReport,
  startWorkout,
  toIsoDate,
} from '@/services/workout';
import { formatDecimal } from '@/utils/format';

// AI回数カウント：今日の種目の中で、model-studioで較正済みの設定（rep_count_models）が
// 登録されているものを先頭から探す。無ければ null（＝カメラ計測はまだ使えない）。
async function findAiReadyExercise(
  exercises: SessionExerciseOut[]
): Promise<SessionExerciseOut | null> {
  for (const ex of exercises) {
    const model = await fetchRepModel(ex.exercise_id);
    if (model) return ex;
  }
  return null;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export default function WorkoutScreen() {
  const { token } = useAuth();
  const today = useMemo(() => new Date(), []);
  const dow = WEEKDAYS[today.getDay()];
  const dateLabel = `${today.getMonth() + 1}月${today.getDate()}日（${dow}）`;

  // ── 今日のセッション取得 ──────────────────────
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [todaySessions, setTodaySessions] = useState<WorkoutSessionOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const sessions = await fetchWorkoutsByDate(token, toIsoDate(today));
      // 取り消し済みだけ除く。完了済みは**残す**——1日1メニュー制にしたので、
      // その日が終わっていることを画面で示し、リザルトへ導く必要がある
      // （2026-08-28。以前は完了済みも除いていたため、終了後に画面がまっさらに
      // 戻って同じ日にもう一度登録できてしまっていた）。
      setTodaySessions(sessions.filter(s => s.status_code !== 'cancelled'));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [token, today]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [loadToday])
  );

  const todayExercises = useMemo(
    () => todaySessions.flatMap(s => s.exercises),
    [todaySessions]
  );

  const handleGoToRegister = () => {
    router.push('/workout-register');
  };

  const hasWorkout = todayExercises.length > 0;
  const activeSession = todaySessions[0] ?? null;
  // 1日1メニュー制。その日のセッションが完了していたら、新しく登録も開始もさせず
  // リザルトだけを見せる（同じ日に2回やるユースケースは想定していない）。
  const todayCompleted = activeSession?.status_code === 'completed';

  // ── 「筋トレを終了する」ボタンは全セット終わってから ─────
  // AI回数カウント対応種目（AIレビュー用のcalibrated modelがある種目）は
  // target_sets分のai_counted_reps記録が全て埋まって初めて「完了」とみなす。
  // 対応外の種目（AI計測の仕組みがそもそも無い）は判定対象外＝常に完了扱い。
  const [workoutAllDone, setWorkoutAllDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeSession || activeSession.status_code !== 'in_progress') {
        setWorkoutAllDone(false);
        return;
      }
      try {
        const uniqueIds = Array.from(new Set(activeSession.exercises.map(e => e.exercise_id)));
        const models = await Promise.all(uniqueIds.map(id => fetchRepModel(id)));
        const aiReadyIds = new Set(uniqueIds.filter((_, i) => models[i] != null));
        const allDone = activeSession.exercises.every(ex => {
          if (!aiReadyIds.has(ex.exercise_id)) return true;
          const target = ex.target_sets ?? ex.sets.length;
          const recorded = ex.sets.filter(s => s.ai_counted_reps != null).length;
          return target > 0 ? recorded >= target : true;
        });
        if (!cancelled) setWorkoutAllDone(allDone);
      } catch (e) {
        console.log('[workout] 完了判定チェックに失敗', e);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSession]);

  const handleEditMenu = () => {
    if (!activeSession) return;
    router.push({
      pathname: '/(screens)/program/program_choice',
      params: {
        mode: 'edit',
        sessionId: String(activeSession.id),
        title: dateLabel,
      },
    });
  };

  // ── 開始/終了ライフサイクル ────────────────────
  const [isLifecycleBusy, setIsLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const goToAiExerciseOrNotice = async (session: WorkoutSessionOut) => {
    // AI回数カウント：較正済みの種目があればカメラ計測画面へ、無ければ未登録の旨を表示。
    // このチェックが失敗しても「開始」自体は成功しているので、別のtry/catchで囲み
    // lifecycleErrorを上書きしないようにする。
    try {
      const aiExercise = await findAiReadyExercise(session.exercises);
      if (aiExercise) {
        // 計測画面がセッションを読んで、較正済み種目を**全て**順に回す。
        // 以前は最初の1種目だけを渡していたが、2種目目以降が計測されない制約に
        // なっていた（AGENTS.md の既知制約）。渡すのは sessionId だけでよい。
        router.push({
          pathname: '/(screens)/workout-camera-live',
          params: { sessionId: String(session.id) },
        });
      } else {
        setAiNotice('AI回数カウントに対応した種目はまだ登録されていません');
      }
    } catch (e) {
      console.log('[workout] AI回数カウント対応種目のチェックに失敗', e);
    }
  };

  const handleStart = async () => {
    if (!activeSession) return;
    setLifecycleError(null);
    setAiNotice(null);
    setIsLifecycleBusy(true);
    try {
      // 既にin_progress（「停止」からの再開）の場合はstartWorkoutを呼ばず、
      // そのままカメラ画面へ再突入する（AGENTS.md『「停止」＝一時中断』参照）。
      // 「次に録るべきセット」の判断はworkout-camera.tsx側でfetchWorkoutして行う。
      const updated = activeSession.status_code === 'in_progress'
        ? activeSession
        : await startWorkout(token, activeSession.id);
      setTodaySessions([updated]);
      await goToAiExerciseOrNotice(updated);
    } catch (e) {
      setLifecycleError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsLifecycleBusy(false);
    }
  };

  // 完了したメニューを「予定済み」に戻してもう一度実行する。
  // 1日1メニュー制のため通常は開始できないが、回数カウントの検証では同じメニューを
  // 何度も回したい。計測結果とAIレビューはサーバー側で消される。
  const handleRetest = async () => {
    if (!activeSession) return;
    setLifecycleError(null);
    setIsLifecycleBusy(true);
    try {
      await abortWorkout(token, activeSession.id);
      await loadToday();
    } catch (e) {
      setLifecycleError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsLifecycleBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!activeSession) return;
    setLifecycleError(null);
    setIsLifecycleBusy(true);
    try {
      const updated = await endWorkout(token, activeSession.id);
      setTodaySessions([updated]);

      // 筋トレレポート自動生成→レポート画面へ（AGENTS.md『筋トレ全体のレポート』参照）。
      // 生成に失敗しても終了自体は完了しているので、別のtry/catchで囲む。
      try {
        const report = await generateWorkoutReport(token, updated.id);
        router.push({
          pathname: '/(screens)/workout-report-result',
          params: { reportJson: JSON.stringify(report) },
        });
      } catch (e) {
        console.log('[workout] 筋トレレポート生成に失敗', e);
        setLifecycleError('筋トレは終了しましたが、レポートの生成に失敗しました');
      }
    } catch (e) {
      setLifecycleError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsLifecycleBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── ヘッダー ───────────────────────────── */}
      <AppHeader onBellPress={() => setShowNotifModal(true)} />
      <PageTitleBar title="筋トレ開始" subtitle={dateLabel} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={Colors.primaryDark} size="large" />
          </View>
        ) : loadError ? (
          <View style={styles.centerBox}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={loadToday}>
              <Text style={styles.retryBtnText}>再読み込み</Text>
            </TouchableOpacity>
          </View>
        ) : todayCompleted ? (
          /* ── 1日1メニュー制：その日はもう終わっているのでリザルトを見せる ── */
          <View style={styles.programCard}>
            <Text style={styles.programCardTitle}>{dateLabel}の記録</Text>
            <Text style={styles.doneBadge}>完了しました</Text>
            {todayExercises.map(ex => {
              const recorded = ex.sets.filter(st => st.ai_counted_reps !== null);
              const totalReps = recorded.reduce((sum, st) => sum + (st.ai_counted_reps ?? 0), 0);
              return (
                <View key={ex.id} style={styles.exerciseRow}>
                  <Text style={styles.exerciseName} numberOfLines={1}>• {ex.exercise_name}</Text>
                  <Text style={styles.exerciseDetails}>
                    {recorded.length}セット / 合計{totalReps}回
                  </Text>
                </View>
              );
            })}
            <TouchableOpacity
              style={styles.registerBtn}
              activeOpacity={0.85}
              onPress={() => router.push({
                pathname: '/(screens)/workout-finish',
                params: { sessionId: String(activeSession?.id ?? '') },
              })}>
              <Text style={styles.registerBtnText}>リザルトを見る</Text>
            </TouchableOpacity>
            <Text style={styles.emptySubtitle}>
              1日1メニューまでです。
            </Text>
            {/* 回数カウントの検証用。同じメニューを何度も回せるようにする。
                計測結果とAIレビューは消えて「予定済み」に戻る。 */}
            <TouchableOpacity
              style={styles.retestBtn}
              activeOpacity={0.7}
              disabled={isLifecycleBusy}
              onPress={handleRetest}>
              <Text style={styles.retestBtnText}>
                {isLifecycleBusy ? '戻しています…' : 'もう一度実行する（テスト用）'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : hasWorkout ? (
          <>
            {activeSession?.status_code === 'in_progress' && (
              <View style={styles.statusBanner}>
                <Text style={styles.statusBannerText}>実施中</Text>
              </View>
            )}
            {lifecycleError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{lifecycleError}</Text>
              </View>
            )}
            {aiNotice && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{aiNotice}</Text>
              </View>
            )}

            {/* ── 今日のトレーニングメニュー（ホーム画面と同じカードスタイル、タップで編集） ── */}
            <TouchableOpacity style={styles.programCard} onPress={handleEditMenu} activeOpacity={0.8}>
              <Text style={styles.programCardTitle}>{dateLabel}のトレーニングメニュー</Text>
              {todayExercises.map(ex => (
                <View key={ex.id} style={styles.exerciseRow}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    • {ex.exercise_name}
                  </Text>
                  <Text style={styles.exerciseDetails}>
                    {ex.sets.length}set / {ex.sets.map(s => `${formatDecimal(s.weight_kg) ?? '-'}kg×${s.reps ?? '-'}`).join(', ')}
                  </Text>
                </View>
              ))}
            </TouchableOpacity>
          </>
        ) : (
          /* ── 空状態：筋トレメニュー登録画面へ ──────── */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>今日のメニューは登録されていません</Text>
            <Text style={styles.emptySubtitle}>筋トレメニューを登録しましょう</Text>
            <TouchableOpacity style={styles.registerBtn} activeOpacity={0.85} onPress={handleGoToRegister}>
              <Text style={styles.registerBtnText}>筋トレメニュー登録</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: Space[4] }} />
      </ScrollView>

      {/* ── 開始/終了ボタン（登録がある時のみ） ─────── */}
      {hasWorkout && !todayCompleted && activeSession?.status_code !== 'in_progress' && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.startBtn, isLifecycleBusy && styles.startBtnDisabled]}
            activeOpacity={0.85}
            disabled={isLifecycleBusy}
            onPress={handleStart}>
            {isLifecycleBusy ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <IconSymbol name="dumbbell.fill" size={22} color={Colors.textOnPrimary} />
                <Text style={styles.startBtnText}>筋トレを開始する</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      {/* 「筋トレを再開する」は廃止（2026-08-28）。計測画面が全セットを通しで回すように
          なったため、途中から再開するという状態が存在しない。中断した場合はやり直し。 */}
      {hasWorkout && activeSession?.status_code === 'in_progress' && workoutAllDone && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.startBtn, styles.endBtn, isLifecycleBusy && styles.startBtnDisabled]}
            activeOpacity={0.85}
            disabled={isLifecycleBusy}
            onPress={handleEnd}>
            {isLifecycleBusy ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.startBtnText}>筋トレを終了する</Text>
            )}
          </TouchableOpacity>
        </View>
      )}


      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },

  // ── スクロール
  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: Space[10], gap: Space[3] },

  // ── 空状態
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingVertical: Space[8],
    paddingHorizontal: Space[6],
    alignItems: 'center',
    gap: Space[2],
    ...Shadow.sm,
    marginBottom: Space[4],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Space[2],
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  retestBtn: {
    marginTop: Space[2], alignItems: 'center', paddingVertical: Space[2],
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  retestBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  doneBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.primarySubtle,
    color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    paddingHorizontal: Space[3], paddingVertical: Space[1], borderRadius: Radius.md,
    overflow: 'hidden',
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    textAlign: 'center',
    marginBottom: Space[2],
  },

  // ── ステータス表示
  statusBanner: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    paddingVertical: Space[2],
    alignItems: 'center',
    marginBottom: Space[4],
  },
  statusBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },

  // ── 今日のトレーニングメニューカード（ホーム画面と同じスタイル）
  programCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  programCardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Space[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exerciseName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Space[2],
  },
  exerciseDetails: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[4],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  infoBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[4],
  },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  retryBtn: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  registerBtn: {
    height: Layout.buttonHeightMd,
    paddingHorizontal: Space[6],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  registerBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

  // ── 開始ボタン
  bottomBar: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[6],
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[3],
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    height: Layout.buttonHeightLg,
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  endBtn: {
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },

  // ── キャンセル確認モーダル
});
