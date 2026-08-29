// アバター画像（avatar_url）があればそれを表示し、無ければ汎用のプロフィール
// アイコンにフォールバックする共通コンポーネント（2026-08-30追加）。
// profile.tsx・user-profile.tsx・follow-list.tsx・community.tsxで共用する。
// 2026-08-30追記：フォールバックを名前の頭文字表示から人型アイコン表示に変更
// （ユーザー要望：「デフォルトは数字じゃなくて、プロフィールアイコンにしてほしい」
// ——ユーザー名が数字始まりだと頭文字が数字になってしまっていたため）。
import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { toAbsoluteMediaUrl } from '@/services/api';

export function Avatar({
  uri,
  label,
  size,
  fontSize,
  style,
}: {
  uri?: string | null;
  label: string;
  size: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri: toAbsoluteMediaUrl(uri) }}
        style={[styles.image, dimensionStyle, style] as StyleProp<ImageStyle>}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, dimensionStyle, style]} accessibilityLabel={label}>
      <IconSymbol name="person.fill" size={fontSize ?? size * 0.55} color={Colors.textOnPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: Colors.bgCard },
  fallback: {
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
