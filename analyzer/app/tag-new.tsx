import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createTag } from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

export default function NewTagScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('入力エラー', 'タグ名は必須です');
      return;
    }
    setBusy(true);
    try {
      await createTag(trimmed, description.trim() || undefined);
      router.back();
    } catch (e: any) {
      Alert.alert('作成失敗', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={sharedStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={sharedStyles.scrollContent}>
        <Text style={sharedStyles.title}>新規タグ作成</Text>
        <Text style={sharedStyles.subtitle}>
          分析結果のグループ名を入力します。
          例: 「スクワット ボトムOK」「デッドリフト フォーム不可」
        </Text>

        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={styles.label}>タグ名 *</Text>
          <TextInput
            style={sharedStyles.textInput}
            placeholder="タグ名"
            placeholderTextColor={colors.textDim}
            value={name}
            onChangeText={setName}
            autoFocus
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

        <Pressable
          style={[sharedStyles.buttonPrimary, busy && sharedStyles.buttonDisabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sharedStyles.buttonPrimaryText}>作成</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textDim,
    fontSize: 13,
  },
});
