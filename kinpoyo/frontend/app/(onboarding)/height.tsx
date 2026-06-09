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

type Unit = 'cm' | 'ft';

const MIN_CM = 140;
const MAX_CM = 220;
const DEFAULT_CM = 176;
const ITEM_HEIGHT = 28;
const VIEWPORT_HEIGHT = 280;
const RULER_WIDTH = 120;
const TICK_START = 56;
const TICK_END = TICK_START + 40;
const NUMBER_OFFSET = 32;
const SIDE_PADDING = VIEWPORT_HEIGHT / 2 - ITEM_HEIGHT / 2;

const VALUES = Array.from({ length: MAX_CM - MIN_CM + 1 }, (_, i) => MIN_CM + i);

function cmToFtIn(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

export default function HeightScreen() {
  const [unit, setUnit] = useState<Unit>('cm');
  const [height, setHeight] = useState(DEFAULT_CM);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const value = MIN_CM + Math.min(Math.max(index, 0), VALUES.length - 1);
    setHeight(value);
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <OnboardingHeader
            step={2}
            totalSteps={6}
            title="身長を教えてください"
            description="BMIを計算して、あなたの体格に合ったトレーニングに調整します！"
          />

          <View style={styles.centerGroup}>
            <View style={styles.unitToggle}>
              <TouchableOpacity
                style={[styles.unitBtn, unit === 'cm' && styles.unitBtnActive]}
                onPress={() => setUnit('cm')}>
                <Text style={[styles.unitText, unit === 'cm' && styles.unitTextActive]}>cm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitBtn, unit === 'ft' && styles.unitBtnActive]}
                onPress={() => setUnit('ft')}>
                <Text style={[styles.unitText, unit === 'ft' && styles.unitTextActive]}>ft</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerArea}>
              <View pointerEvents="none" style={styles.indicatorLine} />

              <View style={styles.bigNumberBlock}>
                <Text style={styles.bigNumber}>
                  {unit === 'cm' ? height : cmToFtIn(height)}
                </Text>
                <Text style={styles.bigUnit}>{unit === 'cm' ? 'cm' : ''}</Text>
              </View>

              <View style={styles.ruler}>
                <ScrollView
                  ref={scrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  onScroll={handleScroll}
                  contentContainerStyle={{ paddingVertical: SIDE_PADDING }}
                  contentOffset={{ x: 0, y: (DEFAULT_CM - MIN_CM) * ITEM_HEIGHT }}>
                  {VALUES.map(v => (
                    <View key={v} style={styles.tickRow}>
                      {v % 10 === 0 ? (
                        <>
                          <View style={styles.tickLineMajor} />
                          <Text style={styles.tickLabel}>
                            {unit === 'cm' ? v : cmToFtIn(v)}
                          </Text>
                        </>
                      ) : (
                        <View style={styles.tickLineMinor} />
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/weight')}>
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
  centerGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  unitToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.full,
    padding: 4,
    marginBottom: Space[8],
  },
  unitBtn: {
    width: 72,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBtnActive: {
    backgroundColor: Colors.textPrimary,
  },
  unitText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textHint,
  },
  unitTextActive: {
    color: Colors.textOnPrimary,
  },
  pickerArea: {
    height: VIEWPORT_HEIGHT,
  },
  indicatorLine: {
    position: 'absolute',
    left: NUMBER_OFFSET,
    right: 0,
    top: VIEWPORT_HEIGHT / 2,
    height: 2,
    backgroundColor: Colors.primary,
    zIndex: 1,
  },
  bigNumberBlock: {
    position: 'absolute',
    left: NUMBER_OFFSET,
    bottom: VIEWPORT_HEIGHT / 2 + Space[1],
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bigNumber: {
    fontSize: 56,
    fontWeight: FontWeight.bold,
    color: '#000000',
    lineHeight: 60,
  },
  bigUnit: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginLeft: Space[1],
    marginBottom: Space[1],
  },
  ruler: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: RULER_WIDTH,
    height: VIEWPORT_HEIGHT,
  },
  tickRow: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  tickLineMajor: {
    position: 'absolute',
    left: TICK_START,
    width: TICK_END - TICK_START,
    height: 1.5,
    backgroundColor: Colors.textSecondary,
  },
  tickLineMinor: {
    position: 'absolute',
    left: TICK_END - 18,
    width: 18,
    height: 1,
    backgroundColor: Colors.borderStrong,
  },
  tickLabel: {
    position: 'absolute',
    left: 0,
    width: TICK_START - Space[2],
    textAlign: 'right',
    fontSize: FontSize.base,
    color: Colors.textSecondary,
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
