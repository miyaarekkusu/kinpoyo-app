import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';

import { OnboardingHeader } from '@/components/onboarding-header';
import {
  Colors,
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Shadow,
  Space,
} from '@/constants/theme';

type Gender = 'male' | 'female' | 'other';

const OPTIONS: { key: Gender; label: string }[] = [
  { key: 'male', label: '男性' },
  { key: 'female', label: '女性' },
];

export default function GenderScreen() {
  const [gender, setGender] = useState<Gender | null>(null);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <OnboardingHeader
            step={1}
            totalSteps={6}
            title="性別を教えてください"
            description="あなたの基礎代謝に合わせて、トレーニング内容をぴったりに調整するために使用します。"
          />

          <View style={styles.optionRow}>
            {OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionCard, gender === opt.key && styles.optionCardActive]}
                activeOpacity={0.85}
                onPress={() => setGender(opt.key)}>
                <Text style={[styles.optionLabel, gender === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.otherPill, gender === 'other' && styles.otherPillActive]}
            activeOpacity={0.85}
            onPress={() => setGender('other')}>
            <Text style={[styles.otherText, gender === 'other' && styles.otherTextActive]}>
              その他 ／ 回答しない
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, !gender && styles.primaryBtnDisabled]}
            activeOpacity={0.85}
            disabled={!gender}
            onPress={() => router.push('/height')}>
            <Text style={styles.primaryBtnText}>次へ</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: Space[4],
    paddingBottom: Space[6],
  },
  optionRow: {
    flexDirection: 'row',
    gap: Space[4],
    marginBottom: Space[5],
  },
  optionCard: {
    flex: 1,
    height: 120,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  optionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  optionLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  optionLabelActive: {
    color: Colors.primaryDark,
  },
  otherPill: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherPillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  otherText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  otherTextActive: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingBottom: Space[4],
  },
  primaryBtn: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.full,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.borderStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});
