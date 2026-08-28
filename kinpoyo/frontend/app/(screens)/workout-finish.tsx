// 筋トレ完了画面。計測画面（workout-camera-live）でメニューを全て終えた後に来る。
//
// ここでは「今日これをやり切った」という事実だけを見せる。数値の講評はAIレビュー
// （workout-report-result）に任せ、押したときに初めて生成する——レポート生成は
// DeepSeek APIを叩くので数秒かかり、完了直後に自動で走らせると「終わったのに待たされる」
// 体験になるため。
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TrainerAvatar } from '@/components/ui/trainer-avatar';
import { Colors, FontSize, FontWeight, Radius, Shadow, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import {
  endWorkout, fetchWorkout, generateWorkoutReport,
  type WorkoutSessionOut,
} from '@/services/workout';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

export default function WorkoutFinishScreen() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const { token } = useAuth();

  const [session, setSession] = useState<WorkoutSessionOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let s = await fetchWorkout(token, sessionId);
        // 計測画面は計測を終えるだけでセッションを閉じない。ここで完了にする
        // （レポート生成が「終了したセッションのみ」を要求するため）。
        if (s.status_code === 'in_progress') {
          s = await endWorkout(token, sessionId);
        }
        if (!cancelled) setSession(s);
      } catch (e) {
        if (!cancelled) {
          setErrorText(e instanceof ApiError ? e.detail : '記録の取得に失敗しました');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, token]);

  // 戻るはパス指定ではなくスタックを1枚戻す。
  // router.replace('/(tabs)/workout') だと、カレンダー（ホーム）からリザルトを
  // 開いたときに筋トレ開始タブへ飛んでしまい、来た画面に戻らない。
  // canGoBack() が false になるのは直リンクで開かれた場合だけなので、
  // そのときだけ既定の行き先へ逃がす。
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/workout');
  };

  const handleReview = async () => {
    setReviewLoading(true);
    setErrorText(null);
    try {
      const report = await generateWorkoutReport(token, sessionId);
      router.push({
        pathname: '/(screens)/workout-report-result',
        params: {
          reportJson: JSON.stringify(report),
          dateLabel: formatDate(session?.ended_at ?? session?.scheduled_date ?? null),
        },
      });
    } catch (e) {
      setErrorText(e instanceof ApiError ? e.detail : 'AIレビューの生成に失敗しました');
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}><ActivityIndicator color={Colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  const dateLabel = formatDate(session?.ended_at ?? session?.scheduled_date ?? null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <TrainerAvatar size={96} />
          <Text style={styles.heroTitle}>おつかれさまでした</Text>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>今日やったメニュー</Text>
          {(session?.exercises ?? []).map(ex => {
            const recorded = ex.sets.filter(s => s.ai_counted_reps !== null);
            const totalReps = recorded.reduce((sum, s) => sum + (s.ai_counted_reps ?? 0), 0);
            return (
              <View key={ex.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                <Text style={styles.exerciseDetail}>
                  {recorded.length}セット / 合計{totalReps}回
                </Text>
              </View>
            );
          })}
          {(session?.exercises ?? []).length === 0 && (
            <Text style={styles.emptyText}>記録された種目がありません</Text>
          )}
        </View>

        {errorText !== null && (
          <View style={styles.errorBox}><Text style={styles.errorText}>{errorText}</Text></View>
        )}

        <Pressable
          style={[styles.primaryBtn, reviewLoading && styles.primaryBtnDisabled]}
          onPress={handleReview}
          disabled={reviewLoading}>
          {reviewLoading ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <>
              <IconSymbol name="chart.line.uptrend.xyaxis" size={20} color={Colors.textOnPrimary} />
              <Text style={styles.primaryBtnText}>AIレビューを見る</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleClose}>
          <Text style={styles.secondaryBtnText}>閉じる</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgScreen },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Space[4], gap: Space[4] },
  hero: { alignItems: 'center', gap: Space[2], paddingTop: Space[4] },
  heroTitle: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  date: { fontSize: FontSize.md, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Space[4], gap: Space[3], ...Shadow.md,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Space[3],
  },
  exerciseName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  exerciseDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textHint },
  errorBox: {
    backgroundColor: Colors.errorSubtle, borderRadius: Radius.md, padding: Space[3],
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space[2],
    backgroundColor: Colors.primaryDark, borderRadius: Radius.lg,
    paddingVertical: Space[4], ...Shadow.md,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  secondaryBtn: { alignItems: 'center', paddingVertical: Space[3] },
  secondaryBtnText: { color: Colors.primaryDark, fontSize: FontSize.md },
});
