import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1f2937' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'kinpoyo' }} />
        <Stack.Screen name="camera" options={{ title: '撮影' }} />
        <Stack.Screen name="review" options={{ title: '範囲選択' }} />
        <Stack.Screen name="history" options={{ title: '保存済み' }} />
        <Stack.Screen name="detail" options={{ title: '詳細' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
