import Slider from '@react-native-community/slider';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deleteVideo } from '../lib/files';
import { uploadSession, type UploadInput } from '../lib/upload';

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
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

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

  const setStart = () => setStartTime(currentTime);
  const setEnd = () => setEndTime(currentTime);

  const canSave =
    startTime !== null && endTime !== null && endTime > startTime && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);

    const input: UploadInput = {
      id: sessionId,
      exerciseName: exercise ?? '',
      videoUri,
      startTimeSec: startTime!,
      endTimeSec: endTime!,
    };

    try {
      const result = await uploadSession(input);
      await deleteVideo(videoUri);
      Alert.alert(
        '送信完了',
        `セッション #${result.remoteSessionId}\nポーズ: ${result.poseCount}件\n画像: ${result.imageCount}件`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (err: any) {
      Alert.alert(
        '送信失敗',
        `${err.message ?? 'unknown'}\n「保存する」を再度押してリトライしてください。`,
      );
    } finally {
      setBusy(false);
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

      <View style={styles.controls}>
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
              {startTime !== null ? formatTime(startTime) : '--:--.-'}
            </Text>
          </Pressable>
          <Pressable style={styles.rangeButton} onPress={setEnd}>
            <Text style={styles.rangeButtonText}>終了点に設定</Text>
            <Text style={styles.rangeValue}>
              {endTime !== null ? formatTime(endTime) : '--:--.-'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>保存する</Text>
          )}
        </Pressable>
      </View>
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
    height: '45%',
    backgroundColor: '#000',
  },
  controls: {
    flex: 1,
    padding: 16,
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
    marginTop: 16,
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
  saveButton: {
    marginTop: 'auto',
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
});
