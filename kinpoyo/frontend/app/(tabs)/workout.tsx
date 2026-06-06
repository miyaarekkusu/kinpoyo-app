import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

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

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

type SetRow = { weight: string; reps: string };
type WorkoutEntry = {
  id: number;
  name: string;
  muscle: string;
  color: string;
  sets: SetRow[];
};

// カレンダーと同じダミーデータ（将来はAPIから取得）
const DUMMY_WORKOUTS: Record<string, WorkoutEntry[]> = {
  '6-2': [
    { id: 1, name: 'ベンチプレス', muscle: '胸', color: '#EF4444',
      sets: [{ weight: '70', reps: '8' }, { weight: '70', reps: '8' }, { weight: '65', reps: '10' }] },
  ],
  '6-4': [
    { id: 2, name: 'デッドリフト', muscle: '背中', color: '#3B82F6',
      sets: [{ weight: '100', reps: '5' }, { weight: '100', reps: '5' }, { weight: '90', reps: '8' }] },
  ],
  '6-6': [
    { id: 3, name: 'スクワット', muscle: '脚', color: '#22C55E',
      sets: [{ weight: '80', reps: '10' }, { weight: '80', reps: '8' }, { weight: '75', reps: '10' }] },
    { id: 4, name: 'ショルダープレス', muscle: '肩', color: '#F59E0B',
      sets: [{ weight: '40', reps: '12' }, { weight: '40', reps: '10' }] },
  ],
};

export default function WorkoutScreen() {
  const today = new Date();
  const key = `${today.getMonth() + 1}-${today.getDate()}`;
  const todayWorkouts = DUMMY_WORKOUTS[key] ?? [];
  const dow = WEEKDAYS[today.getDay()];
  const dateLabel = `${today.getMonth() + 1}月${today.getDate()}日（${dow}）`;
  const totalSets = todayWorkouts.reduce((acc, w) => acc + w.sets.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── ヘッダー ───────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>筋トレ開始</Text>
        <Text style={styles.headerDate}>{dateLabel}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {todayWorkouts.length === 0 ? (
          /* ── 空状態 ──────────────────────────── */
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>今日のメニューが未登録です</Text>
            <Text style={styles.emptySubtitle}>カレンダーから筋トレを登録してください</Text>
            <TouchableOpacity
              style={styles.calendarBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/calendar')}>
              <IconSymbol name="calendar" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.calendarBtnText}>カレンダーで登録する</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── サマリー ──────────────────────── */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{todayWorkouts.length}</Text>
                <Text style={styles.summaryLabel}>種目</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{totalSets}</Text>
                <Text style={styles.summaryLabel}>セット</Text>
              </View>
            </View>

            {/* ── 種目リスト ────────────────────── */}
            {todayWorkouts.map(w => (
              <View key={w.id} style={styles.workoutCard}>
                <View style={[styles.colorBar, { backgroundColor: w.color }]} />
                <View style={styles.workoutBody}>
                  <View style={styles.workoutTop}>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    <View style={[styles.muscleBadge, { backgroundColor: w.color + '22' }]}>
                      <Text style={[styles.muscleBadgeText, { color: w.color }]}>{w.muscle}</Text>
                    </View>
                  </View>
                  <Text style={styles.workoutDetail}>
                    {w.sets.length}セット · {w.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
        <View style={{ height: Space[4] }} />
      </ScrollView>

      {/* ── 開始ボタン（登録がある時のみ） ─────── */}
      {todayWorkouts.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.startBtn} activeOpacity={0.85}>
            <IconSymbol name="dumbbell.fill" size={22} color={Colors.textOnPrimary} />
            <Text style={styles.startBtnText}>筋トレを開始する</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },

  // ── ヘッダー
  header: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
    paddingBottom: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ── スクロール
  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },

  // ── 空状態
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingVertical: Space[10],
    paddingHorizontal: Space[6],
    alignItems: 'center',
    gap: Space[2],
    ...Shadow.sm,
    marginTop: Space[4],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Space[2],
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    textAlign: 'center',
    marginBottom: Space[4],
  },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    paddingHorizontal: Space[5],
    paddingVertical: Space[3],
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  calendarBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },

  // ── サマリー
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[4],
    marginBottom: Space[4],
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.divider,
  },
  summaryNumber: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    lineHeight: FontSize['2xl'] * 1.1,
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ── 種目カード
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    gap: Space[3],
    ...Shadow.sm,
  },
  colorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  workoutBody: {
    flex: 1,
  },
  workoutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    marginBottom: 4,
  },
  workoutName: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  muscleBadge: {
    paddingHorizontal: Space[2],
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  muscleBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  workoutDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // ── 開始ボタン
  bottomBar: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[6],
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[3],
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    height: Layout.buttonHeightLg,
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
});
