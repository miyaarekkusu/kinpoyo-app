import React, { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

const MIN_YEAR = 1950;
const MAX_YEAR = 2015;
const DEFAULT_YEAR = 2004;
const ITEM_HEIGHT = 64;
const VISIBLE_ROWS = 5;
const VIEWPORT_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const SIDE_PADDING = (VIEWPORT_HEIGHT - ITEM_HEIGHT) / 2;

const YEARS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

export default function YearScreen() {
  const [year, setYear] = useState(DEFAULT_YEAR);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const value = MIN_YEAR + Math.min(Math.max(index, 0), YEARS.length - 1);
    setYear(value);
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <OnboardingHeader
            step={5}
            totalSteps={6}
            title={'生まれた年を\n教えてください'}
            description="あなたの体に合った、安全なトレーニングを提案するために使用します。"
          />

          <View style={styles.wheel}>
            <View pointerEvents="none" style={styles.selectionPill} />
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={handleScroll}
              contentContainerStyle={{ paddingVertical: SIDE_PADDING }}
              contentOffset={{ x: 0, y: (DEFAULT_YEAR - MIN_YEAR) * ITEM_HEIGHT }}>
              {YEARS.map(y => (
                <View key={y} style={styles.yearRow}>
                  <Text style={[styles.yearText, y === year && styles.yearTextActive]}>{y}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/train-goal')}>
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
  container: {
    flex: 1,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },
  wheel: {
    height: VIEWPORT_HEIGHT,
    justifyContent: 'center',
  },
  selectionPill: {
    position: 'absolute',
    left: Space[4],
    right: Space[4],
    top: SIDE_PADDING,
    height: ITEM_HEIGHT,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  yearRow: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.semibold,
    color: Colors.textHint,
  },
  yearTextActive: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.bold,
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
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});
