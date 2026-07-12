import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { CountResult, RepCycle } from '../lib/api';
import { colors } from '../lib/theme';

type Props = {
  result: CountResult;
  width: number;
};

const COLOR_WAVE = '#e5e7eb';
const COLOR_OK = '#34d399'; // 採用サイクル
const COLOR_NG = '#f87171'; // 棄却サイクル
const COLOR_MODEL = '#60a5fa'; // モデル標準カーブ

const PAD_LEFT = 46;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

const REASON_LABEL: Record<RepCycle['reason'], string> = {
  ok: '採用',
  stats: '角度/ROMが範囲外',
  shape: '形が違う',
  short: '短すぎて評価不能',
};

/** 波形チャート: 動画の主役関節角度をフレーム軸そのままで描き、
 * 各サイクル区間を採用/棄却で色帯にし、完了フレームに縦線を立てる。 */
function WaveChart({ result, width }: Props) {
  const height = 190;
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  const g = useMemo(() => {
    const s = result.series;
    if (s.length < 2) return null;
    let fMin = Infinity;
    let fMax = -Infinity;
    let aMin = Infinity;
    let aMax = -Infinity;
    for (const p of s) {
      if (p.frame < fMin) fMin = p.frame;
      if (p.frame > fMax) fMax = p.frame;
      if (p.angle < aMin) aMin = p.angle;
      if (p.angle > aMax) aMax = p.angle;
    }
    if (aMin === aMax) {
      aMin -= 5;
      aMax += 5;
    } else {
      const pad = (aMax - aMin) * 0.08;
      aMin -= pad;
      aMax += pad;
    }
    const fSpan = fMax - fMin || 1;
    const aSpan = aMax - aMin || 1;
    const x = (f: number) => ((f - fMin) / fSpan) * innerW + PAD_LEFT;
    const y = (a: number) => ((aMax - a) / aSpan) * innerH + PAD_TOP;
    const path = s
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.frame).toFixed(1)} ${y(p.angle).toFixed(1)}`)
      .join(' ');
    return { x, y, path, aMin, aMax };
  }, [result.series, innerW, innerH]);

  if (!g) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.textDim }}>波形データなし</Text>
      </View>
    );
  }

  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const yy = t * innerH + PAD_TOP;
    const val = Math.round(g.aMax - t * (g.aMax - g.aMin));
    return { y: yy, val };
  });

  return (
    <Svg width={width} height={height}>
      {grid.map((gl, i) => (
        <G key={i}>
          <Line
            x1={PAD_LEFT}
            y1={gl.y}
            x2={width - PAD_RIGHT}
            y2={gl.y}
            stroke={colors.cardBorder}
            strokeWidth={0.5}
          />
          <SvgText x={4} y={gl.y + 4} fill={colors.textDim} fontSize={10}>
            {gl.val}°
          </SvgText>
        </G>
      ))}
      {/* サイクル区間の色帯 */}
      {result.cycles.map((c, i) => {
        const x0 = g.x(c.start);
        const x1 = g.x(c.end);
        return (
          <Rect
            key={`band-${i}`}
            x={x0}
            y={PAD_TOP}
            width={Math.max(1, x1 - x0)}
            height={innerH}
            fill={c.accepted ? COLOR_OK : COLOR_NG}
            opacity={0.14}
          />
        );
      })}
      {/* 波形 */}
      <Path d={g.path} stroke={COLOR_WAVE} strokeWidth={1.6} fill="none" />
      {/* サイクル完了フレームの縦線とラベル */}
      {result.cycles.map((c, i) => {
        const xx = g.x(c.end);
        return (
          <G key={`mark-${i}`}>
            <Line
              x1={xx}
              y1={PAD_TOP}
              x2={xx}
              y2={PAD_TOP + innerH}
              stroke={c.accepted ? COLOR_OK : COLOR_NG}
              strokeWidth={1.4}
              strokeDasharray={c.accepted ? undefined : '3 2'}
            />
            <SvgText
              x={xx}
              y={PAD_TOP + 10}
              fill={c.accepted ? COLOR_OK : COLOR_NG}
              fontSize={10}
              fontWeight="700"
              textAnchor="middle"
            >
              {c.accepted ? '✓' : '✗'}
            </SvgText>
          </G>
        );
      })}
      <SvgText x={PAD_LEFT} y={height - 5} fill={colors.textDim} fontSize={10}>
        frame →
      </SvgText>
    </Svg>
  );
}

/** オーバーレイチャート: モデルの標準カーブ(mean±std帯)に、動画から切り出した
 * 各サイクルの正規化カーブを重ねて、形が合っているか(採用)/外れているか(棄却)を見せる。 */
function OverlayChart({ result, width }: Props) {
  const height = 200;
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP - PAD_BOTTOM;
  const tmpl = result.template;

  const px = (t: number) => t * innerW + PAD_LEFT; // t: 0..1
  const py = (v: number) => (1 - v) * innerH + PAD_TOP; // v: 0..1(振幅)

  const model = useMemo(() => {
    if (!tmpl || tmpl.mean.length === 0) return null;
    const n = tmpl.mean.length;
    const tOf = (i: number) => (n === 1 ? 0 : i / (n - 1));
    const meanPath = tmpl.mean
      .map((m, i) => `${i === 0 ? 'M' : 'L'}${px(tOf(i)).toFixed(1)} ${py(m).toFixed(1)}`)
      .join(' ');
    // std 帯: 上端を順方向、下端を逆方向でつないだ閉領域
    const upper = tmpl.mean.map((m, i) => {
      const hi = Math.min(1, m + (tmpl.std[i] ?? 0));
      return `${i === 0 ? 'M' : 'L'}${px(tOf(i)).toFixed(1)} ${py(hi).toFixed(1)}`;
    });
    const lower = tmpl.mean
      .map((m, i) => {
        const lo = Math.max(0, m - (tmpl.std[i] ?? 0));
        return { i, s: `L${px(tOf(i)).toFixed(1)} ${py(lo).toFixed(1)}` };
      })
      .reverse()
      .map((o) => o.s);
    const bandPath = `${upper.join(' ')} ${lower.join(' ')} Z`;
    return { meanPath, bandPath };
  }, [tmpl, innerW, innerH]);

  const cyclePaths = useMemo(
    () =>
      result.cycles.map((c) => {
        if (!c.vector || c.vector.length === 0) return null;
        const n = c.vector.length;
        const d = c.vector
          .map(
            (v, i) =>
              `${i === 0 ? 'M' : 'L'}${px(n === 1 ? 0 : i / (n - 1)).toFixed(1)} ${py(v).toFixed(1)}`,
          )
          .join(' ');
        return { d, accepted: c.accepted };
      }),
    [result.cycles, innerW, innerH],
  );

  if (!model && cyclePaths.every((c) => c == null)) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={{ color: colors.textDim }}>比較カーブなし</Text>
      </View>
    );
  }

  const grid = [0, 0.5, 1].map((v) => ({ y: py(v), v }));

  return (
    <Svg width={width} height={height}>
      {grid.map((gl, i) => (
        <G key={i}>
          <Line
            x1={PAD_LEFT}
            y1={gl.y}
            x2={width - PAD_RIGHT}
            y2={gl.y}
            stroke={colors.cardBorder}
            strokeWidth={0.5}
          />
          <SvgText x={4} y={gl.y + 4} fill={colors.textDim} fontSize={10}>
            {gl.v.toFixed(1)}
          </SvgText>
        </G>
      ))}
      {/* モデル帯 + 平均線 */}
      {model && (
        <>
          <Path d={model.bandPath} fill={COLOR_MODEL} opacity={0.16} />
          <Path
            d={model.meanPath}
            stroke={COLOR_MODEL}
            strokeWidth={2.4}
            fill="none"
          />
        </>
      )}
      {/* 各サイクル */}
      {cyclePaths.map((c, i) =>
        c ? (
          <Path
            key={i}
            d={c.d}
            stroke={c.accepted ? COLOR_OK : COLOR_NG}
            strokeWidth={1.6}
            strokeDasharray={c.accepted ? undefined : '4 3'}
            fill="none"
            opacity={0.9}
          />
        ) : null,
      )}
      <SvgText x={PAD_LEFT} y={height - 5} fill={colors.textDim} fontSize={10}>
        0%
      </SvgText>
      <SvgText
        x={width - PAD_RIGHT - 26}
        y={height - 5}
        fill={colors.textDim}
        fontSize={10}
      >
        100%
      </SvgText>
    </Svg>
  );
}

export default function CountCheckChart({ result, width }: Props) {
  const hasCycles = result.cycles.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>カウント検証の内訳</Text>
      <Text style={styles.caption}>
        動画から測った角度の連続波形（上）と、モデルが学習した「1回の標準カーブ」に
        各サイクルを重ねた比較（下）です。✓＝採用 / ✗＝棄却。
      </Text>

      <Text style={styles.subLabel}>① 動画の連続性（主役関節の角度）</Text>
      <WaveChart result={result} width={width} />

      <Text style={styles.subLabel}>② モデルの標準カーブとの形状比較</Text>
      <OverlayChart result={result} width={width} />

      <View style={styles.legend}>
        <Legend color={COLOR_MODEL} label="モデル標準カーブ (mean±std)" />
        <Legend color={COLOR_OK} label="採用サイクル" />
        <Legend color={COLOR_NG} label="棄却サイクル" dashed />
      </View>

      {hasCycles && (
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.cJudge]}>判定</Text>
            <Text style={[styles.th, styles.cFrame]}>区間(frame)</Text>
            <Text style={[styles.th, styles.cDist]}>形状距離</Text>
            <Text style={[styles.th, styles.cReason]}>理由</Text>
          </View>
          {result.cycles.map((c, i) => (
            <View key={i} style={styles.tr}>
              <Text
                style={[
                  styles.td,
                  styles.cJudge,
                  { color: c.accepted ? COLOR_OK : COLOR_NG, fontWeight: '700' },
                ]}
              >
                {c.accepted ? '✓' : '✗'}
              </Text>
              <Text style={[styles.td, styles.cFrame]}>
                {c.start}–{c.end}
              </Text>
              <Text style={[styles.td, styles.cDist]}>
                {c.distance != null ? c.distance.toFixed(3) : '—'}
                {c.distance != null
                  ? ` / ${result.shape_threshold.toFixed(2)}`
                  : ''}
              </Text>
              <Text style={[styles.td, styles.cReason]}>
                {REASON_LABEL[c.reason]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendBar,
          { backgroundColor: color },
          dashed && { opacity: 0.7 },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 6 },
  heading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  caption: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  subLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
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
    marginTop: 6,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBar: { width: 18, height: 3, borderRadius: 2 },
  legendText: { color: colors.textDim, fontSize: 11 },
  table: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  th: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  td: {
    color: colors.text,
    fontSize: 12,
  },
  cJudge: { width: 34, textAlign: 'center' },
  cFrame: { flex: 1 },
  cDist: { flex: 1.3 },
  cReason: { flex: 1.6 },
});
