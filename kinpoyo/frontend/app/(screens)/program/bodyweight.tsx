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
  { emoji: '📅', value: '4週間', label: '期間' },
  { emoji: '🔄', value: '週4回', label: '頻度' },
  { emoji: '⚡', value: '初〜中級', label: 'レベル' },
  { emoji: '🤸', value: '自重', label: '種目タイプ' },
] as const;

const SCHEDULE = [
  { day: '月', work: '上半身（プッシュアップ系）', rest: false },
  { day: '火', work: '下半身（スクワット系）',     rest: false },
  { day: '水', work: '休養',                       rest: true  },
  { day: '木', work: '体幹（プランク・バーピー）', rest: false },
  { day: '金', work: '休養',                       rest: true  },
  { day: '土', work: '全身複合',                   rest: false },
  { day: '日', work: '休養',                       rest: true  },
] as const;

const EXERCISES = [
  { name: 'プッシュアップ',      muscle: '胸・肩・腕',  vol: '3セット × 15回', color: '#EF4444' },
  { name: 'スクワット',          muscle: '脚・臀部',    vol: '4セット × 20回', color: '#22C55E' },
  { name: 'プランク',            muscle: '体幹',        vol: '3セット × 60秒', color: '#3B82F6' },
  { name: 'バーピー',            muscle: '全身有酸素',  vol: '3セット × 10回', color: '#F59E0B' },
  { name: 'マウンテンクライマー', muscle: '体幹・有酸素', vol: '3セット × 20回', color: '#8B5CF6' },
  { name: 'ランジ',              muscle: '脚・臀部',    vol: '3セット × 12回', color: '#14B8A6' },
] as const;

export default function ProgramShousa2Screen() {
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
                <Text style={styles.heroEmoji}>🤸</Text>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroTitle}>ボディウェイトワークアウト</Text>
                <Text style={styles.heroSub}>4週間 · 週4回 · 初〜中級</Text>
              </View>
            </View>
            <Text style={styles.heroDesc}>
              器具不要。自分の体重だけで全身を効率よく鍛える4週間プログラム。体力・体幹・柔軟性を同時に向上させます。
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

        {/* ── 参加/中断ボタン（固定下部） ───────── */}
        <ProgramActionBar programName="ボディウェイトワークアウト" />

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
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.xl,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
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
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
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
    color: Colors.primaryDark,
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

  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap' },
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
  overviewLabel: { fontSize: FontSize.xs, color: Colors.textHint },

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
    width: 40,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
  },
  dayPillRest: { backgroundColor: Colors.divider },
  dayPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  dayPillTextRest: { color: Colors.textHint },
  scheduleWork: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  scheduleWorkRest: { color: Colors.textHint, fontWeight: FontWeight.regular },

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
  exBar: { width: 4, height: 40, borderRadius: 2 },
  exInfo: { flex: 1 },
  exName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exMuscle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  exVol: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.sm,
  },
  exVolText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
