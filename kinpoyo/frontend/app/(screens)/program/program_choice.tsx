import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
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
import { ProgramExerciseCreate, createProgram, joinProgram } from '@/services/program';
import { SessionExerciseCreate, cancelWorkout, createWorkout, fetchWorkout } from '@/services/workout';
import { formatDecimal } from '@/utils/format';

// セット行と休憩行を好きな順番に積み重ねられるようにする（セットごとにカスタムな
// 休憩を挟められるように。2026-08-24変更：種目単位の一律restSecから移行）。
interface SetItem {
  type: 'set';
  weight: string;
  reps: string;
  rpe: string;
}
// 「○分○秒」の2つの入力欄で休憩時間を組み立てる（2026-08-24、秒/分タグ切り替え
// から変更。タグ選択よりも直感的という判断）。
interface RestItem {
  type: 'rest';
  minutes: string;
  seconds: string;
}
type ExerciseItem = SetItem | RestItem;

// 種目ごとの設定構造
interface ExerciseSetting {
  name: string;
  exerciseId?: number;
  items: ExerciseItem[];
}

export default function ProgramChoiceScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { title, description, mode, exercises, sessionId } = useLocalSearchParams<{
    title: string;
    description?: string;
    mode?: string;
    exercises?: string;
    sessionId?: string;
  }>();
  const isCustomMode = mode === 'custom';
  const isEditMode = mode === 'edit';

  // 前の画面から渡された種目リストを復元（カスタム作成時は{id,name}[]、それ以外は従来通りstring[]）。
  // 編集モード（既存の登録済みメニュー編集）は実データを非同期取得するため、ここでは空で開始する
  const initialExercises: ExerciseSetting[] = (() => {
    if (isEditMode || !exercises) return [];
    const parsed = JSON.parse(exercises);
    if (isCustomMode) {
      return (parsed as { id: number; name: string }[]).map(e => ({
        name: e.name,
        exerciseId: e.id,
        items: [{ type: 'set', weight: '60', reps: '10', rpe: '8' }],
      }));
    }
    return (parsed as string[]).map(name => ({
      name,
      items: [{ type: 'set', weight: '60', reps: '10', rpe: '8' }],
    }));
  })();

  // 種目ごとの重量・セット数・RPEデータを初期化
  const [exerciseSettings, setExerciseSettings] = useState<ExerciseSetting[]>(initialExercises);

  // カスタムプログラム作成時のみ使用：プログラム名・保存状態
  const [programName, setProgramName] = useState(title ? `${title}プログラム` : 'マイプログラム');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 編集モード：既存セッションの実データを取得
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(isEditMode);
  const [loadSessionError, setLoadSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !sessionId) return;
    let cancelled = false;
    setIsLoadingSession(true);
    setLoadSessionError(null);
    fetchWorkout(token, Number(sessionId))
      .then(session => {
        if (cancelled) return;
        setScheduledDate(session.scheduled_date);
        setExerciseSettings(
          session.exercises.map(ex => {
            const items: ExerciseItem[] =
              ex.sets.length > 0
                ? ex.sets.flatMap((s): ExerciseItem[] => {
                    const setItem: ExerciseItem = {
                      type: 'set',
                      weight: formatDecimal(s.weight_kg) ?? '',
                      reps: s.reps != null ? String(s.reps) : '',
                      rpe: formatDecimal(s.rpe) ?? '',
                    };
                    if (s.rest_after_sec != null) {
                      const mins = Math.floor(s.rest_after_sec / 60);
                      const secs = s.rest_after_sec % 60;
                      return [
                        setItem,
                        { type: 'rest', minutes: mins > 0 ? String(mins) : '', seconds: secs > 0 ? String(secs) : '' },
                      ];
                    }
                    return [setItem];
                  })
                : [{ type: 'set', weight: '', reps: '', rpe: '' }];
            return { name: ex.exercise_name, exerciseId: ex.exercise_id, items };
          })
        );
      })
      .catch(e => {
        if (!cancelled) setLoadSessionError(e instanceof ApiError ? e.detail : 'データの取得に失敗しました');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSession(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, sessionId]);

  // 種目（カード）そのものを削除する
  const removeExercise = (exerciseIndex: number) => {
    setExerciseSettings(prev => prev.filter((_, i) => i !== exerciseIndex));
  };

  // セットを追加する（直前のセットの重量・レップ・RPEを引き継ぐ）
  const addSetItem = (exerciseIndex: number) => {
    setExerciseSettings(prev => {
      const next = [...prev];
      const items = next[exerciseIndex].items;
      const lastSet = [...items].reverse().find((it): it is SetItem => it.type === 'set')
        ?? { type: 'set' as const, weight: '60', reps: '10', rpe: '8' };
      next[exerciseIndex] = { ...next[exerciseIndex], items: [...items, { ...lastSet }] };
      return next;
    });
  };

  // 休憩を追加する（直前が既に休憩なら何もしない＝休憩の連続を防ぐ）
  const addRestItem = (exerciseIndex: number) => {
    setExerciseSettings(prev => {
      const next = [...prev];
      const items = next[exerciseIndex].items;
      if (items[items.length - 1]?.type === 'rest') return prev;
      next[exerciseIndex] = { ...next[exerciseIndex], items: [...items, { type: 'rest', minutes: '', seconds: '' }] };
      return next;
    });
  };

  // セット・休憩の行を削除する（最低1セットは残す）
  const removeItem = (exerciseIndex: number, itemIndex: number) => {
    setExerciseSettings(prev => {
      const next = [...prev];
      const items = next[exerciseIndex].items;
      const target = items[itemIndex];
      if (target.type === 'set' && items.filter(it => it.type === 'set').length <= 1) {
        return prev;
      }
      next[exerciseIndex] = { ...next[exerciseIndex], items: items.filter((_, i) => i !== itemIndex) };
      return next;
    });
  };

  // 休憩時間（分・秒）を変更する
  const updateRestField = (exerciseIndex: number, itemIndex: number, field: 'minutes' | 'seconds', value: string) => {
    setExerciseSettings(prev => {
      const next = [...prev];
      next[exerciseIndex] = {
        ...next[exerciseIndex],
        items: next[exerciseIndex].items.map((it, i) => (i === itemIndex && it.type === 'rest' ? { ...it, [field]: value } : it)),
      };
      return next;
    });
  };

  // 入力値（重量、レップ数、RPE）を変更する（itemIndexはitems配列上の位置）
  const updateSetValue = (
    exerciseIndex: number,
    itemIndex: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string
  ) => {
    if (field === 'rpe') {
      const num = parseInt(value, 10);
      if (value !== '' && (isNaN(num) || num < 1 || num > 10)) {
        return;
      }
    }

    setExerciseSettings(prev => {
      const next = [...prev];
      next[exerciseIndex] = {
        ...next[exerciseIndex],
        items: next[exerciseIndex].items.map((it, i) => (i === itemIndex && it.type === 'set' ? { ...it, [field]: value } : it)),
      };
      return next;
    });
  };

  // プログラムの確定保存とホームへの遷移
  const handleSave = async () => {
    if (isEditMode) {
      if (!sessionId) return;
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        await cancelWorkout(token, Number(sessionId));
        if (exerciseSettings.length > 0 && scheduledDate) {
          // items（セット・休憩が好きな順で並ぶ）を、セットごとに直後の休憩時間を
          // 持たせたsets配列へ変換する（AGENTS.md『新しいセットごとのフロー』参照）。
          const exercisesPayload: SessionExerciseCreate[] = exerciseSettings.map((es, idx) => {
            const sets: { weight_kg?: number; reps?: number; rpe?: number; rest_after_sec?: number }[] = [];
            for (const item of es.items) {
              if (item.type === 'set') {
                const set: { weight_kg?: number; reps?: number; rpe?: number; rest_after_sec?: number } = {};
                if (item.weight.trim() !== '') set.weight_kg = Number(item.weight);
                if (item.reps.trim() !== '') set.reps = Number(item.reps);
                if (item.rpe.trim() !== '') set.rpe = Number(item.rpe);
                sets.push(set);
              } else if ((item.minutes.trim() !== '' || item.seconds.trim() !== '') && sets.length > 0) {
                const mins = item.minutes.trim() !== '' ? Number(item.minutes) : 0;
                const secs = item.seconds.trim() !== '' ? Number(item.seconds) : 0;
                sets[sets.length - 1].rest_after_sec = mins * 60 + secs;
              }
            }
            return {
              exercise_id: es.exerciseId!,
              order_index: idx,
              target_sets: sets.length,
              sets,
            };
          });
          await createWorkout(token, { scheduled_date: scheduledDate, exercises: exercisesPayload });
        }
        router.back();
      } catch (e) {
        setSubmitError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!isCustomMode) {
      console.log('保存されるプログラム設定:', exerciseSettings);
      alert('カスタムプログラムを保存しました！');
      router.replace('/(tabs)');
      return;
    }

    if (!programName.trim()) {
      setSubmitError('プログラム名を入力してください');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const exercisesPayload: ProgramExerciseCreate[] = exerciseSettings.map(es => {
        const setItems = es.items.filter((it): it is SetItem => it.type === 'set');
        const firstSet = setItems[0];
        const reps = firstSet && firstSet.reps.trim() !== '' ? Number(firstSet.reps) : undefined;
        const note =
          firstSet && (firstSet.weight.trim() !== '' || firstSet.rpe.trim() !== '')
            ? `目安: ${firstSet.weight || '-'}kg, RPE${firstSet.rpe || '-'}`
            : undefined;
        return {
          exercise_id: es.exerciseId!,
          sets: setItems.length,
          reps_min: reps,
          reps_max: reps,
          note,
        };
      });

      const created = await createProgram(token, {
        name: programName.trim(),
        description: description || undefined,
        exercises: exercisesPayload,
      });
      await joinProgram(token, created.id);
      router.replace('/(tabs)');
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? '筋トレメニューを編集' : title ? `${title}構成` : 'ボリューム設定'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoadingSession ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={Colors.primaryDark} size="large" />
          </View>
        ) : loadSessionError ? (
          <View style={styles.centerBox}>
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{loadSessionError}</Text>
            </View>
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ステップ案内エリア */}
          <View style={styles.stepCard}>
            {!isEditMode && (
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 3 / 3</Text>
              </View>
            )}
            <Text style={styles.sectionTitle}>
              {isEditMode ? 'メニューを編集' : '詳細ボリューム設定'}
            </Text>
            <Text style={styles.sectionDescription}>
              各種目の重量・レップ数に加えて、狙う運動強度（RPE 1〜10）を設定しましょう。
            </Text>
          </View>

          {isCustomMode && (
            <View style={styles.programNameCard}>
              <Text style={styles.programNameLabel}>プログラム名</Text>
              <TextInput
                style={styles.programNameInput}
                value={programName}
                onChangeText={setProgramName}
                placeholder="プログラム名を入力"
                placeholderTextColor={Colors.textHint}
              />
            </View>
          )}

          {/* 種目ごとの入力カードリスト */}
          {exerciseSettings.length > 0 ? (
            exerciseSettings.map((item, exIdx) => (
              <View key={item.name} style={styles.exerciseCard}>
                {/* カードヘッダー：種目名と型安全な削除ボタンを配置 */}
                <View style={styles.exerciseCardHeader}>
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  <TouchableOpacity 
                    style={styles.deleteExerciseButton} 
                    onPress={() => removeExercise(exIdx)}
                    hitSlop={8}
                    activeOpacity={0.6}
                  >
                    {/* 💡 未定義エラーの起きない既存の 'xmark' を利用し、視認性の高い赤い背景の円形バッジで表現 */}
                    <View style={styles.deleteBadge}>
                      <IconSymbol name="xmark" size={12} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                </View>
                
                {/* テーブルヘッダー */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, { flex: 1 }]}>セット</Text>
                  <Text style={[styles.headerCell, { flex: 2 }]}>重量(kg)</Text>
                  <Text style={[styles.headerCell, { flex: 2 }]}>レップ数</Text>
                  <Text style={[styles.headerCell, { flex: 1.5 }]}>RPE</Text>
                  <Text style={[styles.headerCell, { flex: 1 }]}></Text>
                </View>

                {/* セット・休憩の入力行（好きな順で並ぶ） */}
                {(() => {
                  let setLabel = 0;
                  return item.items.map((it, itemIdx) => {
                    if (it.type === 'set') {
                      setLabel += 1;
                      const isOnlySet = item.items.filter(x => x.type === 'set').length === 1;
                      return (
                        <View key={itemIdx} style={styles.tableRow}>
                          <Text style={[styles.setLabel, { flex: 1 }]}>{setLabel}</Text>

                          {/* 重量入力 */}
                          <View style={[styles.inputContainer, { flex: 2 }]}>
                            <TextInput
                              style={styles.input}
                              keyboardType="numeric"
                              value={it.weight}
                              onChangeText={(val) => updateSetValue(exIdx, itemIdx, 'weight', val)}
                            />
                          </View>

                          {/* レップ数入力 */}
                          <View style={[styles.inputContainer, { flex: 2 }]}>
                            <TextInput
                              style={styles.input}
                              keyboardType="numeric"
                              value={it.reps}
                              onChangeText={(val) => updateSetValue(exIdx, itemIdx, 'reps', val)}
                            />
                          </View>

                          {/* RPE入力 (1〜10) */}
                          <View style={[styles.inputContainer, { flex: 1.5 }]}>
                            <TextInput
                              style={[styles.input, styles.rpeInput]}
                              keyboardType="numeric"
                              placeholder="1-10"
                              value={it.rpe}
                              onChangeText={(val) => updateSetValue(exIdx, itemIdx, 'rpe', val)}
                              maxLength={2}
                            />
                          </View>

                          {/* 各セット削除ボタン */}
                          <TouchableOpacity
                            style={[styles.removeButton, isOnlySet && styles.removeButtonDisabled]}
                            disabled={isOnlySet}
                            onPress={() => removeItem(exIdx, itemIdx)}
                            hitSlop={4}
                          >
                            <IconSymbol name="xmark" size={14} color={isOnlySet ? Colors.border : '#FF3B30'} />
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    return (
                      <View key={itemIdx} style={styles.restRow}>
                        <IconSymbol name="clock" size={14} color={Colors.primaryDark} />
                        <Text style={styles.restLabel}>休憩</Text>
                        <TextInput
                          style={styles.restInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Colors.textHint}
                          value={it.minutes}
                          onChangeText={v => updateRestField(exIdx, itemIdx, 'minutes', v)}
                        />
                        <Text style={styles.restUnitLabel}>分</Text>
                        <TextInput
                          style={styles.restInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={Colors.textHint}
                          value={it.seconds}
                          onChangeText={v => updateRestField(exIdx, itemIdx, 'seconds', v)}
                        />
                        <Text style={styles.restUnitLabel}>秒</Text>
                        <TouchableOpacity onPress={() => removeItem(exIdx, itemIdx)} hitSlop={4}>
                          <IconSymbol name="xmark" size={14} color={Colors.textHint} />
                        </TouchableOpacity>
                      </View>
                    );
                  });
                })()}

                <View style={styles.itemAddRow}>
                  <TouchableOpacity style={styles.addSetButton} onPress={() => addSetItem(exIdx)} activeOpacity={0.7}>
                    <IconSymbol name="plus" size={14} color={Colors.primaryDark} />
                    <Text style={styles.addSetText}>セットを追加</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addRestButton, item.items[item.items.length - 1]?.type === 'rest' && styles.addRestButtonDisabled]}
                    onPress={() => addRestItem(exIdx)}
                    disabled={item.items[item.items.length - 1]?.type === 'rest'}
                    activeOpacity={0.7}>
                    <IconSymbol name="clock" size={14} color={Colors.primaryDark} />
                    <Text style={styles.addSetText}>休憩を追加</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {isEditMode
                  ? '種目がありません。すべて削除すると、この日のメニューが空になります。'
                  : '選択された種目がありません。前の画面から種目を選んでください。'}
              </Text>
            </View>
          )}
        </ScrollView>
        )}

        {/* ボトム固定決定ボタン */}
        {!isLoadingSession && !loadSessionError && (
        <View style={styles.footer}>
          {submitError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{submitError}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.saveButton, (!isEditMode && exerciseSettings.length === 0) || isSubmitting ? styles.saveButtonDisabled : undefined]}
            onPress={handleSave}
            disabled={(!isEditMode && exerciseSettings.length === 0) || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'メニューを更新する' : 'プログラムを確定する'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: Layout.screenPaddingH,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    width: 40,
    justifyContent: 'center',
  },
  programNameCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  programNameLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  programNameInput: {
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    height: 44,
    paddingHorizontal: Space[3],
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[3],
  },
  errorBoxText: { fontSize: FontSize.sm, color: Colors.error },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space[6] },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  scrollContent: {
    padding: Layout.screenPaddingH,
    paddingBottom: 120,
  },
  stepCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[4],
    alignItems: 'center',
    marginBottom: Space[4],
  },
  stepBadge: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Space[3],
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    marginBottom: Space[2],
  },
  stepBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[2],
  },
  sectionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[2],
  },
  exerciseName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Space[2],
  },
  deleteExerciseButton: {
    width: 36,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // 💡 追加：丸みのあるスタイリッシュな赤色の種目削除バッジ
  deleteBadge: {
    backgroundColor: '#FF3B30',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Space[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Space[2],
  },
  headerCell: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space[2],
  },
  setLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: Space[1],
  },
  input: {
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    height: 38,
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  rpeInput: {
    borderColor: Colors.primaryBorder,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySubtle,
  },
  removeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  removeButtonDisabled: {
    opacity: 0.4,
  },
  itemAddRow: { flexDirection: 'row', gap: Space[2], marginTop: Space[2] },
  addSetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[2],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySubtle,
    gap: Space[1],
  },
  addSetText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  addRestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[2],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySubtle,
    gap: Space[1],
  },
  addRestButtonDisabled: { opacity: 0.4 },
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
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Space[5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[4],
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  saveButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.border,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
});