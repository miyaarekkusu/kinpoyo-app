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
import { ExerciseOut, fetchExercises } from '@/services/exercises';
import {
  ProgramExerciseOut,
  UserProgramOut,
  advanceProgram,
  fetchMyPrograms,
  fetchProgramExercises,
} from '@/services/program';
import {
  SessionExerciseCreate,
  SessionSetCreate,
  WorkoutSessionOut,
  createWorkout,
  fetchWorkoutsForDates,
  toIsoDate,
} from '@/services/workout';
import { formatDecimal } from '@/utils/format';

const H_PAD = Layout.screenPaddingH;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

type Cell = { date: number; current: boolean };

type WorkoutItem = {
  id: number;
  name: string;
  muscle: string;
  color: string;
  sets: { weight: string; reps: string }[];
};

function buildGrid(year: number, month: number): Cell[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ date: daysInPrev - i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: d, current: true });
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) cells.push({ date: d, current: false });
  return cells;
}

export default function HomeScreen() {
  const { token } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(today.toDateString());
  const [showNotifModal, setShowNotifModal] = useState(false);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const rows = useMemo(() => {
    const rs: Cell[][] = [];
    for (let i = 0; i < grid.length; i += 7) rs.push(grid.slice(i, i + 7));
    return rs;
  }, [grid]);

  // ── 実データ（種目マスター＋当月ワークアウト）─────────
  const [exercisesById, setExercisesById] = useState<Map<number, ExerciseOut>>(new Map());
  const [monthWorkouts, setMonthWorkouts] = useState<Record<string, WorkoutSessionOut[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isoDatesForMonth = useMemo(
    () => grid.filter(c => c.current).map(c => toIsoDate(new Date(year, month, c.date))),
    [grid, year, month]
  );

  const loadExercises = useCallback(async () => {
    try {
      const data = await fetchExercises();
      setExercisesById(new Map(data.map(e => [e.id, e])));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '種目情報の取得に失敗しました');
    }
  }, []);

  const loadMonthWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const map = await fetchWorkoutsForDates(token, isoDatesForMonth);
      setMonthWorkouts(map);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '筋トレ情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token, isoDatesForMonth]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  useEffect(() => {
    loadMonthWorkouts();
  }, [loadMonthWorkouts]);

  useFocusEffect(
    useCallback(() => {
      loadMonthWorkouts();
    }, [loadMonthWorkouts])
  );

  // ── 参加中プログラム＋次のメニュー提案 ────────────
  const [myProgram, setMyProgram] = useState<UserProgramOut | null>(null);
  const [suggestedExercises, setSuggestedExercises] = useState<ProgramExerciseOut[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [isRegisteringSuggestion, setIsRegisteringSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const loadMyProgram = useCallback(async () => {
    try {
      const list = await fetchMyPrograms(token);
      setMyProgram(list.find(p => p.status_code === 'active') ?? null);
    } catch {
      setMyProgram(null);
    }
  }, [token]);

  useEffect(() => {
    loadMyProgram();
  }, [loadMyProgram]);

  const hasWorkoutForCell = (cell: Cell): boolean => {
    if (!cell.current) return false;
    const iso = toIsoDate(new Date(year, month, cell.date));
    const sessions = monthWorkouts[iso] ?? [];
    return sessions.some(s => s.status_code !== 'cancelled' && s.exercises.length > 0);
  };

  const isToday = (d: number, m: number, y: number) =>
    d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDateStr(today.toDateString());
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const selDate = new Date(selectedDateStr);
  const selLabel = `${selDate.getMonth() + 1}月${selDate.getDate()}日（${WEEKDAYS[selDate.getDay()]}）`;
  const selDateIso = toIsoDate(selDate);

  const selDaySessions = useMemo(
    () => (monthWorkouts[selDateIso] ?? []).filter(s => s.status_code !== 'cancelled'),
    [monthWorkouts, selDateIso]
  );

  const selDayWorkouts: WorkoutItem[] = useMemo(
    () =>
      selDaySessions.flatMap(s =>
        s.exercises.map(ex => {
          const info = exercisesById.get(ex.exercise_id);
          return {
            id: ex.id,
            name: ex.exercise_name,
            muscle: info?.muscle ?? '',
            color: info?.muscle_color ?? Colors.textHint,
            sets: ex.sets.map(st => ({
              weight: formatDecimal(st.weight_kg) ?? '-',
              reps: st.reps != null ? String(st.reps) : '-',
            })),
          };
        })
      ),
    [selDaySessions, exercisesById]
  );

  // 選択日に登録が無く、参加中プログラムがある時だけ「次のメニュー」を取得
  useEffect(() => {
    if (!myProgram || selDaySessions.length > 0) {
      setSuggestedExercises([]);
      return;
    }
    let cancelled = false;
    setSuggestionLoading(true);
    fetchProgramExercises(myProgram.program_id, myProgram.current_week, myProgram.current_day)
      .then(data => {
        if (!cancelled) setSuggestedExercises(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestedExercises([]);
      })
      .finally(() => {
        if (!cancelled) setSuggestionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [myProgram, selDaySessions.length]);

  const handleRegisterSuggestion = async () => {
    if (!myProgram || suggestedExercises.length === 0) return;
    setSuggestionError(null);
    setIsRegisteringSuggestion(true);
    try {
      const exercises: SessionExerciseCreate[] = suggestedExercises.map(pe => {
        const setCount = Math.max(1, pe.sets);
        const reps = pe.reps_min ?? pe.reps_max ?? undefined;
        const sets: SessionSetCreate[] = Array.from({ length: setCount }, () => ({ reps }));
        return { exercise_id: pe.exercise_id, order_index: pe.order_index, sets };
      });
      await createWorkout(token, { scheduled_date: selDateIso, exercises });
      await advanceProgram(token, myProgram.id);
      await Promise.all([loadMonthWorkouts(), loadMyProgram()]);
    } catch (e) {
      setSuggestionError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsRegisteringSuggestion(false);
    }
  };

  const handleEditRegisteredMenu = () => {
    if (selDaySessions.length === 0) return;
    router.push({
      pathname: '/(screens)/program/program_choice',
      params: {
        mode: 'edit',
        sessionId: String(selDaySessions[0].id),
        title: selLabel,
      },
    });
  };

  const handleGoToRegister = () => {
    router.push({
      pathname: '/workout-register',
      params: { year: String(year), month: String(month), date: String(selDate.getDate()) },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerSide} />

        <Text style={styles.appName}>kinpoyo</Text>

        <View style={[styles.headerSide, styles.headerIcons]}>
          <TouchableOpacity
            onPress={() => setShowNotifModal(true)}
            hitSlop={8}
            style={styles.iconBtn}>
            <IconSymbol name="bell.fill" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── 通信状態バナー ─────────────────────── */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={loadMonthWorkouts} hitSlop={8}>
              <Text style={styles.retryText}>再試行</Text>
            </TouchableOpacity>
          </View>
        )}
        {loading && !error && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primaryDark} size="small" />
          </View>
        )}

        {/* ── 月カレンダー ─────────────────────── */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={8}>
              <IconSymbol name="chevron.left" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{`${year}年${month + 1}月`}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={8}>
              <IconSymbol name="chevron.right" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToToday} hitSlop={8} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>{today.getDate()}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dayNameRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.dayName, i === 0 && styles.sunText, i === 6 && styles.satText]}>
                {d}
              </Text>
            ))}
          </View>

          {rows.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((cell, ci) => {
                const cellDate = new Date(year, month, cell.date);
                const isSelected = cell.current && cellDate.toDateString() === selectedDateStr;
                const cellToday = cell.current && isToday(cell.date, month, year);
                return (
                  <TouchableOpacity
                    key={ci}
                    style={styles.cell}
                    disabled={!cell.current}
                    onPress={() => setSelectedDateStr(cellDate.toDateString())}
                    activeOpacity={0.7}>
                    <View
                      style={[
                        styles.dateBubble,
                        cellToday && styles.dateBubbleToday,
                        isSelected && !cellToday && styles.dateBubbleSelected,
                      ]}>
                      <Text
                        style={[
                          styles.cellText,
                          !cell.current && { color: Colors.textHint },
                          ci === 0 && cell.current && styles.sunText,
                          ci === 6 && cell.current && styles.satText,
                          cellToday && styles.dateTextToday,
                          isSelected && !cellToday && styles.dateTextSelected,
                        ]}>
                        {cell.date}
                      </Text>
                    </View>
                    <View style={styles.dotsRow}>
                      {hasWorkoutForCell(cell) && <View style={styles.dot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── 選択日のトレーニングメニュー ─────── */}
        {selDayWorkouts.length > 0 ? (
          /* 登録済み：実データを本日のトレーニングメニューカードで表示（タップで編集画面へ） */
          <TouchableOpacity
            style={styles.programCard}
            onPress={handleEditRegisteredMenu}
            activeOpacity={0.8}>
            <Text style={styles.programCardTitle}>{selLabel}のトレーニングメニュー</Text>
            {selDayWorkouts.map(w => (
              <View key={w.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  • {w.name}
                </Text>
                <Text style={styles.exerciseDetails}>
                  {w.sets.length}set / {w.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        ) : (
          /* 未登録：タップで筋トレメニュー登録画面へ */
          <TouchableOpacity style={styles.emptyCard} onPress={handleGoToRegister} activeOpacity={0.8}>
            <Text style={styles.selDateLabel}>{selLabel}</Text>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>トレーニングなし</Text>
            <Text style={styles.emptySubtitle}>タップして筋トレメニューを登録しましょう</Text>
          </TouchableOpacity>
        )}

        {/* ── プログラムの筋トレメニュー登録（未登録日＋参加中プログラムがある時のみ） ─── */}
        {selDayWorkouts.length === 0 && myProgram && (
          <View style={styles.programCard}>
            <Text style={styles.programCardTitle}>プログラムの筋トレメニュー登録</Text>

            {suggestionLoading ? (
              <ActivityIndicator color={Colors.primaryDark} />
            ) : suggestedExercises.length === 0 ? (
              <Text style={styles.suggestionEmpty}>このプログラムの提案データがありません</Text>
            ) : (
              <>
                {suggestedExercises.map(ex => (
                  <View key={ex.id} style={styles.exerciseRow}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      • {ex.exercise_name}
                    </Text>
                    <Text style={styles.exerciseDetails}>
                      {ex.sets}set{ex.reps_min && ex.reps_max ? ` / ${ex.reps_min}-${ex.reps_max}回` : ''}
                    </Text>
                  </View>
                ))}

                {suggestionError && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{suggestionError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.suggestionBtn, isRegisteringSuggestion && styles.suggestionBtnDisabled]}
                  activeOpacity={0.85}
                  disabled={isRegisteringSuggestion}
                  onPress={handleRegisterSuggestion}>
                  {isRegisteringSuggestion ? (
                    <ActivityIndicator color={Colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.suggestionBtnText}>このメニューを登録する</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Program Card ─────────────────────── */}
        <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => router.push('/program')}>
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <View style={[styles.cardIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Text style={styles.cardEmoji}>📋</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>プログラム</Text>
                <Text style={styles.cardSubtitle}>{myProgram ? `参加中：${myProgram.program_name}` : '未参加'}</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
          </View>
          <Text style={styles.cardHint}>プログラムに参加して一歩成長しましょう</Text>
        </TouchableOpacity>

        {/* ── トレーニング知識セクション ── */}
        <View style={styles.knowledgeSection}>
          <Text style={styles.knowledgeSectionTitle}>💡 トレーニング知識</Text>

          <View style={styles.knowledgeGrid}>
            <TouchableOpacity
              style={styles.knowledgeCard}
              activeOpacity={0.75}
              onPress={() => router.push('/program/hypertrophy' as any)}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={styles.cardEmoji}>💪</Text>
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>筋肥大とは</Text>
                    <Text style={styles.cardSubtitle}>効率よく筋肉を大きくするメカニズム</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.knowledgeCard}
              activeOpacity={0.75}
              onPress={() => router.push('/program/program-design' as any)}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={styles.cardEmoji}>📋</Text>
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>プログラム組み方</Text>
                    <Text style={styles.cardSubtitle}>分割法や適切なボリュームの設定方法</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.knowledgeCard}
              activeOpacity={0.75}
              onPress={() => router.push('/program/rpe' as any)}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={styles.cardEmoji}>🏋️</Text>
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>RPEとは</Text>
                    <Text style={styles.cardSubtitle}>自覚的運動強度を用いた強度管理</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgScreen,
  },
  headerSide: {
    flex: 1,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
    textAlign: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Space[1],
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    ...Shadow.sm,
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: Space[2],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[3],
  },
  errorBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, marginRight: Space[2] },
  retryText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.error },
  loadingRow: { alignItems: 'center', paddingVertical: Space[2] },

  // ── カレンダー
  calendarCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingTop: Space[3],
    paddingBottom: Space[3],
    paddingHorizontal: Space[2],
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space[4],
    position: 'relative',
  },
  monthTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    marginHorizontal: Space[4],
  },
  todayBtn: {
    position: 'absolute',
    right: Space[2],
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgScreen,
  },
  todayBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  dayNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Space[2],
  },
  dayName: {
    width: 36,
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textHint,
  },
  sunText: { color: '#EF4444' },
  satText: { color: '#3B82F6' },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 52,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
  },
  dateBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBubbleToday: {
    backgroundColor: Colors.primary,
  },
  dateBubbleSelected: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  cellText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  dateTextToday: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.bold,
  },
  dateTextSelected: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.bold,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },

  // ── 本日のトレーニングメニューカード（登録済み・提案共通）
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
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[8],
    alignItems: 'center',
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  selDateLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryDark,
    marginBottom: Space[3],
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  emptyIcon: { fontSize: 40, marginBottom: Space[2] },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Space[1],
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
  },

  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[3],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Layout.cardPadding,
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[2],
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    marginTop: 2,
  },
  cardHint: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
  },
  knowledgeSection: {
    marginTop: Space[1],
  },
  knowledgeSectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
    paddingLeft: Space[1],
  },
  knowledgeGrid: {
    gap: Space[2],
  },
  knowledgeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Layout.cardPadding,
    paddingTop: Layout.cardPadding,
    paddingBottom: Layout.cardPadding - Space[2],
    ...Shadow.sm,
  },

  // ── プログラム提案の補足スタイル
  suggestionEmpty: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
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
  suggestionBtn: {
    height: Layout.buttonHeightMd,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space[3],
  },
  suggestionBtnDisabled: { opacity: 0.6 },
  suggestionBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
