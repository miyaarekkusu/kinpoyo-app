import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TrainerAvatar } from '@/components/ui/trainer-avatar';
import { Colors, FontSize, FontWeight, Radius, Space } from '@/constants/theme';

type OnboardingHeaderProps = {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
};

export function OnboardingHeader({ step, totalSteps, title, description }: OnboardingHeaderProps) {
  return (
    <View>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, i < step && styles.progressSegmentActive]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>

      {description && (
        <View style={styles.descCard}>
          <TrainerAvatar size={56} />
          <Text style={styles.descText}>{description}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    marginBottom: Space[6],
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Space[2],
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  progressSegmentActive: {
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 32,
    marginBottom: Space[6],
  },
  descCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[4],
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[8],
  },
  descText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
