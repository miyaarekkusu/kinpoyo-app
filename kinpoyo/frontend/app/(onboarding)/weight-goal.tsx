import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';

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
const ITEM_WIDTH = 16;

const VALUES = Array.from({ length: MAX_KG - MIN_KG + 1 }, (_, i) => MIN_KG + i);

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

function goalMessage(goal: number, current: number) {
  const diffPercent = Math.round((Math.abs(goal - current) / current) * 1000) / 10;

  if (goal < current) {
    return {
      heading: '減量チャレンジ！',
      body: `現在の体重から約 ${diffPercent}% の減量を目指します`,
      bullets: ['心肺機能の向上が期待できます', '関節への負担を軽減できます'],
    };
  }
  if (goal > current) {
    return {
      heading: '増量チャレンジ！',
      body: `現在の体重から約 ${diffPercent}% の増量を目指します`,
      bullets: ['筋力アップが期待できます', '基礎代謝の向上につながります'],
    };
  }
  return {
    heading: '現状維持を目指します',
    body: '今の体重をキープしながら、体型を整えていきましょう',
    bullets: ['体脂肪率の改善が期待できます', '筋肉量を維持しやすくなります'],
  };
}

export default function WeightGoalScreen() {
  const { currentWeight, unit: paramUnit } = useLocalSearchParams<{
    currentWeight: string;
    unit: string;
  }>();
  const currentWeightKg = currentWeight ? parseFloat(currentWeight) : 75;

  const [unit, setUnit] = useState<Unit>((paramUnit as Unit) ?? 'kg');
  const [goal, setGoal] = useState(currentWeightKg);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / ITEM_WIDTH);
    const value = MIN_KG + Math.min(Math.max(index, 0), VALUES.length - 1);
    setGoal(value);
  }, []);

  const message = useMemo(() => goalMessage(goal, currentWeightKg), [goal, currentWeightKg]);

  // ビューポート中央（centerLine）が goal を指しているため、
  // 現在体重との差をピクセル変換してバンドの左端・幅を求める
  const zone = useMemo(() => {
    const rulerCenter = (screenWidth - Layout.screenPaddingH * 2) / 2;
    const diff = (currentWeightKg - goal) * ITEM_WIDTH;
    return {
      left: rulerCenter + Math.min(0, diff),
      width: Math.abs(diff),
    };
  }, [goal, currentWeightKg, screenWidth]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <OnboardingHeader
            step={4}
            totalSteps={6}
            title="目標の体重を教えてください"
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
              {unit === 'kg' ? goal : kgToLbs(goal).toFixed(1)}
            </Text>
            <Text style={styles.bigUnit}>{unit}</Text>
            <Text style={styles.currentRef}>
              現在 {unit === 'kg' ? currentWeightKg : kgToLbs(currentWeightKg).toFixed(1)}{unit}
            </Text>
          </View>

          <View style={styles.ruler}>
            <View pointerEvents="none" style={[styles.zoneBand, { left: zone.left, width: zone.width }]} />
            <View pointerEvents="none" style={styles.centerLine} />
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_WIDTH}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={handleScroll}
              contentContainerStyle={{ paddingHorizontal: Layout.screenPaddingH }}
              contentOffset={{ x: (currentWeightKg - MIN_KG) * ITEM_WIDTH, y: 0 }}>
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

          <View style={styles.goalCard}>
            <View style={styles.goalHeaderRow}>
              <TrainerAvatar size={28} />
              <Text style={styles.goalHeading}>{message.heading}</Text>
            </View>
            <Text style={styles.goalBody}>{message.body}</Text>
            <View style={styles.bulletList}>
              {message.bullets.map(b => (
                <Text key={b} style={styles.bulletText}>・{b}</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/year')}>
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
    marginBottom: Space[6],
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
    marginBottom: Space[5],
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
  currentRef: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    marginLeft: Space[3],
    marginBottom: Space[2],
  },
  ruler: {
    height: 80,
    justifyContent: 'center',
    marginBottom: Space[6],
  },
  zoneBand: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    height: 32,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    opacity: 0.7,
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
  goalCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[5],
    gap: Space[2],
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  goalHeading: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  goalBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bulletList: {
    gap: Space[1],
    marginTop: Space[1],
  },
  bulletText: {
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
