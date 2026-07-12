import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import type { CurvePoint } from '../lib/api';
import { colors } from '../lib/theme';

type Props = {
  jointName: string;
  curveNew: CurvePoint[] | undefined;
  curveExisting: CurvePoint[] | undefined;
  width: number;
  height?: number;
};

const COLOR_NEW = '#f87171';
const COLOR_EXISTING = '#60a5fa';

const PAD_LEFT = 50;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

function buildPath(
  curve: CurvePoint[],
  width: number,
  height: number,
  yMin: number,
  yMax: number,
): string {
  if (curve.length === 0) return '';
  const span = yMax - yMin || 1;
  return curve
    .map((p, idx) => {
      const x = p.t * (width - PAD_LEFT - PAD_RIGHT) + PAD_LEFT;
      const y =
        ((yMax - p.angle) / span) * (height - PAD_TOP - PAD_BOTTOM) + PAD_TOP;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function JointCompareChart({
  jointName,
  curveNew,
  curveExisting,
  width,
  height = 180,
}: Props) {
  const { pathNew, pathExisting, yMin, yMax, hasAny } = useMemo(() => {
    const all = [
      ...(curveNew ?? []).map((p) => p.angle),
      ...(curveExisting ?? []).map((p) => p.angle),
    ];
    if (all.length === 0) {
      return {
        pathNew: '',
        pathExisting: '',
        yMin: 0,
        yMax: 180,
        hasAny: false,
      };
    }
    let yMin = Math.min(...all);
    let yMax = Math.max(...all);
    if (yMin === yMax) {
      yMin -= 5;
      yMax += 5;
    } else {
      const pad = (yMax - yMin) * 0.08;
      yMin -= pad;
      yMax += pad;
    }
    return {
      pathNew: buildPath(curveNew ?? [], width, height, yMin, yMax),
      pathExisting: buildPath(curveExisting ?? [], width, height, yMin, yMax),
      yMin,
      yMax,
      hasAny: true,
    };
  }, [curveNew, curveExisting, width, height]);

  if (!hasAny) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.textDim }}>データなし</Text>
      </View>
    );
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = t * (height - PAD_TOP - PAD_BOTTOM) + PAD_TOP;
    const val = Math.round(yMax - t * (yMax - yMin));
    return { y, val };
  });

  const hasNew = (curveNew?.length ?? 0) > 0;
  const hasExisting = (curveExisting?.length ?? 0) > 0;

  return (
    <View>
      <Text style={styles.title}>{jointName}</Text>
      <Svg width={width} height={height}>
        {gridLines.map((g, i) => (
          <G key={i}>
            <Line
              x1={PAD_LEFT}
              y1={g.y}
              x2={width - PAD_RIGHT}
              y2={g.y}
              stroke={colors.cardBorder}
              strokeWidth={0.5}
            />
            <SvgText x={5} y={g.y + 4} fill={colors.textDim} fontSize={10}>
              {g.val}°
            </SvgText>
          </G>
        ))}
        <SvgText
          x={PAD_LEFT}
          y={height - 4}
          fill={colors.textDim}
          fontSize={10}
        >
          0%
        </SvgText>
        <SvgText
          x={width - PAD_RIGHT - 18}
          y={height - 4}
          fill={colors.textDim}
          fontSize={10}
        >
          100%
        </SvgText>
        {hasExisting && (
          <Path
            d={pathExisting}
            stroke={COLOR_EXISTING}
            strokeWidth={2}
            strokeDasharray="4 3"
            fill="none"
          />
        )}
        {hasNew && (
          <Path d={pathNew} stroke={COLOR_NEW} strokeWidth={2.5} fill="none" />
        )}
      </Svg>
      <View style={styles.legend}>
        {hasNew && (
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: COLOR_NEW }]} />
            <Text style={styles.legendText}>今回 (新規)</Text>
          </View>
        )}
        {hasExisting && (
          <View style={styles.legendItem}>
            <View
              style={[styles.legendBar, { backgroundColor: COLOR_EXISTING }]}
            />
            <Text style={styles.legendText}>既存学習データ</Text>
          </View>
        )}
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
    gap: 12,
    marginTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBar: { width: 18, height: 3, borderRadius: 2 },
  legendText: { color: colors.textDim, fontSize: 11 },
});
