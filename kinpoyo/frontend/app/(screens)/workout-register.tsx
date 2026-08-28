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

// セット行と休憩行を好きな順番に積み重ねられるようにする（セットごとにカスタムな
// 休憩を挟めるように。2026-08-24変更：種目単位の一律restSecから移行）。
type SetItem = { key: string; type: 'set'; weight: string; reps: string };
// 「○分○秒」の2つの入力欄で休憩時間を組み立てる（2026-08-24、秒/分タグ切り替え
// から変更。タグ選択よりも直感的という判断）。
type RestItem = { key: string; type: 'rest'; minutes: string; seconds: string };
type ExerciseItem = SetItem | RestItem;
type SessionExerciseInput = { key: string; exercise: ExerciseOut; items: ExerciseItem[] };

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
      // 紐づけ済み（AI回数カウントの較正済みモデルがある）種目だけを出す。
      const data = await fetchExercises(true);
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
      { key: nextKey(), exercise, items: [{ key: nextKey(), type: 'set', weight: '', reps: '' }] },
    ]);
  };

  const removeExercise = (key: string) => {
    setSessionExercises(prev => prev.filter(se => se.key !== key));
  };

  // 種目選択モーダルでの選択解除用（2026-08-28追加）。ピッカー側はexercise.idしか
  // 持たないため、内部キーではなくexercise.idで直接絞り込む。
  const removeExerciseByExerciseId = (exerciseId: number) => {
    setSessionExercises(prev => prev.filter(se => se.exercise.id !== exerciseId));
  };

  // 種目の並び替え（2026-08-24追加）。上下ボタンで隣と入れ替えるシンプルな方式。
  const moveExercise = (index: number, direction: -1 | 1) => {
    setSessionExercises(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addSetItem = (exerciseKey: string) => {
    setSessionExercises(prev =>
      prev.map(se =>
        se.key === exerciseKey
          ? { ...se, items: [...se.items, { key: nextKey(), type: 'set', weight: '', reps: '' }] }
          : se
      )
    );
  };

  // 休憩を追加：直前が既に休憩なら何もしない（休憩の連続を防ぐ）。
  const addRestItem = (exerciseKey: string) => {
    setSessionExercises(prev =>
      prev.map(se => {
        if (se.key !== exerciseKey) return se;
        const last = se.items[se.items.length - 1];
        if (last?.type === 'rest') return se;
        return { ...se, items: [...se.items, { key: nextKey(), type: 'rest', minutes: '', seconds: '' }] };
      })
    );
  };

  const removeItem = (exerciseKey: string, itemKey: string) => {
    setSessionExercises(prev =>
      prev.map(se => {
        if (se.key !== exerciseKey) return se;
        const target = se.items.find(it => it.key === itemKey);
        // 最低1セットは残す（0セットのままだと「目標セット数」が0になり、
        // 筋トレフローの完了判定が録画前から成立してしまうため）
        if (target?.type === 'set' && se.items.filter(it => it.type === 'set').length <= 1) {
          return se;
        }
        return { ...se, items: se.items.filter(it => it.key !== itemKey) };
      })
    );
  };

  const updateSetField = (exerciseKey: string, itemKey: string, field: 'weight' | 'reps', value: string) => {
    setSessionExercises(prev =>
      prev.map(se =>
        se.key === exerciseKey
          ? {
              ...se,
              items: se.items.map(it => (it.key === itemKey && it.type === 'set' ? { ...it, [field]: value } : it)),
            }
          : se
      )
    );
  };

  const updateRestField = (exerciseKey: string, itemKey: string, field: 'minutes' | 'seconds', value: string) => {
    setSessionExercises(prev =>
      prev.map(se =>
        se.key === exerciseKey
          ? { ...se, items: se.items.map(it => (it.key === itemKey && it.type === 'rest' ? { ...it, [field]: value } : it)) }
          : se
      )
    );
  };

  // ── 保存 ──────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 保存失敗時のエラー（サーバー通信の結果なので、その場では消えず次の保存
  // 試行まで残る。以下のvalidationErrorとは別物）。
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 「保存」を一度でも押したかどうか。これがfalseの間はvalidationErrorがあっても
  // 表示しない（入力し始める前から赤字が出るのを防ぐ、よくあるUXパターン）。
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  // 2026-08-28追加：フロントエンド側でリアルタイムに判定するバリデーション。
  // sessionExercisesが変わるたびに再計算されるため、保存ボタンを押し直さなくても
  // 直した瞬間にエラーが消える（ユーザー要望）。サーバーへの送信は行わない。
  const validationError = useMemo(() => {
    if (sessionExercises.length === 0) {
      return '種目を1つ以上追加してください';
    }
    const missingRepsExercise = sessionExercises.find(se =>
      se.items.some(item => item.type === 'set' && item.reps.trim() === '')
    );
    if (missingRepsExercise) {
      return `「${missingRepsExercise.exercise.name}」にレップ数が未入力のセットがあります`;
    }
    return null;
  }, [sessionExercises]);

  // 表示するエラーは「保存を試みた後のバリデーションエラー」＞「直近の保存失敗」
  // の優先順位。バリデーションが直ればvalidationErrorはnullになり自動的に消える。
  const displayError = (hasAttemptedSave && validationError) || submitError;

  const handleSave = async () => {
    setSubmitError(null);
    setHasAttemptedSave(true);
    if (validationError) {
      return;
    }
    setIsSubmitting(true);
    try {
      await createWorkout(token, {
        scheduled_date: toIsoDate(targetDate),
        exercises: sessionExercises.map(se => {
          // items（セット・休憩が好きな順で並ぶ）を、セットごとに直後の休憩時間を
          // 持たせたsets配列へ変換する（AGENTS.md『新しいセットごとのフロー』参照）。
          const sets: { weight_kg?: number; reps?: number; rest_after_sec?: number }[] = [];
          for (const item of se.items) {
            if (item.type === 'set') {
              const set: { weight_kg?: number; reps?: number; rest_after_sec?: number } = {};
              if (item.weight.trim() !== '') set.weight_kg = Number(item.weight);
              if (item.reps.trim() !== '') set.reps = Number(item.reps);
              sets.push(set);
            } else if ((item.minutes.trim() !== '' || item.seconds.trim() !== '') && sets.length > 0) {
              const mins = item.minutes.trim() !== '' ? Number(item.minutes) : 0;
              const secs = item.seconds.trim() !== '' ? Number(item.seconds) : 0;
              sets[sets.length - 1].rest_after_sec = mins * 60 + secs;
            }
          }
          return {
            exercise_id: se.exercise.id,
            // target_sets = 登録したセット数（「何セットやる予定か」）。AI回数カウント
            // 側（workout-camera.tsx）はこれを「あと何セット録ればいいか」の目標に使う。
            target_sets: sets.length,
            sets,
          };
        }),
      });
      router.back();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
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
        </View>

        {/* ── 種目一覧 ───────────────────────── */}
        {sessionExercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>種目が未追加です</Text>
            <Text style={styles.emptySubtitle}>下のボタンから種目を追加しましょう</Text>
          </View>
        ) : (
          sessionExercises.map((se, exIndex) => (
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
                <View style={styles.exerciseCardHeaderRight}>
                  <View style={styles.moveBtnGroup}>
                    <TouchableOpacity
                      onPress={() => moveExercise(exIndex, -1)}
                      disabled={exIndex === 0}
                      hitSlop={8}
                      style={exIndex === 0 && styles.moveBtnDisabled}>
                      <IconSymbol name="chevron.up" size={18} color={Colors.textHint} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveExercise(exIndex, 1)}
                      disabled={exIndex === sessionExercises.length - 1}
                      hitSlop={8}
                      style={exIndex === sessionExercises.length - 1 && styles.moveBtnDisabled}>
                      <IconSymbol name="chevron.down" size={18} color={Colors.textHint} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeExercise(se.key)} hitSlop={8}>
                    <IconSymbol name="trash" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.setTableHeader}>
                <Text style={[styles.setTableHeaderText, styles.setColSet]}>セット</Text>
                <Text style={[styles.setTableHeaderText, styles.setColInput]}>重量(kg)</Text>
                <Text style={[styles.setTableHeaderText, styles.setColInput]}>レップ数</Text>
                <View style={styles.setColAction} />
              </View>

              {(() => {
                let setIdx = 0;
                return se.items.map(item => {
                  if (item.type === 'set') {
                    setIdx += 1;
                    return (
                      <View key={item.key} style={styles.setRow}>
                        <Text style={[styles.setRowText, styles.setColSet]}>{setIdx}</Text>
                        <TextInput
                          style={[styles.setInput, styles.setColInput]}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Colors.textHint}
                          value={item.weight}
                          onChangeText={v => updateSetField(se.key, item.key, 'weight', v)}
                        />
                        <TextInput
                          style={[styles.setInput, styles.setColInput]}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textHint}
                          value={item.reps}
                          onChangeText={v => updateSetField(se.key, item.key, 'reps', v.replace(/[^0-9]/g, ''))}
                        />
                        <TouchableOpacity
                          style={styles.setColAction}
                          onPress={() => removeItem(se.key, item.key)}
                          hitSlop={8}>
                          <IconSymbol name="xmark" size={16} color={Colors.textHint} />
                        </TouchableOpacity>
                      </View>
                    );
                  }
                  return (
                    <View key={item.key} style={styles.restRow}>
                      <IconSymbol name="clock" size={14} color={Colors.primaryDark} />
                      <Text style={styles.restLabel}>休憩</Text>
                      <TextInput
                        style={styles.restInput}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={Colors.textHint}
                        value={item.minutes}
                        onChangeText={v => updateRestField(se.key, item.key, 'minutes', v.replace(/[^0-9]/g, ''))}
                      />
                      <Text style={styles.restUnitLabel}>分</Text>
                      <TextInput
                        style={styles.restInput}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={Colors.textHint}
                        value={item.seconds}
                        onChangeText={v => updateRestField(se.key, item.key, 'seconds', v.replace(/[^0-9]/g, ''))}
                      />
                      <Text style={styles.restUnitLabel}>秒</Text>
                      <TouchableOpacity
                        style={styles.setColAction}
                        onPress={() => removeItem(se.key, item.key)}
                        hitSlop={8}>
                        <IconSymbol name="xmark" size={16} color={Colors.textHint} />
                      </TouchableOpacity>
                    </View>
                  );
                });
              })()}

              <View style={styles.itemAddRow}>
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetItem(se.key)} activeOpacity={0.75}>
                  <IconSymbol name="plus" size={14} color={Colors.primaryDark} />
                  <Text style={styles.addSetBtnText}>セットを追加</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addRestBtn, se.items[se.items.length - 1]?.type === 'rest' && styles.addRestBtnDisabled]}
                  onPress={() => addRestItem(se.key)}
                  disabled={se.items[se.items.length - 1]?.type === 'rest'}
                  activeOpacity={0.75}>
                  <IconSymbol name="clock" size={14} color={Colors.primaryDark} />
                  <Text style={styles.addSetBtnText}>休憩を追加</Text>
                </TouchableOpacity>
              </View>
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
        {displayError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
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
              {filteredExercises.length === 0 && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>選べる種目がありません</Text>
                  <Text style={styles.emptySubtitle}>
                    AI回数カウントの較正済みモデルが紐づいた種目のみ選択できます
                  </Text>
                </View>
              )}
              {filteredExercises.map(ex => {
                const added = addedExerciseIds.has(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.exerciseListItem, added && styles.exerciseListItemSelected]}
                    onPress={() => (added ? removeExerciseByExerciseId(ex.id) : addExercise(ex))}
                    activeOpacity={0.7}>
                    <View style={styles.exerciseListItemLeft}>
                      {ex.muscle_color && (
                        <View style={[styles.muscleDot, { backgroundColor: ex.muscle_color }]} />
                      )}
                      <Text
                        style={[
                          styles.exerciseListItemName,
                          added && styles.exerciseListItemNameSelected,
                        ]}>
                        {ex.name}
                      </Text>
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
  exerciseCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: Space[5] },
  moveBtnGroup: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  moveBtnDisabled: { opacity: 0.3 },
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
    flex: 1,
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
  itemAddRow: { flexDirection: 'row', gap: Space[2] },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    marginBottom: Space[2],
    paddingVertical: Space[2],
    paddingHorizontal: Space[2],
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySubtle,
  },
  restLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.primaryDark },
  restInput: {
    width: 48,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space[1],
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  restUnitLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  addRestBtn: {
    flex: 1,
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
  addRestBtnDisabled: { opacity: 0.4 },
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
  errorText: { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
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
  exerciseListContent: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    gap: Space[1],
  },
  exerciseListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space[3],
    paddingHorizontal: Space[2],
    borderRadius: Radius.md,
  },
  // 2026-08-28追加：選択済みかどうかがアイコンの違い（+/✓）だけでは分かりづらい
  // という指摘への対策。フィルターチップの選択中スタイル（chipActive）と同じ
  // 見た目（背景色＋枠線＋太字）に揃え、行全体で選択状態が一目で分かるようにした。
  exerciseListItemSelected: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  exerciseListItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Space[2], flexShrink: 1 },
  exerciseListItemName: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  exerciseListItemNameSelected: { color: Colors.primaryDark, fontWeight: FontWeight.bold },
  noResultText: { textAlign: 'center', color: Colors.textHint, fontSize: FontSize.sm, marginTop: Space[6] },
});
