/**
 * kinpoyo デザイントークン（React Native / Expo 用）
 * CSS変数と1対1対応 — styles/theme.css と必ず同期すること
 */

import { Platform } from 'react-native';

// ─── Primary Green ───────────────────────────────────────────
export const Colors = {
  primary:        '#22C55E',   // 明るいグリーン: アクセント・アイコン
  primaryDark:    '#16A34A',   // ボタン背景・アクティブ状態
  primaryDarker:  '#15803D',   // 押下状態
  primaryLight:   '#86EFAC',   // プログレスバー・ハイライト
  primarySubtle:  '#F0FDF4',   // 選択行・カード背景 tint
  primaryBorder:  '#BBF7D0',   // 入力フォーカス枠

  // Background
  bgScreen:       '#F5F7FA',
  bgCard:         '#FFFFFF',
  bgInput:        '#F9FAFB',
  bgOverlay:      'rgba(0, 0, 0, 0.40)',

  // Text
  textPrimary:    '#111827',
  textSecondary:  '#4B5563',
  textHint:       '#9CA3AF',
  textOnPrimary:  '#FFFFFF',
  textLink:       '#16A34A',

  // Border
  border:         '#E5E7EB',
  borderStrong:   '#D1D5DB',
  divider:        '#F3F4F6',

  // Status
  error:          '#EF4444',
  errorSubtle:    '#FEF2F2',
  warning:        '#F59E0B',
  warningSubtle:  '#FFFBEB',
  info:           '#3B82F6',
  infoSubtle:     '#EFF6FF',

  // Tab bar (Expo Router useThemeColor compatibility)
  light: {
    text:           '#111827',
    background:     '#F5F7FA',
    tint:           '#16A34A',
    icon:           '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected:'#16A34A',
  },
  dark: {
    text:           '#ECEDEE',
    background:     '#151718',
    tint:           '#22C55E',
    icon:           '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected:'#22C55E',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────
export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 34,
} as const;

export const FontWeight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, sans-serif",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
});

// ─── Spacing (4px grid) ──────────────────────────────────────
export const Space = {
  1:   4,
  2:   8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border Radius ───────────────────────────────────────────
export const Radius = {
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  full: 9999,
} as const;

// ─── Shadow (React Native 用) ────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ─── Layout ──────────────────────────────────────────────────
export const Layout = {
  screenPaddingH:  16,
  tabBarHeight:    80,
  headerHeight:    56,
  cardPadding:     16,
  inputHeight:     48,
  buttonHeightLg:  52,
  buttonHeightMd:  44,
  buttonHeightSm:  36,
} as const;
