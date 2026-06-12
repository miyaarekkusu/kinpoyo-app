import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Layout, Space } from '@/constants/theme';

export default function ProgramDesignScreen() {
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
          <Text style={styles.headerTitle}>プログラムの組み方</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>プログラムとは/組み方</Text>
          
          <Text style={styles.sectionTitle}>プログラムとは</Text>
          <Text style={styles.paragraph}>
            目標とする身体（筋肉の増量、筋力向上など）を効率よく達成するために、「何を」「どれくらい」「いつ」行うかを体系的にまとめた計画表のことです。{'\n'}
            ただジムに行って思いつきでマシンを動かすのとは違い、計画的に負荷を管理することで、体が運動に慣れて停滞するのを防ぐ役割があります。
          </Text>

          <Text style={styles.sectionTitle}>プログラム作成のポイント</Text>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>1</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>疲労管理（最優先）</Text>
              <Text style={styles.paragraph}>どんな神メニューも、怪をしたらすべてゼロになります。関節や神経の疲れを溜めない仕組みを最優先に。</Text>
            </View>
          </View>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>2</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>コンパウンド種目（多関節種目）を軸にする</Text>
              <Text style={styles.paragraph}>スクワット、ベンチプレス、デッドリフト、懸垂など、一度に多くの筋肉を使う種目をセッションの前半に持ってきます。</Text>
            </View>
          </View>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>3</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>1週間の総セット数（ボリューム）の決定</Text>
              <Text style={styles.paragraph}>筋肥大に最も相関するのは「重量 × 回数 × セット数」の総量です。一般的に1部位あたり週10〜20セットが目安。</Text>
            </View>
          </View>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>4</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>適切なRPE（強度）の設定</Text>
              <Text style={styles.paragraph}>毎セット限界まで追い込む必要はありません。基本はRPE 7〜9（あと1〜3回できる余力を残す）でボリュームを稼ぎます。</Text>
            </View>
          </View>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>5</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>セット間の休憩（インターバル）を長く取る</Text>
              <Text style={styles.paragraph}>息が切れたまま次のセットに入るとボリュームが落ちます。主要種目は2〜3分、しっかり休んでから全力で取り組みましょう。</Text>
            </View>
          </View>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>6</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>進捗の記録（ノートをつける）</Text>
              <Text style={styles.paragraph}>「前回何kgを何回やったか」を必ずメモします。過去の数値を一歩でも超えることが過負荷の原則の基本です。</Text>
            </View>
          </View>

          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>7</Text>
            <View style={styles.itemContent}>
              <Text style={styles.itemHeader}>各部位の頻度を考えながらプログラムを組む</Text>
              <Text style={styles.paragraph}>筋肉の成長スイッチは2〜3日で切れます。週1回だけ鍛えて残りの6日を休ませるより、週2回刺激が入るスケジュールが理想。</Text>
            </View>
          </View>

          <Text style={[styles.paragraph, { marginTop: Space[3], fontWeight: '600', color: '#EF4444' }]}>
            ⚠️ BIG3（スクワット・ベンチプレス・デッドリフト）の重量を伸ばしたい場合、PPL（プッシュ/プル/レッグ）や3〜5分割はおすすめしない
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
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
  scroll: { paddingHorizontal: Space[4], paddingVertical: Space[5], backgroundColor: '#FFFFFF' },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Space[4] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Space[4], marginBottom: Space[3] },
  itemRow: { flexDirection: 'row', marginBottom: Space[4], alignItems: 'flex-start' },
  itemNumber: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySubtle,
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginRight: Space[3],
  },
  itemContent: { flex: 1 },
  itemHeader: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  paragraph: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.6, marginBottom: Space[2] },
});