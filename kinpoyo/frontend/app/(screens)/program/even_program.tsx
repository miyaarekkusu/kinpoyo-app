import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import { ApiError } from '@/services/api';
import { ExerciseOut, fetchExercises } from '@/services/exercises';

const UPPER_MUSCLES = ['胸', '肩', '背中', '腕'];
const LOWER_MUSCLES = ['脚', 'お尻', 'ふくらはぎ'];

function exercisesForPart(part: string, all: ExerciseOut[]): ExerciseOut[] {
  if (part === 'Push') return all.filter(e => e.movement === 'push');
  if (part === 'Pull') return all.filter(e => e.movement === 'pull');
  if (part === 'Leg') return all.filter(e => e.movement === 'legs');
  if (part === '上半身') return all.filter(e => UPPER_MUSCLES.includes(e.muscle));
  if (part === '下半身') return all.filter(e => LOWER_MUSCLES.includes(e.muscle));
  return all.filter(e => e.muscle === part);
}

export default function EvenProgramScreen() {
  const router = useRouter();
  const { title, description } = useLocalSearchParams<{ title: string; description?: string }>();

  const [allExercises, setAllExercises] = useState<ExerciseOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadExercises = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchExercises();
      setAllExercises(data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '種目一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  // 分割法（title）に応じて表示する部位のリストを動的に決定
  const parts = useMemo(() => {
    if (!title) return ['胸', '肩', '背中', '脚', '腕', 'お尻', 'ふくらはぎ'];
    if (title.toUpperCase().includes('PPL')) {
      return ['Push', 'Pull', 'Leg'];
    }
    if (title.includes('上半身') || title.includes('下半身')) {
      return ['上半身', '下半身'];
    }
    return ['胸', '肩', '背中', '脚', '腕', 'お尻', 'ふくらはぎ'];
  }, [title]);

  const [selectedPart, setSelectedPart] = useState<string>(parts[0]);

  // 選択された種目をexercise idで管理
  const [selectedExercises, setSelectedExercises] = useState<Record<number, boolean>>({});

  // 選択部位の安全な初期補正
  useEffect(() => {
    if (!parts.includes(selectedPart)) {
      setSelectedPart(parts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, parts]);

  const toggleExercise = (exerciseId: number) => {
    setSelectedExercises(prev => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  // 選択決定ボタンを押したときの処理
  const handleDecision = () => {
    const chosen = allExercises
      .filter(e => selectedExercises[e.id])
      .map(e => ({ id: e.id, name: e.name }));

    if (chosen.length === 0) {
      alert('種目を1つ以上選択してください。');
      return;
    }

    router.push({
      pathname: './program_choice' as any,
      params: {
        title,
        description,
        mode: 'custom',
        exercises: JSON.stringify(chosen),
      },
    });
  };

  const currentExercises = exercisesForPart(selectedPart, allExercises);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title || 'プログラム設定'}</Text>
          <TouchableOpacity style={styles.helpButton} hitSlop={8}>
            <IconSymbol name="questionmark.circle" size={22} color={Colors.primaryDark} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ステップ案内エリア */}
          <View style={styles.stepCard}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>STEP 2 / 3</Text>
            </View>
            <Text style={styles.sectionTitle}>部位別の種目設定</Text>
            <Text style={styles.sectionDescription}>
              各部位をタップして、トレーニング種目を均等に振り分けていきましょう。
            </Text>
          </View>

          {isLoading ? (
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
            <>
              {/* 部位選択タブ */}
              <Text style={styles.blockLabel}>対象の部位を選択</Text>
              <View style={styles.tabContainer}>
                {parts.map((part) => {
                  const isSelected = selectedPart === part;
                  return (
                    <TouchableOpacity
                      key={part}
                      style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                      onPress={() => setSelectedPart(part)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                        {part}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 種目選択リストエリア */}
              <Text style={styles.blockLabel}>【{selectedPart}】の種目一覧</Text>

              {currentExercises.length > 0 ? (
                <View style={styles.exerciseList}>
                  {currentExercises.map((exercise) => {
                    const isChecked = !!selectedExercises[exercise.id];
                    return (
                      <TouchableOpacity
                        key={exercise.id}
                        style={[styles.exerciseCard, isChecked && styles.exerciseCardChecked]}
                        onPress={() => toggleExercise(exercise.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.exerciseLeft}>
                          <View style={[styles.checkboxOuter, isChecked && styles.checkboxOuterChecked]}>
                            {isChecked && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
                          </View>
                          {exercise.muscle_color && (
                            <View style={[styles.muscleDot, { backgroundColor: exercise.muscle_color }]} />
                          )}
                          <Text style={[styles.exerciseName, isChecked && styles.exerciseNameChecked]}>
                            {exercise.name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    「{selectedPart}」の種目データがありません。他の部位を選択してください。
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* ボトム固定決定アクションボタン */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.decisionButton}
            onPress={handleDecision}
            activeOpacity={0.8}
          >
            <Text style={styles.decisionButtonText}>選択を決定する</Text>
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
  helpButton: {
    width: 40,
    alignItems: 'flex-end',
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
    paddingBottom: 120,
  },
  stepCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[4],
    alignItems: 'center',
    marginBottom: Space[5],
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
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: Space[10], gap: Space[3] },
  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  retryBtn: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  blockLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginTop: Space[2],
    marginBottom: Space[2],
    paddingLeft: Space[1],
  },
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space[2],
    marginBottom: Space[3],
  },
  tabButton: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Space[4],
    paddingVertical: Space[2] + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  tabButtonActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  exerciseList: {
    gap: Space[2],
  },
  exerciseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  exerciseCardChecked: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primarySubtle,
  },
  exerciseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Space[2],
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  checkboxOuterChecked: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  exerciseName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  exerciseNameChecked: {
    color: Colors.primaryDark,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Space[4],
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  decisionButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  decisionButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
});
