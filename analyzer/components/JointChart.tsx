import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import type { SessionSeries } from '../lib/api';
import { colors } from '../lib/theme';

type Props = {
  jointName: string;
  series: SessionSeries[];
  width: number;
  height?: number;
};

const COLORS = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#22d3ee'];

export default function JointChart({ jointName, series, width, height = 180 }: Props) {
  const { paths, minA, maxA, maxFrame } = useMemo(() => {
    const flat = series.flatMap((s) => s.points);
    if (flat.length === 0) {
      return { paths: [], minA: 0, maxA: 180, maxFrame: 1 };
    }
    let minA = Infinity;
    let maxA = -Infinity;
    let maxFrame = 0;
    for (const p of flat) {
      if (p.angle < minA) minA = p.angle;
      if (p.angle > maxA) maxA = p.angle;
      if (p.frame > maxFrame) maxFrame = p.frame;
    }
    if (minA === maxA) {
      minA -= 5;
      maxA += 5;
    }
    return {
      paths: series.map((s, i) => ({
        color: COLORS[i % COLORS.length],
        d: s.points
          .map((p, idx) => {
            const x = (p.frame / Math.max(maxFrame, 1)) * (width - 60) + 50;
            const y = ((maxA - p.angle) / (maxA - minA)) * (height - 30) + 10;
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' '),
        sid: s.session_id,
      })),
      minA,
      maxA,
      maxFrame,
    };
  }, [series, width, height]);

  if (paths.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.textDim }}>データなし</Text>
      </View>
    );
  }

  // 5 horizontal grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = t * (height - 30) + 10;
    const val = Math.round(maxA - t * (maxA - minA));
    return { y, val };
  });

  return (
    <View>
      <Text style={styles.title}>{jointName} の角度推移</Text>
      <Svg width={width} height={height}>
        {gridLines.map((g, i) => (
          <G key={i}>
            <Line
              x1={50}
              y1={g.y}
              x2={width - 10}
              y2={g.y}
              stroke={colors.cardBorder}
              strokeWidth={0.5}
            />
            <SvgText x={5} y={g.y + 4} fill={colors.textDim} fontSize={10}>
              {g.val}°
            </SvgText>
          </G>
        ))}
        {paths.map((p) => (
          <Path key={p.sid} d={p.d} stroke={p.color} strokeWidth={1.5} fill="none" />
        ))}
      </Svg>
      <View style={styles.legend}>
        {paths.map((p) => (
          <View key={p.sid} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>#{p.sid}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 6,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textDim, fontSize: 11 },
});
