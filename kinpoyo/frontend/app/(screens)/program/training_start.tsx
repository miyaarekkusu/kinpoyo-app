import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
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

// 1セット分の記録（目標データ + 今日の実績入力データ）
interface SetRecordRow {
  targetWeight: number;
  targetReps: number;
  targetRpe: number;
  actualWeight: string;
  actualReps: string;
  actualRpe: string;
}

interface WorkoutExerciseState {
  name: string;
  sets: SetRecordRow[];
}

export default function TrainingStartScreen() {
  const router = useRouter();
  const { title, exercises } = useLocalSearchParams<{ title: string; exercises: string }>();

  // 前の画面から引き継いだ種目データを復元
  const initialExercises: string[] = exercises ? JSON.parse(exercises) : [];

  // program_choice で設定された目標ボリューム
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseState[]>(
    initialExercises.map(name => ({
      name,
      sets: [
        { targetWeight: 60, targetReps: 10, targetRpe: 8, actualWeight: '60', actualReps: '10', actualRpe: '8' },
        { targetWeight: 60, targetReps: 10, targetRpe: 8, actualWeight: '', actualReps: '', actualRpe: '' },
        { targetWeight: 60, targetReps: 10, targetRpe: 8, actualWeight: '', actualReps: '', actualRpe: '' }
      ]
    }))
  );

  // 実績入力値を変更するハンドラー
  const updateActualValue = (
    exIdx: number, 
    setIdx: number, 
    field: 'actualWeight' | 'actualReps' | 'actualRpe', 
    value: string
  ) => {
    setWorkoutExercises(prev => {
      const next = [...prev];
      next[exIdx].sets[setIdx][field] = value;
      return next;
    });
  };

  // 目標と今日の記録を比較してテキストを算出する関数
  const getComparisonMessage = (set: SetRecordRow) => {
    if (!set.actualWeight || !set.actualReps) {
      return '今日の記録を入力してください';
    }

    const actW = parseFloat(set.actualWeight);
    const actR = parseInt(set.actualReps, 10);

    if (isNaN(actW) || isNaN(actR)) {
      return '数値を正しく入力してください';
    }

    const wDiff = actW - set.targetWeight;
    const rDiff = actR - set.targetReps;

    if (wDiff === 0 && rDiff === 0) {
      return '今日の記録は目標通り';
    }

    let repsText = '';
    if (rDiff === 0) repsText = '目標通り';
    else if (rDiff > 0) repsText = `目標＋${rDiff}rep`;
    else repsText = `目標－${Math.abs(rDiff)}rep`;

    let weightText = '';
    if (wDiff === 0) weightText = '目標通り';
    else if (wDiff > 0) weightText = `目標の＋${wDiff}kg`;
    else weightText = `目標の－${Math.abs(wDiff)}kg`;

    return `今日の記録は${repsText} / 重量値は${weightText}`;
  };

  // 💡 修正：トレーニング終了保存時に、タブグループ内の「記録」画面 (route: /(tabs)/records) へ移動させる
  const handleFinishWorkout = () => {
    console.log('保存されるトレーニング実績:', workoutExercises);
    alert('本日のトレーニングお疲れ様でした！実績を記録しました。');
    
    // タブグループ内の records 画面へ遷移
    router.replace('/(tabs)/records');
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
          <Text style={styles.headerTitle}>{title ? `${title}・計測中` : 'トレーニング計測中'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 現在の状態案内 */}
          <View style={styles.statusCard}>
            <IconSymbol name="timer" size={24} color={Colors.primaryDark} />
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>ワークアウト記録中</Text>
              <Text style={styles.statusDescription}>セットをこなすごとに、実際に行えた数値を記入してください。</Text>
            </View>
          </View>

          {/* 各種目ごとの入力セクション */}
          {workoutExercises.map((ex, exIdx) => (
            <View key={ex.name} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>🏋️ {ex.name}</Text>

              {ex.sets.map((set, setIdx) => {
                const comparisonMsg = getComparisonMessage(set);
                const isSuccess = comparisonMsg.includes('目標通り') && !comparisonMsg.includes('－');

                return (
                  <View key={setIdx} style={styles.setContainer}>
                    <View style={styles.setRowHeader}>
                      <Text style={styles.setNumberLabel}>セット {setIdx + 1}</Text>
                      <Text style={styles.targetLabel}>
                        目標: {set.targetWeight}kg × {set.targetReps}回 (RPE {set.targetRpe})
                      </Text>
                    </View>

                    {/* 実績入力インプット群 */}
                    <View style={styles.inputRow}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.fieldLabel}>重量 (kg)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder={String(set.targetWeight)}
                          value={set.actualWeight}
                          onChangeText={(val) => updateActualValue(exIdx, setIdx, 'actualWeight', val)}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.fieldLabel}>レップ数</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder={String(set.targetReps)}
                          value={set.actualReps}
                          onChangeText={(val) => updateActualValue(exIdx, setIdx, 'actualReps', val)}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.fieldLabel}>実績RPE</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder={String(set.targetRpe)}
                          value={set.actualRpe}
                          onChangeText={(val) => updateActualValue(exIdx, setIdx, 'actualRpe', val)}
                        />
                      </View>
                    </View>

                    {/* 比較差分メッセージ表示エリア */}
                    <View style={[styles.comparisonBox, isSuccess ? styles.comparisonSuccess : styles.comparisonNormal]}>
                      <Text style={[styles.comparisonText, isSuccess && styles.comparisonTextSuccess]}>
                        {comparisonMsg}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* 終了フッターボタン */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.finishButton} onPress={handleFinishWorkout} activeOpacity={0.8}>
            <Text style={styles.finishButtonText}>トレーニングを終了して保存</Text>
          </TouchableOpacity>
        </View>
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
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  scrollContent: {
    padding: Layout.screenPaddingH,
    paddingBottom: 100,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.md,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    gap: Space[3],
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  exerciseName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[2],
  },
  setContainer: {
    backgroundColor: Colors.bgScreen,
    borderRadius: Radius.md,
    padding: Space[3],
    marginTop: Space[3],
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  setRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[2],
  },
  setNumberLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  targetLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Space[2],
    marginBottom: Space[2],
  },
  inputGroup: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginBottom: 4,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    height: 38,
    textAlign: 'center',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  comparisonBox: {
    paddingVertical: Space[2],
    paddingHorizontal: Space[3],
    borderRadius: Radius.sm,
    marginTop: Space[1],
    alignItems: 'center',
  },
  comparisonNormal: {
    backgroundColor: '#F3F4F6',
  },
  comparisonSuccess: {
    backgroundColor: Colors.primarySubtle,
  },
  comparisonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  comparisonTextSuccess: {
    color: Colors.primaryDark,
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
  finishButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
});