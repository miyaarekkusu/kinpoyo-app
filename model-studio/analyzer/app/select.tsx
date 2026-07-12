import { router, useLocalSearchParams } from 'expo-router';
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

import { listSessions, listTags, type SessionRow, type Tag } from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

type UsedFilter = 'all' | 'used' | 'unused';
type SortKey = 'id' | 'exercise_name' | 'recorded_at' | 'total_frames';

export default function SelectScreen() {
  const { tagId } = useLocalSearchParams<{ tagId: string }>();
  const tagIdNum = Number(tagId);

  const [tag, setTag] = useState<Tag | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [used, setUsed] = useState<UsedFilter>('unused');
  const [sort, setSort] = useState<SortKey>('id');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    try {
      const params = {
        search: search.trim() || undefined,
        used: used === 'all' ? undefined : used,
        sort,
        order,
      } as const;
      const [tagsList, list] = await Promise.all([
        listTags(),
        listSessions(params),
      ]);
      setTag(tagsList.find((t) => t.id === tagIdNum) ?? null);
      setSessions(list);
    } catch (e: any) {
      Alert.alert('読み込み失敗', e.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tagIdNum, search, used, sort, order]);

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

  const goAnalyze = () => {
    if (selected.size === 0) {
      Alert.alert('未選択', '分析するデータを1件以上選択してください');
      return;
    }
    router.push({
      pathname: '/result',
      params: {
        tagId: String(tagIdNum),
        sessionIds: Array.from(selected).join(','),
      },
    });
  };

  const selectedCount = selected.size;
  const totalFrames = useMemo(
    () =>
      sessions
        .filter((s) => selected.has(s.id))
        .reduce((sum, s) => sum + (s.total_frames ?? 0), 0),
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
            <View>
              <Text style={sharedStyles.title}>{tag?.name ?? '...'}</Text>
              <Text style={sharedStyles.subtitle}>
                既存学習データ {tag?.session_count ?? 0} 件 / 過去分析 {tag?.analysis_count ?? 0} 回
              </Text>
            </View>

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

            <View style={[sharedStyles.row, { flexWrap: 'wrap' }]}>
              <Text style={styles.filterLabel}>並び:</Text>
              {([
                ['id', 'ID'],
                ['recorded_at', '撮影日'],
                ['exercise_name', '運動名'],
                ['total_frames', 'フレーム数'],
              ] as [SortKey, string][]).map(([k, label]) => (
                <Pressable
                  key={k}
                  onPress={() => setSort(k)}
                  style={[styles.chip, sort === k && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sort === k && styles.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                style={[styles.chip, styles.chipActive]}
              >
                <Text style={[styles.chipText, styles.chipTextActive]}>
                  {order === 'desc' ? '↓ 降順' : '↑ 昇順'}
                </Text>
              </Pressable>
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
              {sessions.length} 件表示中 ・ 選択 {selectedCount} 件 / 合計 {totalFrames} フレーム
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
          const dur =
            item.fps && item.fps > 0 ? (frames / item.fps).toFixed(1) : '—';
          return (
            <Pressable
              style={[
                sharedStyles.card,
                isSel && { borderColor: colors.accent, borderWidth: 2 },
                item.used && !isSel && { opacity: 0.65 },
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
                  <Text style={styles.itemMeta}>
                    {frames} f / {dur} s @ {item.fps?.toFixed?.(1) ?? '—'} fps
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {item.used && (
                    <Text style={styles.usedBadge}>使用済</Text>
                  )}
                  <View
                    style={[
                      styles.checkbox,
                      isSel && { backgroundColor: colors.accent, borderColor: colors.accent },
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
            sharedStyles.buttonPrimary,
            selectedCount === 0 && sharedStyles.buttonDisabled,
          ]}
          onPress={goAnalyze}
          disabled={selectedCount === 0}
        >
          <Text style={sharedStyles.buttonPrimaryText}>
            {selectedCount > 0 ? `${selectedCount}件で分析` : 'データを選択してください'}
          </Text>
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
