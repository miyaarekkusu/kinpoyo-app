import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Layout, Space } from '@/constants/theme';

export default function HypertrophyScreen() {
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
          <Text style={styles.headerTitle}>筋肥大とは</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>筋肥大とは</Text>
          
          <View style={styles.contentBlock}>
            <Text style={styles.paragraph}>
              目指とする身体（筋肉の増量、筋力向上など）を効率よく達成するために、「何を」「どれくらい」「いつ」行うかを体系的にまとめた計画表のことです。
            </Text>
            <Text style={styles.paragraph}>
              ただジムに行って思いつきでマシンを動かすのとは違い、計画的に負荷を管理することで、体が過酷に慣れて停滞するのを防群役割があります。
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
                <Text style={styles.principleText}>過負荷の原則</Text>
              </View>
              <View style={styles.principleItem}>
                <Text style={styles.principleEmoji}>🥩</Text>
                <Text style={styles.principleText}>十分な栄養</Text>
              </View>
              <View style={styles.principleItem}>
                <Text style={styles.principleEmoji}>💤</Text>
                <Text style={styles.principleText}>質の高い休養</Text>
              </View>
            </View>
          </View>

          {/* 詳しい解説セクション */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. 過負荷の原則（プログレッシブ・オーバーロード）</Text>
            <Text style={styles.paragraph}>
              筋肉を成長させるには、常に「過去の自分を超える負荷」を与え続ける必要があります。前回と同じ重量・回数を繰り返しているだけでは、筋肉は「今のままで十分対応できる」と判断し、それ以上大きくなりません。
            </Text>
            <Text style={styles.paragraph}>
              少しずつ重量を増やす、回数を増やす、セット数を増やすなど、計画的に負荷を高めていくことが最重要です。
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. 超回復と適切な頻度</Text>
            <Text style={styles.paragraph}>
              トレーニングによって傷ついた筋肉は、適切な栄養と休養をとることで、元よりも少し強い状態に修復されます。これを「超回復」と呼びます。
            </Text>
            <Text style={styles.paragraph}>
              修復には一般的に48〜72時間かかるとされているため、同じ部位を毎日鍛えるのではなく、2〜3日あけてサイクルを回すことが効率的です。
            </Text>
          </View>

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
  contentBlock: {
    marginBottom: Space[6],
  },
  paragraph: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.6,
    marginBottom: Space[2],
  },
  highlightCard: {
    backgroundColor: '#F0FDF4',
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
    paddingLeft: Space[2],
  },
});