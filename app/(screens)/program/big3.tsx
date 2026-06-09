import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';

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

const OVERVIEW = [
  { emoji: '📅', value: '8週間', label: '期間' },
  { emoji: '🔄', value: '週3回', label: '頻度' },
  { emoji: '⚡', value: '中〜上級', label: 'レベル' },
  { emoji: '🏋️', value: 'BIG3', label: '種目タイプ' },
] as const;

const SCHEDULE = [
  { day: '月',       work: 'スクワット + ベンチプレス', rest: false },
  { day: '火',       work: '休養・ストレッチ',          rest: true  },
  { day: '水',       work: 'デッドリフト + 補助種目',  rest: false },
  { day: '木',       work: '休養・ストレッチ',          rest: true  },
  { day: '金',       work: '全種目複合 + 仕上げ',       rest: false },
  { day: '土/日',    work: '休養',                      rest: true  },
] as const;

const EXERCISES = [
  { name: 'スクワット',    muscle: '脚・臀部',    vol: '4セット × 8回',  color: '#22C55E' },
  { name: 'ベンチプレス',  muscle: '胸・肩・腕',  vol: '4セット × 8回',  color: '#EF4444' },
  { name: 'デッドリフト',  muscle: '背中・全身',  vol: '3セット × 5回',  color: '#3B82F6' },
] as const;

export default function ProgramShousa1Screen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <IconSymbol name="chevron.left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>プログラム詳細</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconBox}>
                <Text style={styles.heroEmoji}>🏋️</Text>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle}>BIG3強化プログラム</Text>
                <Text style={styles.heroSub}>8週間 · 週3回 · 中〜上級</Text>
              </View>
            </View>
            <Text style={styles.heroDesc}>
              スクワット・ベンチプレス・デッドリフトのBIG3種目を軸に、筋力とパワーを最大化する本格的な8週間プログラム。
            </Text>
          </View>

          {/* ── 概要 ─────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>概要</Text>
            <View style={styles.overviewGrid}>
              {OVERVIEW.map((o, i) => (
                <View key={i} style={styles.overviewItem}>
                  <Text style={styles.overviewEmoji}>{o.emoji}</Text>
                  <Text style={styles.overviewValue}>{o.value}</Text>
                  <Text style={styles.overviewLabel}>{o.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── 週間スケジュール ─────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>週間スケジュール</Text>
            {SCHEDULE.map((s, i) => (
              <View key={i} style={[styles.scheduleRow, i < SCHEDULE.length - 1 && styles.scheduleRowBorder]}>
                <View style={[styles.dayPill, s.rest && styles.dayPillRest]}>
                  <Text style={[styles.dayPillText, s.rest && styles.dayPillTextRest]}>{s.day}</Text>
                </View>
                <Text style={[styles.scheduleWork, s.rest && styles.scheduleWorkRest]}>{s.work}</Text>
              </View>
            ))}
          </View>

          {/* ── 種目リスト ───────────────────── */}
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>メイン種目</Text>
              <Text style={styles.countBadge}>{EXERCISES.length}種目</Text>
            </View>
            {EXERCISES.map((ex, i) => (
              <View key={i} style={[styles.exRow, i < EXERCISES.length - 1 && styles.exRowBorder]}>
                <View style={[styles.exBar, { backgroundColor: ex.color }]} />
                <View style={styles.exInfo}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMuscle}>{ex.muscle}</Text>
                </View>
                <View style={[styles.exVol, { backgroundColor: ex.color + '18' }]}>
                  <Text style={[styles.exVolText, { color: ex.color }]}>{ex.vol}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── 開始ボタン（固定下部） ───────── */}
        <View style={styles.bottomBar}>
          <SafeAreaView edges={['bottom']}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => router.back()}
              activeOpacity={0.85}>
              <Text style={styles.startBtnText}>このプログラムを開始する</Text>
              <IconSymbol name="chevron.right" size={18} color={Colors.textOnPrimary} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: Layout.screenPaddingH,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerBack: { width: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSpacer: { width: 40 },

  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },

  // ── Hero
  heroCard: {
    backgroundColor: '#FFF8EE',
    borderRadius: Radius.xl,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    marginBottom: Space[3],
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 28 },
  heroInfo: { flex: 1, gap: 4 },
  heroTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: '#F97316',
    fontWeight: FontWeight.medium,
  },
  heroDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Section card
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
  },
  countBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },

  // ── Overview grid
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  overviewItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: Space[3],
    gap: 4,
  },
  overviewEmoji: { fontSize: 22 },
  overviewValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  overviewLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
  },

  // ── Schedule
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[3],
    gap: Space[3],
  },
  scheduleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dayPill: {
    width: 48,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
  },
  dayPillRest: { backgroundColor: Colors.divider },
  dayPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#F97316',
  },
  dayPillTextRest: { color: Colors.textHint },
  scheduleWork: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  scheduleWorkRest: { color: Colors.textHint, fontWeight: FontWeight.regular },

  // ── Exercise row
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[3],
    gap: Space[3],
  },
  exRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  exInfo: { flex: 1 },
  exName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exMuscle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  exVol: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.sm,
  },
  exVolText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // ── Bottom bar
  bottomBar: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    height: Layout.buttonHeightLg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
    marginBottom: Space[3],
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
});
