import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deleteVideo } from '../lib/files';
import { loadAll, remove, update, type LocalSession } from '../lib/storage';
import {
  fetchPreview,
  uploadSession,
  type PreviewFrame,
  type PreviewResult,
} from '../lib/upload';

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const statusBadge = (s: LocalSession['status']) => {
  switch (s) {
    case 'uploaded':
      return { text: '送信済み', color: '#10b981' };
    case 'failed':
      return { text: '送信失敗', color: '#ef4444' };
    default:
      return { text: '未送信', color: '#f59e0b' };
  }
};

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<LocalSession | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<PreviewFrame | null>(null);

  const load = useCallback(async () => {
    const all = await loadAll();
    const found = all.find((s) => s.id === id) ?? null;
    setSession(found);
    if (found) {
      try {
        const info = await FileSystem.getInfoAsync(found.videoUri);
        setFileExists(info.exists);
        setFileSize(info.exists && 'size' in info ? (info.size as number) : null);
      } catch {
        setFileExists(false);
        setFileSize(null);
      }
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const player = useVideoPlayer(session?.videoUri ?? '', (p) => {
    p.loop = false;
    p.pause();
  });

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const badge = statusBadge(session.status);
  const rangeDuration = session.endTimeSec - session.startTimeSec;

  const handleUpload = async () => {
    setBusy(true);
    try {
      const result = await uploadSession(session);
      await update(session.id, {
        status: 'uploaded',
        remoteSessionId: result.remoteSessionId,
        lastError: undefined,
      });
      Alert.alert(
        '送信完了',
        `サーバーセッション #${result.remoteSessionId}\nポーズ: ${result.poseCount}件\n画像: ${result.imageCount}件`,
      );
      load();
    } catch (err: any) {
      await update(session.id, {
        status: 'failed',
        lastError: err.message ?? String(err),
      });
      Alert.alert('送信失敗', err.message ?? String(err));
      load();
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setPreviewBusy(true);
    setPreviewError(null);
    setSelectedFrame(null);
    try {
      const result = await fetchPreview(session);
      setPreview(result);
    } catch (err: any) {
      setPreviewError(err.message ?? String(err));
    } finally {
      setPreviewBusy(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('削除しますか？', `${session.exerciseName} を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteVideo(session.videoUri);
          await remove(session.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Status header */}
      <View style={styles.headerRow}>
        <Text style={styles.exerciseName}>{session.exerciseName}</Text>
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Text style={styles.badgeText}>{badge.text}</Text>
        </View>
      </View>

      {/* Video preview */}
      {fileExists !== false && (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
        />
      )}
      {fileExists === false && (
        <View style={[styles.video, styles.missingVideo]}>
          <Text style={styles.missingText}>動画ファイルが見つかりません</Text>
        </View>
      )}

      {/* Metadata sections */}
      <Section title="基本情報">
        <Field label="ID" value={session.id} />
        <Field label="種目名" value={session.exerciseName} />
        <Field label="撮影日時" value={formatDateTime(session.recordedAt)} />
        <Field label="動画長" value={`${session.durationSec.toFixed(2)} 秒`} />
      </Section>

      <Section title="選択範囲">
        <Field
          label="開始点"
          value={`${session.startTimeSec.toFixed(2)} 秒`}
        />
        <Field label="終了点" value={`${session.endTimeSec.toFixed(2)} 秒`} />
        <Field label="範囲長" value={`${rangeDuration.toFixed(2)} 秒`} />
      </Section>

      <Section title="動画ファイル">
        <Field label="URI" value={session.videoUri} mono />
        <Field
          label="サイズ"
          value={fileSize !== null ? formatBytes(fileSize) : '取得中...'}
        />
        <Field
          label="存在"
          value={
            fileExists === null ? '...' : fileExists ? 'あり' : 'なし'
          }
        />
      </Section>

      <Section title="サーバー連携">
        <Field label="状態" value={badge.text} />
        <Field
          label="サーバーID"
          value={
            session.remoteSessionId != null
              ? `#${session.remoteSessionId}`
              : '(未送信)'
          }
        />
        {session.lastError && (
          <Field label="エラー" value={session.lastError} mono />
        )}
      </Section>

      {/* Server-side preview extraction */}
      <Section title="サーバー抽出（プレビュー）">
        <View style={{ padding: 4, gap: 8 }}>
          <Text style={styles.helpText}>
            サーバーに動画 + 範囲を送って MediaPipe で抽出し、結果を返します。
            DBには保存されません。
          </Text>
          <Pressable
            style={[styles.previewButton, previewBusy && styles.previewButtonBusy]}
            onPress={handlePreview}
            disabled={previewBusy}
          >
            {previewBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.previewButtonText}>
                {preview ? '再抽出' : 'プレビュー実行'}
              </Text>
            )}
          </Pressable>
          {previewError && (
            <Text style={styles.errorText}>{previewError}</Text>
          )}
        </View>

        {preview && (
          <View style={{ padding: 4, gap: 8 }}>
            <Field label="FPS" value={preview.fps.toFixed(2)} />
            <Field
              label="範囲内フレーム数"
              value={`${preview.total_frames_in_range} フレーム`}
            />
            <Field
              label="ポーズ検出数"
              value={`${preview.pose_count} 件`}
            />
            <Field
              label="画像抽出数"
              value={`${preview.image_count} 件 (${preview.image_sample_interval}フレーム毎)`}
            />

            <Text style={styles.subTitle}>画像サムネイル</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.thumbRow}>
                {preview.frames
                  .filter((f) => f.image_base64)
                  .map((f) => (
                    <Pressable
                      key={f.frame_number}
                      onPress={() => setSelectedFrame(f)}
                      style={[
                        styles.thumbBox,
                        selectedFrame?.frame_number === f.frame_number &&
                          styles.thumbBoxSelected,
                      ]}
                    >
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${f.image_base64}` }}
                        style={styles.thumb}
                        contentFit="cover"
                      />
                      <Text style={styles.thumbLabel}>#{f.frame_number}</Text>
                    </Pressable>
                  ))}
              </View>
            </ScrollView>

            {selectedFrame && (
              <View style={styles.selectedBox}>
                <Text style={styles.subTitle}>
                  フレーム #{selectedFrame.frame_number} のポーズ
                </Text>
                {selectedFrame.image_base64 && (
                  <Image
                    source={{
                      uri: `data:image/jpeg;base64,${selectedFrame.image_base64}`,
                    }}
                    style={styles.selectedImage}
                    contentFit="contain"
                  />
                )}
                <Text style={styles.detectStatus}>
                  {selectedFrame.pose_landmarks
                    ? `${selectedFrame.pose_landmarks.length} ランドマーク検出`
                    : 'ポーズ未検出'}
                </Text>
                {selectedFrame.pose_landmarks && (
                  <View style={styles.poseBox}>
                    <Text style={styles.poseText}>
                      {JSON.stringify(
                        selectedFrame.pose_landmarks.slice(0, 5),
                        null,
                        2,
                      )}
                      {'\n... (' +
                        (selectedFrame.pose_landmarks.length - 5) +
                        ' more)'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </Section>

      {/* Raw JSON */}
      <Pressable
        style={styles.rawToggle}
        onPress={() => setShowRaw((v) => !v)}
      >
        <Text style={styles.rawToggleText}>
          {showRaw ? '▼' : '▶'} 生JSONを表示
        </Text>
      </Pressable>
      {showRaw && (
        <View style={styles.rawBox}>
          <Text style={styles.rawText}>{JSON.stringify(session, null, 2)}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {session.status !== 'uploaded' && (
          <Pressable
            style={[styles.actionButton, styles.uploadAction]}
            onPress={handleUpload}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>
                {session.status === 'failed' ? '再送信' : 'サーバーへ送信'}
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          style={[styles.actionButton, styles.deleteAction]}
          onPress={handleDelete}
          disabled={busy}
        >
          <Text style={styles.actionText}>削除</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionInner}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text
        style={[styles.fieldValue, mono && styles.monoText]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  video: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  missingVideo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  missingText: {
    color: '#9ca3af',
  },
  section: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: 'bold',
    padding: 12,
    backgroundColor: '#374151',
  },
  sectionInner: {
    padding: 8,
  },
  field: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 2,
  },
  fieldValue: {
    color: '#fff',
    fontSize: 14,
  },
  monoText: {
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  helpText: {
    color: '#9ca3af',
    fontSize: 12,
  },
  previewButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  previewButtonBusy: {
    backgroundColor: '#374151',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
  },
  subTitle: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  thumbBox: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbBoxSelected: {
    borderColor: '#2563eb',
  },
  thumb: {
    width: 80,
    height: 120,
    backgroundColor: '#000',
  },
  thumbLabel: {
    color: '#9ca3af',
    fontSize: 10,
    textAlign: 'center',
    paddingVertical: 2,
  },
  selectedBox: {
    backgroundColor: '#111827',
    padding: 8,
    borderRadius: 6,
  },
  selectedImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#000',
    borderRadius: 4,
  },
  detectStatus: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 4,
  },
  poseBox: {
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  poseText: {
    color: '#a3e635',
    fontSize: 10,
    fontFamily: 'Menlo',
  },
  rawToggle: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  rawToggleText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  rawBox: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
  },
  rawText: {
    color: '#a3e635',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadAction: {
    backgroundColor: '#2563eb',
  },
  deleteAction: {
    backgroundColor: '#374151',
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
