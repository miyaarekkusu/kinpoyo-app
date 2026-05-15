import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'kinpoyo analyzer' }} />
        <Stack.Screen name="tag-new" options={{ title: '新規タグ', presentation: 'modal' }} />
        <Stack.Screen name="select" options={{ title: 'データ選択' }} />
        <Stack.Screen name="result" options={{ title: '分析結果' }} />
        <Stack.Screen name="delete" options={{ title: 'データ削除' }} />
      </Stack>
    </>
  );
}
