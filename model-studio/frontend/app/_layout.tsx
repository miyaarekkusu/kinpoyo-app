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
        <Stack.Screen name="review" options={{ title: '範囲選択' }} />
        <Stack.Screen name="pending" options={{ title: '送信保留' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
