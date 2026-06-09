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

type Goal = 'lose' | 'gain' | 'maintain';

const OPTIONS: { key: Goal; label: string }[] = [
  { key: 'lose', label: '痩せたい' },
  { key: 'gain', label: '筋肉を増やしたい' },
  { key: 'maintain', label: '体型を維持したい' },
];

export default function TrainGoalScreen() {
  const [goal, setGoal] = useState<Goal | null>(null);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <OnboardingHeader
            step={6}
            totalSteps={6}
            title={'あなたの主な目標は\n何ですか？'}
            description="目標に合わせて、有酸素運動と筋力トレーニングの最適な組み合わせを提案します！"
          />

          <View style={styles.optionList}>
            {OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.optionCard, goal === opt.key && styles.optionCardActive]}
                activeOpacity={0.85}
                onPress={() => setGoal(opt.key)}>
                <Text style={[styles.optionLabel, goal === opt.key && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, !goal && styles.primaryBtnDisabled]}
            activeOpacity={0.85}
            disabled={!goal}
            onPress={() => router.push({ pathname: '/success', params: { from: 'onboarding' } })}>
            <Text style={styles.primaryBtnText}>はじめる</Text>
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
  optionList: {
    gap: Space[4],
  },
  optionCard: {
    height: 88,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: Space[5],
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
