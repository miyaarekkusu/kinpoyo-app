import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  Colors,
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Shadow,
  Space,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

const STATS = [
  { icon: 'timer' as const,       value: '0',  unit: '時間', label: 'トレーニング時間', color: Colors.info },
  { icon: 'arrow.up.right' as const, value: '0', unit: 'kg',  label: '総ボリューム',    color: Colors.primaryDark },
  { icon: 'dumbbell.fill' as const,  value: '0', unit: '回',  label: '合計ワークアウト', color: '#8B5CF6' },
  { icon: 'flame.fill' as const,     value: '0', unit: '週',  label: '週間ストリーク',  color: '#F97316' },
];

const BIG3 = [
  { label: 'SQUAT',     value: '─' },
  { label: 'BENCH',     value: '─' },
  { label: 'DEADLIFT',  value: '─' },
];

const BODY_ITEMS = [
  { emoji: '⚖️', label: '体重',    unit: 'kg' },
  { emoji: '💪', label: '筋肉量',  unit: 'kg' },
  { emoji: '📊', label: '体脂肪率', unit: '%' },
];

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>プロフィール</Text>
        <TouchableOpacity hitSlop={8}>
          <IconSymbol name="gear" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── User Card ────────────────────────── */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>ゲ</Text>
            </View>
            <View style={styles.avatarOnline} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>ゲスト</Text>
          </View>
        </View>

        {/* ── Stats Grid ───────────────────────── */}
        <Text style={styles.sectionTitle}>実績</Text>
        <View style={styles.statsGrid}>
          {STATS.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: s.color + '18' }]}>
                <IconSymbol name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={styles.statValue}>
                {s.value}
                <Text style={styles.statUnit}>{s.unit}</Text>
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── BIG3 ─────────────────────────────── */}
        <Text style={styles.sectionTitle}>BIG3の合計 (1RM)</Text>
        <View style={styles.big3Total}>
          <Text style={styles.big3TotalLabel}>TOTAL</Text>
          <Text style={styles.big3TotalValue}>─</Text>
        </View>
        <View style={styles.big3Row}>
          {BIG3.map((b, i) => (
            <View key={i} style={styles.big3Card}>
              <Text style={styles.big3Label}>{b.label}</Text>
              <Text style={styles.big3Value}>{b.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Body Data ────────────────────────── */}
        <TouchableOpacity style={styles.bodySection} activeOpacity={0.8}>
          <View style={styles.bodySectionHeader}>
            <Text style={styles.sectionTitle2}>最近の身体情報</Text>
            <IconSymbol name="chevron.right" size={18} color={Colors.textHint} />
          </View>
          <View style={styles.bodyGrid}>
            {BODY_ITEMS.map((b, i) => (
              <View key={i} style={styles.bodyItem}>
                <Text style={styles.bodyEmoji}>{b.emoji}</Text>
                <Text style={styles.bodyValue}>──</Text>
                <Text style={styles.bodyLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* ── ログアウト ───────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.75}
          onPress={() => setShowLogoutConfirm(true)}>
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={Colors.error} />
          <Text style={styles.logoutBtnText}>ログアウト</Text>
        </TouchableOpacity>

        <View style={{ height: Space[10] }} />
      </ScrollView>

      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>ログアウトしますか？</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.dialogCancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogLogoutBtn} onPress={handleLogout}>
                <Text style={styles.dialogLogoutBtnText}>ログアウト</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },

  // ── User Card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    padding: Space[4],
    marginBottom: Space[5],
    gap: Space[4],
    ...Shadow.sm,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  avatarOnline: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primarySubtle,
  },
  userInfo: {
    flex: 1,
    gap: Space[1],
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  // ── Section titles
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
    marginTop: Space[1],
  },
  sectionTitle2: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  // ── Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space[3],
    marginBottom: Space[5],
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    gap: Space[1],
    ...Shadow.sm,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space[1],
  },
  statValue: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  statUnit: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
  },

  // ── BIG3
  big3Total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[2],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  big3TotalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  big3TotalValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  big3Row: {
    flexDirection: 'row',
    gap: Space[2],
    marginBottom: Space[5],
  },
  big3Card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Space[3],
    alignItems: 'center',
    gap: Space[1],
    ...Shadow.sm,
  },
  big3Label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textHint,
    letterSpacing: 0.5,
  },
  big3Value: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  // ── Body Data
  bodySection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[5],
    ...Shadow.sm,
  },
  bodySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[4],
  },
  bodyGrid: {
    flexDirection: 'row',
  },
  bodyItem: {
    flex: 1,
    alignItems: 'center',
    gap: Space[1],
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
    paddingVertical: Space[2],
  },
  bodyEmoji: {
    fontSize: 24,
  },
  bodyValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  bodyLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
  },

  // ── ログアウト
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    height: Layout.buttonHeightMd,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.error,
    backgroundColor: Colors.bgCard,
  },
  logoutBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.error,
  },

  // ── ログアウト確認ダイアログ
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgOverlay,
    paddingHorizontal: Space[5],
  },
  dialogBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    width: '100%',
    padding: Space[5],
    gap: Space[2],
  },
  dialogTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Space[2],
  },
  dialogActions: { flexDirection: 'row', gap: Space[3] },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center',
  },
  dialogCancelBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  dialogLogoutBtn: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  dialogLogoutBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});
