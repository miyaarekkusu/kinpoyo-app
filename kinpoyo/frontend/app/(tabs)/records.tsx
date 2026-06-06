import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';

import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space,
} from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD   = Layout.screenPaddingH;
const CARD_PAD = Layout.cardPadding;
const Y_AXIS_W = 44;
const CHART_W  = SCREEN_W - H_PAD * 2 - CARD_PAD * 2 - Y_AXIS_W;

const AXIS_TEXT: object = { fontSize: 10, color: Colors.textHint };

// ─── グラフ データ型 ──────────────────────────────────────────

type GraphPeriod = '週' | '月' | '年';

type VolPoint = { value: number; label: string };
const VOLUME: Record<GraphPeriod, VolPoint[]> = {
  週: [
    { value: 2800, label: '月' }, { value: 0,    label: '火' },
    { value: 4200, label: '水' }, { value: 0,    label: '木' },
    { value: 3100, label: '金' }, { value: 5500, label: '土' },
    { value: 0,    label: '日' },
  ],
  月: [
    { value: 8500,  label: '1週' }, { value: 9200,  label: '2週' },
    { value: 10100, label: '3週' }, { value: 11300, label: '4週' },
  ],
  年: [
    { value: 32000, label: '1月' }, { value: 28000, label: '2月' },
    { value: 35000, label: '3月' }, { value: 40000, label: '4月' },
    { value: 38000, label: '5月' }, { value: 15000, label: '6月' },
  ],
};

const SUMMARY: Record<GraphPeriod, { count: number; volume: number; label: string }> = {
  週: { count: 3,  volume: 15600,  label: '回 / 今週' },
  月: { count: 12, volume: 39100,  label: '回 / 今月' },
  年: { count: 20, volume: 188000, label: '回 / 今年' },
};

const EXERCISES = ['ベンチプレス', 'スクワット', 'デッドリフト', 'ショルダープレス'] as const;
type Ex = (typeof EXERCISES)[number];

type WtPoint = { value: number; label: string; dataPointText: string };
const WEIGHT_DATA: Record<Ex, WtPoint[]> = {
  ベンチプレス: [
    { value: 65,   label: '5/9',  dataPointText: '65'    },
    { value: 67.5, label: '5/16', dataPointText: '67.5'  },
    { value: 70,   label: '5/23', dataPointText: '70'    },
    { value: 70,   label: '5/30', dataPointText: '70'    },
    { value: 72.5, label: '6/6',  dataPointText: '72.5'  },
  ],
  スクワット: [
    { value: 80,   label: '5/9',  dataPointText: '80'   },
    { value: 80,   label: '5/16', dataPointText: '80'   },
    { value: 82.5, label: '5/23', dataPointText: '82.5' },
    { value: 85,   label: '5/30', dataPointText: '85'   },
    { value: 87.5, label: '6/6',  dataPointText: '87.5' },
  ],
  デッドリフト: [
    { value: 100,   label: '5/9',  dataPointText: '100'   },
    { value: 100,   label: '5/16', dataPointText: '100'   },
    { value: 105,   label: '5/23', dataPointText: '105'   },
    { value: 107.5, label: '5/30', dataPointText: '107.5' },
    { value: 110,   label: '6/6',  dataPointText: '110'   },
  ],
  ショルダープレス: [
    { value: 40,   label: '5/9',  dataPointText: '40'   },
    { value: 42.5, label: '5/16', dataPointText: '42.5' },
    { value: 42.5, label: '5/23', dataPointText: '42.5' },
    { value: 45,   label: '5/30', dataPointText: '45'   },
    { value: 45,   label: '6/6',  dataPointText: '45'   },
  ],
};

// ─── 履歴 データ型 ────────────────────────────────────────────

type HistPeriod = '全期間' | '今月' | '今週';
const HIST_PERIODS: HistPeriod[] = ['全期間', '今月', '今週'];

const MUSCLE_GROUPS = [
  { label: '胸',   color: '#EF4444' },
  { label: '背中', color: '#3B82F6' },
  { label: '脚',   color: '#22C55E' },
  { label: '肩',   color: '#F59E0B' },
  { label: '腕',   color: '#8B5CF6' },
  { label: '腹筋', color: '#EC4899' },
] as const;
type MuscleGroup = (typeof MUSCLE_GROUPS)[number]['label'];

type HistWorkout = { name: string; muscle: string; color: string; sets: number; maxWeight: number };
type HistEntry   = { date: string; weekday: string; month: number; day: number; workouts: HistWorkout[] };

const HISTORY: HistEntry[] = [
  {
    date: '6/6', weekday: '土', month: 6, day: 6,
    workouts: [
      { name: 'スクワット',       muscle: '脚', color: '#22C55E', sets: 3, maxWeight: 87.5 },
      { name: 'ショルダープレス', muscle: '肩', color: '#F59E0B', sets: 2, maxWeight: 45   },
    ],
  },
  {
    date: '6/4', weekday: '木', month: 6, day: 4,
    workouts: [
      { name: 'デッドリフト', muscle: '背中', color: '#3B82F6', sets: 3, maxWeight: 110 },
    ],
  },
  {
    date: '6/2', weekday: '火', month: 6, day: 2,
    workouts: [
      { name: 'ベンチプレス', muscle: '胸', color: '#EF4444', sets: 3, maxWeight: 72.5 },
    ],
  },
  {
    date: '5/30', weekday: '金', month: 5, day: 30,
    workouts: [
      { name: 'ベンチプレス', muscle: '胸', color: '#EF4444', sets: 3, maxWeight: 70 },
      { name: 'アームカール', muscle: '腕', color: '#8B5CF6', sets: 3, maxWeight: 20 },
    ],
  },
  {
    date: '5/23', weekday: '土', month: 5, day: 23,
    workouts: [
      { name: 'スクワット', muscle: '脚', color: '#22C55E', sets: 3, maxWeight: 82.5 },
    ],
  },
  {
    date: '5/16', weekday: '金', month: 5, day: 16,
    workouts: [
      { name: 'デッドリフト',     muscle: '背中', color: '#3B82F6', sets: 3, maxWeight: 100 },
      { name: 'ショルダープレス', muscle: '肩',   color: '#F59E0B', sets: 3, maxWeight: 42.5 },
    ],
  },
  {
    date: '5/9', weekday: '金', month: 5, day: 9,
    workouts: [
      { name: 'ベンチプレス', muscle: '胸', color: '#EF4444', sets: 3, maxWeight: 65 },
      { name: 'スクワット',   muscle: '脚', color: '#22C55E', sets: 3, maxWeight: 80 },
    ],
  },
];

// ─── ユーティリティ ───────────────────────────────────────────

function spacing(n: number): number {
  return Math.max(20, Math.floor((CHART_W - 20) / Math.max(n - 1, 1)));
}
function fmtVol(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v > 0)      return `${(v / 1000).toFixed(1)}k`;
  return '';
}

function applyHistFilter(
  entries: HistEntry[],
  period: HistPeriod,
  muscles: string[],
): HistEntry[] {
  const today = new Date();
  const year  = today.getFullYear();

  let result = entries.filter(e => {
    const d = new Date(year, e.month - 1, e.day);
    if (period === '今週') {
      const sun = new Date(today);
      sun.setDate(today.getDate() - today.getDay());
      sun.setHours(0, 0, 0, 0);
      return d >= sun;
    }
    if (period === '今月') {
      return e.month === today.getMonth() + 1;
    }
    return true;
  });

  if (muscles.length > 0) {
    result = result
      .map(e => ({ ...e, workouts: e.workouts.filter(w => muscles.includes(w.muscle)) }))
      .filter(e => e.workouts.length > 0);
  }
  return result;
}

// ─── 履歴フィルターバー（共通 UI） ───────────────────────────

type FilterBarProps = {
  histPeriod:   HistPeriod;
  histMuscles:  string[];
  onPeriod:     (p: HistPeriod) => void;
  onToggleMuscle: (m: string) => void;
};

function FilterBar({ histPeriod, histMuscles, onPeriod, onToggleMuscle }: FilterBarProps) {
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
        <View style={fb.divider} />
        {/* 部位（選択時は部位ごとの色） */}
        {MUSCLE_GROUPS.map(({ label, color }) => {
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

function HistoryCard({ entry }: { entry: HistEntry }) {
  return (
    <View style={hc.card}>
      <View style={hc.header}>
        <View style={hc.dateWrap}>
          <Text style={hc.date}>{entry.date}</Text>
          <Text style={hc.weekday}>（{entry.weekday}）</Text>
        </View>
        <Text style={hc.count}>{entry.workouts.length}種目</Text>
      </View>
      {entry.workouts.map((w, j) => (
        <View key={j} style={[hc.row, j < entry.workouts.length - 1 && hc.rowBorder]}>
          <View style={[hc.bar, { backgroundColor: w.color }]} />
          <View style={hc.info}>
            <Text style={hc.name}>{w.name}</Text>
            <Text style={hc.detail}>{w.sets}セット · 最大 {w.maxWeight}kg</Text>
          </View>
          <View style={[hc.badge, { backgroundColor: w.color + '22' }]}>
            <Text style={[hc.badgeText, { color: w.color }]}>{w.muscle}</Text>
          </View>
        </View>
      ))}
    </View>
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
  const [graphPeriod,    setGraphPeriod]    = useState<GraphPeriod>('週');
  const [exercise,       setExercise]       = useState<Ex>('ベンチプレス');
  const [histPeriod,     setHistPeriod]     = useState<HistPeriod>('全期間');
  const [histMuscles,    setHistMuscles]    = useState<string[]>([]);
  const [histModalOpen,  setHistModalOpen]  = useState(false);

  const volData = VOLUME[graphPeriod];
  const summary = SUMMARY[graphPeriod];
  const wtData  = WEIGHT_DATA[exercise];

  const latestWt = wtData[wtData.length - 1].value;
  const firstWt  = wtData[0].value;
  const wtDiff   = +(latestWt - firstWt).toFixed(1);
  const wtMin    = Math.min(...wtData.map(d => d.value));
  const wtBase   = Math.max(0, Math.floor((wtMin - 8) / 5) * 5);

  const filteredHistory = useMemo(
    () => applyHistFilter(HISTORY, histPeriod, histMuscles),
    [histPeriod, histMuscles],
  );

  const toggleMuscle = (m: string) =>
    setHistMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m],
    );

  const previewHistory = filteredHistory.slice(0, 3);
  const hasMore = filteredHistory.length > 3;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── ヘッダー ─────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>記録</Text>
      </View>

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

        {/* ── サマリー ──────────────────────── */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{summary.count}</Text>
            <Text style={s.summaryLbl}>{summary.label}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{fmtVol(summary.volume)}</Text>
            <Text style={s.summaryLbl}>kg ボリューム</Text>
          </View>
        </View>

        {/* ── ボリューム折れ線グラフ ────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>ボリューム推移</Text>
          <Text style={s.cardSub}>
            {graphPeriod === '週' && '今週の日別ボリューム (重量 × 回数)'}
            {graphPeriod === '月' && '今月の週別ボリューム (重量 × 回数)'}
            {graphPeriod === '年' && '最新12ヶ月のボリューム — 1年超は年ナビゲーションで確認'}
          </Text>
          <LineChart
            areaChart curved isAnimated
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
        </View>

        {/* ── 種目別最大重量 ────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>種目別 最大重量</Text>
          <View style={{ height: Space[3] }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={s.exScroll} contentContainerStyle={s.exContent}>
            {EXERCISES.map(ex => (
              <TouchableOpacity
                key={ex}
                style={[s.exChip, exercise === ex && s.exChipActive]}
                onPress={() => setExercise(ex)}
                activeOpacity={0.75}>
                <Text style={[s.exChipText, exercise === ex && s.exChipTextActive]}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
          onPeriod={setHistPeriod}
          onToggleMuscle={toggleMuscle}
        />

        {/* 履歴カード（最大3件） */}
        {filteredHistory.length === 0 ? (
          <View style={s.emptyHistory}>
            <Text style={s.emptyHistoryText}>該当するトレーニングがありません</Text>
          </View>
        ) : (
          previewHistory.map((entry, i) => <HistoryCard key={i} entry={entry} />)
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
                  {filteredHistory.map((entry, i) => <HistoryCard key={i} entry={entry} />)}
                  <View style={{ height: Space[4] }} />
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },

  header: {
    paddingHorizontal: H_PAD,
    paddingTop: Space[4],
    paddingBottom: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

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
