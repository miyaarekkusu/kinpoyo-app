import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function Index() {
  const [exerciseName, setExerciseName] = useState('');

  const canProceed = exerciseName.trim().length > 0;

  const handleStart = () => {
    if (!canProceed) return;
    router.push({
      pathname: '/camera',
      params: { exercise: exerciseName.trim() },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.label}>種目名</Text>
        <TextInput
          style={styles.input}
          value={exerciseName}
          onChangeText={setExerciseName}
          placeholder="例: 腹筋 / スクワット / 腕立て"
          placeholderTextColor="#9ca3af"
          returnKeyType="done"
          onSubmitEditing={handleStart}
        />

        <Pressable
          style={[styles.button, !canProceed && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={!canProceed}
        >
          <Text style={styles.buttonText}>撮影を始める</Text>
        </Pressable>

        <Text style={styles.hint}>
          撮影 → 範囲選択 → サーバーへ送信。
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  label: {
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#fff',
    fontSize: 18,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#374151',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  hint: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 24,
    textAlign: 'center',
  },
});
