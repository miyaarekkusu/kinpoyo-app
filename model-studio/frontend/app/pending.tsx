import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ProgressBar } from '../components/progress-bar';
import {
  listPendingRows,
  removePendingRows,
  type PendingRow,
} from '../lib/pending';
import { uploadSession, type UploadProgress } from '../lib/upload';

const rowKey = (r: PendingRow) => `${r.itemId}::${r.segment.id}`;

const formatTime = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${String(
    Math.floor((sec * 10) % 10),
  )}`;

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PendingScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    rowIndex: number;
    totalRows: number;
    label: string;
    progress: UploadProgress;
  } | null>(null);

  const reload = useCallback(async () => {
    const r = await listPendingRows();
    setRows(r);
    setSelected((prev) => {
      const valid = new Set(r.map(rowKey));
      const next = new Set<string>();
      prev.forEach((k) => {
        if (valid.has(k)) next.add(k);
      });
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = useMemo(
    () =>
      rows !== null &&
      rows.length > 0 &&
      rows.every((r) => selected.has(rowKey(r))),
    [rows, selected],
  );

  const toggleAll = () => {
    if (!rows) return;
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map(rowKey)));
  };

  const handleDelete = () => {
    if (selected.size === 0 || busy) return;
    Alert.alert(
      '保留を削除',
      `選択した ${selected.size} 件を削除します。よろしいですか？\n(同じ動画の区間が全て消えると動画ファイルも削除されます)`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const keys = Array.from(selected).map((k) => {
              const [itemId, segmentId] = k.split('::');
              return { itemId, segmentId };
            });
            await removePendingRows(keys);
            await reload();
          },
        },
      ],
    );
  };

  const handleSend = async () => {
    if (selected.size === 0 || busy || !rows) return;
    const targets = rows.filter((r) => selected.has(rowKey(r)));
    setBusy(true);

    let successCount = 0;
    let failureCount = 0;
    const succeededKeys: { itemId: string; segmentId: string }[] = [];

    for (let i = 0; i < targets.length; i++) {
      const row = targets[i];
      const label = `${row.exerciseName} 区間 ${formatTime(row.segment.startTime)}-${formatTime(row.segment.endTime)}`;
      try {
        await uploadSession(
          {
            id: `${row.itemId}-${row.segment.id}`,
            exerciseName: row.exerciseName,
            videoUri: row.videoUri,
            startTimeSec: row.segment.startTime,
            endTimeSec: row.segment.endTime,
          },
          {
            onProgress: (p) =>
              setCurrentProgress({
                rowIndex: i,
                totalRows: targets.length,
                label,
                progress: p,
              }),
          },
        );
        succeededKeys.push({
          itemId: row.itemId,
          segmentId: row.segment.id,
        });
        successCount += 1;
      } catch (err) {
        console.error('pending upload failed', err);
        failureCount += 1;
      }
    }

    if (succeededKeys.length > 0) {
      await removePendingRows(succeededKeys);
    }
    setCurrentProgress(null);
    setBusy(false);
    await reload();

    Alert.alert(
      '送信結果',
      `成功: ${successCount} 件 / 失敗: ${failureCount} 件`,
    );
  };

  if (rows === null) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerCount}>
          {rows.length} 件中 {selected.size} 件選択
        </Text>
        <View style={styles.headerButtons}>
          <Pressable
            style={[styles.headerBtn, rows.length === 0 && styles.btnDisabled]}
            onPress={toggleAll}
            disabled={rows.length === 0 || busy}
          >
            <Text style={styles.headerBtnText}>
              {allSelected ? '選択解除' : '全選択'}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.headerBtn,
              styles.headerBtnDanger,
              (selected.size === 0 || busy) && styles.btnDisabled,
            ]}
            onPress={handleDelete}
            disabled={selected.size === 0 || busy}
          >
            <Text style={styles.headerBtnDangerText}>削除</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => rowKey(r)}
        contentContainerStyle={
          rows.length === 0 ? styles.emptyContent : styles.listContent
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>送信保留はありません。</Text>
        }
        renderItem={({ item }) => {
          const key = rowKey(item);
          const isSelected = selected.has(key);
          return (
            <Pressable
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggle(key)}
              disabled={busy}
            >
              <View
                style={[styles.checkbox, isSelected && styles.checkboxOn]}
              >
                {isSelected && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowExercise}>{item.exerciseName}</Text>
                <Text style={styles.rowTime}>
                  {formatTime(item.segment.startTime)} -{' '}
                  {formatTime(item.segment.endTime)}
                </Text>
                <Text style={styles.rowMeta}>
                  保留 {formatDate(item.createdAt)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        {currentProgress && (
          <View style={styles.progressBlock}>
            <ProgressBar
              value={currentProgress.progress.processed}
              total={currentProgress.progress.total}
              label={
                (currentProgress.progress.phase === 'uploading'
                  ? `送信中 (${currentProgress.rowIndex + 1}/${currentProgress.totalRows}) - 動画アップロード`
                  : `処理中 (${currentProgress.rowIndex + 1}/${currentProgress.totalRows}) - サーバ解析`) +
                `\n${currentProgress.label}`
              }
            />
          </View>
        )}
        <View style={styles.footerRow}>
          <Pressable
            style={[styles.footerBtn, styles.footerBtnSecondary]}
            onPress={() => router.replace('/')}
            disabled={busy}
          >
            <Text style={styles.footerBtnSecondaryText}>戻る</Text>
          </Pressable>
          <Pressable
            style={[
              styles.footerBtn,
              styles.footerBtnPrimary,
              (selected.size === 0 || busy) && styles.btnDisabled,
            ]}
            onPress={handleSend}
            disabled={selected.size === 0 || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.footerBtnPrimaryText}>
                選択した {selected.size} 件を送信
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    gap: 8,
  },
  headerCount: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  headerBtnText: {
    color: '#e5e7eb',
    fontWeight: 'bold',
  },
  headerBtnDanger: {
    borderColor: '#ef4444',
  },
  headerBtnDangerText: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  listContent: {
    padding: 12,
    gap: 6,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  rowSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#1e3a8a',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6b7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxMark: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowExercise: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: 'bold',
  },
  rowTime: {
    color: '#93c5fd',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {
    color: '#9ca3af',
    fontSize: 11,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 8,
  },
  progressBlock: {
    padding: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerBtnSecondary: {
    backgroundColor: '#374151',
    paddingHorizontal: 18,
  },
  footerBtnSecondaryText: {
    color: '#e5e7eb',
    fontWeight: 'bold',
  },
  footerBtnPrimary: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  footerBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
