import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import {
  Colors,
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Shadow,
  Space,
} from '@/constants/theme';

export default function SignupScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // キーボード表示時にロゴを縮小して、フォームのスペースを確保する
  // （2026-08-28追加。login.tsxと同じ実装。詳細はそちらのコメント参照）。
  const logoAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      Animated.timing(logoAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(logoAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [logoAnim]);
  const logoFontSize = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 26] });
  const logoOpacity = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });

  const handleRegister = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await register(name, email, password);
      router.push('/gender');
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '予期しないエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            <Animated.Text style={[styles.logo, { fontSize: logoFontSize, opacity: logoOpacity }]}>
              kinpoyo
            </Animated.Text>

            <View style={styles.form}>
              <Text style={styles.title}>新規登録</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ニックネーム</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="ニックネーム"
                  placeholderTextColor={Colors.textHint}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>メールアドレス</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="メールアドレス"
                  placeholderTextColor={Colors.textHint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>パスワード</Text>
                <View style={[styles.input, styles.inputRow]}>
                  <TextInput
                    style={styles.inputFlex}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••"
                    placeholderTextColor={Colors.textHint}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    <IconSymbol
                      name={showPassword ? 'eye' : 'eye.slash'}
                      size={18}
                      color={Colors.textHint}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { marginTop: Space[2] },
                  isSubmitting && styles.primaryBtnDisabled,
                ]}
                activeOpacity={0.85}
                disabled={isSubmitting}
                onPress={handleRegister}>
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryBtnText}>新規作成</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>すでにアカウントをお持ちの方は </Text>
              <TouchableOpacity onPress={() => router.replace('/login')}>
                <Text style={styles.switchLink}>ログイン</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[8],
  },
  logo: {
    // FontSizeトークンの最大('3xl'=34)を超えるロゴ用の特別サイズ。
    fontSize: 48,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
    textAlign: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[8],
  },

  form: {
    gap: Space[5],
  },
  inputGroup: {
    gap: Space[2],
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  input: {
    height: Layout.inputHeight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
    paddingHorizontal: Space[4],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputFlex: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
  },

  primaryBtn: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Space[2],
  },
  switchText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textLink,
  },
});
