import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deleteVideo } from '../lib/files';
import { loadAll, remove, update, type LocalSession } from '../lib/storage';
import { uploadSession } from '../lib/upload';

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const statusLabel = (s: LocalSession['status']) => {
  switch (s) {
    case 'uploaded':
      return { text: '送信済み', color: '#10b981' };
    case 'failed':
      return { text: '送信失敗', color: '#ef4444' };
    default:
      return { text: '未送信', color: '#f59e0b' };
  }
};

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await loadAll();
    setSessions(all);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleUpload = async (session: LocalSession) => {
    setBusyId(session.id);
    try {
      const result = await uploadSession(session);
      await update(session.id, {
        status: 'uploaded',
        remoteSessionId: result.remoteSessionId,
        lastError: undefined,
      });
      Alert.alert(
        '送信完了',
        `セッション #${result.remoteSessionId}\nポーズ: ${result.poseCount}件\n画像: ${result.imageCount}件`,
      );
    } catch (err: any) {
      await update(session.id, {
        status: 'failed',
        lastError: err.message ?? String(err),
      });
      Alert.alert('送信失敗', err.message ?? String(err));
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const handleDelete = (session: LocalSession) => {
    Alert.alert(
      '削除しますか？',
      `${session.exerciseName} (${formatDateTime(session.recordedAt)}) を削除します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteVideo(session.videoUri);
            await remove(session.id);
            refresh();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>保存済みのセッションはありません</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={sessions}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor="#fff"
        />
      }
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const badge = statusLabel(item.status);
        const rangeDuration = item.endTimeSec - item.startTimeSec;
        const isBusy = busyId === item.id;
        return (
          <View style={styles.row}>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/detail', params: { id: item.id } })
              }
            >
              <View style={styles.rowHeader}>
                <Text style={styles.exerciseName}>{item.exerciseName}</Text>
                <View style={[styles.badge, { backgroundColor: badge.color }]}>
                  <Text style={styles.badgeText}>{badge.text}</Text>
                </View>
              </View>

              <Text style={styles.meta}>
                {formatDateTime(item.recordedAt)} ・ 選択範囲 {rangeDuration.toFixed(1)}s
              </Text>

              {item.status === 'uploaded' && item.remoteSessionId != null && (
                <Text style={styles.remoteId}>サーバー側 ID: #{item.remoteSessionId}</Text>
              )}
              {item.status === 'failed' && item.lastError && (
                <Text style={styles.errorText} numberOfLines={2}>
                  {item.lastError}
                </Text>
              )}

              <Text style={styles.tapHint}>タップで詳細</Text>
            </Pressable>

            <View style={styles.actions}>
              {item.status !== 'uploaded' && (
                <Pressable
                  style={[styles.actionButton, styles.uploadAction]}
                  onPress={() => handleUpload(item)}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionText}>
                      {item.status === 'failed' ? '再送信' : '送信'}
                    </Text>
                  )}
                </Pressable>
              )}
              <Pressable
                style={[styles.actionButton, styles.deleteAction]}
                onPress={() => handleDelete(item)}
                disabled={isBusy}
              >
                <Text style={styles.actionText}>削除</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  row: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  meta: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 4,
  },
  remoteId: {
    color: '#10b981',
    fontSize: 13,
    marginBottom: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 4,
  },
  tapHint: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
});
