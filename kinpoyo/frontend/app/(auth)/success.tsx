import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { Colors, Radius } from '@/constants/theme';

const AUTO_NAVIGATE_DELAY = 1600;

export default function SuccessScreen() {
  const { from } = useLocalSearchParams<{ from: string }>();
  const { signIn } = useAuth();

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSequence(
      withTiming(1.08, { duration: 320, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 140 }),
    );
    checkOpacity.value = withDelay(220, withTiming(1, { duration: 200 }));

    const timer = setTimeout(() => {
      if (from === 'onboarding') {
        signIn();
      } else {
        router.replace('/login');
      }
    }, AUTO_NAVIGATE_DELAY);
    return () => clearTimeout(timer);
  }, [checkOpacity, from, opacity, scale, signIn]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <Animated.View style={[styles.circle, circleStyle]}>
            <Animated.View style={checkStyle}>
              <IconSymbol name="checkmark" size={36} color={Colors.primary} />
            </Animated.View>
          </Animated.View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
