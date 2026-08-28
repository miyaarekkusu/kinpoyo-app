// AIレビュー結果の表示専用画面。
// workout-camera.tsx で POST .../generate-review を叩いた結果（feedback_text）を
// そのまま文字列paramsで受け取って表示するだけで、この画面自体はAPIを呼ばない。
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TrainerAvatar } from '@/components/ui/trainer-avatar';
import { Colors, FontSize, FontWeight, Radius, Shadow, Space } from '@/constants/theme';

export default function AiReviewResultScreen() {
  const params = useLocalSearchParams<{ feedbackText?: string; exerciseName?: string }>();
  const feedbackText = params.feedbackText ?? 'レビューを取得できませんでした。';
  const exerciseName = params.exerciseName ?? '種目';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TrainerAvatar size={80} />
          <Text style={styles.title}>AIトレーナーからのレビュー</Text>
          <Text style={styles.subtitle}>{exerciseName}</Text>
        </View>

        <View style={styles.aiCard}>
          <Text style={styles.aiComment}>{feedbackText}</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>閉じる</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Space[5],
    paddingTop: Space[6],
    paddingBottom: Space[4],
  },
  header: {
    alignItems: 'center',
    gap: Space[2],
    marginBottom: Space[5],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Space[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    textAlign: 'center',
  },
  aiCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[5],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  aiComment: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: FontSize.base * 1.7,
  },
  bottomBar: {
    paddingHorizontal: Space[5],
    paddingTop: Space[3],
    paddingBottom: Space[4],
    backgroundColor: Colors.bgScreen,
  },
  closeBtn: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  closeBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
