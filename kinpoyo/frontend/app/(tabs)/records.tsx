import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-gifted-charts';

import { AppHeader, PageTitleBar } from '@/components/ui/app-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TrainerAvatar } from '@/components/ui/trainer-avatar';
import { NotificationsModal } from '@/components/notifications-modal';
import {
  Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import { fetchWorkoutReport } from '@/services/workout';
import {
  HistoryItem,
  HistoryPeriodKey,
  MaxWeightOut,
  PeriodKey,
  VolumeSummaryOut,
  fetchHistory,
  fetchMaxWeight,
  fetchVolumeSummary,
} from '@/services/records';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD   = Layout.screenPaddingH;
const CARD_PAD = Layout.cardPadding;
const Y_AXIS_W = 44;
const CHART_W  = SCREEN_W - H_PAD * 2 - CARD_PAD * 2 - Y_AXIS_W;

const AXIS_TEXT: object = { fontSize: 10, color: Colors.textHint };

// ─── 期間・型 ──────────────────────────────────────────────────

type GraphPeriod = '週' | '月' | '年';
const GRAPH_PERIOD_TO_KEY: Record<GraphPeriod, PeriodKey> = { 週: 'week', 月: 'month', 年: 'year' };

type HistPeriod = '全期間' | '今月' | '今週';
const HIST_PERIODS: HistPeriod[] = ['全期間', '今月', '今週'];
const HIST_PERIOD_TO_KEY: Record<HistPeriod, HistoryPeriodKey> = { 全期間: 'all', 今月: 'month', 今週: 'week' };

type VolPoint = { value: number; label: string };
type MuscleOption = { label: string; color: string };
type ExerciseOption = { id: number; name: string };

// ─── ユーティリティ ───────────────────────────────────────────

// "YYYY-MM-DD"をローカルタイムゾーンの日付として解釈する（new Date(string)の
// UTC解釈によるタイムゾーンずれを避けるため）。
function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function mdLabel(s: string): string {
  const d = parseIsoDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];
function weekdayLabel(s: string): string {
  return WEEKDAY_JA[parseIsoDate(s).getDay()];
}
function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}
function spacing(n: number): number {
  return Math.max(20, Math.floor((CHART_W - 20) / Math.max(n - 1, 1)));
}
function fmtVol(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v > 0)      return `${(v / 1000).toFixed(1)}k`;
  return '0';
}
function fmtDuration(sec: number | null): string | null {
  if (sec == null || sec <= 0) return null;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

// AIトレーナーのコメント：実測データ（volumeSummary/セッション数）を使った決定的な
// 傾向判定文。期間集計に対する本物のAIレビュー機能（DeepSeek等）はまだ無いため、
// 簡易ヒューリスティックのまま（AGENTS.md参照。将来的にAI生成へ置き換え候補）。
function aiComment(period: GraphPeriod, vol: VolPoint[], sessionCount: number): string {
  if (sessionCount === 0) {
    if (period === '週') return '今週はまだトレーニング記録がありません。まずは1回、体を動かしてみましょう。';
    if (period === '月') return '今月はまだトレーニング記録がありません。無理のない範囲で始めてみましょう。';
    return '今年はまだトレーニング記録がありません。少しずつ積み重ねていきましょう。';
  }

  const points = vol.map(v => v.value).filter(v => v > 0);
  const trendUp = points.length >= 2 && points[points.length - 1] >= points[0];

  if (period === '週') {
    return trendUp
      ? `今週は${sessionCount}回のトレーニングでボリュームが順調に伸びています。この調子で来週も継続していきましょう。`
      : `今週は${sessionCount}回トレーニングできました。次回は少し強度を上げてみると、さらに成長につながりそうです。`;
  }
  if (period === '月') {
    return trendUp
      ? `今月は週を追うごとにボリュームが増加傾向です。順調にステップアップできています。`
      : `今月のボリュームは横ばい傾向です。種目のバリエーションを増やすと新しい刺激になりそうです。`;
  }
  return trendUp
    ? `年間を通してボリュームが右肩上がりです。長期的な積み重ねが成果に繋がっています。`
    : `直近の月でボリュームが落ち着いています。無理のないペースで継続していきましょう。`;
}

// ─── 履歴フィルターバー（共通 UI） ───────────────────────────

type FilterBarProps = {
  histPeriod:   HistPeriod;
  histMuscles:  string[];
  muscleOptions: MuscleOption[];
  onPeriod:     (p: HistPeriod) => void;
  onToggleMuscle: (m: string) => void;
};

function FilterBar({ histPeriod, histMuscles, muscleOptions, onPeriod, onToggleMuscle }: FilterBarProps) {
  return (
    <View style={fb.wrap}>
      {/* 期間 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fb.row}>
        {HIST_PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            style={[fb.chip, histPeriod === p && fb.chipActive]}
            onPress={() => onPeriod(p)}
            activeOpacity={0.75}>
            <Text style={[fb.chipText, histPeriod === p && fb.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
        {muscleOptions.length > 0 && <View style={fb.divider} />}
        {/* 部位（選択時は部位ごとの色） */}
        {muscleOptions.map(({ label, color }) => {
          const active = histMuscles.includes(label);
          return (
            <TouchableOpacity
              key={label}
              style={[
                fb.chip,
                active && { borderColor: color, backgroundColor: color + '22' },
              ]}
              onPress={() => onToggleMuscle(label)}
              activeOpacity={0.75}>
              <Text style={[fb.chipText, active && { color, fontWeight: FontWeight.bold }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const fb = StyleSheet.create({
  wrap: { marginBottom: Space[3] },
  row:  { flexDirection: 'row', alignItems: 'center', gap: Space[2], paddingBottom: 2 },
  divider: { width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: Space[1] },
  chip: {
    paddingHorizontal: Space[3],
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
  },
  chipActive:     { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  chipText:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textOnPrimary, fontWeight: FontWeight.bold },
});

// ─── 履歴カード（共通 UI） ────────────────────────────────────

function HistoryCard({ item, onPress, loading }: { item: HistoryItem; onPress: () => void; loading: boolean }) {
  const dateLabel = item.scheduled_date ? mdLabel(item.scheduled_date) : '-';
  const weekday = item.scheduled_date ? weekdayLabel(item.scheduled_date) : null;
  const duration = fmtDuration(item.duration_sec);
  return (
    <TouchableOpacity style={hc.card} onPress={onPress} activeOpacity={0.7} disabled={loading}>
      <View style={hc.header}>
        <View style={hc.dateWrap}>
          <Text style={hc.date}>{dateLabel}</Text>
          {weekday && <Text style={hc.weekday}>（{weekday}）</Text>}
          {duration && <Text style={hc.duration}>· {duration}</Text>}
        </View>
        <View style={hc.headerRight}>
          <Text style={hc.count}>{item.exercises.length}種目</Text>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primaryDark} />
          ) : (
            <IconSymbol name="chevron.right" size={14} color={Colors.textHint} />
          )}
        </View>
      </View>
      {item.exercises.map((ex, j) => {
        const color = ex.muscle_group_color ?? Colors.textHint;
        return (
          <View
            key={ex.exercise_id}
            style={[hc.row, j < item.exercises.length - 1 && hc.rowBorder]}>
            <View style={[hc.bar, { backgroundColor: color }]} />
            <View style={hc.info}>
              <Text style={hc.name}>{ex.exercise_name}</Text>
              <Text style={hc.detail}>
                {ex.sets_count}セット
                {ex.max_weight_kg != null ? ` · 最大 ${toNum(ex.max_weight_kg)}kg` : ''}
              </Text>
            </View>
            <View style={[hc.badge, { backgroundColor: color + '22' }]}>
              <Text style={[hc.badgeText, { color }]}>{ex.muscle_group_name}</Text>
            </View>
          </View>
        );
      })}
    </TouchableOpacity>
  );
}

const hc = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: CARD_PAD,
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dateWrap: { flexDirection: 'row', alignItems: 'baseline', gap: Space[1] },
  date:     { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  weekday:  { fontSize: FontSize.sm, color: Colors.textSecondary },
  duration: { fontSize: FontSize.sm, color: Colors.textHint, marginLeft: Space[1] },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  count:    { fontSize: FontSize.sm, color: Colors.textHint, fontWeight: FontWeight.medium },
  row:      { flexDirection: 'row', alignItems: 'center', gap: Space[3], paddingVertical: Space[2] },
  rowBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.divider },
  bar:      { width: 3, height: 32, borderRadius: 2 },
  info:     { flex: 1 },
  name:     { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  detail:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  badge:    { paddingHorizontal: Space[2], paddingVertical: 3, borderRadius: Radius.sm },
  badgeText:{ fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});

// ─── メイン画面 ───────────────────────────────────────────────

export default function RecordsScreen() {
  const { token } = useAuth();
  const [showNotifModal, setShowNotifModal] = useState(false);

  // ── ボリューム推移・サマリー ──────────────────
  const [graphPeriod, setGraphPeriod] = useState<GraphPeriod>('週');
  const [volumeSummary, setVolumeSummary] = useState<VolumeSummaryOut | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const loadVolume = useCallback(async () => {
    setVolumeLoading(true);
    setVolumeError(null);
    try {
      const data = await fetchVolumeSummary(token, GRAPH_PERIOD_TO_KEY[graphPeriod]);
      setVolumeSummary(data);
    } catch (e) {
      setVolumeError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setVolumeLoading(false);
    }
  }, [token, graphPeriod]);

  useEffect(() => { loadVolume(); }, [loadVolume]);
  useFocusEffect(useCallback(() => { loadVolume(); }, [loadVolume]));

  const volData: VolPoint[] = useMemo(() => {
    if (!volumeSummary) return [];
    return volumeSummary.points.map((p, i) => {
      let label: string;
      if (graphPeriod === '週') label = weekdayLabel(p.period_start);
      else if (graphPeriod === '月') label = `${i + 1}週`;
      else label = `${parseIsoDate(p.period_start).getMonth() + 1}月`;
      return { value: toNum(p.volume), label };
    });
  }, [volumeSummary, graphPeriod]);

  const summaryCount = volumeSummary?.total_sessions ?? 0;
  const summaryVolume = toNum(volumeSummary?.total_volume);
  const summaryLabel = graphPeriod === '週' ? '回 / 今週' : graphPeriod === '月' ? '回 / 今月' : '回 / 今年';

  // ── 種目別最大重量・履歴フィルター選択肢（全期間データから作成）──
  const [allHistory, setAllHistory] = useState<HistoryItem[] | null>(null);
  const [allHistoryLoading, setAllHistoryLoading] = useState(true);
  const [allHistoryError, setAllHistoryError] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState<number | null>(null);

  const loadAllHistory = useCallback(async () => {
    setAllHistoryLoading(true);
    setAllHistoryError(null);
    try {
      const data = await fetchHistory(token, 'all');
      setAllHistory(data);
      setExerciseId(prev => prev ?? data.flatMap(h => h.exercises)[0]?.exercise_id ?? null);
    } catch (e) {
      setAllHistoryError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setAllHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAllHistory(); }, [loadAllHistory]);
  useFocusEffect(useCallback(() => { loadAllHistory(); }, [loadAllHistory]));

  const muscleOptions: MuscleOption[] = useMemo(() => {
    if (!allHistory) return [];
    const map = new Map<string, MuscleOption>();
    for (const item of allHistory) {
      for (const ex of item.exercises) {
        if (!map.has(ex.muscle_group_name)) {
          map.set(ex.muscle_group_name, { label: ex.muscle_group_name, color: ex.muscle_group_color ?? Colors.textHint });
        }
      }
    }
    return Array.from(map.values());
  }, [allHistory]);

  const exerciseOptions: ExerciseOption[] = useMemo(() => {
    if (!allHistory) return [];
    const seen = new Set<number>();
    const list: ExerciseOption[] = [];
    for (const item of allHistory) {
      for (const ex of item.exercises) {
        if (!seen.has(ex.exercise_id)) {
          seen.add(ex.exercise_id);
          list.push({ id: ex.exercise_id, name: ex.exercise_name });
        }
      }
    }
    return list;
  }, [allHistory]);

  const [maxWeight, setMaxWeight] = useState<MaxWeightOut | null>(null);
  const [maxWeightLoading, setMaxWeightLoading] = useState(false);
  const [maxWeightError, setMaxWeightError] = useState<string | null>(null);

  useEffect(() => {
    if (exerciseId == null) return;
    let cancelled = false;
    setMaxWeightLoading(true);
    setMaxWeightError(null);
    fetchMaxWeight(token, exerciseId)
      .then(data => { if (!cancelled) setMaxWeight(data); })
      .catch(e => { if (!cancelled) setMaxWeightError(e instanceof ApiError ? e.detail : '読み込みに失敗しました'); })
      .finally(() => { if (!cancelled) setMaxWeightLoading(false); });
    return () => { cancelled = true; };
  }, [token, exerciseId]);

  const wtData = useMemo(() => {
    if (!maxWeight) return [];
    return maxWeight.points.map(p => {
      const v = toNum(p.max_weight_kg);
      return { value: v, label: mdLabel(p.session_date), dataPointText: String(v) };
    });
  }, [maxWeight]);

  const hasWtData = wtData.length > 0;
  const latestWt = hasWtData ? wtData[wtData.length - 1].value : 0;
  const firstWt  = hasWtData ? wtData[0].value : 0;
  const wtDiff   = hasWtData ? +(latestWt - firstWt).toFixed(1) : 0;
  const wtMin    = hasWtData ? Math.min(...wtData.map(d => d.value)) : 0;
  const wtBase   = Math.max(0, Math.floor((wtMin - 8) / 5) * 5);

  // ── 筋トレ履歴（期間ごとに再取得、部位はクライアント側で絞り込み）──
  const [histPeriod,    setHistPeriod]    = useState<HistPeriod>('全期間');
  const [histMuscles,   setHistMuscles]   = useState<string[]>([]);
  const [histModalOpen, setHistModalOpen] = useState(false);
  const [periodHistory, setPeriodHistory] = useState<HistoryItem[] | null>(null);
  const [periodHistoryLoading, setPeriodHistoryLoading] = useState(true);
  const [periodHistoryError, setPeriodHistoryError] = useState<string | null>(null);

  const loadPeriodHistory = useCallback(async () => {
    setPeriodHistoryLoading(true);
    setPeriodHistoryError(null);
    try {
      const data = await fetchHistory(token, HIST_PERIOD_TO_KEY[histPeriod]);
      setPeriodHistory(data);
    } catch (e) {
      setPeriodHistoryError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setPeriodHistoryLoading(false);
    }
  }, [token, histPeriod]);

  useEffect(() => { loadPeriodHistory(); }, [loadPeriodHistory]);
  useFocusEffect(useCallback(() => { loadPeriodHistory(); }, [loadPeriodHistory]));

  const filteredHistory = useMemo(() => {
    if (!periodHistory) return [];
    if (histMuscles.length === 0) return periodHistory;
    return periodHistory
      .map(item => ({ ...item, exercises: item.exercises.filter(ex => histMuscles.includes(ex.muscle_group_name)) }))
      .filter(item => item.exercises.length > 0);
  }, [periodHistory, histMuscles]);

  const toggleMuscle = (m: string) =>
    setHistMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m],
    );

  const previewHistory = filteredHistory.slice(0, 3);
  const hasMore = filteredHistory.length > 3;

  // 筋トレ履歴のカードをタップ→そのセッションの過去のAIレポートを取得して表示。
  const [openingSessionId, setOpeningSessionId] = useState<number | null>(null);
  const handleOpenReport = async (item: HistoryItem) => {
    if (openingSessionId != null) return;
    setOpeningSessionId(item.session_id);
    try {
      const report = await fetchWorkoutReport(token, item.session_id);
      const weekday = item.scheduled_date ? weekdayLabel(item.scheduled_date) : null;
      const dateLabel = item.scheduled_date
        ? `${mdLabel(item.scheduled_date)}${weekday ? `（${weekday}）` : ''}`
        : undefined;
      router.push({
        pathname: '/(screens)/workout-report-result',
        params: { reportJson: JSON.stringify(report), ...(dateLabel ? { dateLabel } : {}) },
      });
    } catch (e) {
      Alert.alert(
        'レポートを取得できませんでした',
        e instanceof ApiError ? e.detail : '時間をおいて再度お試しください',
      );
    } finally {
      setOpeningSessionId(null);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── ヘッダー ─────────────────────────── */}
      <AppHeader onBellPress={() => setShowNotifModal(true)} />
      <PageTitleBar title="記録" />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>

        {/* ── グラフ期間セレクター ──────────── */}
        <View style={s.periodRow}>
          {(['週', '月', '年'] as GraphPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodBtn, graphPeriod === p && s.periodBtnActive]}
              onPress={() => setGraphPeriod(p)}
              activeOpacity={0.75}>
              <Text style={[s.periodText, graphPeriod === p && s.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── AIトレーナー（実測データによる決定的コメント） ─── */}
        <View style={s.aiCard}>
          <View style={s.aiHeaderRow}>
            <TrainerAvatar size={36} />
            <View style={s.aiHeaderTextWrap}>
              <Text style={s.aiTitle}>AIトレーナー</Text>
              <Text style={s.aiSubtitle}>
                {graphPeriod === '週' && '今週のレビュー'}
                {graphPeriod === '月' && '今月のレビュー'}
                {graphPeriod === '年' && '今年のレビュー'}
              </Text>
            </View>
          </View>
          {volumeLoading ? (
            <ActivityIndicator color={Colors.primaryDark} />
          ) : volumeError ? (
            <Text style={s.errorInlineText}>{volumeError}</Text>
          ) : (
            <Text style={s.aiComment}>{aiComment(graphPeriod, volData, summaryCount)}</Text>
          )}
        </View>

        {/* ── サマリー ──────────────────────── */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{summaryCount}</Text>
            <Text style={s.summaryLbl}>{summaryLabel}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{fmtVol(summaryVolume)}</Text>
            <Text style={s.summaryLbl}>kg ボリューム</Text>
          </View>
        </View>

        {/* ── ボリューム折れ線グラフ ────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>ボリューム推移</Text>
          <Text style={s.cardSub}>
            {graphPeriod === '週' && '今週の日別ボリューム (重量 × 回数)'}
            {graphPeriod === '月' && '今月の週別ボリューム (重量 × 回数)'}
            {graphPeriod === '年' && '今年の月別ボリューム (重量 × 回数)'}
          </Text>
          {volumeLoading && !volumeSummary ? (
            <View style={s.chartLoading}><ActivityIndicator color={Colors.primaryDark} /></View>
          ) : volumeError ? (
            <View style={s.chartLoading}><Text style={s.errorInlineText}>{volumeError}</Text></View>
          ) : (
            <LineChart
              areaChart isAnimated
              data={volData}
              width={CHART_W} height={150}
              spacing={spacing(volData.length)} initialSpacing={16}
              color={Colors.primary} thickness={2.5}
              startFillColor={Colors.primarySubtle} endFillColor={Colors.bgCard}
              startOpacity={0.5} endOpacity={0}
              noOfSections={4}
              rulesColor={Colors.divider} rulesType="dashed"
              xAxisColor={Colors.border} yAxisColor="transparent"
              xAxisLabelTextStyle={AXIS_TEXT} yAxisTextStyle={AXIS_TEXT}
              dataPointsColor={Colors.primaryDark} dataPointsRadius={4}
            />
          )}
        </View>

        {/* ── 種目別最大重量 ────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>種目別 最大重量</Text>
          <View style={{ height: Space[3] }} />

          {allHistoryLoading && !allHistory ? (
            <View style={s.chartLoading}><ActivityIndicator color={Colors.primaryDark} /></View>
          ) : allHistoryError ? (
            <View style={s.chartLoading}><Text style={s.errorInlineText}>{allHistoryError}</Text></View>
          ) : exerciseOptions.length === 0 ? (
            <View style={s.chartLoading}><Text style={s.emptyHistoryText}>まだ記録がありません</Text></View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={s.exScroll} contentContainerStyle={s.exContent}>
                {exerciseOptions.map(ex => (
                  <TouchableOpacity
                    key={ex.id}
                    style={[s.exChip, exerciseId === ex.id && s.exChipActive]}
                    onPress={() => setExerciseId(ex.id)}
                    activeOpacity={0.75}>
                    <Text style={[s.exChipText, exerciseId === ex.id && s.exChipTextActive]}>{ex.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {maxWeightLoading && !maxWeight ? (
                <View style={s.chartLoading}><ActivityIndicator color={Colors.primaryDark} /></View>
              ) : maxWeightError ? (
                <View style={s.chartLoading}><Text style={s.errorInlineText}>{maxWeightError}</Text></View>
              ) : !hasWtData ? (
                <View style={s.chartLoading}><Text style={s.emptyHistoryText}>重量の記録がありません</Text></View>
              ) : (
                <>
                  <View style={s.weightRow}>
                    <View>
                      <View style={s.weightValRow}>
                        <Text style={s.weightVal}>{latestWt}</Text>
                        <Text style={s.weightUnit}> kg</Text>
                      </View>
                      <Text style={s.weightLbl}>現在の最大重量</Text>
                    </View>
                    {wtDiff !== 0 && (
                      <View style={[s.diffBadge, wtDiff > 0 && s.diffBadgeUp]}>
                        <Text style={[s.diffText, wtDiff > 0 && s.diffTextUp]}>
                          {wtDiff > 0 ? '▲' : '▼'} {Math.abs(wtDiff)} kg
                        </Text>
                      </View>
                    )}
                  </View>

                  <LineChart
                    areaChart curved isAnimated
                    data={wtData}
                    width={CHART_W} height={130}
                    spacing={spacing(wtData.length)} initialSpacing={16}
                    color={Colors.primaryDark} thickness={2.5}
                    startFillColor={Colors.primarySubtle} endFillColor={Colors.bgCard}
                    startOpacity={0.4} endOpacity={0}
                    noOfSections={3} yAxisOffset={wtBase}
                    rulesColor={Colors.divider} rulesType="dashed"
                    xAxisColor={Colors.border} yAxisColor="transparent"
                    xAxisLabelTextStyle={AXIS_TEXT} yAxisTextStyle={AXIS_TEXT}
                    dataPointsColor={Colors.primaryDark} dataPointsRadius={5}
                    textFontSize={11} textColor={Colors.primaryDark}
                    textShiftY={-10} textShiftX={-4}
                  />
                </>
              )}
            </>
          )}
        </View>

        {/* ── 筋トレ履歴 ───────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>筋トレ履歴</Text>
          <Text style={s.sectionCount}>{filteredHistory.length}件</Text>
        </View>

        {/* 絞り込みバー（メイン画面） */}
        <FilterBar
          histPeriod={histPeriod}
          histMuscles={histMuscles}
          muscleOptions={muscleOptions}
          onPeriod={setHistPeriod}
          onToggleMuscle={toggleMuscle}
        />

        {/* 履歴カード（最大3件） */}
        {periodHistoryLoading && !periodHistory ? (
          <View style={s.emptyHistory}><ActivityIndicator color={Colors.primaryDark} /></View>
        ) : periodHistoryError ? (
          <View style={s.emptyHistory}><Text style={s.errorInlineText}>{periodHistoryError}</Text></View>
        ) : filteredHistory.length === 0 ? (
          <View style={s.emptyHistory}>
            <Text style={s.emptyHistoryText}>該当するトレーニングがありません</Text>
          </View>
        ) : (
          previewHistory.map(item => (
            <HistoryCard
              key={item.session_id}
              item={item}
              onPress={() => handleOpenReport(item)}
              loading={openingSessionId === item.session_id}
            />
          ))
        )}

        {/* もっと見るボタン */}
        {hasMore && (
          <TouchableOpacity
            style={s.showMoreBtn}
            onPress={() => setHistModalOpen(true)}
            activeOpacity={0.75}>
            <Text style={s.showMoreText}>
              もっと見る（全{filteredHistory.length}件）
            </Text>
            <IconSymbol name="chevron.right" size={14} color={Colors.primaryDark} />
          </TouchableOpacity>
        )}

        <View style={{ height: Space[8] }} />
      </ScrollView>

      {/* ════ 履歴モーダル ══════════════════════════════════════ */}
      <Modal
        visible={histModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHistModalOpen(false)}>
        <View style={m.overlay}>
          {/* モーダルヘッダー */}
          <View style={m.dialog}>
            <View style={m.header}>
              <View>
                <Text style={m.title}>筋トレ履歴</Text>
                <Text style={m.subtitle}>{filteredHistory.length}件</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHistModalOpen(false)}
                hitSlop={8}
                style={m.closeBtn}>
                <IconSymbol name="xmark" size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* 絞り込みバー（モーダル内） */}
            <View style={m.filterWrap}>
              <FilterBar
                histPeriod={histPeriod}
                histMuscles={histMuscles}
                muscleOptions={muscleOptions}
                onPeriod={setHistPeriod}
                onToggleMuscle={toggleMuscle}
              />
            </View>

            {/* 固定高さのコンテンツエリア（空でもサイズ変わらない） */}
            <View style={m.contentArea}>
              {filteredHistory.length === 0 ? (
                <View style={m.empty}>
                  <Text style={m.emptyText}>該当するトレーニングがありません</Text>
                </View>
              ) : (
                <ScrollView
                  style={m.list}
                  contentContainerStyle={m.listContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled">
                  {filteredHistory.map(item => (
                    <HistoryCard
                      key={item.session_id}
                      item={item}
                      onPress={() => handleOpenReport(item)}
                      loading={openingSessionId === item.session_id}
                    />
                  ))}
                  <View style={{ height: Space[4] }} />
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },

  scroll: { paddingHorizontal: H_PAD, paddingTop: Space[4] },

  periodRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[1],
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  periodBtn:       { flex: 1, alignItems: 'center', paddingVertical: Space[2], borderRadius: Radius.md },
  periodBtnActive: { backgroundColor: Colors.primaryDark },
  periodText:      { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  periodTextActive:{ color: Colors.textOnPrimary },

  // ── AIトレーナーカード
  aiCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: CARD_PAD,
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  aiHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Space[3], marginBottom: Space[3] },
  aiHeaderTextWrap: { flex: 1 },
  aiTitle:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  aiSubtitle: { fontSize: FontSize.xs, color: Colors.textHint, marginTop: 1 },
  aiComment:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.6 },
  errorInlineText: { fontSize: FontSize.sm, color: Colors.error },

  summaryRow: { flexDirection: 'row', gap: Space[3], marginBottom: Space[4] },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[4],
    alignItems: 'center',
    ...Shadow.sm,
  },
  summaryVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primaryDark, lineHeight: FontSize.xl * 1.15 },
  summaryLbl: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: CARD_PAD,
    marginBottom: Space[4],
    ...Shadow.sm,
    overflow: 'hidden',
  },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 2 },
  cardSub:   { fontSize: FontSize.xs,   color: Colors.textHint,      marginBottom: Space[4] },
  chartLoading: { paddingVertical: Space[8], alignItems: 'center', justifyContent: 'center' },

  exScroll:       { marginBottom: Space[4] },
  exContent:      { gap: Space[2] },
  exChip: {
    paddingHorizontal: Space[3], paddingVertical: Space[2],
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgScreen,
  },
  exChipActive:     { borderColor: Colors.primaryDark, backgroundColor: Colors.primarySubtle },
  exChipText:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  exChipTextActive: { color: Colors.primaryDark, fontWeight: FontWeight.bold },

  weightRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space[4] },
  weightValRow: { flexDirection: 'row', alignItems: 'baseline' },
  weightVal:    { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary },
  weightUnit:   { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  weightLbl:    { fontSize: FontSize.xs, color: Colors.textHint, marginTop: 2 },
  diffBadge:    { paddingHorizontal: Space[3], paddingVertical: Space[1], borderRadius: Radius.full, backgroundColor: Colors.errorSubtle },
  diffBadgeUp:  { backgroundColor: Colors.primarySubtle },
  diffText:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.error },
  diffTextUp:   { color: Colors.primaryDark },

  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: Space[4], marginBottom: Space[3] },
  sectionTitle:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionCount:  { fontSize: FontSize.sm, color: Colors.textHint },

  emptyHistory: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[8],
    alignItems: 'center',
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  emptyHistoryText: { fontSize: FontSize.sm, color: Colors.textHint },

  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[3],
    marginBottom: Space[3],
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  showMoreText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primaryDark },
});

// ─── モーダル スタイル（calendar.tsx の筋トレ修正と統一） ─────

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgOverlay,
    paddingHorizontal: Space[5],
  },
  dialog: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    paddingBottom: Space[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space[4],
    paddingTop: Space[4],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title:    { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center', justifyContent: 'center',
  },
  filterWrap:  { paddingHorizontal: Space[4], paddingTop: Space[3] },
  contentArea: { height: 340 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: FontSize.sm, color: Colors.textHint },
  list:        { flex: 1 },
  listContent: { paddingHorizontal: Space[4], paddingTop: Space[2], paddingBottom: Space[2] },
});
