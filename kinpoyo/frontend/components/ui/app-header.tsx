// 全画面共通のヘッダー：「kinpoyo」ブランドバー（ホーム画面と同一）＋その下の
// 画面タイトル行。各タブ画面はAppHeader（ブランドバー）とPageTitleBar（タイトル）
// を組み合わせて使い、見た目を統一する（2026-08-26）。
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space } from '@/constants/theme';

type AppHeaderProps = {
  onBellPress: () => void;
};

export function AppHeader({ onBellPress }: AppHeaderProps) {
  return (
    <View style={s.header}>
      <View style={s.headerSide} />
      <Text style={s.appName}>kinpoyo</Text>
      <View style={[s.headerSide, s.headerIcons]}>
        <TouchableOpacity onPress={onBellPress} hitSlop={8} style={s.iconBtn}>
          <IconSymbol name="bell.fill" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

type PageTitleBarProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function PageTitleBar({ title, subtitle, right }: PageTitleBarProps) {
  return (
    <View style={s.titleBar}>
      <View style={s.titleTextWrap}>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgScreen,
  },
  headerSide: { flex: 1 },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
    textAlign: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Space[1],
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    ...Shadow.sm,
  },

  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgScreen,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  titleTextWrap: {},
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
