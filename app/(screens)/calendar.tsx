import React, { useState } from 'react';
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

// ─── ダミーカレンダードット ────────────────────────────────────
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
  '6-27': ['#3B82F6', '#22C55E'],
};

// ─── ダミーワークアウト詳細（修正モーダル用） ─────────────────
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

let _editNextId = 100;

// ─── 画面コンポーネント ────────────────────────────────────────
export default function CalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today.getDate());

  // フィルターモーダル
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [pendingFilters, setPendingFilters] = useState<string[]>([]);

  // 修正モーダル（削除をメイン一覧に反映するためのstate）
  const [workoutDataState, setWorkoutDataState] = useState<Record<string, EditWorkoutEntry[]>>(
    { ...DUMMY_EDIT_DATA },
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editWorkouts, setEditWorkouts] = useState<EditWorkoutEntry[]>([]);

  const grid = buildGrid(year, month);
  const rows: Cell[][] = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, (i + 1) * 7));

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(today.getDate());
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDate(1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDate(1);
  };

  // フィルター操作
  const openFilter = () => { setPendingFilters([...activeFilters]); setFilterModalOpen(true); };
  const applyFilter = () => { setActiveFilters([...pendingFilters]); setFilterModalOpen(false); };
  const resetFilter = () => setPendingFilters([]);
  const togglePending = (label: string) =>
    setPendingFilters(prev => prev.includes(label) ? prev.filter(f => f !== label) : [...prev, label]);

  // 修正モーダル操作
  const openEditModal = () => {
    const key = `${month + 1}-${selectedDate}`;
    const data = workoutDataState[key] ?? [];
    setEditWorkouts(data.map(w => ({ ...w, sets: w.sets.map(s => ({ ...s })) })));
    setEditModalOpen(true);
  };

  const saveEditModal = () => {
    const key = `${month + 1}-${selectedDate}`;
    setWorkoutDataState(prev => ({ ...prev, [key]: editWorkouts }));
    setEditModalOpen(false);
  };

  const deleteEditWorkout = (id: number) =>
    setEditWorkouts(prev => prev.filter(w => w.id !== id));

  const updateEditSet = (wid: number, si: number, field: keyof EditSetRow, v: string) =>
    setEditWorkouts(prev =>
      prev.map(w => w.id !== wid ? w : {
        ...w, sets: w.sets.map((s, i) => i === si ? { ...s, [field]: v } : s),
      }),
    );

  const removeEditSet = (wid: number, si: number) =>
    setEditWorkouts(prev =>
      prev.map(w => {
        if (w.id !== wid || w.sets.length <= 1) return w;
        return { ...w, sets: w.sets.filter((_, i) => i !== si) };
      }),
    );

  const addEditSet = (wid: number) =>
    setEditWorkouts(prev =>
      prev.map(w => w.id !== wid ? w : { ...w, sets: [...w.sets, { weight: '', reps: '' }] }),
    );

  const selDow = WEEKDAYS[new Date(year, month, selectedDate).getDay()];
  const selLabel = `${month + 1}月 ${selectedDate}日 ${selDow}`;
  const hasFilters = activeFilters.length > 0;

  const calendarWorkouts = activeFilters.length > 0
    ? (workoutDataState[`${month + 1}-${selectedDate}`] ?? []).filter(w => activeFilters.includes(w.muscle))
    : (workoutDataState[`${month + 1}-${selectedDate}`] ?? []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── ヘッダー Row1: 戻るボタン ───────────── */}
      <View style={styles.headerRow1}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── ヘッダー Row2: 年月 + 今日ボタン ────── */}
      <View style={styles.headerRow2}>
        <TouchableOpacity onPress={prevMonth} hitSlop={8} style={styles.monthArrow}>
          <IconSymbol name="chevron.left" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{year}年{month + 1}月</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={8} style={styles.monthArrow}>
          <IconSymbol name="chevron.right" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={goToToday} hitSlop={8}>
          <View style={styles.todayBtnInner}>
            <Text style={styles.todayBtnDate}>{today.getDate()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 絞り込みバー ─────────────────────────── */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterToggle, hasFilters && styles.filterToggleActive]}
          onPress={openFilter}
          activeOpacity={0.75}>
          <IconSymbol name="slider.horizontal.3" size={15}
            color={hasFilters ? Colors.primaryDark : Colors.textSecondary} />
          <Text style={[styles.filterToggleText, hasFilters && styles.filterToggleTextActive]}>
            絞り込み
          </Text>
        </TouchableOpacity>
        {hasFilters && (
          <View style={styles.activeFilterDots}>
            {activeFilters.map(label => {
              const mg = MUSCLE_GROUPS.find(m => m.label === label);
              return mg ? <View key={label} style={[styles.activeDot, { backgroundColor: mg.color }]} /> : null;
            })}
          </View>
        )}
      </View>

      {/* ── スクロールエリア ─────────────────────── */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* カレンダーグリッド */}
        <View style={styles.calendarCard}>
          <View style={styles.dayHeaderRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.dayHeader, i === 0 && styles.sunText, i === 6 && styles.satText]}>
                {d}
              </Text>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((cell, ci) => {
                const todayCell = cell.current && isToday(cell.date);
                const selected = cell.current && cell.date === selectedDate;
                return (
                  <TouchableOpacity key={ci} style={styles.cell}
                    onPress={() => cell.current && setSelectedDate(cell.date)} activeOpacity={0.7}>
                    <View style={[
                      styles.dateBubble,
                      todayCell && styles.dateBubbleToday,
                      selected && !todayCell && styles.dateBubbleSelected,
                    ]}>
                      <Text style={[
                        styles.cellText,
                        !cell.current && styles.cellTextOutside,
                        cell.current && ci === 0 && styles.sunText,
                        cell.current && ci === 6 && styles.satText,
                        todayCell && styles.cellTextToday,
                        selected && !todayCell && styles.cellTextSelected,
                      ]}>
                        {cell.date}
                      </Text>
                    </View>
                    <View style={styles.dotsRow}>
                      {getDotsForCell(cell, month, activeFilters).map((color, di) => (
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
              <Text style={styles.emptyWorkoutText}>登録されているトレーニングがありません</Text>
            </View>
          ) : (
            calendarWorkouts.map(w => (
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
          <TouchableOpacity style={styles.registerBtn} activeOpacity={0.85}
            onPress={() => router.push('/workout-register')}>
            <Text style={styles.registerBtnText}>筋トレ登録</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.85} onPress={openEditModal}>
            <Text style={styles.editBtnText}>筋トレ修正</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ════ 絞り込みモーダル ════════════════════ */}
      <Modal visible={filterModalOpen} transparent animationType="slide"
        onRequestClose={() => setFilterModalOpen(false)}>
        <View style={styles.modalWrapper}>
          <TouchableWithoutFeedback onPress={() => setFilterModalOpen(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>絞り込み</Text>
              <TouchableOpacity onPress={resetFilter} hitSlop={8}>
                <Text style={styles.resetText}>リセット</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSectionLabel}>部位を選択</Text>
            <View style={styles.filterGrid}>
              {/* すべて */}
              <TouchableOpacity
                style={[styles.filterChip, pendingFilters.length === 0 && styles.filterChipAll]}
                onPress={() => setPendingFilters([])}
                activeOpacity={0.75}>
                <Text style={[styles.filterChipText, pendingFilters.length === 0 && styles.filterChipAllText]}>
                  すべて
                </Text>
              </TouchableOpacity>

              {MUSCLE_GROUPS.map(({ label, color }) => {
                const active = pendingFilters.includes(label);
                return (
                  <TouchableOpacity key={label}
                    style={[styles.filterChip, active && { borderColor: color, backgroundColor: color + '22' }]}
                    onPress={() => togglePending(label)} activeOpacity={0.75}>
                    <View style={[styles.filterDot, { backgroundColor: color }]} />
                    <Text style={[styles.filterChipText, active && { color, fontWeight: FontWeight.bold }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={applyFilter} activeOpacity={0.85}>
              <Text style={styles.applyBtnText}>適用する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════ 筋トレ修正モーダル（中央） ════════ */}
      <Modal visible={editModalOpen} transparent animationType="fade"
        onRequestClose={() => setEditModalOpen(false)}>
        <View style={styles.centeredOverlay}>
          <View style={styles.centeredDialog}>
            {/* ヘッダー */}
            <View style={styles.editModalHeader}>
              <View>
                <Text style={styles.editModalTitle}>筋トレ修正</Text>
                <Text style={styles.editModalDate}>{selLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalOpen(false)} hitSlop={8}
                style={styles.editModalClose}>
                <IconSymbol name="xmark" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* コンテンツ（スクロール） */}
            <ScrollView contentContainerStyle={styles.editModalScroll}
              keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              style={styles.editModalScrollView}>

              {editWorkouts.length === 0 ? (
                <View style={styles.editEmptyState}>
                  <Text style={styles.emptyWorkoutIcon}>🏋️</Text>
                  <Text style={styles.emptyWorkoutText}>この日のトレーニングはありません</Text>
                </View>
              ) : (
                editWorkouts.map(w => (
                  <View key={w.id} style={styles.editCard}>
                    {/* 種目ヘッダー */}
                    <View style={styles.editCardHeader}>
                      <View style={[styles.editColorBar, { backgroundColor: w.color }]} />
                      <Text style={styles.editWorkoutName}>{w.name}</Text>
                      <View style={[styles.editMuscleBadge, { backgroundColor: w.color + '20' }]}>
                        <Text style={[styles.editMuscleBadgeText, { color: w.color }]}>{w.muscle}</Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteEditWorkout(w.id)} hitSlop={8}
                        style={styles.deleteWorkoutBtn}>
                        <IconSymbol name="trash" size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>

                    {/* セットテーブルヘッダー */}
                    <View style={styles.editSetHeader}>
                      <View style={{ width: 24 }} />
                      <Text style={styles.editSetHeaderLabel}>重量(kg)</Text>
                      <Text style={styles.editSetHeaderLabel}>回数</Text>
                      <View style={{ width: 24 }} />
                    </View>

                    {/* セット行 */}
                    {w.sets.map((s, si) => (
                      <View key={si} style={styles.editSetRow}>
                        <View style={styles.editSetNum}>
                          <Text style={styles.editSetNumText}>{si + 1}</Text>
                        </View>
                        <TextInput
                          style={styles.editSetInput}
                          value={s.weight}
                          onChangeText={v => updateEditSet(w.id, si, 'weight', v)}
                          keyboardType="decimal-pad"
                          placeholder="─"
                          placeholderTextColor={Colors.textHint}
                          textAlign="center"
                        />
                        <TextInput
                          style={styles.editSetInput}
                          value={s.reps}
                          onChangeText={v => updateEditSet(w.id, si, 'reps', v)}
                          keyboardType="number-pad"
                          placeholder="─"
                          placeholderTextColor={Colors.textHint}
                          textAlign="center"
                        />
                        {w.sets.length > 1 && (
                          <TouchableOpacity onPress={() => removeEditSet(w.id, si)} hitSlop={8}
                            style={styles.deleteSetBtn}>
                            <IconSymbol name="xmark" size={11} color={Colors.textHint} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}

                    {/* セット追加 */}
                    <TouchableOpacity style={styles.addSetRow} onPress={() => addEditSet(w.id)}
                      activeOpacity={0.7}>
                      <IconSymbol name="plus" size={13} color={Colors.primaryDark} />
                      <Text style={styles.addSetText}>セットを追加</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {/* 保存ボタン */}
            <TouchableOpacity style={styles.saveBtn} onPress={saveEditModal} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>変更を保存する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const CALENDAR_ROW_H = 56;
const CALENDAR_H =
  32 +
  CALENDAR_ROW_H * 6 +
  Space[3] + Space[3];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },

  // ── ヘッダー2行構成
  headerRow1: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[1],
    backgroundColor: Colors.bgCard,
  },
  headerRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: Space[3],
    backgroundColor: Colors.bgCard,
    gap: Space[2],
  },
  monthArrow: { padding: Space[1] },
  monthTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
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

  // ── 絞り込みバー
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[2],
    gap: Space[2],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
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
  filterToggleActive: {
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
  },
  filterToggleText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  filterToggleTextActive: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.semibold,
  },
  activeFilterDots: { flexDirection: 'row', gap: Space[1], alignItems: 'center' },
  activeDot: { width: 8, height: 8, borderRadius: 4 },

  // ── スクロール
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: Space[4] },

  // ── カレンダー
  calendarCard: {
    height: CALENDAR_H,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[3],
    marginBottom: Space[3],
  },
  dayHeaderRow: { flexDirection: 'row', height: 32, alignItems: 'center' },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textHint,
  },
  sunText: { color: '#EF4444' },
  satText: { color: '#3B82F6' },
  gridRow: { height: CALENDAR_ROW_H, flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dateBubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dateBubbleToday: { backgroundColor: Colors.textPrimary },
  dateBubbleSelected: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  cellText: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  cellTextOutside: { color: Colors.textHint },
  cellTextToday: { color: Colors.textOnPrimary, fontWeight: FontWeight.bold },
  cellTextSelected: { color: Colors.primaryDark, fontWeight: FontWeight.bold },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 3, height: 8, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },

  // ── 筋トレ一覧
  workoutSection: { paddingHorizontal: Layout.screenPaddingH },
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
    gap: Space[2],
    ...Shadow.sm,
  },
  emptyWorkoutIcon: { fontSize: 36 },
  emptyWorkoutText: { fontSize: FontSize.sm, color: Colors.textHint },
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
  workoutName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 2 },
  workoutDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // ── ボトムパネル
  bottomPanel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[6],
  },
  actionRow: { flexDirection: 'row', gap: Space[3] },
  registerBtn: {
    flex: 1,
    height: Layout.buttonHeightLg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
    shadowColor: Colors.primary,
  },
  registerBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  editBtn: {
    flex: 1,
    height: Layout.buttonHeightLg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { color: Colors.primaryDark, fontSize: FontSize.base, fontWeight: FontWeight.bold },

  // ── 絞り込みモーダル（ボトムシート）
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.bgOverlay },
  modalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[2],
    paddingBottom: Space[10],
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginBottom: Space[4],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[4],
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resetText: { fontSize: FontSize.sm, color: Colors.textLink, fontWeight: FontWeight.medium },
  modalSectionLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.medium,
    color: Colors.textSecondary, marginBottom: Space[3],
  },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], marginBottom: Space[6] },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: Space[2],
    paddingHorizontal: Space[4], paddingVertical: Space[2],
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  filterDot: { width: 10, height: 10, borderRadius: 5 },
  filterChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  filterChipAll: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  filterChipAllText: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.bold,
  },
  applyBtn: {
    height: Layout.buttonHeightLg, borderRadius: Radius.lg,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadow.md, shadowColor: Colors.primary,
  },
  applyBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

  // ── 筋トレ修正モーダル（中央ダイアログ）
  centeredOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgOverlay,
    paddingHorizontal: Space[5],
  },
  centeredDialog: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    paddingBottom: Space[4],
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Space[4],
    paddingTop: Space[4],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  editModalTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  editModalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgScreen, alignItems: 'center', justifyContent: 'center',
  },
  editModalDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editModalScrollView: {
    maxHeight: 400,
  },
  editModalScroll: {
    paddingHorizontal: Space[4],
    paddingTop: Space[3],
    paddingBottom: Space[2],
  },
  editEmptyState: {
    alignItems: 'center',
    paddingVertical: Space[8],
    gap: Space[2],
  },

  // 修正カード
  editCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  editCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    marginBottom: Space[3],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  editColorBar: { width: 4, height: 24, borderRadius: 2 },
  editWorkoutName: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  editMuscleBadge: {
    paddingHorizontal: Space[2], paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  editMuscleBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  deleteWorkoutBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.errorSubtle,
    alignItems: 'center', justifyContent: 'center',
  },

  // セット編集行
  editSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Space[2],
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  editSetHeaderLabel: {
    flex: 1, fontSize: FontSize.xs, fontWeight: FontWeight.medium,
    color: Colors.textHint, textAlign: 'center',
  },
  editSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginBottom: 4,
    gap: 4,
  },
  editSetNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  editSetNumText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  editSetInput: {
    flex: 1, height: 40,
    borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
    fontSize: FontSize.base, fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  deleteSetBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center', justifyContent: 'center',
  },

  addSetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Space[1], paddingVertical: Space[3],
    marginTop: Space[1], borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  addSetText: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: FontWeight.semibold },

  saveBtn: {
    height: Layout.buttonHeightMd,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Space[4],
    marginTop: Space[2],
    ...Shadow.sm,
    shadowColor: Colors.primaryDark,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
});
