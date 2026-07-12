import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../lib/theme';

type Props = {
  value: number;
  total: number;
  label?: string;
};

export default function ProgressBar({ value, total, label }: Props) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.max(0, Math.min(1, value / safeTotal));
  const percent = Math.round(ratio * 100);

  return (
    <View style={styles.wrapper}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.count}>
        {value} / {total} ({percent}%)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cardBorder,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  count: {
    color: colors.textDim,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
