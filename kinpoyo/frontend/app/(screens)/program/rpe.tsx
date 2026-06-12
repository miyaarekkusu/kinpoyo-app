import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Layout, Space } from '@/constants/theme';

export default function RpeScreen() {
  return (
    <>
      {/* ネイティブの黒いヘッダー帯を非表示にする設定 */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <IconSymbol name="chevron.left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>RPEとは</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>RPEとは</Text>
          <Text style={styles.paragraph}>
            RPEとは「そのセットがどれくらいキツかったか」を1〜10の数字で表した自己評価の基準です。
            正式名称は Rate of Perceived Exertion（自覚的運動強度）と言います。
          </Text>

          {/* RPE法 10段階評価リスト */}
          <Text style={styles.sectionTitle}>📋 RPE法 10段階評価リスト</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableHeaderCell, { width: '25%' }]}>RPEレベル</Text>
              <Text style={[styles.tableHeaderCell, { width: '30%' }]}>疲労度・感覚</Text>
              <Text style={[styles.tableHeaderCell, { width: '45%' }]}>具体的な目安</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>10</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>最大強度</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと1回も挙がらない（限界）</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>9.5</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>極めてきつい</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>回数は限界だが、重量は少し増やせるかも</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>9</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>かなりきつい</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと「1回」だけなら確実に挙げられた</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>8.5</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>強い強度</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと1〜2回は挙げられた感覚</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>8</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>強い強度</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと「2回」なら確実に挙げられた</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>7.5</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>中高強度</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと2〜3回は挙げられた感覚</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>7</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>適度なきつさ</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと「3回」なら確実に挙げられた（スピードを維持できる限界）</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>5〜6</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>軽い・中等度</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>あと4〜6回は余裕がある（ウォーミングアップ等）</Text>
            </View>

            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.rpeNum, { width: '25%' }]}>1〜4</Text>
              <Text style={[styles.tableCellBold, { width: '30%' }]}>非常に軽い</Text>
              <Text style={[styles.tableCell, { width: '45%' }]}>ほとんど努力が不要な軽さ</Text>
            </View>
          </View>

          {/* なぜRPEが重要なのか */}
          <Text style={styles.sectionTitle}>💡 なぜRPEが重要なのか？</Text>
          <Text style={styles.paragraph}>
            人間の体調は毎日変わります。睡眠不足の日や仕事で疲れている日に、「いつも100kgだから今日も100kg」と無理に挙げてしまうと、疲労が溜まりすぎて怪我をしたり、筋肉が逆に減ってしまう原因になります。
          </Text>
          <Text style={styles.paragraph}>
            RPEを使うことで、「今日は体調が悪いから、RPE 8（あと2回できる余裕）になるように少し重量を落とそう」といった、その日の体調に合わせた最適なトレーニング（自動調整）が可能になります。
          </Text>
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
    paddingHorizontal: Space[4],
    paddingVertical: Space[5],
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[4],
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Space[5],
    marginBottom: Space[3],
    lineHeight: FontSize.md * 1.4,
  },
  paragraph: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.6,
    marginBottom: Space[2],
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: Space[2],
    marginBottom: Space[4],
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Space[2],
    paddingHorizontal: Space[2],
  },
  tableHeaderCell: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Space[3],
    paddingHorizontal: Space[2],
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  rpeNum: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  tableCellBold: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});