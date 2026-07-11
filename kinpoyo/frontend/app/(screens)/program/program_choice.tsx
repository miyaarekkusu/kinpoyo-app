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

// 1セット分の構造を定義 (重量、レップ数、RPE)
interface SetRow {
  weight: string;
  reps: string;
  rpe: string;
}

// 種目ごとの設定構造
interface ExerciseSetting {
  name: string;
  exerciseId?: number;
  sets: SetRow[];
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
        sets: [{ weight: '60', reps: '10', rpe: '8' }],
      }));
    }
    return (parsed as string[]).map(name => ({
      name,
      sets: [{ weight: '60', reps: '10', rpe: '8' }],
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
          session.exercises.map(ex => ({
            name: ex.exercise_name,
            exerciseId: ex.exercise_id,
            sets:
              ex.sets.length > 0
                ? ex.sets.map(s => ({
                    weight: formatDecimal(s.weight_kg) ?? '',
                    reps: s.reps != null ? String(s.reps) : '',
                    rpe: formatDecimal(s.rpe) ?? '',
                  }))
                : [{ weight: '', reps: '', rpe: '' }],
          }))
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

  // セットを追加する
  const addSet = (exerciseIndex: number) => {
    setExerciseSettings(prev => {
      const next = [...prev];
      const currentSets = next[exerciseIndex].sets;
      const lastSet = currentSets[currentSets.length - 1] || { weight: '60', reps: '10', rpe: '8' };
      next[exerciseIndex].sets = [...currentSets, { ...lastSet }];
      return next;
    });
  };

  // セットを削除する
  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExerciseSettings(prev => {
      const next = [...prev];
      if (next[exerciseIndex].sets.length > 1) {
        next[exerciseIndex].sets = next[exerciseIndex].sets.filter((_, i) => i !== setIndex);
      }
      return next;
    });
  };

  // 入力値（重量、レップ数、RPE）を変更する
  const updateSetValue = (
    exerciseIndex: number, 
    setIndex: number, 
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
      next[exerciseIndex].sets[setIndex][field] = value;
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
          const exercisesPayload: SessionExerciseCreate[] = exerciseSettings.map((es, idx) => ({
            exercise_id: es.exerciseId!,
            order_index: idx,
            sets: es.sets.map(s => {
              const set: { weight_kg?: number; reps?: number; rpe?: number } = {};
              if (s.weight.trim() !== '') set.weight_kg = Number(s.weight);
              if (s.reps.trim() !== '') set.reps = Number(s.reps);
              if (s.rpe.trim() !== '') set.rpe = Number(s.rpe);
              return set;
            }),
          }));
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
        const firstSet = es.sets[0];
        const reps = firstSet && firstSet.reps.trim() !== '' ? Number(firstSet.reps) : undefined;
        const note =
          firstSet && (firstSet.weight.trim() !== '' || firstSet.rpe.trim() !== '')
            ? `目安: ${firstSet.weight || '-'}kg, RPE${firstSet.rpe || '-'}`
            : undefined;
        return {
          exercise_id: es.exerciseId!,
          sets: es.sets.length,
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

                {/* セットごとの入力行 */}
                {item.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.tableRow}>
                    <Text style={[styles.setLabel, { flex: 1 }]}>{setIdx + 1}</Text>
                    
                    {/* 重量入力 */}
                    <View style={[styles.inputContainer, { flex: 2 }]}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={set.weight}
                        onChangeText={(val) => updateSetValue(exIdx, setIdx, 'weight', val)}
                      />
                    </View>

                    {/* レップ数入力 */}
                    <View style={[styles.inputContainer, { flex: 2 }]}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={set.reps}
                        onChangeText={(val) => updateSetValue(exIdx, setIdx, 'reps', val)}
                      />
                    </View>

                    {/* RPE入力 (1〜10) */}
                    <View style={[styles.inputContainer, { flex: 1.5 }]}>
                      <TextInput
                        style={[styles.input, styles.rpeInput]}
                        keyboardType="numeric"
                        placeholder="1-10"
                        value={set.rpe}
                        onChangeText={(val) => updateSetValue(exIdx, setIdx, 'rpe', val)}
                        maxLength={2}
                      />
                    </View>

                    {/* 各セット削除ボタン */}
                    <TouchableOpacity 
                      style={[styles.removeButton, item.sets.length === 1 && styles.removeButtonDisabled]} 
                      disabled={item.sets.length === 1}
                      onPress={() => removeSet(exIdx, setIdx)}
                      hitSlop={4}
                    >
                      <IconSymbol name="xmark" size={14} color={item.sets.length === 1 ? Colors.border : '#FF3B30'} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* セット追加ボタン */}
                <TouchableOpacity style={styles.addSetButton} onPress={() => addSet(exIdx)} activeOpacity={0.7}>
                  <IconSymbol name="plus" size={14} color={Colors.primaryDark} />
                  <Text style={styles.addSetText}>セットを追加</Text>
                </TouchableOpacity>
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
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[2],
    marginTop: Space[2],
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