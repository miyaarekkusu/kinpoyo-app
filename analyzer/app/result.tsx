import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import FrameScrubber from '../components/FrameScrubber';
import JointCompareChart from '../components/JointCompareChart';
import RepCountCard from '../components/RepCountCard';
import StickFigure from '../components/StickFigure';
import {
  buildModel,
  listSessions,
  previewAnalysis,
  saveAnalysis,
  type AnalyzeResult,
  type BuildModelResult,
} from '../lib/api';
import { countRepsForSession, type RepCountPick } from '../lib/repCount';
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
  const [savedInfo, setSavedInfo] = useState<{
    id: number;
    sessionCount: number;
    model: BuildModelResult | null;
    modelError: string | null;
  } | null>(null);
  // セッションID -> DB登録済みの正解回数（フォームの初期値）。
  const [initialTrueReps, setInitialTrueReps] = useState<Record<number, number | null>>({});
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 32, 700);

  // joint -> session -> frame -> angle, pre-built per new session for the
  // frame-by-frame scrubber.
  const newSessionAngles = useMemo(() => {
    if (!result) return {} as Record<number, Record<number, Record<string, number>>>;
    const newSet = new Set(result.new_session_ids);
    const out: Record<number, Record<number, Record<string, number>>> = {};
    for (const [jointName, j] of Object.entries(result.joints)) {
      for (const s of j.series) {
        if (!newSet.has(s.session_id)) continue;
        const byFrame = out[s.session_id] ?? (out[s.session_id] = {});
        for (const p of s.points) {
          const frameRow = byFrame[p.frame] ?? (byFrame[p.frame] = {});
          frameRow[jointName] = p.angle;
        }
      }
    }
    return out;
  }, [result]);

  // 新規セッションごとの推定回数。主役関節は監視関節の中で最も動いたものを自動選択。
  const repCounts = useMemo(() => {
    if (!result) return {} as Record<number, RepCountPick>;
    const out: Record<number, RepCountPick> = {};
    for (const sid of result.new_session_ids) {
      const jointSeries = Object.entries(result.joints).map(([joint, j]) => ({
        joint,
        points: j.series.find((s) => s.session_id === sid)?.points ?? [],
      }));
      out[sid] = countRepsForSession(jointSeries, result.monitored_joints);
    }
    return out;
  }, [result]);

  useEffect(() => {
    (async () => {
      try {
        const r = await previewAnalysis(tagIdNum, sessionIdList);
        setResult(r);
        // フォーム初期値用に、対象セッションの登録済み正解回数を取得。
        try {
          const sessions = await listSessions();
          const newSet = new Set(r.new_session_ids);
          const map: Record<number, number | null> = {};
          for (const s of sessions) {
            if (newSet.has(s.id)) map[s.id] = s.true_reps;
          }
          setInitialTrueReps(map);
        } catch {
          // 正解回数の取得失敗は致命的ではない（フォームは空で開始）。
        }
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
      // ① 分析を保存してセッションをタグに紐付け（元々のデータと合算）。
      const r = await saveAnalysis(tagIdNum, sessionIdList, result);
      // ② 合算後の正解回数つきデータでmodelを較正（学習）してDB保存。
      let model: BuildModelResult | null = null;
      let modelError: string | null = null;
      try {
        model = await buildModel(tagIdNum);
      } catch (e: any) {
        modelError = e.message ?? String(e);
      }
      setSavedInfo({ id: r.id, sessionCount: r.session_count, model, modelError });
    } catch (e: any) {
      Alert.alert('保存失敗', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const closeSavedAndReturn = () => {
    setSavedInfo(null);
    router.replace({ pathname: '/select', params: { tagId: String(tagIdNum) } });
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
          {result.monitored_joints.length === 0 ? (
            <Text style={styles.warn}>
              ⚠ このタグは監視関節が未設定です。今は全関節を表示しています。タグ編集で対象を絞ってください。
            </Text>
          ) : (
            <Text style={[sharedStyles.subtitle, { marginTop: 4 }]}>
              監視関節: {result.monitored_joints.join(' / ')}
            </Text>
          )}
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

        {result.new_session_ids.map((sid) => {
          const rep = repCounts[sid];
          return (
          <View key={`scrub-${sid}`} style={sharedStyles.card}>
            <Text style={styles.sectionTitle}>
              フレーム別レビュー (セッション #{sid})
            </Text>
            {rep && (
              <RepCountCard
                sessionId={sid}
                rep={rep}
                initialTrueReps={initialTrueReps[sid] ?? null}
              />
            )}
            <Text style={[sharedStyles.subtitle, { marginBottom: 8 }]}>
              画像と各関節角度をフレーム単位で確認できます。
            </Text>
            <FrameScrubber
              sessionId={sid}
              jointNames={Object.keys(result.joints)}
              anglesByFrame={newSessionAngles[sid] ?? {}}
              width={chartWidth}
            />
          </View>
          );
        })}

        <View style={sharedStyles.card}>
          <Text style={styles.sectionTitle}>
            関節角度 推移 (0〜100% で正規化)
          </Text>
          <Text style={[sharedStyles.subtitle, { marginBottom: 8 }]}>
            今回 (新規 {result.new_session_ids.length} 件) vs 既存学習データ
            ({result.existing_session_ids.length} 件) の平均カーブ。
          </Text>
          {Object.entries(result.joints).map(([name, j]) => {
            const hasNew = (j.curve_new?.length ?? 0) > 0;
            const hasExisting = (j.curve_existing?.length ?? 0) > 0;
            if (!hasNew && !hasExisting) return null;
            return (
              <View key={name} style={{ marginVertical: 6 }}>
                <JointCompareChart
                  jointName={name}
                  curveNew={j.curve_new}
                  curveExisting={j.curve_existing}
                  width={chartWidth}
                />
              </View>
            );
          })}
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

      <Modal
        visible={saving}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.modalText}>登録中...</Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={savedInfo !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSavedAndReturn}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>登録しました</Text>
            {savedInfo && (
              <Text style={[styles.modalText, { marginTop: 8, fontWeight: '400' }]}>
                分析 #{savedInfo.id} を保存しました。{'\n'}
                学習データ合計: {savedInfo.sessionCount} 件
              </Text>
            )}
            {savedInfo?.model && (
              <Text style={[styles.modalText, { marginTop: 6, fontWeight: '400' }]}>
                model「{savedInfo.model.name}」を学習しました。{'\n'}
                一致率 {savedInfo.model.exact_match_rate != null
                  ? `${Math.round(savedInfo.model.exact_match_rate * 100)}%`
                  : '—'}
                {' ・ '}平均ズレ {savedInfo.model.mae != null
                  ? `${savedInfo.model.mae} 回`
                  : '—'}
                {'\n'}主役関節 {savedInfo.model.main_joint ?? '—'}
                {' ・ '}1レップ標準カーブを {savedInfo.model.cycle_count} サイクルから学習
                {'\n'}（正解回数つき {savedInfo.model.session_count} 件で較正）
              </Text>
            )}
            {savedInfo && !savedInfo.model && (
              <Text style={[styles.warn, { marginTop: 6 }]}>
                ⚠ model学習はスキップされました。{'\n'}
                {savedInfo.modelError ?? '正解回数が未登録の可能性があります。'}
              </Text>
            )}
            <Pressable
              style={[sharedStyles.buttonPrimary, styles.modalButton]}
              onPress={closeSavedAndReturn}
            >
              <Text style={sharedStyles.buttonPrimaryText}>データ選択へ戻る</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  warn: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.card,
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 180,
  },
  modalText: {
    color: colors.text,
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalButton: {
    marginTop: 20,
    alignSelf: 'stretch',
  },
});
