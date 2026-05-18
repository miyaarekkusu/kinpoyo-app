import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deleteTag, listTags, type Tag } from '../lib/api';
import { colors, sharedStyles } from '../lib/theme';

export default function TagListScreen() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await listTags();
      setTags(t);
    } catch (e: any) {
      Alert.alert('読み込み失敗', e.message ?? String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (tag: Tag) => {
    const confirm = async () => {
      try {
        await deleteTag(tag.id);
        await load();
      } catch (e: any) {
        Alert.alert('削除失敗', e.message ?? String(e));
      }
    };
    if (typeof window !== 'undefined' && 'confirm' in window) {
      if (window.confirm(`タグ「${tag.name}」を削除しますか？\n紐付く分析結果もすべて削除されます。`)) {
        confirm();
      }
    } else {
      Alert.alert(
        `タグ「${tag.name}」を削除`,
        '紐付く分析結果もすべて削除されます。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '削除', style: 'destructive', onPress: confirm },
        ],
      );
    }
  };

  if (loading) {
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
        data={tags}
        keyExtractor={(t) => String(t.id)}
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
          <View style={{ gap: 8 }}>
            <Text style={sharedStyles.title}>タグを選んで分析を開始</Text>
            <Text style={sharedStyles.subtitle}>
              分析結果を保存する「ラベル」を選択します。新規追加もここから。
            </Text>
            <View style={[sharedStyles.row, { marginTop: 8 }]}>
              <Pressable
                style={[sharedStyles.buttonPrimary, { flex: 1 }]}
                onPress={() => router.push('/tag-new')}
              >
                <Text style={sharedStyles.buttonPrimaryText}>+ 新規タグ</Text>
              </Pressable>
              <Pressable
                style={[sharedStyles.buttonSecondary, { flex: 1 }]}
                onPress={() => router.push('/delete')}
              >
                <Text style={sharedStyles.buttonSecondaryText}>データ削除</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[sharedStyles.subtitle, { padding: 24, textAlign: 'center' }]}>
            タグがまだありません。「+ 新規タグ」で追加してください。
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={sharedStyles.card}
            onPress={() =>
              router.push({ pathname: '/select', params: { tagId: item.id } })
            }
          >
            <View style={[sharedStyles.row, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tagName}>{item.name}</Text>
                {item.description ? (
                  <Text style={sharedStyles.subtitle}>{item.description}</Text>
                ) : null}
                <Text style={styles.meta}>
                  分析 {item.analysis_count} 回 ・ 学習データ {item.session_count} 件
                </Text>
                <Text
                  style={[
                    styles.joints,
                    item.monitored_joints.length === 0 && styles.jointsWarn,
                  ]}
                >
                  {item.monitored_joints.length === 0
                    ? '⚠ 監視関節 未設定 (編集してください)'
                    : `監視: ${item.monitored_joints.join(' / ')}`}
                </Text>
              </View>
              <View style={{ gap: 8, alignItems: 'flex-end' }}>
                <Pressable
                  onPress={() => handleDelete(item)}
                  style={styles.deleteIcon}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.danger, fontSize: 18 }}>×</Text>
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation?.();
                    router.push({
                      pathname: '/tag-new',
                      params: { tagId: item.id },
                    });
                  }}
                  style={styles.editBtn}
                  hitSlop={8}
                >
                  <Text style={styles.editBtnText}>編集</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  tagName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  meta: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 6,
  },
  joints: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
  },
  jointsWarn: {
    color: colors.warning,
    fontWeight: '600',
  },
  deleteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dangerDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.cardBorder,
  },
  editBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
