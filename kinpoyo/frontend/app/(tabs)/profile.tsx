import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { NotificationsModal } from '@/components/notifications-modal';
import { AppHeader, PageTitleBar } from '@/components/ui/app-header';
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
import { ApiError } from '@/services/api';
import { fetchMe, type UserOut } from '@/services/auth';
import { AchievementsOut, Big3Out, fetchAchievements, fetchBig3, registerExerciseMax } from '@/services/records';
import { fetchMyPrograms, leaveProgram, type UserProgramOut } from '@/services/program';
import { fetchMyProfile, type UserProfileOut } from '@/services/user';
import {
  deleteWorkoutTemplate,
  fetchWorkoutTemplates,
  type WorkoutTemplateListItem,
} from '@/services/workout-templates';

function fmtBodyValue(v: number | string | null): string {
  if (v === null || v === undefined) return '──';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? String(n) : '──';
}
function fmt1rm(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '─';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? `${Math.round(n)}` : '─';
}

export default function ProfileScreen() {
  const { token, signOut } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const [user, setUser] = useState<UserOut | null>(null);
  const [profile, setProfile] = useState<UserProfileOut | null>(null);
  const [achievements, setAchievements] = useState<AchievementsOut | null>(null);
  const [myProgram, setMyProgram] = useState<UserProgramOut | null>(null);
  const [big3, setBig3] = useState<Big3Out | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leavingProgram, setLeavingProgram] = useState(false);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [me, prof, ach, programs, b3, tmpls] = await Promise.all([
        fetchMe(token),
        fetchMyProfile(token),
        fetchAchievements(token),
        fetchMyPrograms(token),
        fetchBig3(token),
        fetchWorkoutTemplates(token),
      ]);
      setUser(me);
      setProfile(prof);
      setAchievements(ach);
      setMyProgram(programs.find(p => p.status_code === 'active') ?? null);
      setBig3(b3);
      setTemplates(tmpls);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
  };

  const handleLeaveProgram = () => {
    if (!myProgram) return;
    Alert.alert(
      'プログラムをやめますか？',
      `「${myProgram.program_name}」から離脱します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'やめる',
          style: 'destructive',
          onPress: async () => {
            setLeavingProgram(true);
            try {
              await leaveProgram(token, myProgram.id);
              await loadAll();
            } catch (e) {
              Alert.alert('エラー', e instanceof ApiError ? e.detail : '処理に失敗しました');
            } finally {
              setLeavingProgram(false);
            }
          },
        },
      ],
    );
  };

  // 参加中プログラムの詳細画面へ遷移。組み込みプログラム（BIG3・ボディウェイト）は
  // program/index.tsxのPROGRAMS定義と同じ固定ルート、それ以外（カスタム作成
  // プログラム）はcustom-detailにprogramIdを渡す（ProgramActionBarの名前解決と
  // 同じ「名前で組み込み/カスタムを判別する」方式に合わせた）。
  const BUILT_IN_PROGRAM_ROUTES: Record<string, string> = {
    'BIG3強化プログラム': '/program/big3',
    'ボディウェイトワークアウト': '/program/bodyweight',
  };
  const handleOpenMyProgram = (program: UserProgramOut) => {
    const builtInRoute = BUILT_IN_PROGRAM_ROUTES[program.program_name];
    if (builtInRoute) {
      router.push(builtInRoute as any);
      return;
    }
    router.push({
      pathname: '/program/custom-detail',
      params: { programId: String(program.program_id) },
    } as any);
  };

  // ── BIG3の1RM手入力登録 ────────────────────
  const [maxModalExercise, setMaxModalExercise] = useState<{ id: number; name: string } | null>(null);
  const [maxModalValue, setMaxModalValue] = useState('');
  const [maxModalSaving, setMaxModalSaving] = useState(false);

  const handleSaveMax = async () => {
    if (!maxModalExercise || maxModalValue.trim() === '') return;
    setMaxModalSaving(true);
    try {
      await registerExerciseMax(token, maxModalExercise.id, Number(maxModalValue));
      setMaxModalExercise(null);
      setMaxModalValue('');
      await loadAll();
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : '登録に失敗しました');
    } finally {
      setMaxModalSaving(false);
    }
  };

  // ── My筋トレ ─────────────────────────────────
  const handleDeleteTemplate = (t: WorkoutTemplateListItem) => {
    Alert.alert('削除しますか？', `「${t.name}」を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutTemplate(token, t.id);
            await loadAll();
          } catch (e) {
            Alert.alert('エラー', e instanceof ApiError ? e.detail : '削除に失敗しました');
          }
        },
      },
    ]);
  };

  const displayName = profile?.display_name || user?.username || 'ゲスト';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  const STATS = achievements
    ? [
        { icon: 'dumbbell.fill' as const, value: String(achievements.total_workouts), unit: '回', label: '合計ワークアウト', color: '#8B5CF6' },
        { icon: 'flame.fill' as const, value: String(achievements.weekly_streak), unit: '週', label: '週間ストリーク', color: '#F97316' },
      ]
    : [
        { icon: 'dumbbell.fill' as const, value: '─', unit: '回', label: '合計ワークアウト', color: '#8B5CF6' },
        { icon: 'flame.fill' as const, value: '─', unit: '週', label: '週間ストリーク', color: '#F97316' },
      ];

  const BODY_ITEMS = [
    { emoji: '⚖️', label: '体重', unit: 'kg', value: fmtBodyValue(profile?.weight_kg ?? null) },
    { emoji: '💪', label: '筋肉量', unit: 'kg', value: fmtBodyValue(profile?.muscle_mass_kg ?? null) },
    { emoji: '📊', label: '体脂肪率', unit: '%', value: fmtBodyValue(profile?.body_fat_pct ?? null) },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────── */}
      <AppHeader onBellPress={() => setShowNotifModal(true)} />
      <PageTitleBar title="プロフィール" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={undefined}>

        {loadError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadAll}>
              <Text style={styles.retryBtnText}>再読み込み</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── User Card（タップでユーザー情報変更） ─── */}
        <TouchableOpacity
          style={styles.userCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(screens)/profile-edit')}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
            <View style={styles.avatarOnline} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{loading && !user ? '読み込み中...' : displayName}</Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={Colors.textHint} />
        </TouchableOpacity>

        {/* ── Body Data ────────────────────────── */}
        <TouchableOpacity
          style={styles.bodySection}
          activeOpacity={0.8}
          onPress={() => router.push('/(screens)/profile-edit')}>
          <View style={styles.bodySectionHeader}>
            <Text style={styles.sectionTitle2}>最近の身体情報</Text>
            <IconSymbol name="chevron.right" size={18} color={Colors.textHint} />
          </View>
          <View style={styles.bodyGrid}>
            {BODY_ITEMS.map((b, i) => (
              <View key={i} style={styles.bodyItem}>
                <Text style={styles.bodyEmoji}>{b.emoji}</Text>
                <Text style={styles.bodyValue}>{b.value}</Text>
                <Text style={styles.bodyLabel}>{b.label}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

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

        {/* ── BIG3の合計(1RM)。自動計算＋タップで手入力登録 ──── */}
        <Text style={styles.sectionTitle}>BIG3の合計 (1RM)</Text>
        <View style={styles.big3Total}>
          <Text style={styles.big3TotalLabel}>TOTAL</Text>
          <Text style={styles.big3TotalValue}>
            {big3?.total_kg != null ? `${fmt1rm(big3.total_kg)} kg` : '─'}
          </Text>
        </View>
        <View style={styles.big3Row}>
          {([
            { key: 'squat', label: 'SQUAT', entry: big3?.squat },
            { key: 'bench', label: 'BENCH', entry: big3?.bench },
            { key: 'deadlift', label: 'DEADLIFT', entry: big3?.deadlift },
          ] as const).map(b => (
            <TouchableOpacity
              key={b.key}
              style={styles.big3Card}
              activeOpacity={0.75}
              onPress={() => {
                if (!b.entry) return;
                setMaxModalExercise({ id: b.entry.exercise_id, name: b.entry.exercise_name });
                setMaxModalValue('');
              }}>
              <Text style={styles.big3Label}>{b.label}</Text>
              <Text style={styles.big3Value}>{fmt1rm(b.entry?.best_1rm_kg)}</Text>
              {b.entry?.best_1rm_kg != null && (
                <Text style={styles.big3Source}>{b.entry.source === 'manual' ? '手入力' : '推定'}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.big3Hint}>種目をタップすると1RMを手入力で登録できます</Text>

        {/* ── 参加プログラム ───────────────────── */}
        <Text style={styles.sectionTitle}>参加プログラム</Text>
        {myProgram ? (
          <TouchableOpacity
            style={styles.programCard}
            activeOpacity={0.85}
            onPress={() => handleOpenMyProgram(myProgram)}>
            <View style={styles.programCardHeaderRow}>
              <Text style={styles.programName}>{myProgram.program_name}</Text>
              <IconSymbol name="chevron.right" size={18} color={Colors.textHint} />
            </View>
            <Text style={styles.programProgress}>
              {myProgram.current_week}週目 {myProgram.current_day}日目
            </Text>
            <TouchableOpacity
              style={styles.programLeaveBtn}
              activeOpacity={0.75}
              disabled={leavingProgram}
              onPress={handleLeaveProgram}>
              {leavingProgram ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <Text style={styles.programLeaveBtnText}>プログラムをやめる</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <View style={styles.programEmptyCard}>
            <Text style={styles.programEmptyText}>
              {loading ? '読み込み中...' : '参加中のプログラムはありません'}
            </Text>
          </View>
        )}

        {/* ── My筋トレ ─────────────────────────── */}
        <View style={styles.myWorkoutHeader}>
          <Text style={styles.sectionTitle2}>My筋トレ</Text>
          <TouchableOpacity
            style={styles.myWorkoutAddBtn}
            activeOpacity={0.75}
            onPress={() => router.push('/(screens)/workout-template-edit')}>
            <IconSymbol name="plus" size={14} color={Colors.primaryDark} />
            <Text style={styles.myWorkoutAddBtnText}>新規追加</Text>
          </TouchableOpacity>
        </View>
        {templates.length === 0 ? (
          <View style={styles.programEmptyCard}>
            <Text style={styles.programEmptyText}>
              {loading ? '読み込み中...' : 'よく行う筋トレを登録しておくと、カレンダーからワンタップで登録できます'}
            </Text>
          </View>
        ) : (
          templates.map(t => (
            <TouchableOpacity
              key={t.id}
              style={styles.myWorkoutCard}
              activeOpacity={0.75}
              onPress={() => router.push(`/(screens)/workout-template-edit?templateId=${t.id}`)}>
              <View style={styles.myWorkoutInfo}>
                <Text style={styles.myWorkoutName}>{t.name}</Text>
                <Text style={styles.myWorkoutMeta}>{t.exercise_count}種目</Text>
              </View>
              <TouchableOpacity hitSlop={8} onPress={() => handleDeleteTemplate(t)}>
                <IconSymbol name="trash" size={18} color={Colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

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

      <Modal
        visible={maxModalExercise != null}
        transparent
        animationType="fade"
        onRequestClose={() => setMaxModalExercise(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>{maxModalExercise?.name}の1RMを登録</Text>
            <TextInput
              style={styles.maxModalInput}
              value={maxModalValue}
              onChangeText={setMaxModalValue}
              keyboardType="numeric"
              placeholder="例: 100"
              placeholderTextColor={Colors.textHint}
              autoFocus
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setMaxModalExercise(null)}>
                <Text style={styles.dialogCancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogSaveBtn}
                disabled={maxModalSaving || maxModalValue.trim() === ''}
                onPress={handleSaveMax}>
                {maxModalSaving ? (
                  <ActivityIndicator color={Colors.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.dialogSaveBtnText}>登録</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },

  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },

  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    marginBottom: Space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space[2],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, flex: 1 },
  retryBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radius.sm,
    backgroundColor: Colors.error,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

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
  big3Source: {
    fontSize: 10,
    color: Colors.textHint,
  },
  big3Hint: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginBottom: Space[5],
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

  // ── 参加プログラム
  programCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[5],
    gap: Space[1],
    ...Shadow.sm,
  },
  programCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  programName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  programProgress: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  programLeaveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[2],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  programLeaveBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.error,
  },
  programEmptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[5],
    alignItems: 'center',
    marginBottom: Space[5],
    ...Shadow.sm,
  },
  programEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    textAlign: 'center',
    paddingHorizontal: Space[4],
  },

  // ── My筋トレ
  myWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
    marginTop: Space[1],
  },
  myWorkoutAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[1],
    paddingHorizontal: Space[3],
    paddingVertical: Space[1] + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
  },
  myWorkoutAddBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  myWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  myWorkoutInfo: { flex: 1 },
  myWorkoutName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  myWorkoutMeta: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    marginTop: 2,
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
  maxModalInput: {
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space[3],
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Space[2],
  },
  dialogSaveBtn: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSaveBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});
