import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Space } from '@/constants/theme';

export default function RpeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* メイン解説 */}
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
            <Text style={[styles.rpeNum, { width: '25%', color: '#EF4444' }]}>10</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>限界値・極限</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>1回も追加できない。全力を出し切った状態。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#F97316' }]}>9</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>非常に強い</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>あと1回なら挙げられたかもしれないが、確実ではない。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#F59E0B' }]}>8</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>強い</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>あと2回は確実に挙げられた。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#10B981' }]}>7</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>やや強い</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>あと3回は確実に挙げられた。フォームを維持できる。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#3B82F6' }]}>6</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>中等度</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>あと4〜5回は挙がる。重さは感じるが余力はある。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#6366F1' }]}>5</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>やや楽</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>トレーニングとして機能するが、まだ余裕がある。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#8B5CF6' }]}>4</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>楽</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>ウォーミングアップや回復レベル。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#A855F7' }]}>3</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>非常に楽</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>ほとんど疲労を感じない。軽い運動。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#EC4899' }]}>2</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>きわめて楽</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>日常生活活動程度。</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.rpeNum, { width: '25%', color: '#6B7280' }]}>1</Text>
            <Text style={[styles.tableCellBold, { width: '30%' }]}>安静時</Text>
            <Text style={[styles.tableCell, { width: '45%' }]}>座っている。寝ている状態。</Text>
          </View>
        </View>

        {/* なぜBig3を伸ばすのにRPEが必要なのか？ */}
        <Text style={styles.sectionTitle}>・なぜBig3を伸ばすのにRPEが必要なのか？</Text>
        <Text style={styles.paragraph}>
          これまでは「1発最大で挙がる重量（1RM）」の75%や80%といった「%1RM」でメニューを組むのが主流でした。しかし、これには大きな弱点があります。それは「人間の調子は毎日変わる」ということです。{'\n'}
          睡眠不足、仕事のストレス、前日の疲れなどで、先週は軽く挙がった100kgが、今日は鉄の塊のように重く感じることってありますよね。{'\n'}
          RPEを使うと、その日の体調に合わせた最適な負荷（オートレギュレーション＝自己調節）が可能になります。
        </Text>

        {/* ケガを防ぎ、神経系の疲労を管理できる */}
        <Text style={styles.sectionTitle}>・ケガを防ぎ、神経系の疲労を管理できる</Text>
        <Text style={styles.paragraph}>
          Big3、特にスクワットやデッドリフトは全身の神経系を激しく消耗します。体調が悪い日に無理やり固定された高重量（%1RM）で潰れるまでやってしまうと、ケガのリスクが跳ね上がります。「今日は調子が悪いから、RPE8（あと2回残る軽さ）になるように重量を少し落とそう」と判断を可能にするのがRPEです。
        </Text>

        {/* 毎セット限界（RPE10）まで追い込まないため */}
        <Text style={styles.sectionTitle}>・毎セット限界（RPE10）まで追い込まないため</Text>
        <Text style={styles.paragraph}>
          「限界までやらないと伸びないのでは？」と思いがちですが、Big3の重量を伸ばすには「潰れるまでやらない（RPE7〜9で止める）」のが鉄則です。余力を残してセットを終えることで、フォームが崩れるのを防ぎ、質の高い練習（ボリューム）をたくさん積み重ねることができます。結果として、その方が早く強くなります。
        </Text>

        {/* RPE法と筋肥大 */}
        <Text style={styles.sectionTitle}>・RPE法と筋肥大</Text>
        <Text style={styles.paragraph}>
          RPE法（余力を残す管理）でも十分に筋肉は大きく（筋肥大）なります。しかし、すべての種目をRPE法で管理してしまうと、筋肥大の効率が落ちてしまう可能性があります。{'\n\n'}
          Big3は「RPE法」で疲労をコントロールするものであり補助種目まで「RPE法」で管理する必要がないので限界まで追い込んで筋肥大したいのであれば疲労管理を最優先に考えながら実施すること。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[5],
    backgroundColor: '#FFFFFF',
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
    borderRadius: 8, // 👈 エラー回避のため直接数値を指定
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
    textAlign: 'center',
  },
  tableCellBold: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  tableCell: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: FontSize.xs * 1.4,
    paddingHorizontal: 2,
  },
});