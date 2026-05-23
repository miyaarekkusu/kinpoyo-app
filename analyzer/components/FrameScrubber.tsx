import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchAllSessionFrames, frameImageUrl } from '../lib/api';
import { colors } from '../lib/theme';
import ProgressBar from './ProgressBar';

type AnglesByFrame = Record<number, Record<string, number>>;

type Props = {
  sessionId: number;
  jointNames: string[];
  anglesByFrame: AnglesByFrame;
  width: number;
};

export default function FrameScrubber({
  sessionId,
  jointNames,
  anglesByFrame,
  width,
}: Props) {
  const [frames, setFrames] = useState<number[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<{ received: number; total: number }>(
    { received: 0, total: 0 },
  );

  const angleFrames = useMemo(
    () =>
      Object.keys(anglesByFrame)
        .map(Number)
        .sort((a, b) => a - b),
    [anglesByFrame],
  );

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const rows = await fetchAllSessionFrames(sessionId, {
          chunkSize: 100,
          signal: ac.signal,
          onProgress: (received, total) =>
            setProgress({ received, total }),
        });
        if (ac.signal.aborted) return;
        const withImage = rows
          .filter((r) => r.has_image)
          .map((r) => r.frame_number);
        setFrames(withImage.length ? withImage : angleFrames);
      } catch (e: any) {
        if (!ac.signal.aborted) setLoadError(e.message ?? String(e));
      }
    })();
    return () => ac.abort();
  }, [sessionId, angleFrames]);

  if (loadError) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.danger }}>
          フレーム読込失敗: {loadError}
        </Text>
      </View>
    );
  }

  if (!frames) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.textDim, marginTop: 6, marginBottom: 10 }}>
          フレーム情報を取得中...
        </Text>
        <View style={{ width: '100%', maxWidth: 320 }}>
          <ProgressBar
            value={progress.received}
            total={progress.total}
            label="フレーム取得中"
          />
        </View>
      </View>
    );
  }

  if (frames.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.textDim }}>フレームがありません</Text>
      </View>
    );
  }

  const clamped = Math.max(0, Math.min(index, frames.length - 1));
  const currentFrame = frames[clamped];
  const currentAngles = anglesByFrame[currentFrame] ?? {};

  const imageWidth = width;
  const imageHeight = Math.round(width * 0.75);

  const step = (delta: number) => {
    setIndex((i) => {
      const next = i + delta;
      if (next < 0) return 0;
      if (next > frames.length - 1) return frames.length - 1;
      return next;
    });
  };

  return (
    <View>
      <Image
        source={{ uri: frameImageUrl(sessionId, currentFrame) }}
        style={{
          width: imageWidth,
          height: imageHeight,
          backgroundColor: '#000',
          borderRadius: 6,
        }}
        resizeMode="contain"
      />
      <View style={styles.controls}>
        <Pressable
          style={styles.navBtn}
          onPress={() => step(-10)}
          disabled={clamped === 0}
        >
          <Text style={styles.navText}>«</Text>
        </Pressable>
        <Pressable
          style={styles.navBtn}
          onPress={() => step(-1)}
          disabled={clamped === 0}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.frameLabel}>
          frame {currentFrame}
          {'  '}
          <Text style={styles.frameLabelDim}>
            ({clamped + 1}/{frames.length})
          </Text>
        </Text>
        <Pressable
          style={styles.navBtn}
          onPress={() => step(1)}
          disabled={clamped === frames.length - 1}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
        <Pressable
          style={styles.navBtn}
          onPress={() => step(10)}
          disabled={clamped === frames.length - 1}
        >
          <Text style={styles.navText}>»</Text>
        </Pressable>
      </View>

      <View style={styles.anglesTable}>
        {jointNames.map((name) => {
          const a = currentAngles[name];
          return (
            <View key={name} style={styles.angleRow}>
              <Text style={styles.angleName}>{name}</Text>
              <Text style={styles.angleValue}>
                {a == null ? '—' : `${a.toFixed(1)}°`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  navBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  navText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  frameLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 140,
    textAlign: 'center',
  },
  frameLabelDim: {
    color: colors.textDim,
    fontWeight: '400',
  },
  anglesTable: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  angleRow: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  angleName: {
    color: colors.textDim,
    fontSize: 12,
  },
  angleValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
