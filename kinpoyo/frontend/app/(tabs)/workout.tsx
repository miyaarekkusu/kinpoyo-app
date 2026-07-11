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
import {
  WorkoutSessionOut,
  endWorkout,
  fetchWorkoutsByDate,
  startWorkout,
  toIsoDate,
} from '@/services/workout';
import { formatDecimal } from '@/utils/format';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export default function WorkoutScreen() {
  const { token } = useAuth();
  const today = useMemo(() => new Date(), []);
  const dow = WEEKDAYS[today.getDay()];
  const dateLabel = `${today.getMonth() + 1}月${today.getDate()}日（${dow}）`;

  // ── 今日のセッション取得 ──────────────────────
  const [todaySessions, setTodaySessions] = useState<WorkoutSessionOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const sessions = await fetchWorkoutsByDate(token, toIsoDate(today));
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

  const handleStart = async () => {
    if (!activeSession) return;
    setLifecycleError(null);
    setIsLifecycleBusy(true);
    try {
      const updated = await startWorkout(token, activeSession.id);
      setTodaySessions([updated]);
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
    } catch (e) {
      setLifecycleError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsLifecycleBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── ヘッダー ───────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>筋トレ開始</Text>
        <Text style={styles.headerDate}>{dateLabel}</Text>
      </View>

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
      {hasWorkout && activeSession?.status_code !== 'in_progress' && (
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
      {hasWorkout && activeSession?.status_code === 'in_progress' && (
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },

  // ── ヘッダー
  header: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
    paddingBottom: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
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
});
