import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import JointChart from '../components/JointChart';
import StickFigure from '../components/StickFigure';
import {
  previewAnalysis,
  saveAnalysis,
  type AnalyzeResult,
} from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

export default function ResultScreen() {
  const { tagId, sessionIds } = useLocalSearchParams<{
    tagId: string;
    sessionIds: string;
  }>();
  const tagIdNum = Number(tagId);
  const sessionIdList = (sessionIds ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 32, 700);

  useEffect(() => {
    (async () => {
      try {
        const r = await previewAnalysis(tagIdNum, sessionIdList);
        setResult(r);
      } catch (e: any) {
        Alert.alert('分析失敗', e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const r = await saveAnalysis(tagIdNum, sessionIdList, result);
      Alert.alert(
        '登録完了',
        `分析 #${r.id} を保存しました。\n学習データ合計: ${r.session_count} 件`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (e: any) {
      Alert.alert('保存失敗', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[sharedStyles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[sharedStyles.subtitle, { marginTop: 8 }]}>
          分析中... 既存データと合成しています
        </Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[sharedStyles.container, styles.center]}>
        <Text style={sharedStyles.subtitle}>結果がありません</Text>
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent}>
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.title}>分析結果プレビュー</Text>
          <Text style={sharedStyles.subtitle}>
            合計 {result.session_count} セッション ・ {result.total_frames} フレーム
          </Text>
          <Text style={[sharedStyles.subtitle, { marginTop: 4 }]}>
            新規 {result.new_session_ids.length} 件 + 既存 {result.existing_session_ids.length} 件
          </Text>
        </View>

        <View style={sharedStyles.card}>
          <Text style={styles.sectionTitle}>関節角度 統計</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.cellLabel, { flex: 1.2 }]}>関節</Text>
            <Text style={styles.cellHead}>平均</Text>
            <Text style={styles.cellHead}>±SD</Text>
            <Text style={styles.cellHead}>最小</Text>
            <Text style={styles.cellHead}>最大</Text>
          </View>
          {Object.entries(result.joints).map(([name, j]) => (
            <View key={name} style={styles.tableRow}>
              <Text style={[styles.cellLabel, { flex: 1.2 }]}>{name}</Text>
              <Text style={styles.cell}>{j.stats.mean != null ? `${j.stats.mean}°` : '—'}</Text>
              <Text style={styles.cell}>{j.stats.std != null ? `${j.stats.std}` : '—'}</Text>
              <Text style={styles.cell}>{j.stats.min != null ? `${j.stats.min}°` : '—'}</Text>
              <Text style={styles.cell}>{j.stats.max != null ? `${j.stats.max}°` : '—'}</Text>
            </View>
          ))}
        </View>

        <View style={sharedStyles.card}>
          <Text style={styles.sectionTitle}>平均ポーズ (棒人間)</Text>
          <View style={{ alignItems: 'center' }}>
            <StickFigure
              landmarks={result.landmark_mean}
              width={chartWidth}
              height={Math.min(chartWidth, 400)}
              showLabels
            />
          </View>
        </View>

        <View style={sharedStyles.card}>
          <Text style={styles.sectionTitle}>関節角度 時系列</Text>
          {Object.entries(result.joints).map(([name, j]) =>
            j.series.length === 0 ? null : (
              <View key={name} style={{ marginVertical: 6 }}>
                <JointChart jointName={name} series={j.series} width={chartWidth} />
              </View>
            ),
          )}
        </View>

        <View style={sharedStyles.row}>
          <Pressable
            style={[sharedStyles.buttonSecondary, { flex: 1 }]}
            onPress={() => router.back()}
          >
            <Text style={sharedStyles.buttonSecondaryText}>戻る</Text>
          </Pressable>
          <Pressable
            style={[
              sharedStyles.buttonPrimary,
              { flex: 2 },
              saving && sharedStyles.buttonDisabled,
            ]}
            onPress={register}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={sharedStyles.buttonPrimaryText}>登録 (使用済みにする)</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  cellLabel: {
    color: colors.text,
    fontSize: 13,
  },
  cell: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  cellHead: {
    flex: 1,
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'right',
  },
});
