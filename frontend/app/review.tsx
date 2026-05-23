import Slider from '@react-native-community/slider';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ProgressBar } from '../components/progress-bar';
import { deleteVideo } from '../lib/files';
import { addPending } from '../lib/pending';
import { uploadSession, type UploadInput, type UploadProgress } from '../lib/upload';

type SegmentStatus = 'pending' | 'success' | 'failed';

type Segment = {
  id: string;
  startTime: number;
  endTime: number;
  status: SegmentStatus;
  remoteSessionId?: number;
};

const formatTime = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${String(
    Math.floor((sec * 10) % 10),
  )}`;

export default function ReviewScreen() {
  const { exercise, videoUri, sessionId } = useLocalSearchParams<{
    exercise: string;
    videoUri: string;
    sessionId: string;
  }>();

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.pause();
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [pendingEnd, setPendingEnd] = useState<number | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    segmentIndex: number;
    totalSegments: number;
    progress: UploadProgress;
  } | null>(null);

  useEffect(() => {
    if (status === 'readyToPlay' && duration === 0 && player.duration > 0) {
      setDuration(player.duration);
    }
  }, [status, player, duration]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 100);
    return () => clearInterval(id);
  }, [isPlaying, player]);

  const handleSeek = (sec: number) => {
    player.currentTime = sec;
    setCurrentTime(sec);
  };

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
  };

  const setStart = () => setPendingStart(currentTime);
  const setEnd = () => setPendingEnd(currentTime);

  const canAddSegment =
    pendingStart !== null && pendingEnd !== null && pendingEnd > pendingStart;

  const addSegment = () => {
    if (!canAddSegment) return;
    const seg: Segment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startTime: pendingStart!,
      endTime: pendingEnd!,
      status: 'pending',
    };
    setSegments((prev) => [...prev, seg]);
    setPendingStart(null);
    setPendingEnd(null);
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const pendingSegments = segments.filter((s) => s.status !== 'success');
  const canSend = pendingSegments.length > 0 && !busy;
  const canDefer = pendingSegments.length > 0 && !busy;

  const handleDefer = async () => {
    if (!canDefer) return;
    try {
      await addPending({
        id: sessionId,
        videoUri,
        exerciseName: exercise ?? '',
        segments: pendingSegments.map((s) => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        createdAt: Date.now(),
      });
      Alert.alert(
        '保留しました',
        `${pendingSegments.length}件の区間を送信保留に追加しました。メニュー > 保留一覧から送信できます。`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (err) {
      console.error('defer failed', err);
      Alert.alert('保留に失敗しました', String(err));
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    setBusy(true);

    const updated: Segment[] = [...segments];
    const pendingIndices = updated
      .map((s, i) => (s.status === 'success' ? -1 : i))
      .filter((i) => i >= 0);
    let successCount = 0;
    let failureCount = 0;

    for (let pi = 0; pi < pendingIndices.length; pi++) {
      const i = pendingIndices[pi];
      const seg = updated[i];

      const input: UploadInput = {
        id: `${sessionId}-${seg.id}`,
        exerciseName: exercise ?? '',
        videoUri,
        startTimeSec: seg.startTime,
        endTimeSec: seg.endTime,
      };

      try {
        const result = await uploadSession(input, {
          onProgress: (p) =>
            setCurrentProgress({
              segmentIndex: pi,
              totalSegments: pendingIndices.length,
              progress: p,
            }),
        });
        updated[i] = {
          ...seg,
          status: 'success',
          remoteSessionId: result.remoteSessionId,
        };
        successCount += 1;
      } catch (err) {
        console.error('segment upload failed', err);
        updated[i] = { ...seg, status: 'failed' };
        failureCount += 1;
      }
      setSegments([...updated]);
    }

    setCurrentProgress(null);
    setBusy(false);

    const allSuccess = updated.every((s) => s.status === 'success');
    if (allSuccess) {
      await deleteVideo(videoUri);
      Alert.alert(
        '送信完了',
        `${updated.length}件のセグメントを送信しました。`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } else {
      Alert.alert(
        '一部失敗',
        `成功: ${successCount} 件 / 失敗: ${failureCount} 件\n「送信する」を再度押して失敗分をリトライできます。`,
      );
    }
  };

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />

      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={styles.controls}
      >
        <Text style={styles.exerciseTag}>{exercise}</Text>

        <View style={styles.timeRow}>
          <Pressable style={styles.playButton} onPress={togglePlay}>
            <Text style={styles.playText}>{isPlaying ? '⏸' : '▶'}</Text>
          </Pressable>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={currentTime}
          onValueChange={handleSeek}
          minimumTrackTintColor="#2563eb"
          maximumTrackTintColor="#374151"
          thumbTintColor="#2563eb"
        />

        <View style={styles.rangeRow}>
          <Pressable style={styles.rangeButton} onPress={setStart}>
            <Text style={styles.rangeButtonText}>開始点に設定</Text>
            <Text style={styles.rangeValue}>
              {pendingStart !== null ? formatTime(pendingStart) : '--:--.-'}
            </Text>
          </Pressable>
          <Pressable style={styles.rangeButton} onPress={setEnd}>
            <Text style={styles.rangeButtonText}>終了点に設定</Text>
            <Text style={styles.rangeValue}>
              {pendingEnd !== null ? formatTime(pendingEnd) : '--:--.-'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.addButton, !canAddSegment && styles.addButtonDisabled]}
          onPress={addSegment}
          disabled={!canAddSegment}
        >
          <Text style={styles.addButtonText}>区間を追加</Text>
        </Pressable>

        <Pressable
          style={styles.listButton}
          onPress={() => setShowList(true)}
        >
          <Text style={styles.listButtonText}>
            区間一覧 ({segments.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.saveButton, !canSend && styles.saveButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>送信する</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.deferButton, !canDefer && styles.deferButtonDisabled]}
          onPress={handleDefer}
          disabled={!canDefer}
        >
          <Text style={styles.deferButtonText}>送信保留に追加</Text>
        </Pressable>

        {currentProgress && (
          <View style={styles.progressBlock}>
            <ProgressBar
              value={currentProgress.progress.processed}
              total={currentProgress.progress.total}
              label={
                currentProgress.progress.phase === 'uploading'
                  ? `送信中 (${currentProgress.segmentIndex + 1}/${currentProgress.totalSegments}) - 動画アップロード`
                  : `処理中 (${currentProgress.segmentIndex + 1}/${currentProgress.totalSegments}) - サーバ解析`
              }
            />
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showList}
        animationType="slide"
        transparent
        onRequestClose={() => setShowList(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                区間一覧 ({segments.length})
              </Text>
              <Pressable
                style={styles.modalClose}
                onPress={() => setShowList(false)}
              >
                <Text style={styles.modalCloseText}>閉じる</Text>
              </Pressable>
            </View>
            <FlatList
              data={segments}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={
                segments.length === 0 ? styles.listEmptyContent : undefined
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  開始/終了点を設定して「区間を追加」を押してください。
                </Text>
              }
              renderItem={({ item, index }) => (
                <View style={styles.segmentRow}>
                  <View style={styles.segmentInfo}>
                    <Text style={styles.segmentIndex}>#{index + 1}</Text>
                    <Text style={styles.segmentTime}>
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                    </Text>
                    <Text
                      style={[
                        styles.segmentStatus,
                        item.status === 'success' && styles.statusSuccess,
                        item.status === 'failed' && styles.statusFailed,
                      ]}
                    >
                      {item.status === 'success'
                        ? '送信済'
                        : item.status === 'failed'
                          ? '失敗'
                          : '未送信'}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.removeButton,
                      item.status === 'success' && styles.removeButtonDisabled,
                    ]}
                    onPress={() => removeSegment(item.id)}
                    disabled={item.status === 'success' || busy}
                  >
                    <Text style={styles.removeButtonText}>削除</Text>
                  </Pressable>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  video: {
    width: '100%',
    height: '38%',
    backgroundColor: '#000',
  },
  controlsScroll: {
    flex: 1,
  },
  controls: {
    padding: 16,
    paddingBottom: 32,
    gap: 8,
  },
  exerciseTag: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playText: {
    color: '#fff',
    fontSize: 18,
  },
  timeText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 36,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rangeButton: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  rangeButtonText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 4,
  },
  rangeValue: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    marginTop: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#374151',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listButton: {
    marginTop: 12,
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  listButtonText: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalClose: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    marginVertical: 4,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  segmentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segmentIndex: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: 'bold',
    width: 32,
  },
  segmentTime: {
    color: '#e5e7eb',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  segmentStatus: {
    color: '#9ca3af',
    fontSize: 12,
  },
  statusSuccess: {
    color: '#10b981',
  },
  statusFailed: {
    color: '#ef4444',
  },
  removeButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#374151',
  },
  removeButtonDisabled: {
    opacity: 0.4,
  },
  removeButtonText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: 'bold',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#374151',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBlock: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  deferButton: {
    marginTop: 8,
    backgroundColor: '#1f2937',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  deferButtonDisabled: {
    opacity: 0.4,
  },
  deferButtonText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
