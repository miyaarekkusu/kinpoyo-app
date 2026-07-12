import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import type { LandmarkMean } from '../lib/api';
import { colors } from '../lib/theme';

// Connections between landmarks to draw a skeleton.
const BONES: [number, number][] = [
  // arms
  [11, 13], [13, 15], [12, 14], [14, 16],
  // shoulders / hips
  [11, 12], [23, 24], [11, 23], [12, 24],
  // legs
  [23, 25], [25, 27], [24, 26], [26, 28],
  // feet
  [27, 31], [28, 32],
];

type Props = {
  landmarks: LandmarkMean[];
  width: number;
  height?: number;
  showLabels?: boolean;
};

export default function StickFigure({
  landmarks,
  width,
  height = 320,
  showLabels = false,
}: Props) {
  const points = useMemo(() => {
    const map: Record<number, { x: number; y: number; label: string }> = {};
    for (const lm of landmarks) {
      map[lm.index] = {
        x: lm.x * (width - 40) + 20,
        y: lm.y * (height - 40) + 20,
        label: lm.label,
      };
    }
    return map;
  }, [landmarks, width, height]);

  if (landmarks.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.textDim }}>ランドマークなし</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={width} height={height}>
        {BONES.map(([a, b], i) => {
          const pa = points[a];
          const pb = points[b];
          if (!pa || !pb) return null;
          return (
            <Line
              key={i}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={colors.accent}
              strokeWidth={2}
            />
          );
        })}
        {Object.entries(points).map(([k, p]) => {
          const idx = Number(k);
          // Highlight major joints.
          const isJoint = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(idx);
          return (
            <Circle
              key={k}
              cx={p.x}
              cy={p.y}
              r={isJoint ? 4 : 2}
              fill={isJoint ? '#fff' : colors.textDim}
            />
          );
        })}
        {showLabels &&
          Object.entries(points).map(([k, p]) => {
            const idx = Number(k);
            if (![11, 12, 13, 14, 15, 16, 23, 24, 25, 26].includes(idx)) return null;
            return (
              <SvgText
                key={`l${k}`}
                x={p.x + 6}
                y={p.y - 4}
                fill={colors.text}
                fontSize={9}
              >
                {p.label}
              </SvgText>
            );
          })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 6,
  },
});
