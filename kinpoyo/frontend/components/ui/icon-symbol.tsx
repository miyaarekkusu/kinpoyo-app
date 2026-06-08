// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'bell.fill': 'notifications',
  'dumbbell.fill': 'fitness-center',
  'figure.strengthtraining.traditional': 'fitness-center',
  'bubble.left.and.bubble.right.fill': 'forum',
  'chart.bar.fill': 'analytics',
  'person.fill': 'person',
  'calendar': 'event',
  'slider.horizontal.3': 'tune',
  'search': 'search',
  'heart.fill': 'favorite',
  'chat.bubble': 'chat-bubble-outline',
  'plus': 'add',
  'flame.fill': 'local-fire-department',
  'arrow.up.right': 'trending-up',
  'gear': 'settings',
  'xmark': 'close',
  'timer': 'timer',
  'repeat': 'repeat',
  'trash': 'delete',
  // Records & Profile 画面用追加アイコン
  'person.crop.circle': 'account-circle',
  'checkmark.circle': 'check-circle',
  'trophy.fill': 'emoji-events',
  'chart.line.uptrend.xyaxis': 'show-chart',
  'info.circle': 'info',
  'clock': 'schedule',
  'lock.fill': 'lock',
  'questionmark.circle': 'help-outline',
  'note.text': 'note',
  'list.bullet': 'list',
  'scale.3d': 'monitor-weight',
  'figure.arms.open': 'accessibility',
  'percent': 'percent',
  // 認証画面用追加アイコン
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'envelope': 'email',
  'checkmark': 'check',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
