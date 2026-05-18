import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createTag, getTag, listJoints, updateTag } from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

export default function TagFormScreen() {
  const { tagId } = useLocalSearchParams<{ tagId?: string }>();
  const editingId = tagId ? Number(tagId) : null;
  const isEdit = editingId != null && Number.isFinite(editingId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [availableJoints, setAvailableJoints] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const joints = await listJoints();
        if (cancelled) return;
        setAvailableJoints(joints);
        if (isEdit) {
          const tag = await getTag(editingId!);
          if (cancelled) return;
          setName(tag.name);
          setDescription(tag.description ?? '');
          setSelected(new Set(tag.monitored_joints));
        }
      } catch (e: any) {
        Alert.alert('読み込み失敗', e.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editingId]);

  const toggle = (joint: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(joint)) next.delete(joint);
      else next.add(joint);
      return next;
    });
  };

  const selectedList = useMemo(
    () => (availableJoints ?? []).filter((n) => selected.has(n)),
    [availableJoints, selected],
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('入力エラー', 'タグ名は必須です');
      return;
    }
    if (selectedList.length === 0) {
      Alert.alert(
        '監視関節未選択',
        '監視する関節を1つ以上選んでください。何も選ばれていないと分析対象がなくなります。',
      );
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        await updateTag(editingId!, {
          name: trimmed,
          description: description.trim() || null,
          monitored_joints: selectedList,
        });
      } else {
        await createTag(trimmed, description.trim() || undefined, selectedList);
      }
      router.back();
    } catch (e: any) {
      Alert.alert(isEdit ? '更新失敗' : '作成失敗', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[sharedStyles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={sharedStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={sharedStyles.scrollContent}>
        <Text style={sharedStyles.title}>
          {isEdit ? 'タグ編集' : '新規タグ作成'}
        </Text>
        <Text style={sharedStyles.subtitle}>
          分析結果のグループ名と、監視する関節を指定します。
        </Text>

        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={styles.label}>タグ名 *</Text>
          <TextInput
            style={sharedStyles.textInput}
            placeholder="例: スクワット ボトムOK"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
            autoFocus={!isEdit}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>説明 (任意)</Text>
          <TextInput
            style={[sharedStyles.textInput, { minHeight: 80 }]}
            placeholder="どんな分析か、簡単な説明"
            placeholderTextColor={colors.textDim}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>監視する関節 *</Text>
          <Text style={styles.help}>
            運動で実際に動かす関節だけを選んでください。選ばなかった関節は分析・グラフから除外されます。
          </Text>
          <View style={styles.jointGrid}>
            {(availableJoints ?? []).map((joint) => {
              const on = selected.has(joint);
              return (
                <Pressable
                  key={joint}
                  onPress={() => toggle(joint)}
                  style={[
                    styles.jointChip,
                    on ? styles.jointChipOn : styles.jointChipOff,
                  ]}
                >
                  <Text
                    style={[
                      styles.jointChipText,
                      on && styles.jointChipTextOn,
                    ]}
                  >
                    {on ? '✓ ' : ''}
                    {joint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helpDim}>
            選択中: {selectedList.length} / {availableJoints?.length ?? 0}
          </Text>
        </View>

        <Pressable
          style={[
            sharedStyles.buttonPrimary,
            busy && sharedStyles.buttonDisabled,
          ]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sharedStyles.buttonPrimaryText}>
              {isEdit ? '更新' : '作成'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  label: {
    color: colors.textDim,
    fontSize: 13,
  },
  help: {
    color: colors.textDim,
    fontSize: 12,
  },
  helpDim: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  jointGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  jointChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  jointChipOff: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
  },
  jointChipOn: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  jointChipText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
  jointChipTextOn: {
    color: colors.text,
  },
});
