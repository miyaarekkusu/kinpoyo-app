import React, { useState, useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';

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

// ─── 定数・型 ──────────────────────────────────────────────────
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const MUSCLE_GROUPS = [
  { label: '胸',   color: '#EF4444' },
  { label: '背中', color: '#3B82F6' },
  { label: '脚',   color: '#22C55E' },
  { label: '肩',   color: '#F59E0B' },
  { label: '腕',   color: '#8B5CF6' },
  { label: '腹筋', color: '#EC4899' },
  { label: '有酸素', color: '#14B8A6' },
] as const;

type Cell = { date: number; current: boolean };

type EditSetRow = { weight: string; reps: string };

type EditWorkoutEntry = {
  id: number;
  name: string;
  muscle: string;
  color: string;
  sets: EditSetRow[];
};

// ─── カレンダードット ────────────────────────────────────
const DUMMY_WORKOUT_DOTS: Record<string, string[]> = {
  '6-2':  ['#EF4444'],
  '6-4':  ['#3B82F6'],
  '6-6':  ['#22C55E', '#F59E0B'],
  '6-9':  ['#EF4444', '#8B5CF6'],
  '6-11': ['#3B82F6'],
  '6-13': ['#22C55E'],
  '6-16': ['#EC4899'],
  '6-18': ['#EF4444', '#3B82F6'],
  '6-20': ['#22C55E', '#F59E0B'],
  '6-23': ['#8B5CF6'],
  '6-25': ['#EF4444'],
  '6-27': ['#EF4444'], 
};

// ─── ワークアウト詳細 ─────────────────
const DUMMY_EDIT_DATA: Record<string, EditWorkoutEntry[]> = {
  '6-2': [
    { id: 1, name: 'ベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '70', reps: '8' }, { weight: '70', reps: '8' }, { weight: '65', reps: '10' }] },
  ],
  '6-4': [
    { id: 2, name: 'デッドリフト', muscle: '背中', color: '#3B82F6',
      sets: [{ weight: '100', reps: '5' }, { weight: '100', reps: '5' }, { weight: '90', reps: '8' }] },
  ],
  '6-6': [
    { id: 3, name: 'スクワット', muscle: '脚', color: '#22C55E',
      sets: [{ weight: '80', reps: '10' }, { weight: '80', reps: '8' }, { weight: '75', reps: '10' }] },
    { id: 4, name: 'ショルダープレス', muscle: '肩', color: '#F59E0B',
      sets: [{ weight: '40', reps: '12' }, { weight: '40', reps: '10' }] },
  ],
  '6-9': [
    { id: 5, name: 'インクライン・ベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '60', reps: '10' }, { weight: '60', reps: '10' }] },
    { id: 6, name: 'アームカール', muscle: '腕', color: '#8B5CF6',
      sets: [{ weight: '20', reps: '12' }, { weight: '20', reps: '12' }, { weight: '18', reps: '15' }] },
  ],
  '6-13': [
    { id: 7, name: 'スクワット', muscle: '脚', color: '#22C55E',
      sets: [{ weight: '85', reps: '8' }, { weight: '85', reps: '8' }, { weight: '80', reps: '10' }] },
  ],
  '6-18': [
    { id: 8, name: 'ベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '75', reps: '6' }, { weight: '70', reps: '8' }] },
    { id: 9, name: 'ラット・プルダウン', muscle: '背中', color: '#3B82F6',
      sets: [{ weight: '55', reps: '10' }, { weight: '55', reps: '10' }, { weight: '50', reps: '12' }] },
  ],
  '6-27': [
    { id: 10, name: 'ベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '60', reps: '10' }, { weight: '60', reps: '10' }, { weight: '60', reps: '10' }] },
    { id: 11, name: 'インクラインベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '50', reps: '10' }, { weight: '50', reps: '10' }, { weight: '50', reps: '10' }] },
    { id: 12, name: 'ダンベルベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '24', reps: '10' }, { weight: '24', reps: '10' }, { weight: '24', reps: '10' }] },
  ],
};

// ─── ユーティリティ ────────────────────────────────────────────
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

function getDotsForCell(cell: Cell, month: number, filters: string[]): string[] {
  if (!cell.current) return [];
  const key = `${month + 1}-${cell.date}`;
  const allDots = DUMMY_WORKOUT_DOTS[key] ?? [];
  if (filters.length === 0) return allDots.slice(0, 3);
  const MUSCLE_COLORS: Record<string, string> = {
    '胸': '#EF4444', '背中': '#3B82F6', '脚': '#22C55E',
    '肩': '#F59E0B', '腕': '#8B5CF6', '腹筋': '#EC4899', '有酸素': '#14B8A6',
  };
  const fc = filters.map(f => MUSCLE_COLORS[f]).filter(Boolean);
  return allDots.filter(c => fc.includes(c)).slice(0, 3);
}

export default function CalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(today.toDateString());

  const grid = buildGrid(year, month);
  const rows = useMemo(() => {
    const rs: Cell[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
      rs.push(grid.slice(i, i + 7));
    }
    return rs;
  }, [grid]);

  const isToday = (d: number, m: number, y: number) => {
    return d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  };

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

  const dateKey = `${selDate.getMonth() + 1}-${selDate.getDate()}`;
  const calendarWorkouts = DUMMY_EDIT_DATA[dateKey] || [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── ヘッダー Row1: 戻るボタン ───────────── */}
      <View style={styles.headerRow1}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* ── 絞り込みバー ─────────────────────────── */}
      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterToggle} activeOpacity={0.75}>
          <IconSymbol name="slider.horizontal.3" size={15} color={Colors.primaryDark} />
          <Text style={styles.filterToggleText}>絞り込み</Text>
        </TouchableOpacity>
        <View style={styles.activeFilterDots}>
          {MUSCLE_GROUPS.slice(0, 3).map((mg) => (
            <View key={mg.label} style={[styles.activeDot, { backgroundColor: mg.color }]} />
          ))}
        </View>
      </View>

      {/* ── ヘッダー Row2: 年月（中央ぞろえ）+ 今日ボタン ── */}
      <View style={styles.headerRow2}>
        <TouchableOpacity onPress={prevMonth} hitSlop={8}>
          <IconSymbol name="chevron.left" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{`${year}年${month + 1}月`}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={8}>
          <IconSymbol name="chevron.right" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday} hitSlop={8} style={styles.todayBtn}>
          <View style={styles.todayBtnInner}>
            <Text style={styles.todayBtnDate}>{today.getDate()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── スクロールエリア ─────────────────────── */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* カレンダーグリッド */}
        <View style={styles.calendarCard}>
          <View style={styles.dayNameRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.dayName, i === 0 && styles.sunText, i === 6 && styles.satText]}>
                {d}
              </Text>
            ))}
          </View>
          
          {rows.map((row: Cell[], ri: number) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((cell: Cell, ci: number) => {
                const cellDate = new Date(year, month, cell.date);
                const isSelected = cell.current && cellDate.toDateString() === selectedDateStr;
                const cellToday = cell.current && isToday(cell.date, month, year);
                
                return (
                  <TouchableOpacity
                    key={ci}
                    style={styles.cell}
                    disabled={!cell.current}
                    onPress={() => setSelectedDateStr(cellDate.toDateString())}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dateBubble,
                      cellToday && styles.dateBubbleToday,
                      isSelected && !cellToday && styles.dateBubbleSelected,
                    ]}>
                      <Text style={[
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
                      {cell.current && getDotsForCell(cell, month, []).map((color, di) => (
                        <View key={di} style={[styles.dot, { backgroundColor: color }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* 筋トレ一覧 */}
        <View style={styles.workoutSection}>
          <Text style={styles.workoutSectionTitle}>{selLabel}のトレーニング</Text>
          {calendarWorkouts.length === 0 ? (
            <View style={styles.emptyWorkout}>
              <Text style={styles.emptyWorkoutIcon}>🏋️</Text>
              <Text style={styles.emptyTitle}>トレーニングなし</Text>
              <Text style={styles.emptySubtitle}>ワークアウトを登録してみましょう</Text>
            </View>
          ) : (
            calendarWorkouts.map((w) => (
              <View key={w.id} style={styles.workoutItem}>
                <View style={[styles.workoutColorBar, { backgroundColor: w.color }]} />
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutName}>{w.name}</Text>
                  <Text style={styles.workoutDetail}>
                    {w.sets.length}セット · {w.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── ボトムパネル ─────────────────────────── */}
      <View style={styles.bottomPanel}>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.registerBtn} 
            activeOpacity={0.85}
            onPress={() => router.push('/program')}
          >
            <Text style={styles.registerBtnText}>筋トレ登録</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const CALENDAR_ROW_H = 56;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },
  headerRow1: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[1],
    backgroundColor: Colors.bgCard,
  },
  headerRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
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
    right: Layout.screenPaddingH,
  },
  todayBtnInner: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgScreen,
  },
  todayBtnDate: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[2],
    gap: Space[2],
    backgroundColor: Colors.bgCard,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[1],
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
  },
  filterToggleText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  activeFilterDots: { flexDirection: 'row', gap: Space[1], alignItems: 'center' },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: Space[4] },
  calendarCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingTop: Space[4],
    paddingBottom: Space[3],
    marginBottom: Space[3],
    ...Shadow.sm,
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
    height: CALENDAR_ROW_H,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  dateBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  workoutSection: { paddingHorizontal: Layout.screenPaddingH, marginTop: Space[3] },
  workoutSectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
  },
  emptyWorkout: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[8],
    alignItems: 'center',
    marginBottom: Space[4],
    ...Shadow.sm,
  },
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
  emptyWorkoutIcon: { fontSize: 40, marginBottom: Space[2] },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[2],
    gap: Space[3],
    ...Shadow.sm,
  },
  workoutColorBar: { width: 4, height: 36, borderRadius: 2 },
  workoutInfo: { flex: 1 },
  workoutName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 2 },
  workoutDetail: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  bottomPanel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[4],
  },
  actionRow: { flexDirection: 'row', gap: Space[3] },
  registerBtn: {
    flex: 1,
    height: Layout.buttonHeightLg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  registerBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});