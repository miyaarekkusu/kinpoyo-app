import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { TrainerAvatar } from '@/components/ui/trainer-avatar';
import {
  Colors,
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Shadow,
  Space,
} from '@/constants/theme';

type Unit = 'kg' | 'lbs';

const MIN_KG = 40;
const MAX_KG = 150;
const DEFAULT_KG = 75;
const ITEM_WIDTH = 16;
const VIEWPORT_WIDTH_PADDING = Layout.screenPaddingH;

const VALUES = Array.from({ length: MAX_KG - MIN_KG + 1 }, (_, i) => MIN_KG + i);

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function bmiComment(bmi: number): string {
  if (bmi < 18.5) return '少し細めです。筋肉量を増やしていきましょう！';
  if (bmi < 25) return '標準的な体型です！この調子を維持しましょう。';
  if (bmi < 30) return '少し体重が多めです。一緒に整えていきましょう。';
  return '無理のないペースで、体重管理に取り組みましょう。';
}

export default function WeightScreen() {
  const [unit, setUnit] = useState<Unit>('kg');
  const [weight, setWeight] = useState(DEFAULT_KG);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    const value = MIN_KG + Math.min(Math.max(index, 0), VALUES.length - 1);
    setWeight(value);
  }, []);

  // height は前画面のモック値(176cm)で仮計算 — UI確認用のプレースホルダー
  const bmi = useMemo(() => {
    const heightM = 1.76;
    return Math.round((weight / (heightM * heightM)) * 10) / 10;
  }, [weight]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <OnboardingHeader
            step={3}
            totalSteps={6}
            title="現在の体重を教えてください"
          />

          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitBtn, unit === 'kg' && styles.unitBtnActive]}
              onPress={() => setUnit('kg')}>
              <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>kg</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitBtn, unit === 'lbs' && styles.unitBtnActive]}
              onPress={() => setUnit('lbs')}>
              <Text style={[styles.unitText, unit === 'lbs' && styles.unitTextActive]}>lbs</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bigNumberBlock}>
            <Text style={styles.bigNumber}>
              {unit === 'kg' ? weight.toFixed(1) : kgToLbs(weight).toFixed(1)}
            </Text>
            <Text style={styles.bigUnit}>{unit}</Text>
          </View>

          <View style={styles.ruler}>
            <View pointerEvents="none" style={styles.centerLine} />
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_WIDTH}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={handleScroll}
              contentContainerStyle={{
                paddingHorizontal: VIEWPORT_WIDTH_PADDING,
              }}
              contentOffset={{ x: (DEFAULT_KG - MIN_KG) * ITEM_WIDTH, y: 0 }}>
              {VALUES.map(v => (
                <View key={v} style={styles.tickCol}>
                  <Text style={styles.tickLabel}>
                    {v % 10 === 0 ? (unit === 'kg' ? v : Math.round(kgToLbs(v))) : ''}
                  </Text>
                  <View style={v % 10 === 0 ? styles.tickLineMajor : styles.tickLineMinor} />
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.bmiCard}>
            <View style={styles.bmiHeaderRow}>
              <TrainerAvatar size={56} />
              <View style={styles.bmiHeaderTextWrap}>
                <Text style={styles.bmiHeaderTitle}>AIトレーナー</Text>
                <Text style={styles.bmiHeaderSubtitle}>現在のBMI</Text>
              </View>
            </View>
            <View style={styles.bmiRow}>
              <Text style={styles.bmiValue}>{bmi}</Text>
              <Text style={styles.bmiComment}>{bmiComment(bmi)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/weight-goal',
                params: { currentWeight: String(weight), unit },
              })
            }>
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
  bigNumberBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: Space[6],
  },
  bigNumber: {
    fontSize: 64,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 68,
  },
  bigUnit: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginLeft: Space[1],
    marginBottom: Space[1],
  },
  ruler: {
    height: 80,
    justifyContent: 'center',
    marginBottom: Space[6],
  },
  centerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: Colors.primary,
    zIndex: 1,
  },
  tickCol: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tickLineMajor: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderStrong,
  },
  tickLineMinor: {
    width: 1,
    height: 14,
    backgroundColor: Colors.border,
  },
  tickLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginBottom: Space[1],
    height: 16,
  },
  bmiCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[5],
    gap: Space[3],
  },
  bmiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  bmiHeaderTextWrap: { flex: 1 },
  bmiHeaderTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  bmiHeaderSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginTop: 1,
  },
  bmiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  bmiValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  bmiComment: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
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
