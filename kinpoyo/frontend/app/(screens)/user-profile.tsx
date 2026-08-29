// 他ユーザーのプロフィール表示画面（2026-08-30新規追加）。
// AGENTS.md『フォロー機能の拡充』参照：自分専用profile.tsxとは別に、公開範囲
// （実績・フォロー状態・フォロワー数等）だけに絞って新設した。編集・My筋トレの
// CRUD・BIG3手入力・プログラム離脱等、自分専用の操作はここには置かない。
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { Avatar } from '@/components/ui/avatar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import {
  followUser,
  fetchUserProfile,
  unfollowUser,
  type PublicProfileOut,
} from '@/services/user';

function fmtHours(sec: number): string {
  const hours = sec / 3600;
  return hours >= 10 ? String(Math.round(hours)) : hours.toFixed(1);
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = Number(params.userId);
  const { token } = useAuth();

  const [profile, setProfile] = useState<PublicProfileOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(userId)) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchUserProfile(token, userId);
      setProfile(data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    try {
      if (profile.is_following) {
        await unfollowUser(token, profile.id);
        setProfile({ ...profile, is_following: false, followers_count: profile.followers_count - 1 });
      } else {
        await followUser(token, profile.id);
        setProfile({ ...profile, is_following: true, followers_count: profile.followers_count + 1 });
      }
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : '処理に失敗しました');
    } finally {
      setFollowBusy(false);
    }
  };

  const displayName = profile?.display_name || profile?.username || '';

  const STATS = profile
    ? [
        { icon: 'dumbbell.fill' as const, value: String(profile.total_workouts), unit: '回', label: '合計ワークアウト' },
        { icon: 'timer' as const, value: fmtHours(profile.total_duration_sec), unit: '時間', label: 'トレーニング時間' },
        { icon: 'flame.fill' as const, value: String(profile.weekly_streak), unit: '週', label: '週間ストリーク' },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>プロフィール</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && !profile ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : loadError ? (
        <View style={styles.centerBox}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>再読み込み</Text>
          </TouchableOpacity>
        </View>
      ) : profile ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.identityBlock}>
            <Avatar uri={profile.avatar_url} label={displayName} size={80} fontSize={FontSize['2xl']} style={styles.avatar} />
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <TouchableOpacity
              style={[styles.followBtn, profile.is_following && styles.followBtnActive]}
              activeOpacity={0.85}
              disabled={followBusy}
              onPress={handleToggleFollow}>
              {followBusy ? (
                <ActivityIndicator color={profile.is_following ? Colors.primaryDark : Colors.textOnPrimary} size="small" />
              ) : (
                <Text style={[styles.followBtnText, profile.is_following && styles.followBtnTextActive]}>
                  {profile.is_following ? 'フォロー中' : 'フォロー'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.followCountsRow}>
              <TouchableOpacity
                style={styles.followCountItem}
                onPress={() => router.push({ pathname: '/(screens)/follow-list', params: { userId: String(profile.id), mode: 'followers' } })}>
                <Text style={styles.followCountValue}>{profile.followers_count}</Text>
                <Text style={styles.followCountLabel}>フォロワー</Text>
              </TouchableOpacity>
              <View style={styles.followCountDivider} />
              <TouchableOpacity
                style={styles.followCountItem}
                onPress={() => router.push({ pathname: '/(screens)/follow-list', params: { userId: String(profile.id), mode: 'following' } })}>
                <Text style={styles.followCountValue}>{profile.following_count}</Text>
                <Text style={styles.followCountLabel}>フォロー中</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>実績</Text>
          <View style={styles.statsGrid}>
            {STATS.map((s, i) => (
              <View key={i} style={styles.statCard}>
                <View style={styles.statIconCircle}>
                  <IconSymbol name={s.icon} size={18} color={Colors.primaryDark} />
                </View>
                <Text style={styles.statValue}>
                  {s.value}
                  <Text style={styles.statUnit}>{s.unit}</Text>
                </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: Space[10] }} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },
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
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space[6], gap: Space[3] },
  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  retryBtn: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryDark,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  scroll: { paddingHorizontal: Layout.screenPaddingH, paddingTop: Space[2] },

  identityBlock: { alignItems: 'center', gap: Space[1], marginBottom: Space[6] },
  avatar: { marginBottom: Space[2] },
  displayName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  username: { fontSize: FontSize.sm, color: Colors.textHint },
  bio: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Space[2],
    paddingHorizontal: Space[6],
  },
  followBtn: {
    marginTop: Space[4],
    paddingHorizontal: Space[8],
    height: Layout.buttonHeightMd,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  followBtnActive: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  followBtnTextActive: { color: Colors.textPrimary },

  followCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space[5],
    gap: Space[6],
  },
  followCountItem: { alignItems: 'center' },
  followCountValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  followCountLabel: { fontSize: FontSize.xs, color: Colors.textHint, marginTop: 2 },
  followCountDivider: { width: 1, height: 28, backgroundColor: Colors.divider },

  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
  },
  statsGrid: { flexDirection: 'row', gap: Space[3] },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    gap: Space[1],
    ...Shadow.sm,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space[1],
  },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statUnit: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textHint },
});
