import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Radius, Space } from '@/constants/theme';

// ─── 通知マスターデータ（モック） ───────────────────────────────
type NotificationType = 'achievement' | 'like' | 'comment' | 'follow' | 'system';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timeAgo: string;
  read: boolean;
};

const NOTIFICATIONS: NotificationItem[] = [
  { id: '1', type: 'achievement', title: '実績を獲得しました', body: '「3日連続トレーニング」を達成しました🔥', timeAgo: '1時間前', read: false },
  { id: '2', type: 'like',        title: 'いいねされました',   body: 'kinpoyo太郎さんが投稿にいいねしました', timeAgo: '3時間前', read: false },
  { id: '3', type: 'comment',     title: 'コメントが届きました', body: 'kinpoyo花子さん: 「フォームきれいですね！」', timeAgo: '昨日', read: true },
  { id: '4', type: 'follow',      title: '新しいフォロワー',     body: 'kinpoyo次郎さんにフォローされました', timeAgo: '2日前', read: true },
  { id: '5', type: 'system',      title: 'お知らせ',           body: '「今日」タブが新しくオープンしました！', timeAgo: '8日前', read: true },
];

const NOTIF_ICON: Record<NotificationType, { name: React.ComponentProps<typeof IconSymbol>['name']; color: string }> = {
  achievement: { name: 'trophy.fill', color: '#F59E0B' },
  like:        { name: 'heart.fill',  color: '#EF4444' },
  comment:     { name: 'bubble.left.and.bubble.right.fill', color: Colors.primaryDark },
  follow:      { name: 'person.fill', color: '#3B82F6' },
  system:      { name: 'bell.fill',   color: Colors.textSecondary },
};

// ─── コンポーネント ────────────────────────────────────────────
type Props = {
  visible: boolean;
  onClose: () => void;
};

export function NotificationsModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>通知</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <IconSymbol name="xmark" size={18} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {NOTIFICATIONS.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>通知はありません</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}>
              {NOTIFICATIONS.map((n, i) => {
                const icon = NOTIF_ICON[n.type];
                return (
                  <View
                    key={n.id}
                    style={[styles.item, i === NOTIFICATIONS.length - 1 && styles.itemLast]}>
                    <View style={[styles.iconWrap, { backgroundColor: icon.color + '20' }]}>
                      <IconSymbol name={icon.name} size={18} color={icon.color} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>{n.title}</Text>
                      <Text style={styles.itemText} numberOfLines={2}>{n.body}</Text>
                      <Text style={styles.itemTime}>{n.timeAgo}</Text>
                    </View>
                    {!n.read && <View style={styles.unreadDot} />}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgOverlay,
    paddingHorizontal: Space[5],
  },
  dialog: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
    paddingBottom: Space[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space[4],
    paddingTop: Space[4],
    paddingBottom: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { maxHeight: 420 },
  listContent: {
    paddingHorizontal: Space[4],
    paddingTop: Space[2],
    paddingBottom: Space[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space[3],
    paddingVertical: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  itemLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1 },
  itemTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  itemText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[8],
  },
  emptyText: { fontSize: FontSize.sm, color: Colors.textHint },
});
