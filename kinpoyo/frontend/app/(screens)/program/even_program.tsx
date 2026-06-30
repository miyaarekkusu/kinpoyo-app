import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
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

// ── 各部位のパーツデータを定義 ───────────────────
const CHEST_EXERCISES = [
  'ベンチプレス',
  'インクラインベンチプレス',
  'ダンベルベンチプレス',
  'ディップス',
  'インクラインダンベルベンチプレス',
  'チェストプレスマシン',
  'スミスマシンインクラインベンチプレス',
  'スミスマシンベンチプレス',
  'ハンマーベンチプレス',
  'ディップチンアシスト'
];

const SHOULDER_EXERCISES = [
  'オーバーヘッドプレス',
  'ダンベルショルダープレス',
  'ショルダープレスマシン',
  'ダンベルサイドレイズ',
  'リアデルトフライマシン',
  'サイドレイズマシン'
];

const BACK_EXERCISES = [
  'デッドリフト',
  'チンアップ',
  '加重チンアップ',
  'ベントオーバーロウ',
  'ダンベルインクラインロウ',
  'ワンハンドダンベルロウ',
  'シーテッドロウマシン',
  'シーテッドケーブルロウ',
  'ラットプルダウン',
  'パラレルグリップラットプルダウン',
  'スミスマシンベントオーバーロウ',
  'ローローマシン',
  'ワンハンドローローマシン',
  'ナローラットプルダウン',
  'フロントプルダウン'
];

const BICEPS_EXERCISES = [
  'バーベルカール',
  'EZ バーカール',
  'ダンベルカール',
  'ダンベルハンマーカール',
  'ケーブルカール',
  'ダンベルプリーチャーカール',
  'EZ バープリーチャーカール',
  'プリーチャーカールマシン',
  'インクラインダンベルカール'
];

const TRICEPS_EXERCISES = [
  'ナローベンチプレス',
  'ダンベルフレンチプレス',
  'シーテッドダンベルフレンチプレス',
  'ケーブルプレスダウン',
  'スミスマシン JM プレス',
  'ナロースミスマシンベンチプレス'
];

const ARM_EXERCISES = [...BICEPS_EXERCISES, ...TRICEPS_EXERCISES];

const LEG_EXERCISES = [
  'ハックスクワット',
  'バックスクワット',
  'フロントスクワット',
  'バーベルブルガリアンスプリットスクワット',
  'ダンベルブルガリアンスプリットスクワット',
  'レッグプレス',
  'レッグカール',
  'レッグエクステンション'
];

// ── 正確な種目マッピングデータ ───────────────────
const EXERCISE_DATA: Record<string, string[]> = {
  '胸': CHEST_EXERCISES,
  '肩': SHOULDER_EXERCISES,
  '背中': BACK_EXERCISES,
  '腕': ARM_EXERCISES,
  '脚': LEG_EXERCISES,
  'Push': [...CHEST_EXERCISES, ...SHOULDER_EXERCISES, ...TRICEPS_EXERCISES],
  'Pull': [...BACK_EXERCISES, ...BICEPS_EXERCISES],
  'Leg': LEG_EXERCISES,
  '上半身': [...CHEST_EXERCISES, ...SHOULDER_EXERCISES, ...BACK_EXERCISES, ...ARM_EXERCISES],
  '下半身': LEG_EXERCISES
};

export default function EvenProgramScreen() {
  const router = useRouter();
  const { title } = useLocalSearchParams<{ title: string }>();

  // 分割法（title）に応じて表示する部位のリストを動的に決定
  const getTargetParts = () => {
    if (!title) return ['胸', '肩', '背中', '脚', '腕'];
    if (title.toUpperCase().includes('PPL')) {
      return ['Push', 'Pull', 'Leg'];
    }
    if (title.includes('上半身') || title.includes('下半身')) {
      return ['上半身', '下半身'];
    }
    return ['胸', '肩', '背中', '脚', '腕'];
  };

  const parts = getTargetParts();
  const [selectedPart, setSelectedPart] = useState<string>(parts[0]);
  
  // 選択された種目をID（"部位-種目名" をキーとするオブジェクト）で管理
  const [selectedExercises, setSelectedExercises] = useState<Record<string, boolean>>({});

  // 選択部位の安全な初期補正
  useEffect(() => {
    if (!parts.includes(selectedPart)) {
      setSelectedPart(parts[0]);
    }
  }, [title, parts, selectedPart]);

  // 種目のチェック選択を切り替える
  const toggleExercise = (part: string, exerciseName: string) => {
    const key = `${part}-${exerciseName}`;
    setSelectedExercises(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 選択決定ボタンを押したときの処理
  const handleDecision = () => {
    // チェックが入っている種目の「種目名のみ」を抽出
    const chosen = Object.keys(selectedExercises)
      .filter(key => selectedExercises[key])
      .map(key => key.split('-')[1]);

    if (chosen.length === 0) {
      alert('種目を1つ以上選択してください。');
      return;
    }

    // 👈 厳密なフルパスの型エラーを回避するため、同階層の相対パス指定（stringキャスト）に修正
    router.push({
      pathname: './program_choice' as any,
      params: { 
        title: title, 
        exercises: JSON.stringify(chosen) 
      }
    });
  };

  const currentExercises = EXERCISE_DATA[selectedPart] || [];

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
                const isChecked = !!selectedExercises[`${selectedPart}-${exercise}`];
                return (
                  <TouchableOpacity
                    key={exercise}
                    style={[styles.exerciseCard, isChecked && styles.exerciseCardChecked]}
                    onPress={() => toggleExercise(selectedPart, exercise)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseLeft}>
                      {/* チェックボックス */}
                      <View style={[styles.checkboxOuter, isChecked && styles.checkboxOuterChecked]}>
                        {isChecked && <IconSymbol name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.exerciseName, isChecked && styles.exerciseNameChecked]}>
                        {exercise}
                      </Text>
                    </View>
                    
                    {/* インフォアイコン */}
                    <TouchableOpacity hitSlop={6}>
                      <IconSymbol name="info.circle" size={22} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                「{selectedPart}」のサンプル種目は現在準備中です。他の部位を選択してください。
              </Text>
            </View>
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
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Space[3],
    backgroundColor: Colors.bgCard,
  },
  checkboxOuterChecked: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
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