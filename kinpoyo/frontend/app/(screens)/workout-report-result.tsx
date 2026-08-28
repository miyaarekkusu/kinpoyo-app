// 筋トレレポート結果の表示専用画面。
// (tabs)/workout.tsx の「筋トレを終了する」→ generateWorkoutReport() の結果
// （WorkoutSessionReportOut）をJSON文字列paramsで受け取って表示するだけで、
// この画面自体はAPIを呼ばない（ai-review-result.tsxと同じ設計）。
//
// 2026-08-24：総ボリューム比較から、種目ごとの重量・レップ数・RPEの前回比較へ
// 変更（ユーザーフィードバック：「総ボリューム数はいらないかも。今回の実績と
// 前回の同じ種目のデータを比較できる方がいい」）。
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TrainerAvatar } from '@/components/ui/trainer-avatar';
import { Colors, FontSize, FontWeight, Radius, Shadow, Space } from '@/constants/theme';
import type { WorkoutSessionReportOut } from '@/services/workout';

// 参加中プログラムがある場合、feedback_text内にこの見出しから始まる段落が
// 必ず含まれる（backend/app/core/session_report_prompt.pyのPROGRAM_SECTION_HEADING
// と同じ文字列。変更する場合は両方直すこと）。ここで見出し以降を切り出して
// 専用カードとして表示する。
const PROGRAM_SECTION_HEADING = '【プログラムについて】';

function splitProgramSection(feedbackText: string): { overall: string; program: string | null } {
  const idx = feedbackText.indexOf(PROGRAM_SECTION_HEADING);
  if (idx === -1) return { overall: feedbackText, program: null };
  return {
    overall: feedbackText.slice(0, idx).trim(),
    program: feedbackText.slice(idx + PROGRAM_SECTION_HEADING.length).trim(),
  };
}

function fmtPct(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : `${value}%`;
}
function fmtNum(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : String(value);
}

type ExerciseComparison = NonNullable<WorkoutSessionReportOut['planned_vs_actual_json']>['exercises'][number];
type SetComparison = ExerciseComparison['sets'][number];

// 今回のセットを前回の「同じセット番号」と比較する行。平均ではなく実測値を
// そのまま並べる（ユーザーフィードバック：「平均はいらない。前回の実績と
// 重量とrep数とrpeを出して比較できるようにしてほしい」）。
function SetCompareRow({ current, prev }: { current: SetComparison; prev: SetComparison | undefined }) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setRowLabel}>セット{current.set_number}</Text>
      <Text style={styles.setRowValue}>
        {fmtNum(current.weight_kg)}kg × {fmtNum(current.reps)}回
        {current.rpe != null ? `（RPE${current.rpe}）` : ''}
        {prev && (
          <Text style={styles.metricPrev}>
            {'  （前回 '}{fmtNum(prev.weight_kg)}kg × {fmtNum(prev.reps)}回
            {prev.rpe != null ? `・RPE${prev.rpe}` : ''}
            {'）'}
          </Text>
        )}
      </Text>
    </View>
  );
}

function ExerciseCard({ ex }: { ex: ExerciseComparison }) {
  const hasPrev = ex.prev_sets.length > 0;
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeaderRow}>
        <Text style={styles.exerciseName} numberOfLines={1}>{ex.exercise_name}</Text>
        <Text style={styles.exerciseSets}>
          {ex.actual_sets}/{ex.target_sets ?? '-'}set ・ {fmtPct(ex.achievement_pct)}
        </Text>
      </View>
      {ex.sets.map(s => (
        <SetCompareRow
          key={s.set_number}
          current={s}
          prev={ex.prev_sets.find(p => p.set_number === s.set_number)}
        />
      ))}
      {!hasPrev && <Text style={styles.noPrevText}>前回の同じ種目データはありません</Text>}
    </View>
  );
}

export default function WorkoutReportResultScreen() {
  // dateLabelは記録タブの筋トレ履歴から開いた時だけ渡される（例:"8/25（火）"）。
  // 筋トレ終了直後の遷移では渡されず、その場合は「今回の筋トレレポート」のまま。
  const params = useLocalSearchParams<{ reportJson?: string; dateLabel?: string }>();
  const report: WorkoutSessionReportOut | null = params.reportJson
    ? JSON.parse(params.reportJson)
    : null;

  const plan = report?.planned_vs_actual_json ?? null;
  const title = params.dateLabel ? `${params.dateLabel}の筋トレレポート` : '今回の筋トレレポート';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TrainerAvatar size={80} />
          <Text style={styles.title}>{title}</Text>
        </View>

        {!report ? (
          <Text style={styles.noticeBody}>レポートを取得できませんでした。</Text>
        ) : (
          <>
            <View style={styles.achievementCard}>
              <Text style={styles.achievementLabel}>全体達成率</Text>
              <Text style={styles.achievementValue}>{fmtPct(plan?.overall_achievement_pct)}</Text>
              {plan && !plan.has_comparison && (
                <Text style={styles.noPrevText}>前回の同じ筋トレデータはありません（今回が初回）</Text>
              )}
            </View>

            {plan?.exercises.map((ex) => (
              <ExerciseCard key={ex.exercise_id} ex={ex} />
            ))}

            {(() => {
              const { overall, program } = splitProgramSection(report.feedback_text);
              return (
                <>
                  <View style={styles.aiCard}>
                    <Text style={styles.aiComment}>{overall}</Text>
                  </View>
                  {program && (
                    <View style={styles.programAiCard}>
                      <View style={styles.programAiHeaderRow}>
                        <IconSymbol name="calendar" size={16} color={Colors.primaryDark} />
                        <Text style={styles.programAiTitle}>プログラムについて</Text>
                      </View>
                      <Text style={styles.aiComment}>{program}</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </>
        )}
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
    gap: Space[3],
  },
  header: {
    alignItems: 'center',
    gap: Space[2],
    marginBottom: Space[2],
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Space[2],
    textAlign: 'center',
  },
  noticeBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  achievementCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[5],
    alignItems: 'center',
    gap: Space[1],
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  achievementLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  achievementValue: {
    fontSize: 48,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  exerciseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    gap: Space[1],
    ...Shadow.sm,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[2],
    paddingBottom: Space[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exerciseName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Space[2],
  },
  exerciseSets: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  setRowLabel: {
    width: 56,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textHint,
  },
  setRowValue: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  metricPrev: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  noPrevText: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginTop: Space[1],
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
  programAiCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[5],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  programAiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    marginBottom: Space[2],
  },
  programAiTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
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
