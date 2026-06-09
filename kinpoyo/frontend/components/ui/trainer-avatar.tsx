import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Radius } from '@/constants/theme';

// personal-trainer.gif: 110 frames / 2400ms 1ループ分のみ再生して停止する
const GIF_LOOP_DURATION = 2400;

type TrainerAvatarProps = {
  size?: number;
};

export function TrainerAvatar({ size = 56 }: TrainerAvatarProps) {
  const imageRef = useRef<Image>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      imageRef.current?.stopAnimating();
    }, GIF_LOOP_DURATION);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        ref={imageRef}
        source={require('@/assets/gif/personal-trainer.gif')}
        style={{ width: size, height: size }}
        autoplay
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
