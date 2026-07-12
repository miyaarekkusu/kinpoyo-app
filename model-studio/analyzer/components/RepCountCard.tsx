import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { updateSessionTrueReps } from '../lib/api';
import type { RepCountPick } from '../lib/repCount';
import { colors, sharedStyles } from '../lib/theme';

type Props = {
  sessionId: number;
  rep: RepCountPick;
  /** DB に既に登録済みの正解回数。未登録なら null。 */
  initialTrueReps: number | null;
};

/**
 * 推定回数の表示と、正解回数の登録フォーム。
 * 保存すると Azure の RecordingSession.true_reps を更新し、推定とのズレを表示する。
 */
export default function RepCountCard({
  sessionId,
  rep,
  initialTrueReps,
}: Props) {
  const [input, setInput] = useState<string>(
    initialTrueReps != null ? String(initialTrueReps) : '',
  );
  const [savedTrue, setSavedTrue] = useState<number | null>(initialTrueReps);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = input.trim() !== (savedTrue != null ? String(savedTrue) : '');

  const save = async () => {
    const trimmed = input.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      setError('0以上の整数を入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateSessionTrueReps(sessionId, value);
      setSavedTrue(value);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const diff = savedTrue != null ? rep.count - savedTrue : null;

  return (
    <View style={styles.wrap}>
      {rep.joint ? (
        <Text style={styles.repCount}>
          推定回数: {rep.count} 回
          <Text style={styles.repMeta}>
            {'  '}
            (主役関節 {rep.joint} ・ ROM {Math.round(rep.rom)}°)
          </Text>
        </Text>
      ) : (
        <Text style={styles.warn}>
          ⚠ 動いている監視関節が見つからず、回数を推定できませんでした。
        </Text>
      )}

      <View style={styles.formRow}>
        <Text style={styles.label}>正解回数</Text>
        <TextInput
          style={[sharedStyles.textInput, styles.input]}
          value={input}
          onChangeText={(t) => setInput(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.textDim}
        />
        <Pressable
          style={[
            sharedStyles.buttonPrimary,
            styles.saveBtn,
            (!dirty || saving) && sharedStyles.buttonDisabled,
          ]}
          onPress={save}
          disabled={!dirty || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sharedStyles.buttonPrimaryText}>保存</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.warn}>⚠ {error}</Text>}

      {diff != null && (
        <Text style={diff === 0 ? styles.matchOk : styles.matchNg}>
          {diff === 0
            ? `✓ 推定と一致 (${rep.count} 回)`
            : `✗ ズレ ${diff > 0 ? '+' : ''}${diff} 回 (推定 ${rep.count} / 正解 ${savedTrue})`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    gap: 8,
  },
  repCount: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  repMeta: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '400',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    width: 90,
    textAlign: 'center',
    paddingVertical: 8,
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  matchOk: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  matchNg: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  warn: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
});
