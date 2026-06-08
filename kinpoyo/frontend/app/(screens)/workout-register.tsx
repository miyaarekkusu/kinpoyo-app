import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

// ─── 型定義 ───────────────────────────────────────────────────
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const MUSCLE_PARTS = ['胸', '背中', '脚', '肩', '腕', '腹筋'] as const;
type MusclePart = (typeof MUSCLE_PARTS)[number];

type SetRow = { sets: string; reps: string; weight: string };

type ExerciseEntry = {
  id: number;
  name: string;
  selectedPart: MusclePart | null;
  setRows: SetRow[];
};

// ─── 種目マスターデータ ───────────────────────────────────────
type Movement = 'push' | 'pull' | 'leg';

type ExerciseMaster = {
  name: string;
  movement: Movement;
  muscle: MusclePart;
};

const ALL_EXERCISES: ExerciseMaster[] = [
  // Push
  { name: 'ベンチプレス',                   movement: 'push', muscle: '胸' },
  { name: 'インクライン・ベンチプレス',      movement: 'push', muscle: '胸' },
  { name: 'ダンベルフライ',                  movement: 'push', muscle: '胸' },
  { name: 'プッシュアップ',                  movement: 'push', muscle: '胸' },
  { name: 'ショルダープレス',                movement: 'push', muscle: '肩' },
  { name: 'サイドレイズ',                    movement: 'push', muscle: '肩' },
  { name: 'フロントレイズ',                  movement: 'push', muscle: '肩' },
  { name: 'トライセプス・エクステンション',  movement: 'push', muscle: '腕' },
  { name: 'トライセプス・プッシュダウン',    movement: 'push', muscle: '腕' },
  // Pull
  { name: 'デッドリフト',                   movement: 'pull', muscle: '背中' },
  { name: 'ラット・プルダウン',              movement: 'pull', muscle: '背中' },
  { name: 'ベント・オーバーロウ',            movement: 'pull', muscle: '背中' },
  { name: 'シーテッドロウ',                 movement: 'pull', muscle: '背中' },
  { name: 'フェイスプル',                   movement: 'pull', muscle: '背中' },
  { name: 'アームカール',                   movement: 'pull', muscle: '腕' },
  { name: 'ハンマーカール',                 movement: 'pull', muscle: '腕' },
  { name: 'クランチ',                       movement: 'pull', muscle: '腹筋' },
  { name: 'プランク',                       movement: 'pull', muscle: '腹筋' },
  { name: 'レッグレイズ',                   movement: 'pull', muscle: '腹筋' },
  { name: 'ロシアンツイスト',               movement: 'pull', muscle: '腹筋' },
  // Leg
  { name: 'スクワット',                     movement: 'leg', muscle: '脚' },
  { name: 'レッグプレス',                   movement: 'leg', muscle: '脚' },
  { name: 'ランジ',                         movement: 'leg', muscle: '脚' },
  { name: 'レッグカール',                   movement: 'leg', muscle: '脚' },
  { name: 'レッグエクステンション',         movement: 'leg', muscle: '脚' },
  { name: 'カーフレイズ',                   movement: 'leg', muscle: '脚' },
  { name: 'ヒップスラスト',                 movement: 'leg', muscle: '脚' },
];

const MOVEMENT_LABELS: Record<Movement, string> = {
  push: 'Push',
  pull: 'Pull',
  leg: 'Leg',
};

const MUSCLE_COLORS: Record<MusclePart, string> = {
  胸: '#EF4444',
  背中: '#3B82F6',
  脚: '#22C55E',
  肩: '#F59E0B',
  腕: '#8B5CF6',
  腹筋: '#EC4899',
};

// ─── ユーティリティ ────────────────────────────────────────────
let _nextId = 2;

function newExercise(id: number, name = '', part: MusclePart | null = null): ExerciseEntry {
  return {
    id,
    name,
    selectedPart: part,
    setRows: [{ sets: '3', reps: '10', weight: '' }],
  };
}

// ─── コンポーネント ────────────────────────────────────────────
export default function KintoreTourokuScreen() {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const dateLabel = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${WEEKDAYS[today.getDay()]}）`;

  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);

  // 種目選択モーダル
  const [showModal, setShowModal] = useState(false);
  const [filterMode, setFilterMode] = useState<'movement' | 'muscle'>('movement');
  const [movFilter, setMovFilter] = useState<Movement | 'all'>('all');
  const [muscleFilter, setMuscleFilter] = useState<MusclePart | 'all'>('all');

  // ── 種目操作
  const updateName = (id: number, v: string) =>
    setExercises(prev => prev.map(e => e.id === id ? { ...e, name: v } : e));

  const removeExercise = (id: number) =>
    setExercises(prev => prev.filter(e => e.id !== id));

  // ── セット操作
  const updateSet = (id: number, ri: number, field: keyof SetRow, v: string) =>
    setExercises(prev =>
      prev.map(e => {
        if (e.id !== id) return e;
        const rows = e.setRows.map((r, i) => i === ri ? { ...r, [field]: v } : r);
        return { ...e, setRows: rows };
      }),
    );

  const addSet = (id: number) =>
    setExercises(prev =>
      prev.map(e => e.id === id
        ? { ...e, setRows: [...e.setRows, { sets: '', reps: '', weight: '' }] }
        : e,
      ),
    );

  const removeSet = (id: number, ri: number) =>
    setExercises(prev =>
      prev.map(e => {
        if (e.id !== id || e.setRows.length <= 1) return e;
        return { ...e, setRows: e.setRows.filter((_, i) => i !== ri) };
      }),
    );

  // ── 種目選択モーダル
  const openModal = () => {
    setFilterMode('movement');
    setMovFilter('all');
    setMuscleFilter('all');
    setShowModal(true);
  };

  const selectExercise = (ex: ExerciseMaster) => {
    setExercises(prev => [...prev, newExercise(_nextId++, ex.name, ex.muscle)]);
    setShowModal(false);
  };

  const filteredExercises: ExerciseMaster[] =
    filterMode === 'movement'
      ? movFilter === 'all' ? ALL_EXERCISES : ALL_EXERCISES.filter(e => e.movement === movFilter)
      : muscleFilter === 'all' ? ALL_EXERCISES : ALL_EXERCISES.filter(e => e.muscle === muscleFilter);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* ── ヘッダー ─────────────────────────── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
              <IconSymbol name="chevron.left" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>筋トレ登録</Text>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
              <Text style={styles.headerDone}>完了</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* ── 日付 ──────────────────────────── */}
            <View style={styles.dateCard}>
              <Text style={styles.dateEmoji}>📅</Text>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <TouchableOpacity style={styles.changeBtn} hitSlop={8}>
                <Text style={styles.changeBtnText}>変更</Text>
              </TouchableOpacity>
            </View>

            {/* ── 空状態 ────────────────────────── */}
            {exercises.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏋️</Text>
                <Text style={styles.emptyTitle}>種目がありません</Text>
                <Text style={styles.emptySub}>下の「種目を追加」から種目を選んでください</Text>
              </View>
            )}

            {/* ── 種目カード ────────────────────── */}
            {exercises.map((ex, exIdx) => (
              <View key={ex.id} style={styles.exerciseCard}>

                {/* カードヘッダー: 種目N + × */}
                <View style={styles.exCardHeader}>
                  <Text style={styles.exNumber}>種目 {exIdx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => removeExercise(ex.id)}
                    hitSlop={8}
                    style={styles.removeBtn}>
                    <IconSymbol name="xmark" size={18} color={Colors.textHint} />
                  </TouchableOpacity>
                </View>

                {/* 種目名（モーダルから選ぶか直接入力） */}
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.nameInput}
                    value={ex.name}
                    onChangeText={v => updateName(ex.id, v)}
                    placeholder="種目名を入力"
                    placeholderTextColor={Colors.textHint}
                    returnKeyType="done"
                  />
                  {ex.selectedPart && (
                    <View style={[styles.partTag, { backgroundColor: MUSCLE_COLORS[ex.selectedPart] + '20' }]}>
                      <View style={[styles.partTagDot, { backgroundColor: MUSCLE_COLORS[ex.selectedPart] }]} />
                      <Text style={[styles.partTagText, { color: MUSCLE_COLORS[ex.selectedPart] }]}>
                        {ex.selectedPart}
                      </Text>
                    </View>
                  )}
                </View>

                {/* セットテーブルヘッダー */}
                <View style={styles.setHeaderRow}>
                  <View style={styles.setNumCol} />
                  <Text style={styles.setHeaderLabel}>セット数</Text>
                  <Text style={styles.setHeaderLabel}>レップ数</Text>
                  <Text style={styles.setHeaderLabel}>重量(kg)</Text>
                  <View style={{ width: 36 }} />
                </View>

                {/* セット行 */}
                {ex.setRows.map((row, ri) => (
                  <View key={ri} style={styles.setRow}>
                    <View style={styles.setNumCol}>
                      <View style={styles.setNumBubble}>
                        <Text style={styles.setNumText}>{ri + 1}</Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.setInput}
                      value={row.sets}
                      onChangeText={v => updateSet(ex.id, ri, 'sets', v)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textHint}
                      textAlign="center"
                    />
                    <TextInput
                      style={styles.setInput}
                      value={row.reps}
                      onChangeText={v => updateSet(ex.id, ri, 'reps', v)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textHint}
                      textAlign="center"
                    />
                    <TextInput
                      style={styles.setInput}
                      value={row.weight}
                      onChangeText={v => updateSet(ex.id, ri, 'weight', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textHint}
                      textAlign="center"
                    />
                    {ex.setRows.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeSet(ex.id, ri)}
                        hitSlop={8}
                        style={styles.setDeleteBtn}>
                        <IconSymbol name="xmark" size={12} color={Colors.textHint} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* セット追加 */}
                <TouchableOpacity
                  style={styles.addSetBtn}
                  onPress={() => addSet(ex.id)}
                  activeOpacity={0.7}
                  hitSlop={8}>
                  <IconSymbol name="plus" size={16} color={Colors.primaryDark} />
                  <Text style={styles.addSetText}>セットを追加</Text>
                </TouchableOpacity>
              </View>
            ))}

          </ScrollView>

          {/* ── 種目追加ボタン（ScrollView外・固定） ─ */}
          <TouchableOpacity
            style={styles.addExerciseBtn}
            onPress={openModal}
            activeOpacity={0.75}>
            <IconSymbol name="plus" size={20} color={Colors.primaryDark} />
            <Text style={styles.addExerciseText}>種目を追加</Text>
          </TouchableOpacity>

          {/* ── 保存ボタン（固定下部） ───────── */}
          <View style={styles.bottomPanel}>
            <SafeAreaView edges={['bottom']}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => router.back()}
                activeOpacity={0.85}>
                <IconSymbol name="dumbbell.fill" size={20} color={Colors.textOnPrimary} />
                <Text style={styles.saveBtnText}>筋トレを保存する</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ════════════════════════════════════════
          種目選択モーダル
      ════════════════════════════════════════ */}
      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}>
        {/* Modal内ではSafeAreaViewが正しく動作しないため、useSafeAreaInsetsで手動対応 */}
        <View style={styles.modalSafe}>

          {/* モーダルヘッダー（ノッチ分を paddingTop で確保） */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + Space[3] }]}>
            <Text style={styles.modalTitle}>種目を選ぶ</Text>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              hitSlop={8}
              style={styles.modalCloseBtn}>
              <IconSymbol name="xmark" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* フィルターモード切替 */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, filterMode === 'movement' && styles.modeBtnActive]}
              onPress={() => setFilterMode('movement')}
              activeOpacity={0.75}>
              <Text style={[styles.modeBtnText, filterMode === 'movement' && styles.modeBtnTextActive]}>
                PPL
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, filterMode === 'muscle' && styles.modeBtnActive]}
              onPress={() => setFilterMode('muscle')}
              activeOpacity={0.75}>
              <Text style={[styles.modeBtnText, filterMode === 'muscle' && styles.modeBtnTextActive]}>
                部位別
              </Text>
            </TouchableOpacity>
          </View>

          {/* フィルターチップ */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsRow}
            style={styles.filterChipsScroll}>
            {filterMode === 'movement' ? (
              <>
                {(['all', 'push', 'pull', 'leg'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, movFilter === f && styles.filterChipActive]}
                    onPress={() => setMovFilter(f)}
                    activeOpacity={0.75}>
                    <Text style={[styles.filterChipText, movFilter === f && styles.filterChipTextActive]}>
                      {f === 'all' ? '全て' : MOVEMENT_LABELS[f]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                {(['all', ...MUSCLE_PARTS] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.filterChip,
                      muscleFilter === f && styles.filterChipActive,
                      muscleFilter === f && f !== 'all' && {
                        backgroundColor: MUSCLE_COLORS[f as MusclePart],
                        borderColor: MUSCLE_COLORS[f as MusclePart],
                      },
                    ]}
                    onPress={() => setMuscleFilter(f as MusclePart | 'all')}
                    activeOpacity={0.75}>
                    <Text style={[
                      styles.filterChipText,
                      muscleFilter === f && styles.filterChipTextActive,
                    ]}>
                      {f === 'all' ? '全て' : f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          {/* 種目リスト（ホームインジケーター分を paddingBottom で確保） */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.exListContent, { paddingBottom: insets.bottom + 40 }]}>
            {filteredExercises.map((ex, i) => {
              const col = MUSCLE_COLORS[ex.muscle];
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.exListItem}
                  onPress={() => selectExercise(ex)}
                  activeOpacity={0.75}>
                  <View style={[styles.exListBar, { backgroundColor: col }]} />
                  <View style={styles.exListInfo}>
                    <Text style={styles.exListName}>{ex.name}</Text>
                    <Text style={styles.exListMeta}>
                      {ex.muscle}　·　{MOVEMENT_LABELS[ex.movement]}
                    </Text>
                  </View>
                  <View style={[styles.exListTag, { backgroundColor: col + '20' }]}>
                    <Text style={[styles.exListTagText, { color: col }]}>
                      {MOVEMENT_LABELS[ex.movement]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },
  flex: { flex: 1 },

  // ── ヘッダー
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerSide: {
    minWidth: 56,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerDone: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryDark,
    textAlign: 'right',
  },

  // ── スクロール
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
    paddingBottom: Space[6],
  },

  // ── 日付カード
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  dateEmoji: { fontSize: 20 },
  dateText: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  changeBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
  },
  changeBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontWeight: FontWeight.medium,
  },

  // ── 種目カード
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Layout.cardPadding,
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  exCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
  },
  exNumber: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 入力グループ
  inputGroup: { marginBottom: Space[4] },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  nameInput: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
    paddingHorizontal: Space[4],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },

  // ── 空状態
  emptyState: {
    alignItems: 'center',
    paddingVertical: Space[8],
    marginBottom: Space[4],
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
  emptyIcon: { fontSize: 40, marginBottom: Space[3] },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Space[2],
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    textAlign: 'center',
    paddingHorizontal: Space[6],
    lineHeight: 20,
  },

  // ── 部位タグ（読み取り専用バッジ）
  partTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Space[1],
    paddingHorizontal: Space[2],
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: Space[2],
  },
  partTagDot: { width: 8, height: 8, borderRadius: 4 },
  partTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  // ── セットテーブル
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[2],
    paddingBottom: Space[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  setHeaderLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textHint,
    textAlign: 'center',
  },
  setNumCol: { width: 36 },
  setDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginBottom: 4,
  },
  setNumBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  setInput: {
    flex: 1,
    height: 44,
    marginHorizontal: 4,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },

  // ── セット追加
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[1],
    paddingVertical: Space[3],
    marginTop: Space[2],
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  addSetText: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontWeight: FontWeight.semibold,
  },

  // ── 種目追加ボタン（ScrollView外・固定）
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    paddingVertical: Space[4],
    marginHorizontal: Layout.screenPaddingH,
    marginVertical: Space[3],
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
  },
  addExerciseText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryDark,
  },

  // ── 保存ボタン
  bottomPanel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[3],
    height: Layout.buttonHeightLg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
    marginBottom: Space[3],
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },

  // ════ モーダル ════════════════════════════

  modalSafe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },

  // モーダルヘッダー
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // モード切替
  modeToggle: {
    flexDirection: 'row',
    margin: Space[4],
    backgroundColor: Colors.divider,
    borderRadius: Radius.lg,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: Colors.bgCard,
    ...Shadow.sm,
  },
  modeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.bold,
  },

  // フィルターチップ
  filterChipsScroll: {
    maxHeight: 48,
    marginBottom: Space[2],
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: Space[2],
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: Space[2],
  },
  filterChip: {
    height: 36,
    minWidth: 60,
    paddingHorizontal: Space[4],
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  filterChipTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.bold,
  },

  // 種目リスト
  exListContent: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[2],
    paddingBottom: 40,
  },
  exListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[2],
    gap: Space[3],
    ...Shadow.sm,
  },
  exListBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  exListInfo: { flex: 1 },
  exListName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exListMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  exListTag: {
    paddingHorizontal: Space[3],
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  exListTagText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});
