import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Space } from '@/constants/theme';

export default function ProgramDesignScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>プログラムとは/組み方</Text>
        
        <Text style={styles.sectionTitle}>プログラムとは</Text>
        <Text style={styles.paragraph}>
          目標とする身体（筋肉の増量、筋力向上など）を効率よく達成するために、「何を」「どれくらい」「いつ」行うかを体系的にまとめた計画表のことです。{'\n'}
          ただジムに行って思いつきでマシンを動かすのとは違い、計画的に負荷を管理することで、体が運動に慣れて停滞するのを防ぐ役割があります。
        </Text>

        <Text style={styles.sectionTitle}>プログラム作成</Text>

        <View style={styles.itemRow}>
          <Text style={styles.itemNumber}>1</Text>
          <View style={styles.itemContent}>
            <Text style={styles.itemHeader}>疲労管理（最優先）</Text>
            <Text style={styles.paragraph}>どんな神メニューも、怪我をしたらすべてゼロになります。関節や神経の疲れを溜めない仕組みを最優先に。</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNumber}>2</Text>
          <View style={styles.itemContent}>
            <Text style={styles.itemHeader}>筋力・筋肥大の両方を鍛えるのが理想</Text>
            <Text style={styles.paragraph}>筋肉を大きくすることと、扱える重さを伸ばすことは表裏一体です。両方の刺激を入れるのが一番効率的。</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNumber}>3</Text>
          <View style={styles.itemContent}>
            <Text style={styles.itemHeader}>補助種目は2〜3セットが理想</Text>
            <Text style={styles.paragraph}>メイン種目の後の補助は2〜3セットで十分。ダラダラ回数を重ねるより、短いセットで出し切る方が効果的です。</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNumber}>4</Text>
          <View style={styles.itemContent}>
            <Text style={styles.itemHeader}>筋力・筋肥大のどちらをメインにするか決める</Text>
            <Text style={styles.paragraph}>その日のメニュー（または時期）ごとに、「今日は重さを狙う日」「今日は回数を狙う日」とメリハリをつけます。</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNumber}>5</Text>
          <View style={styles.itemContent}>
            <Text style={styles.itemHeader}>軽い重量ばかりではなく、重い重量を優先する</Text>
            <Text style={styles.paragraph}>軽い重量ばかりで疲れるのはもったいない。エネルギーが満タンの最初に、しっかり重い重量を扱って神経系を刺激します。</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemNumber}>6</Text>
          <View style={styles.itemContent}>
            <Text style={styles.itemHeader}>初心者は全身法がおすすめ</Text>
            <Text style={styles.paragraph}>初心者は1日1部位を壊すより、週2〜3回、全身の大きな筋肉を高い頻度で動かす方がフォームも筋肉も速く成長します。</Text>
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: Space[4], paddingVertical: Space[5], backgroundColor: '#FFFFFF' },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Space[4] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Space[4], marginBottom: Space[3] },
  itemRow: { flexDirection: 'row', marginBottom: Space[4], alignItems: 'flex-start' },
  itemNumber: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primaryDark, width: 28, textAlign: 'center', marginTop: 2 },
  itemContent: { flex: 1, paddingLeft: Space[2] },
  itemHeader: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 4 },
  paragraph: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: FontSize.sm * 1.5 },
});