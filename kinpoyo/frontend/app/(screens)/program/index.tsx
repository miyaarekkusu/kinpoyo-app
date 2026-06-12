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

const PROGRAMS = [
  {
    id: 'big3',
    emoji: '🏋️',
    iconBg: '#FEF3C7',
    title: 'BIG3強化プログラム',
    desc: 'スクワット・ベンチプレス・デッドリフトで\nパワーを最大化する8週間プログラム',
    tag: '人気',
    tagBg: '#FFF3E0',
    tagColor: '#F97316',
    badges: ['8週間', '週3回', '中〜上級'],
    accentColor: '#F97316',
    route: '/program/big3',
  },
  {
    id: 'bodyweight',
    emoji: '🤸',
    iconBg: Colors.primarySubtle,
    title: 'ボディウェイトワークアウト',
    desc: '器具なしで始める全身トレーニング。\n自重で体力・体幹を鍛える4週間プログラム',
    tag: '初心者向け',
    tagBg: Colors.primarySubtle,
    tagColor: Colors.primaryDark,
    badges: ['4週間', '週4回', '初〜中級'],
    accentColor: Colors.primaryDark,
    route: '/program/bodyweight',
  },
] as const;

export default function ProgramIchiranScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <IconSymbol name="chevron.left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>プログラム</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          <Text style={styles.subtitle}>目標に合ったプログラムを選んでください</Text>

          {/* ── プログラムカード ─────────────── */}
          {PROGRAMS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push(p.route as any)}
              activeOpacity={0.8}>

              {/* 上段: アイコン + タイトル + タグ */}
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: p.iconBg }]}>
                  <Text style={styles.emoji}>{p.emoji}</Text>
                </View>
                <View style={styles.cardTopCenter}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <View style={[styles.tag, { backgroundColor: p.tagBg }]}>
                    <Text style={[styles.tagText, { color: p.tagColor }]}>{p.tag}</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={18} color={Colors.textHint} />
              </View>

              {/* 説明 */}
              <Text style={styles.cardDesc}>{p.desc}</Text>

              {/* バッジ群 */}
              <View style={styles.badgeRow}>
                {p.badges.map(b => (
                  <View key={b} style={styles.badge}>
                    <Text style={styles.badgeText}>{b}</Text>
                  </View>
                ))}
              </View>

            </TouchableOpacity>
          ))}

          {/* ── カスタム作成 ─────────────────── */}
          <TouchableOpacity 
            style={styles.customBtn} 
            activeOpacity={0.7}
            onPress={() => router.push('/program/custom_program')}
          >
            <IconSymbol name="plus" size={18} color={Colors.primaryDark} />
            <Text style={styles.customBtnText}>カスタムプログラムを作成</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
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
    paddingTop: Space[5],
    paddingBottom: 100,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    textAlign: 'center',
    marginBottom: Space[5],
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Space[4],
    marginBottom: Space[4],
    ...Shadow.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    marginBottom: Space[3],
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  cardTopCenter: {
    flex: 1,
    gap: Space[1],
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Space[3],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Space[2],
  },
  badge: {
    paddingHorizontal: Space[3],
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    paddingVertical: Space[4],
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
  },
  customBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryDark,
  },
});