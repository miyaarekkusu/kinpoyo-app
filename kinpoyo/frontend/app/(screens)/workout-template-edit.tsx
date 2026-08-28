// 「My筋トレ」テンプレート作成・編集画面。workout-register.tsx（当日の筋トレ登録）と
// ほぼ同じ種目/セットの組み立てUIだが、日付が無く、AIレビュー等には一切
// 関連しない（AGENTS.md『My筋トレ』参照）。paramsにtemplateIdがあれば編集モード
// （既存テンプレートを読み込んでPUTで更新）、無ければ新規作成モード（POST）。
import React, { useEffect, useMemo, useState } from 'react';
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
import { createWorkoutTemplate, fetchWorkoutTemplate, updateWorkoutTemplate } from '@/services/workout-templates';

const MOVEMENT_LABELS: Record<Movement, string> = {
  push: 'プッシュ',
  pull: 'プル',
  legs: 'レッグ',
};

// program_choice.tsx（筋トレ開始前のメニュー編集）と同じ「セット・休憩を好きな順で
// 積み重ねる」方式。セットごとに直後の休憩を挟められる。
type SetItem = { type: 'set'; key: string; weight: string; reps: string };
type RestItem = { type: 'rest'; key: string; minutes: string; seconds: string };
type ExerciseItem = SetItem | RestItem;
type TemplateExerciseInput = { key: string; exercise: ExerciseOut; items: ExerciseItem[] };

export default function WorkoutTemplateEditScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ templateId?: string }>();
  const templateId = params.templateId ? Number(params.templateId) : null;
  const isEditMode = templateId !== null;

  const [templateName, setTemplateName] = useState('');

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

  // ── テンプレート組み立て ────────────────────
  const [templateExercises, setTemplateExercises] = useState<TemplateExerciseInput[]>([]);
  const idCounter = React.useRef(0);
  const nextKey = () => `k${idCounter.current++}`;

  // ── 編集モード：既存テンプレートの読み込み ────
  const [loadingTemplate, setLoadingTemplate] = useState(isEditMode);

  useEffect(() => {
    if (!isEditMode || exercises.length === 0) return;
    (async () => {
      setLoadingTemplate(true);
      try {
        const template = await fetchWorkoutTemplate(token, templateId!);
        setTemplateName(template.name);
        setTemplateExercises(
          template.exercises.map(te => {
            const exercise = exercises.find(e => e.id === te.exercise_id);
            return {
              key: nextKey(),
              exercise: exercise ?? {
                id: te.exercise_id,
                name: te.exercise_name,
                movement: 'push',
                muscle: '',
                muscle_color: null,
              } as ExerciseOut,
              items: te.sets.flatMap((s): ExerciseItem[] => {
                const setItem: ExerciseItem = {
                  type: 'set',
                  key: nextKey(),
                  weight: s.weight_kg != null ? String(s.weight_kg) : '',
                  reps: s.reps != null ? String(s.reps) : '',
                };
                if (s.rest_after_sec != null) {
                  const mins = Math.floor(s.rest_after_sec / 60);
                  const secs = s.rest_after_sec % 60;
                  return [
                    setItem,
                    {
                      type: 'rest',
                      key: nextKey(),
                      minutes: mins > 0 ? String(mins) : '',
                      seconds: secs > 0 ? String(secs) : '',
                    },
                  ];
                }
                return [setItem];
              }),
            };
          })
        );
      } catch (e) {
        setError(e instanceof ApiError ? e.detail : 'テンプレートの取得に失敗しました');
      } finally {
        setLoadingTemplate(false);
      }
    })();
    // exercisesが揃った直後の1回だけ読み込めばよい（テンプレートIDは画面遷移で固定）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, exercises.length]);

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
    () => new Set(templateExercises.map(te => te.exercise.id)),
    [templateExercises]
  );

  const addExercise = (exercise: ExerciseOut) => {
    if (addedExerciseIds.has(exercise.id)) return;
    setTemplateExercises(prev => [
      ...prev,
      { key: nextKey(), exercise, items: [{ type: 'set', key: nextKey(), weight: '', reps: '' }] },
    ]);
  };

  const removeExercise = (key: string) => {
    setTemplateExercises(prev => prev.filter(te => te.key !== key));
  };

  const addSetItem = (exerciseKey: string) => {
    setTemplateExercises(prev =>
      prev.map(te =>
        te.key === exerciseKey
          ? { ...te, items: [...te.items, { type: 'set', key: nextKey(), weight: '', reps: '' }] }
          : te
      )
    );
  };

  // 休憩を追加する（直前が既に休憩なら何もしない＝休憩の連続を防ぐ。program_choice.tsxと同じ）
  const addRestItem = (exerciseKey: string) => {
    setTemplateExercises(prev =>
      prev.map(te => {
        if (te.key !== exerciseKey) return te;
        if (te.items[te.items.length - 1]?.type === 'rest') return te;
        return { ...te, items: [...te.items, { type: 'rest', key: nextKey(), minutes: '', seconds: '' }] };
      })
    );
  };

  // セット・休憩の行を削除する（最低1セットは残す）
  const removeItem = (exerciseKey: string, itemKey: string) => {
    setTemplateExercises(prev =>
      prev.map(te => {
        if (te.key !== exerciseKey) return te;
        const target = te.items.find(it => it.key === itemKey);
        if (target?.type === 'set' && te.items.filter(it => it.type === 'set').length <= 1) return te;
        return { ...te, items: te.items.filter(it => it.key !== itemKey) };
      })
    );
  };

  const updateSetValue = (exerciseKey: string, itemKey: string, field: 'weight' | 'reps', value: string) => {
    setTemplateExercises(prev =>
      prev.map(te =>
        te.key === exerciseKey
          ? {
              ...te,
              items: te.items.map(it => (it.key === itemKey && it.type === 'set' ? { ...it, [field]: value } : it)),
            }
          : te
      )
    );
  };

  const updateRestField = (exerciseKey: string, itemKey: string, field: 'minutes' | 'seconds', value: string) => {
    setTemplateExercises(prev =>
      prev.map(te =>
        te.key === exerciseKey
          ? {
              ...te,
              items: te.items.map(it => (it.key === itemKey && it.type === 'rest' ? { ...it, [field]: value } : it)),
            }
          : te
      )
    );
  };

  // ── 保存 ──────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (templateName.trim() === '') {
      setError('テンプレート名を入力してください');
      return;
    }
    if (templateExercises.length === 0) {
      setError('種目を1つ以上追加してください');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: templateName.trim(),
        exercises: templateExercises.map((te, idx) => {
          // items（セット・休憩が好きな順で並ぶ）を、セットごとに直後の休憩時間を
          // 持たせたsets配列へ変換する（program_choice.tsxのhandleSaveと同じ変換）。
          const sets: { weight_kg?: number; reps?: number; rest_after_sec?: number }[] = [];
          for (const item of te.items) {
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
          return { exercise_id: te.exercise.id, order_index: idx, sets };
        }),
      };
      if (isEditMode) {
        await updateWorkoutTemplate(token, templateId!, payload);
      } else {
        await createWorkoutTemplate(token, payload);
      }
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
        <Text style={styles.headerTitle}>{isEditMode ? 'My筋トレを編集' : 'My筋トレを登録'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loadingTemplate ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : (
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── テンプレート名 ─────────────────── */}
        <View style={styles.nameCard}>
          <Text style={styles.nameLabel}>テンプレート名</Text>
          <TextInput
            style={styles.nameInput}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="例: 定番プッシュデイ"
            placeholderTextColor={Colors.textHint}
          />
        </View>

        {/* ── 種目一覧 ───────────────────────── */}
        {templateExercises.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>種目が未追加です</Text>
            <Text style={styles.emptySubtitle}>下のボタンから種目を追加しましょう</Text>
          </View>
        ) : (
          templateExercises.map(te => (
            <View key={te.key} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <View style={styles.exerciseCardHeaderLeft}>
                  {te.exercise.muscle_color && (
                    <View style={[styles.muscleDot, { backgroundColor: te.exercise.muscle_color }]} />
                  )}
                  <Text style={styles.exerciseName}>{te.exercise.name}</Text>
                  <View style={styles.muscleBadge}>
                    <Text style={styles.muscleBadgeText}>{te.exercise.muscle}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeExercise(te.key)} hitSlop={8}>
                  <IconSymbol name="trash" size={18} color={Colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.setTableHeader}>
                <Text style={[styles.setTableHeaderText, styles.setColSet]}>セット</Text>
                <Text style={[styles.setTableHeaderText, styles.setColInput]}>重量(kg)</Text>
                <Text style={[styles.setTableHeaderText, styles.setColInput]}>レップ数</Text>
                <View style={styles.setColAction} />
              </View>

              {(() => {
                let setLabel = 0;
                return te.items.map(item => {
                  if (item.type === 'set') {
                    setLabel += 1;
                    const isOnlySet = te.items.filter(it => it.type === 'set').length === 1;
                    return (
                      <View key={item.key} style={styles.setRow}>
                        <Text style={[styles.setRowText, styles.setColSet]}>{setLabel}</Text>
                        <TextInput
                          style={[styles.setInput, styles.setColInput]}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Colors.textHint}
                          value={item.weight}
                          onChangeText={v => updateSetValue(te.key, item.key, 'weight', v)}
                        />
                        <TextInput
                          style={[styles.setInput, styles.setColInput]}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Colors.textHint}
                          value={item.reps}
                          onChangeText={v => updateSetValue(te.key, item.key, 'reps', v)}
                        />
                        <TouchableOpacity
                          style={[styles.setColAction, isOnlySet && styles.setColActionDisabled]}
                          disabled={isOnlySet}
                          onPress={() => removeItem(te.key, item.key)}
                          hitSlop={8}>
                          <IconSymbol name="xmark" size={16} color={isOnlySet ? Colors.border : Colors.textHint} />
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
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Colors.textHint}
                        value={item.minutes}
                        onChangeText={v => updateRestField(te.key, item.key, 'minutes', v)}
                      />
                      <Text style={styles.restUnitLabel}>分</Text>
                      <TextInput
                        style={styles.restInput}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={Colors.textHint}
                        value={item.seconds}
                        onChangeText={v => updateRestField(te.key, item.key, 'seconds', v)}
                      />
                      <Text style={styles.restUnitLabel}>秒</Text>
                      <TouchableOpacity onPress={() => removeItem(te.key, item.key)} hitSlop={4}>
                        <IconSymbol name="xmark" size={14} color={Colors.textHint} />
                      </TouchableOpacity>
                    </View>
                  );
                });
              })()}

              <View style={styles.itemAddRow}>
                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSetItem(te.key)} activeOpacity={0.75}>
                  <IconSymbol name="plus" size={14} color={Colors.primaryDark} />
                  <Text style={styles.addSetBtnText}>セットを追加</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addRestBtn, te.items[te.items.length - 1]?.type === 'rest' && styles.addRestBtnDisabled]}
                  onPress={() => addRestItem(te.key)}
                  disabled={te.items[te.items.length - 1]?.type === 'rest'}
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
      )}

      {/* ── 保存パネル ─────────────────────────── */}
      {!loadingTemplate && (
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
            <Text style={styles.saveBtnText}>{isEditMode ? '変更を保存する' : 'My筋トレを保存する'}</Text>
          )}
        </TouchableOpacity>
      </View>
      )}

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

// ─── スタイル（workout-register.tsxと統一） ────────────────────
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
  nameCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  nameLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  nameInput: {
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space[3],
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
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
  setColActionDisabled: { opacity: 0.4 },
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
  itemAddRow: { flexDirection: 'row', gap: Space[2] },
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
