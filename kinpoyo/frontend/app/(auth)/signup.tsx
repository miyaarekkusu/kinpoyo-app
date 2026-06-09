import React, { useState } from 'react';
import {
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
import { router, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { IconSymbol } from '@/components/ui/icon-symbol';
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

            <Text style={styles.title}>新規登録</Text>

            <View style={styles.form}>
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

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: Space[2] }]}
                activeOpacity={0.85}
                onPress={() => router.push('/gender')}>
                <Text style={styles.primaryBtnText}>新規作成</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>または</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
                <FontAwesome name="apple" size={18} color={Colors.textPrimary} />
                <Text style={styles.socialBtnText}>Appleでログイン</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.85}>
                <FontAwesome name="google" size={16} color="#EA4335" />
                <Text style={styles.socialBtnText}>Googleでログイン</Text>
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>すでにアカウントをお持ちの方は </Text>
                <TouchableOpacity onPress={() => router.replace('/login')}>
                  <Text style={styles.switchLink}>ログイン</Text>
                </TouchableOpacity>
              </View>
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
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[8],
    paddingBottom: Space[10],
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

  primaryBtn: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    marginVertical: Space[1],
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
  },

  socialBtn: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[3],
  },
  socialBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
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
