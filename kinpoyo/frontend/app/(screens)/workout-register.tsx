import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';

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
import { ExerciseOut, Movement, fetchExercises } from '@/services/exercises';
import { createWorkout, toIsoDate } from '@/services/workout';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const MOVEMENT_LABELS: Record<Movement, string> = {
  push: 'プッシュ',
  pull: 'プル',
  legs: 'レッグ',
};

type SetInput = { key: string; weight: string; reps: string };
type SessionExerciseInput = { key: string; exercise: ExerciseOut; sets: SetInput[] };

function resolveTargetDate(params: { year?: string; month?: string; date?: string }): Date {
  const { year, month, date } = params;
  if (year && month !== undefined && date) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(date);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  return new Date();
}

export default function WorkoutRegisterScreen() {
  const params = useLocalSearchParams<{ year?: string; month?: string; date?: string }>();
  const { token } = useAuth();

  const targetDate = resolveTargetDate(params);
  const dateLabel = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日（${WEEKDAYS[targetDate.getDay()]}）`;

  // ── 種目マスター ──────────────────────────────
  const [exercises, setExercises] = useState<ExerciseOut[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadExercises = async () => {
    setLoadingExercises(true);
    setLoadError(null);
    try {
      const data = await fetchExercises();
      setExercises(data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '種目一覧の取得に失敗しました');
    } finally {
      setLoadingExercises(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  // ── セッション組み立て ────────────────────────
  const [sessionExercises, setSessionExercises] = useState<SessionExerciseInput[]>([]);
  const idCounter = useRef(0);
  const nextKey = () => `k${idCounter.current++}`;

  const [pickerVisible, setPickerVisible] = useState(false);
  const [movementFilter, setMovementFilter] = useState<Movement | 'all'>('all');
  const [muscleFilter, setMuscleFilter] = useState<string | 'all'>('all');

  const muscleOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach(e => set.add(e.muscle));
    return Array.from(set);
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(e => {
      if (movementFilter !== 'all' && e.movement !== movementFilter) return false;
      if (muscleFilter !== 'all' && e.muscle !== muscleFilter) return false;
      return true;
    });
  }, [exercises, movementFilter, muscleFilter]);

  const addedExerciseIds = useMemo(
    () => new Set(sessionExercises.map(se => se.exercise.id)),
    [sessionExercises]
  );

  const addExercise = (exercise: ExerciseOut) => {
    if (addedExerciseIds.has(exercise.id)) return;
    setSessionExercises(prev => [
      ...prev,
      { key: nextKey(), exercise, sets: [{ key: nextKey(), weight: '', reps: '' }] },
    ]);
  };

  const removeExercise = (key: string) => {
    setSessionExercises(prev => prev.filter(se => se.key !== key));
  };

  const addSetRow = (exerciseKey: string) => {
    setSessionExercises(prev =>
      prev.map(se =>
        se.key === exerciseKey
          ? { ...se, sets: [...se.sets, { key: nextKey(), weight: '', reps: '' }] }
          : se
      )
    );
  };

  const removeSetRow = (exerciseKey: string, setKey: string) => {
    setSessionExercises(prev =>
      prev.map(se =>
        se.key === exerciseKey ? { ...se, sets: se.sets.filter(s => s.key !== setKey) } : se
      )
    );
  };

  const updateSetRow = (exerciseKey: string, setKey: string, field: 'weight' | 'reps', value: string) => {
    setSessionExercises(prev =>
      prev.map(se =>
        se.key === exerciseKey
          ? {
              ...se,
              sets: se.sets.map(s => (s.key === setKey ? { ...s, [field]: value } : s)),
            }
          : se
      )
    );
  };

  // ── 保存 ──────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (sessionExercises.length === 0) {
      setError('種目を1つ以上追加してください');
      return;
    }
    setIsSubmitting(true);
    try {
      await createWorkout(token, {
        scheduled_date: toIsoDate(targetDate),
        exercises: sessionExercises.map(se => ({
          exercise_id: se.exercise.id,
          sets: se.sets.map(s => {
            const set: { weight_kg?: number; reps?: number } = {};
            if (s.weight.trim() !== '') set.weight_kg = Number(s.weight);
            if (s.reps.trim() !== '') set.reps = Number(s.reps);
            return set;
          }),
        })),
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── ヘッダー ─────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>筋トレメニュー登録</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── 日付カード ─────────────────────── */}
        <View style={styles.dateCard}>
          <View style={styles.dateCardLeft}>
            <IconSymbol name="calendar" size={18} color={Colors.primaryDark} />
            <Text style={styles.dateCardText}>{dateLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.changeBtnText}>変更</Text>
          </TouchableOpacity>
        </View>

        {/* ── 種目一覧 ───────────────────────── */}
        {sessionExercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>種目が未追加です</Text>
            <Text style={styles.emptySubtitle}>下のボタンから種目を追加しましょう</Text>
          </View>
        ) : (
          sessionExercises.map(se => (
            <View key={se.key} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <View style={styles.exerciseCardHeaderLeft}>
                  {se.exercise.muscle_color && (
                    <View style={[styles.muscleDot, { backgroundColor: se.exercise.muscle_color }]} />
                  )}
                  <Text style={styles.exerciseName}>{se.exercise.name}</Text>
                  <View style={styles.muscleBadge}>
                    <Text style={styles.muscleBadgeText}>{se.exercise.muscle}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeExercise(se.key)} hitSlop={8}>
                  <IconSymbol name="trash" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.setTableHeader}>
                <Text style={[styles.setTableHeaderText, styles.setColSet]}>セット</Text>
                <Text style={[styles.setTableHeaderText, styles.setColInput]}>重量(kg)</Text>
                <Text style={[styles.setTableHeaderText, styles.setColInput]}>レップ数</Text>
                <View style={styles.setColAction} />
              </View>

              {se.sets.map((s, idx) => (
                <View key={s.key} style={styles.setRow}>
                  <Text style={[styles.setRowText, styles.setColSet]}>{idx + 1}</Text>
                  <TextInput
                    style={[styles.setInput, styles.setColInput]}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.textHint}
                    value={s.weight}
                    onChangeText={v => updateSetRow(se.key, s.key, 'weight', v)}
                  />
                  <TextInput
                    style={[styles.setInput, styles.setColInput]}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.textHint}
                    value={s.reps}
                    onChangeText={v => updateSetRow(se.key, s.key, 'reps', v)}
                  />
                  <TouchableOpacity
                    style={styles.setColAction}
                    onPress={() => removeSetRow(se.key, s.key)}
                    hitSlop={8}>
                    <IconSymbol name="xmark" size={16} color={Colors.textHint} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetRow(se.key)} activeOpacity={0.75}>
                <IconSymbol name="plus" size={14} color={Colors.primaryDark} />
                <Text style={styles.addSetBtnText}>セットを追加</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.85}>
          <IconSymbol name="plus" size={18} color={Colors.primaryDark} />
          <Text style={styles.addExerciseBtnText}>種目を追加</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── 保存パネル ─────────────────────────── */}
      <View style={styles.bottomPanel}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.saveBtn}
          activeOpacity={0.85}
          disabled={isSubmitting}
          onPress={handleSave}>
          {isSubmitting ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>筋トレメニューを保存する</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── 種目選択モーダル ───────────────────── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerVisible(false)}
        onDismiss={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>種目を選ぶ</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={8}>
              <IconSymbol name="xmark" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterChipsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsContent}>
              <TouchableOpacity
                style={[styles.chip, movementFilter === 'all' && styles.chipActive]}
                onPress={() => setMovementFilter('all')}>
                <Text style={[styles.chipText, movementFilter === 'all' && styles.chipTextActive]}>すべて</Text>
              </TouchableOpacity>
              {(['push', 'pull', 'legs'] as Movement[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, movementFilter === m && styles.chipActive]}
                  onPress={() => setMovementFilter(m)}>
                  <Text style={[styles.chipText, movementFilter === m && styles.chipTextActive]}>
                    {MOVEMENT_LABELS[m]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterChipsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsContent}>
              <TouchableOpacity
                style={[styles.chip, muscleFilter === 'all' && styles.chipActive]}
                onPress={() => setMuscleFilter('all')}>
                <Text style={[styles.chipText, muscleFilter === 'all' && styles.chipTextActive]}>部位すべて</Text>
              </TouchableOpacity>
              {muscleOptions.map(muscle => (
                <TouchableOpacity
                  key={muscle}
                  style={[styles.chip, muscleFilter === muscle && styles.chipActive]}
                  onPress={() => setMuscleFilter(muscle)}>
                  <Text style={[styles.chipText, muscleFilter === muscle && styles.chipTextActive]}>{muscle}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loadingExercises ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={Colors.primaryDark} size="large" />
            </View>
          ) : loadError ? (
            <View style={styles.centerBox}>
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
              <TouchableOpacity style={styles.retryBtn} onPress={loadExercises}>
                <Text style={styles.retryBtnText}>再読み込み</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.exerciseListContent}>
              {filteredExercises.map(ex => {
                const added = addedExerciseIds.has(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={styles.exerciseListItem}
                    disabled={added}
                    onPress={() => addExercise(ex)}
                    activeOpacity={0.7}>
                    <View style={styles.exerciseListItemLeft}>
                      {ex.muscle_color && (
                        <View style={[styles.muscleDot, { backgroundColor: ex.muscle_color }]} />
                      )}
                      <Text style={styles.exerciseListItemName}>{ex.name}</Text>
                      <View style={styles.muscleBadge}>
                        <Text style={styles.muscleBadgeText}>{ex.muscle}</Text>
                      </View>
                    </View>
                    {added ? (
                      <IconSymbol name="checkmark" size={18} color={Colors.primaryDark} />
                    ) : (
                      <IconSymbol name="plus" size={18} color={Colors.textHint} />
                    )}
                  </TouchableOpacity>
                );
              })}
              {filteredExercises.length === 0 && (
                <Text style={styles.noResultText}>該当する種目がありません</Text>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },
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
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  scrollArea: { flex: 1 },
  scrollContent: { padding: Layout.screenPaddingH, paddingBottom: Space[8] },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  dateCardLeft: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  dateCardText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  changeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textLink },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[8],
    alignItems: 'center',
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  emptyIcon: { fontSize: 40, marginBottom: Space[2] },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Space[1],
  },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textHint },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
  },
  exerciseCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Space[2], flexShrink: 1 },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  exerciseName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  muscleBadge: {
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
  },
  muscleBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[2],
  },
  setTableHeaderText: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  setColSet: { width: 40 },
  setColInput: { flex: 1, marginHorizontal: Space[1] },
  setColAction: { width: 28, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[2],
  },
  setRowText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  setInput: {
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space[2],
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[1],
    paddingVertical: Space[2],
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
  },
  addSetBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primaryDark },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    height: Layout.buttonHeightMd,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.bgCard,
  },
  addExerciseBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  bottomPanel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[4],
    gap: Space[2],
  },
  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  saveBtn: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

  // ── モーダル ───────────────────────────
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginLeft: Space[2] },
  filterChipsRow: { paddingVertical: Space[2], borderBottomWidth: 1, borderBottomColor: Colors.divider },
  filterChipsContent: { paddingHorizontal: Layout.screenPaddingH, gap: Space[2] },
  chip: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[1] + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
    marginRight: Space[2],
  },
  chipActive: {
    backgroundColor: Colors.primarySubtle,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.primaryDark, fontWeight: FontWeight.bold },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space[6], gap: Space[3] },
  retryBtn: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  exerciseListContent: { paddingHorizontal: Layout.screenPaddingH, paddingVertical: Space[3] },
  exerciseListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exerciseListItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Space[2], flexShrink: 1 },
  exerciseListItemName: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  noResultText: { textAlign: 'center', color: Colors.textHint, fontSize: FontSize.sm, marginTop: Space[6] },
});
