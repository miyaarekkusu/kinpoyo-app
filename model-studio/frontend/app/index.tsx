import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { persistVideo } from '../lib/files';
import { pendingCount } from '../lib/pending';

export default function Index() {
  const [exerciseName, setExerciseName] = useState('');
  const [pendingNum, setPendingNum] = useState(0);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      pendingCount().then(setPendingNum).catch(() => setPendingNum(0));
    }, []),
  );

  const canProceed = exerciseName.trim().length > 0 && !busy;

  const handlePick = async () => {
    if (!canProceed) return;

    // Web(PC)は <input type=file> で開くため権限要求は不要（呼ぶと未対応で失敗しうる）。
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          '権限がありません',
          'フォトライブラリへのアクセスを許可してください。',
        );
        return;
      }
    }

    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
        // iPhone の動画は HEVC が多く、サーバの OpenCV がデコードできないことがある。
        // Compatible にすると iOS 側で H.264 に変換してから渡してくれる。
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (res.canceled || res.assets.length === 0) return;

      const sessionId = `${Date.now()}`;
      // ピッカーが返す URI はキャッシュ上にあり消えうるので、documents へ複製して永続化する。
      const persistedUri = await persistVideo(res.assets[0].uri, sessionId);
      router.push({
        pathname: '/review',
        params: { exercise: exerciseName.trim(), videoUri: persistedUri, sessionId },
      });
    } catch (err) {
      console.error('pick failed', err);
      Alert.alert('動画を読み込めませんでした', String(err));
    } finally {
      setBusy(false);
    }
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
          editable={!busy}
          onSubmitEditing={handlePick}
        />

        <Pressable
          style={[styles.button, !canProceed && styles.buttonDisabled]}
          onPress={handlePick}
          disabled={!canProceed}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>動画を選択</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.pendingButton}
          onPress={() => router.push('/pending')}
          disabled={busy}
        >
          <Text style={styles.pendingButtonText}>
            保留一覧 ({pendingNum}件)
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          端末の動画を選択 → 範囲を複数選択 → サーバーへ送信。
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
  pendingButton: {
    marginTop: 12,
    backgroundColor: '#1f2937',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  pendingButtonText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hint: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 24,
    textAlign: 'center',
  },
});
