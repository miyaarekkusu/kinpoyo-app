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

import { ProgramActionBar } from '@/components/program-action-bar';
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
  { emoji: '🔄', value: '週4回', label: '頻度' },
  { emoji: '⚡', value: '中〜上級', label: 'レベル' },
  { emoji: '🏋️', value: 'BIG3', label: '種目タイプ' },
] as const;

const SCHEDULE = [
  { day: 'Day 1', work: 'スクワット + テンポベンチプレス + 補助種目', rest: false },
  { day: 'Day 2', work: 'デッドリフト + 補助種目', rest: false },
  { day: 'Day 3', work: 'ベンチプレス + テンポスクワット + 補助種目', rest: false },
  { day: 'Day 4', work: '止めありベンチプレス + 肩・腕補助種目', rest: false },
] as const;

// ─── Day 1 ~ Day 4 詳細プログラム構成 ────────────────────────
const PROGRAM_DAYS = [
  {
    day: 'Day 1',
    theme: 'スクワット & テンポベンチ',
    color: '#22C55E',
    exercises: [
      { name: 'スクワット', detail: '1セット × 3回', rpe: 'RPE 8' },
      { name: 'スクワット', detail: '4セット × 3回', rpe: 'RPE 6.5~7' },
      { name: 'テンポベンチプレス (下ろし4秒)', detail: '1セット × 5回', rpe: 'RPE 6' },
      { name: 'テンポベンチプレス (下ろし4秒)', detail: '1セット × 5回', rpe: 'RPE 6.5' },
      { name: 'テンポベンチプレス (下ろし4秒)', detail: '1セット × 5回', rpe: 'RPE 7' },
      { name: 'チンニング', detail: '2セット', rpe: '' },
      { name: 'マシンローイング', detail: '2セット', rpe: '' },
    ],
  },
  {
    day: 'Day 2',
    theme: 'デッドリフト & 背中・ポステリアチェーン',
    color: '#3B82F6',
    exercises: [
      { name: 'デッドリフト', detail: '1セット × 5回', rpe: 'RPE 6' },
      { name: 'デッドリフト', detail: '4セット × 3回', rpe: 'RPE 8' },
      { name: 'ルーマニアンデッドリフト', detail: '2セット', rpe: '' },
      { name: 'ダンベルプルオーバー', detail: '2セット', rpe: '' },
    ],
  },
  {
    day: 'Day 3',
    theme: 'ベンチプレス & テンポスクワット',
    color: '#EF4444',
    exercises: [
      { name: 'ベンチプレス', detail: '2セット × 5回', rpe: 'RPE 6.5~7' },
      { name: 'ベンチプレス (Top Single)', detail: '1セット × 1回', rpe: 'RPE 9' },
      { name: 'ベンチプレス', detail: '2セット × 5回', rpe: 'RPE 7' },
      { name: 'テンポスクワット (下ろし4秒)', detail: '3セット × 5回', rpe: 'RPE 6~6.5' },
      { name: 'スミスインクライン / ハイインクライン', detail: '2セット', rpe: '' },
      { name: 'ワンハンドロウ / マシンローイング', detail: '2セット', rpe: '' },
    ],
  },
  {
    day: 'Day 4',
    theme: '止めありベンチ & 肩・腕アクセサリー',
    color: '#F59E0B',
    exercises: [
      { name: '止めありベンチプレス', detail: '3セット × 4回', rpe: 'RPE 6' },
      { name: '止めありベンチプレス', detail: '2セット × 4回', rpe: 'RPE 6.5' },
      { name: 'ミリタリープレス', detail: '3セット', rpe: '' },
      { name: 'フレンチプレス', detail: '2セット', rpe: '' },
      { name: 'サイドレイズ', detail: '2セット', rpe: '' },
    ],
  },
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
                <Text style={styles.heroSub}>8週間 · 週4回 · 中〜上級</Text>
              </View>
            </View>
            <Text style={styles.heroDesc}>
              スクワット・ベンチプレス・デッドリフトのBIG3種目を軸に、RPEに基づいた適切な強度設定で筋力とパワーを最大化する本格的な8週間プログラム。
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

          {/* ── メインプログラム構成（Day 1 〜 Day 4） ──────── */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.mainSectionTitle}>メインプログラム詳細</Text>
            <Text style={styles.countBadge}>4 Days</Text>
          </View>

          {PROGRAM_DAYS.map((dayGroup, dIdx) => (
            <View key={dIdx} style={styles.dayCard}>
              {/* Day ヘッダー */}
              <View style={styles.dayHeader}>
                <View style={[styles.dayBadge, { backgroundColor: dayGroup.color }]}>
                  <Text style={styles.dayBadgeText}>{dayGroup.day}</Text>
                </View>
                <Text style={styles.dayThemeText} numberOfLines={1}>{dayGroup.theme}</Text>
              </View>

              {/* 種目リスト */}
              {dayGroup.exercises.map((ex, exIdx) => (
                <View
                  key={exIdx}
                  style={[
                    styles.exRow,
                    exIdx < dayGroup.exercises.length - 1 && styles.exRowBorder,
                  ]}
                >
                  <View style={[styles.exBar, { backgroundColor: dayGroup.color }]} />
                  <View style={styles.exInfo}>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exDetail}>{ex.detail}</Text>
                  </View>
                  {ex.rpe !== '' && (
                    <View style={[styles.rpeBadge, { backgroundColor: dayGroup.color + '15' }]}>
                      <Text style={[styles.rpeText, { color: dayGroup.color }]}>{ex.rpe}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── 参加/中断ボタン（固定下部） ───────── */}
        <ProgramActionBar programName="BIG3強化プログラム" />

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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space[2],
    marginBottom: Space[3],
  },
  mainSectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  countBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: Space[3],
    paddingVertical: 3,
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
    width: 54,
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

  // ── Day Group Card
  dayCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Space[1],
  },
  dayBadge: {
    paddingHorizontal: Space[2],
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  dayBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  dayThemeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },

  // ── Exercise Row
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[2],
    gap: Space[3],
  },
  exRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exBar: {
    width: 3.5,
    height: 36,
    borderRadius: 2,
  },
  exInfo: { flex: 1 },
  exName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exDetail: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  rpeBadge: {
    paddingHorizontal: Space[2],
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  rpeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});