import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OnboardingProvider } from '@/hooks/use-onboarding';

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <OnboardingProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
          <StatusBar style="auto" />
        </ThemeProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isLoggedIn, isRestoring } = useAuth();

  if (isRestoring) {
    return null;
  }

  return (
    // ヘッダーは既定で出さない。(screens) 配下の画面はどれも自前の戻るボタンや
    // 全画面カメラUIを持っており、スタックのヘッダーが出るとルート名
    // （「(screens)/workout-finish」など）がそのまま画面上に露出する。
    //
    // ⚠️ ここを個別宣言に戻さないこと。ルートStackは「宣言していないルート」に
    // 既定ヘッダーを出すため、画面を1枚足すたびに同じ事故が起きる。
    // ヘッダーが要る画面が出てきたら、その画面側で
    // <Stack.Screen options={{ headerShown: true, title: '…' }} /> を宣言する。
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(screens)/modal" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
