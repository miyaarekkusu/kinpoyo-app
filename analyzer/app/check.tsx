import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import CountCheckChart from '../components/CountCheckChart';
import {
  countWithModel,
  listModels,
  type CountResult,
  type RepModelSummary,
} from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

type PickedVideo = { uri: string; name: string; durationSec: number };

export default function CheckScreen() {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 64, 700);
  const [models, setModels] = useState<RepModelSummary[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [counting, setCounting] = useState(false);
  const [result, setResult] = useState<CountResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState('');

  const load = useCallback(async () => {
    setLoadingModels(true);
    try {
      const m = await listModels();
      setModels(m);
      if (m.length === 1) setSelectedId(m[0].id);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickVideo = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('動画ライブラリへのアクセスが許可されていません。');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (res.canceled || res.assets.length === 0) return;
    const a = res.assets[0];
    setVideo({
      uri: a.uri,
      name: a.fileName ?? 'video.mp4',
      // duration は ms。取れない場合は十分大きい値でクリップ全体を対象に。
      durationSec: a.duration != null ? a.duration / 1000 : 3600,
    });
    setResult(null);
  };

  const runCount = async () => {
    if (selectedId == null || !video) return;
    setCounting(true);
    setError(null);
    setResult(null);
    try {
      const r = await countWithModel(selectedId, video.uri, 0, video.durationSec);
      setResult(r);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setCounting(false);
    }
  };

  const actualNum = actual.trim() === '' ? null : Number(actual.trim());
  const diff =
    result != null && actualNum != null ? result.count - actualNum : null;

  return (
    <View style={sharedStyles.container}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent}>
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.title}>回数カウント チェック</Text>
          <Text style={sharedStyles.subtitle}>
            学習済みmodelを選び、動画をアップロードして回数を数えます。
          </Text>
        </View>

        <View style={sharedStyles.card}>
          <Text style={styles.sectionTitle}>1. model を選択</Text>
          {loadingModels ? (
            <ActivityIndicator color={colors.accent} />
          ) : models.length === 0 ? (
            <Text style={[sharedStyles.subtitle, { paddingVertical: 8 }]}>
              学習済みmodelがありません。先に分析画面で登録してください。
            </Text>
          ) : (
            models.map((m) => {
              const selected = m.id === selectedId;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.modelRow, selected && styles.modelRowOn]}
                  onPress={() => setSelectedId(m.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modelName}>{m.name}</Text>
                    <Text style={styles.modelMeta}>
                      一致率{' '}
                      {m.exact_match_rate != null
                        ? `${Math.round(m.exact_match_rate * 100)}%`
                        : '—'}
                      {' ・ '}平均ズレ {m.mae != null ? `${m.mae}回` : '—'}
                      {' ・ '}
                      {m.session_count}件で較正
                    </Text>
                  </View>
                  <Text style={styles.radio}>{selected ? '●' : '○'}</Text>
                </Pressable>
              );
            })
          )}
        </View>

        <View style={sharedStyles.card}>
          <Text style={styles.sectionTitle}>2. 動画を選択</Text>
          <Pressable style={sharedStyles.buttonSecondary} onPress={pickVideo}>
            <Text style={sharedStyles.buttonSecondaryText}>
              {video ? '別の動画を選び直す' : '動画ライブラリから選択'}
            </Text>
          </Pressable>
          {video && (
            <Text style={[sharedStyles.subtitle, { marginTop: 8 }]}>
              選択中: {video.name}
              {video.durationSec < 3600
                ? ` (${video.durationSec.toFixed(1)}秒)`
                : ''}
            </Text>
          )}
        </View>

        <Pressable
          style={[
            sharedStyles.buttonPrimary,
            (selectedId == null || !video || counting) &&
              sharedStyles.buttonDisabled,
          ]}
          onPress={runCount}
          disabled={selectedId == null || !video || counting}
        >
          {counting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sharedStyles.buttonPrimaryText}>カウント実行</Text>
          )}
        </Pressable>

        {counting && (
          <Text style={[sharedStyles.subtitle, { textAlign: 'center' }]}>
            アップロード→姿勢推定→カウント中... 動画の長さによっては時間がかかります。
          </Text>
        )}

        {error && (
          <View style={sharedStyles.card}>
            <Text style={styles.warn}>⚠ {error}</Text>
          </View>
        )}

        {result && (
          <View style={sharedStyles.card}>
            <Text style={styles.sectionTitle}>結果</Text>
            {result.joint ? (
              <Text style={styles.bigCount}>
                {result.count} 回
                <Text style={styles.countMeta}>
                  {'  '}(主役関節 {result.joint} ・ ROM {result.rom}°)
                </Text>
              </Text>
            ) : (
              <Text style={styles.warn}>
                ⚠ 動いている関節を検出できず、カウントできませんでした。
              </Text>
            )}
            <Text style={[sharedStyles.subtitle, { marginTop: 4 }]}>
              model「{result.model_name}」・ 姿勢検出フレーム {result.pose_frames}
              {result.segments > 1 ? ` ・ ${result.segments}区間に分割して合算` : ''}
              {result.rejected > 0
                ? ` ・ 形が違う ${result.rejected} サイクルを棄却`
                : ''}
            </Text>

            <View style={styles.actualRow}>
              <Text style={styles.label}>実際の回数</Text>
              <TextInput
                style={[sharedStyles.textInput, styles.actualInput]}
                value={actual}
                onChangeText={(t) => setActual(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={colors.textDim}
              />
            </View>
            {diff != null && (
              <Text style={diff === 0 ? styles.matchOk : styles.matchNg}>
                {diff === 0
                  ? `✓ 正解と一致 (${result.count} 回)`
                  : `✗ ズレ ${diff > 0 ? '+' : ''}${diff} 回 (推定 ${result.count} / 実際 ${actualNum})`}
              </Text>
            )}

            {result.joint && (
              <CountCheckChart result={result} width={chartWidth} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
  },
  modelRowOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  modelName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modelMeta: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  radio: {
    color: colors.accent,
    fontSize: 18,
    marginLeft: 8,
  },
  bigCount: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  countMeta: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '400',
  },
  actualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actualInput: {
    width: 90,
    textAlign: 'center',
    paddingVertical: 8,
  },
  matchOk: {
    color: colors.success,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  matchNg: {
    color: colors.warning,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  warn: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
});
