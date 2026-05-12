import {
  CameraType,
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { persistVideo } from '../lib/files';

const FRONT_CAMERA: CameraType = 'front';

export default function CameraScreen() {
  const { exercise } = useLocalSearchParams<{ exercise: string }>();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const [isRecording, setIsRecording] = useState(false);

  if (!cameraPermission || !micPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>権限を確認中...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>
          カメラとマイクの権限が必要です
        </Text>
        <Pressable
          style={styles.button}
          onPress={async () => {
            if (!cameraPermission.granted) await requestCameraPermission();
            if (!micPermission.granted) await requestMicPermission();
          }}
        >
          <Text style={styles.buttonText}>権限を許可</Text>
        </Pressable>
      </View>
    );
  }

  const handleRecord = async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      cameraRef.current.stopRecording();
      return;
    }

    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync();
      if (video?.uri) {
        const sessionId = `${Date.now()}`;
        const persistedUri = await persistVideo(video.uri, sessionId);
        router.push({
          pathname: '/review',
          params: { exercise, videoUri: persistedUri, sessionId },
        });
      }
    } catch (e) {
      console.error('record error', e);
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={FRONT_CAMERA}
        mode="video"
        videoQuality="720p"
      />

      <View style={styles.overlay}>
        <Text style={styles.exerciseTag}>{exercise ?? '(無題)'}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.recordButton, isRecording && styles.recordingButton]}
          onPress={handleRecord}
        >
          <View
            style={[
              styles.recordInner,
              isRecording && styles.recordInnerActive,
            ]}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  exerciseTag: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controls: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#000',
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    borderColor: '#ef4444',
  },
  recordInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ef4444',
  },
  recordInnerActive: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  center: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
