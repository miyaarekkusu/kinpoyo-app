import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Space } from '@/constants/theme';

export default function HypertrophyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* メインタイトル */}
        <Text style={styles.title}>筋肥大とは</Text>
        
        <View style={styles.contentBlock}>
          <Text style={styles.paragraph}>
            目指とする身体（筋肉の増量、筋力向上など）を効率よく達成するために、「何を」「どれくらい」「いつ」行うかを体系的にまとめた計画表のことです。
          </Text>
          <Text style={styles.paragraph}>
            ただジムに行って思いつきでマシンを動かすのとは違い、計画的に負荷を管理することで、体が過酷に慣れて停滞するのを防ぐ役割があります。
          </Text>
        </View>

        {/* 三大原則セクション */}
        <View style={styles.highlightCard}>
          <Text style={styles.cardTitle}>効率よく筋肥大させるための「三大原則」</Text>
          <Text style={styles.paragraph}>
            トレーニング、栄養、休養のどれか一つを頑張るだけでなく、以下のバランスが大切です。
          </Text>
          
          <View style={styles.principleRow}>
            <View style={styles.principleItem}>
              <Text style={styles.principleEmoji}>🏋️</Text>
              <Text style={styles.principleText}>適切な運動</Text>
            </View>
            <View style={styles.principleItem}>
              <Text style={styles.principleEmoji}>🥩</Text>
              <Text style={styles.principleText}>適切な栄養</Text>
            </View>
            <View style={styles.principleItem}>
              <Text style={styles.principleEmoji}>💤</Text>
              <Text style={styles.principleText}>適切な休養</Text>
            </View>
          </View>
        </View>

        {/* 詳細解説 1: 運動 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. 適切な運動 (プログレッシブ・オーバーロード)</Text>
          <Text style={styles.paragraph}>
            筋肉を成長させるためには、筋肉に強い負荷が必要です。扱う重量や回数、セット数などの総負荷（ボリューム）を少しずつ増やしていく手法のことです。
          </Text>
          <Text style={styles.paragraph}>
            いつも同じ重さ・同じ回数では、筋肉がその負荷に慣れてしまい、筋肥大のシグナルが弱まります。
          </Text>
        </View>

        {/* 詳細解説 2: 栄養 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. 適切な栄養 (オーバーカロリーの状態)</Text>
          <Text style={styles.paragraph}>
            筋肉を大きくするにはタンパク質が必要。体重1kgあたり1.6〜2.0g（体重60kgなら120g程度）を摂るのが理想的です。
          </Text>
          <Text style={styles.paragraph}>
            また、エネルギーが不足している状態（アンダーカロリー）だと、筋肉が分解されやすいです。基本的には、<Text style={styles.bold}>摂取カロリー ＞ 消費カロリー</Text> の「オーバーカロリー」状態でトレーニングを行うのが理想的です。
          </Text>
        </View>

        {/* 詳細解説 3: 休養 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. 適切な休養 (超回復)</Text>
          <Text style={styles.paragraph}>
            トレーニングによって傷ついた筋肉は、休息をとることで修復され、以前よりも強く太くなります（超回復）。
          </Text>
          <Text style={styles.paragraph}>
            毎日同じ部位を鍛えるのではなく、48〜72時間（2〜3日）程度の休息を挟むことが推奨されます。
          </Text>
        </View>

        {/* まとめ */}
        <View style={styles.summaryBlock}>
          <Text style={styles.sectionTitle}>まとめ</Text>
          <Text style={styles.paragraph}>
            筋肥大は一朝一夕には成し遂げられません。計画的なトレーニング、充実した栄養、そして十分な休養を組み合わせることで、理想の身体へと近づくことができます。
          </Text>
          <Text style={styles.paragraph}>
            kinpoyoを使って日々の成長を可視化し、継続していきましょう。
          </Text>
        </View>
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
  contentBlock: {
    marginBottom: Space[6],
  },
  highlightCard: {
    backgroundColor: '#F0FDF4', // 薄いグリーンの背景
    borderRadius: 12,
    padding: Space[4],
    marginBottom: Space[6],
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    marginBottom: Space[2],
  },
  principleRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Space[3],
    paddingVertical: Space[2],
  },
  principleItem: {
    alignItems: 'center',
  },
  principleEmoji: {
    fontSize: 32,
    marginBottom: Space[1],
  },
  principleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  section: {
    marginBottom: Space[6],
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    paddingLeft: Space[3],
  },
  paragraph: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.6,
    marginBottom: Space[2],
  },
  bold: {
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  summaryBlock: {
    marginTop: Space[4],
    paddingTop: Space[4],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: Space[6],
  },
});