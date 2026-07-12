import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { bulkDeleteSessions, listSessions, type SessionRow } from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

type UsedFilter = 'all' | 'used' | 'unused';

function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'confirm' in window) {
      resolve(window.confirm(message));
    } else {
      Alert.alert('確認', message, [
        { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
        { text: '削除', style: 'destructive', onPress: () => resolve(true) },
      ]);
    }
  });
}

export default function DeleteScreen() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [used, setUsed] = useState<UsedFilter>('all');

  const load = useCallback(async () => {
    try {
      const list = await listSessions({
        search: search.trim() || undefined,
        used: used === 'all' ? undefined : used,
        sort: 'id',
        order: 'desc',
      });
      setSessions(list);
      // Drop selections that no longer exist.
      setSelected((prev) => new Set([...prev].filter((id) => list.some((s) => s.id === id))));
    } catch (e: any) {
      Alert.alert('読み込み失敗', e.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, used]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(sessions.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  const handleDelete = async () => {
    if (selected.size === 0) return;
    const ok = await confirm(
      `${selected.size} 件のデータを削除します。\n含まれるフレームサンプルもすべて削除されます。\n本当によろしいですか？`,
    );
    if (!ok) return;

    setBusy(true);
    try {
      const r = await bulkDeleteSessions(Array.from(selected));
      setSelected(new Set());
      await load();
      Alert.alert('削除完了', `${r.deleted} 件を削除しました`);
    } catch (e: any) {
      Alert.alert('削除失敗', e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = selected.size;
  const totalSize = useMemo(
    () => sessions.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + (s.total_frames ?? 0), 0),
    [sessions, selected],
  );

  if (loading && sessions.length === 0) {
    return (
      <View style={[sharedStyles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <FlatList
        contentContainerStyle={sharedStyles.scrollContent}
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <Text style={sharedStyles.title}>データ削除</Text>
            <Text style={sharedStyles.subtitle}>
              撮影した運動データを削除します。削除すると元に戻せません。
            </Text>

            <TextInput
              style={sharedStyles.textInput}
              placeholder="運動名で検索"
              placeholderTextColor={colors.textDim}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={load}
            />

            <View style={[sharedStyles.row, { flexWrap: 'wrap' }]}>
              <Text style={styles.filterLabel}>状態:</Text>
              {(['all', 'unused', 'used'] as UsedFilter[]).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUsed(u)}
                  style={[styles.chip, used === u && styles.chipActive]}
                >
                  <Text style={[styles.chipText, used === u && styles.chipTextActive]}>
                    {u === 'all' ? '全部' : u === 'unused' ? '未使用' : '使用済'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={sharedStyles.row}>
              <Pressable style={[sharedStyles.buttonSecondary, { flex: 1 }]} onPress={selectAll}>
                <Text style={sharedStyles.buttonSecondaryText}>全選択</Text>
              </Pressable>
              <Pressable style={[sharedStyles.buttonSecondary, { flex: 1 }]} onPress={clearAll}>
                <Text style={sharedStyles.buttonSecondaryText}>選択解除</Text>
              </Pressable>
            </View>

            <Text style={[sharedStyles.subtitle, { marginTop: 4 }]}>
              {sessions.length} 件表示中 ・ 選択 {selectedCount} 件 / {totalSize} フレーム
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[sharedStyles.subtitle, { padding: 24, textAlign: 'center' }]}>
            条件に一致するデータがありません
          </Text>
        }
        renderItem={({ item }) => {
          const isSel = selected.has(item.id);
          const frames =
            item.end_frame != null && item.start_frame != null
              ? item.end_frame - item.start_frame + 1
              : (item.total_frames ?? 0);
          return (
            <Pressable
              style={[
                sharedStyles.card,
                isSel && { borderColor: colors.danger, borderWidth: 2 },
              ]}
              onPress={() => toggle(item.id)}
            >
              <View style={[sharedStyles.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    #{item.id} {item.exercise_name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.recorded_at ? item.recorded_at.slice(0, 19).replace('T', ' ') : '—'}
                  </Text>
                  <Text style={styles.itemMeta}>{frames} フレーム</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {item.used && (
                    <Text style={styles.usedBadge}>使用済</Text>
                  )}
                  <View
                    style={[
                      styles.checkbox,
                      isSel && { backgroundColor: colors.danger, borderColor: colors.danger },
                    ]}
                  >
                    {isSel && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Pressable
          style={[
            sharedStyles.buttonDanger,
            (selectedCount === 0 || busy) && sharedStyles.buttonDisabled,
          ]}
          onPress={handleDelete}
          disabled={selectedCount === 0 || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sharedStyles.buttonPrimaryText}>
              {selectedCount > 0 ? `${selectedCount} 件を削除` : '削除するデータを選択'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  filterLabel: {
    color: colors.textDim,
    fontSize: 13,
    marginRight: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textDim, fontSize: 12 },
  chipTextActive: { color: '#fff' },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  itemMeta: {
    color: colors.textDim,
    fontSize: 12,
  },
  usedBadge: {
    color: colors.used,
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.used,
    borderRadius: 4,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
});
