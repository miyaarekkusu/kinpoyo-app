// フォロワー/フォロー中の一覧画面（2026-08-30新規追加）。
// AGENTS.md『フォロー機能の拡充』参照：user-profile.tsxのフォロワー数/
// フォロー中数のタップから遷移する。modeパラメータで表示を切り替える。
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
import { Colors, FontSize, FontWeight, Layout, Radius, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import {
  fetchFollowers,
  fetchFollowing,
  followUser,
  unfollowUser,
  type UserSearchResult,
} from '@/services/user';

type Mode = 'followers' | 'following';

export default function FollowListScreen() {
  const params = useLocalSearchParams<{ userId: string; mode: Mode }>();
  const userId = Number(params.userId);
  const mode: Mode = params.mode === 'following' ? 'following' : 'followers';
  const { token } = useAuth();

  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(userId)) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = mode === 'followers'
        ? await fetchFollowers(token, userId)
        : await fetchFollowing(token, userId);
      setUsers(data);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token, userId, mode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFollow = async (user: UserSearchResult) => {
    if (busyUserId != null) return;
    setBusyUserId(user.id);
    try {
      if (user.is_following) {
        await unfollowUser(token, user.id);
      } else {
        await followUser(token, user.id);
      }
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, is_following: !u.is_following } : u)));
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : '処理に失敗しました');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'followers' ? 'フォロワー' : 'フォロー中'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
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
      ) : users.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>
            {mode === 'followers' ? 'フォロワーはまだいません' : 'フォロー中のユーザーはいません'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {users.map(u => (
            <View key={u.id} style={styles.row}>
              <TouchableOpacity
                style={styles.rowLeft}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: '/(screens)/user-profile', params: { userId: String(u.id) } })}>
                <Avatar uri={u.avatar_url} label={u.display_name || u.username} size={44} />
                <View>
                  <Text style={styles.name}>{u.display_name || u.username}</Text>
                  <Text style={styles.username}>@{u.username}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.followBtn, u.is_following && styles.followBtnActive]}
                disabled={busyUserId === u.id}
                onPress={() => handleToggleFollow(u)}>
                {busyUserId === u.id ? (
                  <ActivityIndicator color={u.is_following ? Colors.textPrimary : Colors.textOnPrimary} size="small" />
                ) : (
                  <Text style={[styles.followBtnText, u.is_following && styles.followBtnTextActive]}>
                    {u.is_following ? 'フォロー中' : 'フォロー'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: Space[6] }} />
        </ScrollView>
      )}
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
  emptyText: { fontSize: FontSize.sm, color: Colors.textHint },

  scroll: { paddingHorizontal: Layout.screenPaddingH, paddingTop: Space[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Space[3], flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  username: { fontSize: FontSize.xs, color: Colors.textHint, marginTop: 2 },
  followBtn: {
    paddingHorizontal: Space[4],
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  followBtnActive: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  followBtnTextActive: { color: Colors.textPrimary },
});
