import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NotificationsModal } from '@/components/notifications-modal';
import { AppHeader, PageTitleBar } from '@/components/ui/app-header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space,
} from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError, toAbsoluteMediaUrl } from '@/services/api';
import { fetchMe, type UserOut } from '@/services/auth';
import {
  CommentOut,
  PostAuthor,
  PostOut,
  PostTypeKey,
  addComment,
  createPost,
  deletePost,
  fetchComments,
  fetchPosts,
  likePost,
  unlikePost,
  updatePost,
  uploadPostImages,
} from '@/services/community';
import {
  UserSearchResult,
  followUser,
  searchUsers,
  unfollowUser,
} from '@/services/user';

// ─── Types ────────────────────────────────────────────────────

type TabKey = 'follow' | 'feed' | 'qa';

// ─── ユーティリティ ───────────────────────────────────────────

function initialOf(author: PostAuthor): string {
  return (author.display_name || author.username).charAt(0).toUpperCase();
}
function nameOf(author: PostAuthor): string {
  return author.display_name || author.username;
}
// ImagePickerが返すローカルURI（file://等）か、バックエンドが返した相対URLかを判別
function isLocalUri(uri: string): boolean {
  return !uri.startsWith('/') && !uri.startsWith('http');
}
function displayImageUri(uri: string): string {
  return isLocalUri(uri) ? uri : toAbsoluteMediaUrl(uri);
}
function timeAgoJa(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return '今';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}日前`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}ヶ月前`;
  return `${Math.floor(diffMonth / 12)}年前`;
}

// ─── Main Screen ──────────────────────────────────────────────

export default function CommunityScreen() {
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('follow');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostOut | null>(null);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followSearch, setFollowSearch] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<PostOut | null>(null);
  const [postModalKey, setPostModalKey] = useState(0);
  const [deletingPost, setDeletingPost] = useState<PostOut | null>(null);

  const [me, setMe] = useState<UserOut | null>(null);
  const [feedPosts, setFeedPosts] = useState<PostOut[]>([]);
  const [qaPosts, setQaPosts] = useState<PostOut[]>([]);
  const [followingPosts, setFollowingPosts] = useState<PostOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [meOut, feed, qa, following] = await Promise.all([
        fetchMe(token),
        fetchPosts(token, 'feed', 'all'),
        fetchPosts(token, 'qa', 'all'),
        fetchPosts(token, 'feed', 'following'),
      ]);
      setMe(meOut);
      setFeedPosts(feed);
      setQaPosts(qa);
      setFollowingPosts(following);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const myInitial = me ? me.username.charAt(0).toUpperCase() : 'K';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'follow', label: 'フォロー中' },
    { key: 'feed',   label: 'フィード' },
    { key: 'qa',     label: 'Q&A' },
  ];

  // 投稿の更新を、表示中の全リスト＋詳細画面に反映する
  const applyPostUpdate = (updated: PostOut) => {
    const patch = (list: PostOut[]) => list.map(p => (p.id === updated.id ? updated : p));
    setFeedPosts(patch);
    setQaPosts(patch);
    setFollowingPosts(patch);
    setSelectedPost(prev => (prev && prev.id === updated.id ? updated : prev));
  };

  const bumpCommentCount = (postId: number) => {
    const patch = (list: PostOut[]) =>
      list.map(p => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
    setFeedPosts(patch);
    setQaPosts(patch);
    setFollowingPosts(patch);
    setSelectedPost(prev => (prev && prev.id === postId ? { ...prev, comments_count: prev.comments_count + 1 } : prev));
  };

  const handleToggleLike = async (post: PostOut) => {
    try {
      const updated = post.liked_by_me ? await unlikePost(token, post.id) : await likePost(token, post.id);
      applyPostUpdate(updated);
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : 'いいねに失敗しました');
    }
  };

  // ローカルで選んだ画像だけアップロードし、既存の（アップロード済み）URLと
  // 元の並び順を保ったままマージする
  const resolveImageUrls = async (images: string[]): Promise<string[]> => {
    const localUris = images.filter(isLocalUri);
    const uploaded = localUris.length > 0 ? await uploadPostImages(token, localUris) : [];
    let j = 0;
    return images.map(uri => (isLocalUri(uri) ? uploaded[j++] : uri));
  };

  const handleCreatePost = async (type: PostTypeKey, title: string, body: string, images: string[]) => {
    const imageUrls = await resolveImageUrls(images);
    const created = await createPost(token, { post_type: type, title: title || null, body, image_urls: imageUrls });
    if (type === 'feed') {
      setFeedPosts(prev => [created, ...prev]);
    } else {
      setQaPosts(prev => [created, ...prev]);
    }
    setActiveTab(type);
    setShowCreateModal(false);
  };

  const handleUpdatePost = async (_type: PostTypeKey, title: string, body: string, images: string[]) => {
    if (!editingPost) return;
    const imageUrls = await resolveImageUrls(images);
    const updated = await updatePost(token, editingPost.id, { title: title || null, body, image_urls: imageUrls });
    applyPostUpdate(updated);
    setEditingPost(null);
  };

  const handleDeletePost = async (post: PostOut) => {
    try {
      await deletePost(token, post.id);
      const remove = (list: PostOut[]) => list.filter(p => p.id !== post.id);
      setFeedPosts(remove);
      setQaPosts(remove);
      setFollowingPosts(remove);
      setSelectedPost(null);
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : '削除に失敗しました');
    }
  };

  const openCreateModal = () => {
    setPostModalKey(k => k + 1);
    setShowCreateModal(true);
  };

  const openEditModal = (post: PostOut) => {
    setSelectedPost(null);
    setPostModalKey(k => k + 1);
    setEditingPost(post);
  };

  const toggleSearch = () => {
    setSearchVisible(prev => !prev);
    setSearchQuery('');
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filterByQuery = (data: PostOut[]) => {
    if (!normalizedQuery) return data;
    return data.filter(item =>
      (item.title ?? '').toLowerCase().includes(normalizedQuery)
      || item.body.toLowerCase().includes(normalizedQuery)
      || nameOf(item.author).toLowerCase().includes(normalizedQuery)
    );
  };

  const filteredFeedData = filterByQuery(feedPosts);
  const filteredQaData = filterByQuery(qaPosts);
  const searchEmptyMessage = normalizedQuery ? '一致する投稿が見つかりませんでした' : undefined;

  // ── ユーザー検索・フォロー ──────────────────────
  const [followResults, setFollowResults] = useState<UserSearchResult[]>([]);
  const [followSearchLoading, setFollowSearchLoading] = useState(false);

  useEffect(() => {
    const q = followSearch.trim();
    if (!q) {
      setFollowResults([]);
      return;
    }
    let cancelled = false;
    setFollowSearchLoading(true);
    const timer = setTimeout(() => {
      searchUsers(token, q)
        .then(res => { if (!cancelled) setFollowResults(res); })
        .catch(() => { if (!cancelled) setFollowResults([]); })
        .finally(() => { if (!cancelled) setFollowSearchLoading(false); });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [followSearch, token]);

  const handleToggleFollow = async (user: UserSearchResult) => {
    try {
      if (user.is_following) {
        await unfollowUser(token, user.id);
      } else {
        await followUser(token, user.id);
      }
      setFollowResults(prev =>
        prev.map(u => (u.id === user.id ? { ...u, is_following: !u.is_following } : u))
      );
      const posts = await fetchPosts(token, 'feed', 'following');
      setFollowingPosts(posts);
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : '処理に失敗しました');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <AppHeader onBellPress={() => setShowNotifModal(true)} />
      <PageTitleBar
        title="コミュニティー"
        right={
          <View style={s.headerRight}>
            <TouchableOpacity style={s.headerBtn} onPress={toggleSearch} hitSlop={8}>
              <IconSymbol
                name={searchVisible ? 'xmark' : 'magnifyingglass'}
                size={22}
                color={Colors.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{myInitial}</Text>
              </View>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Bar */}
      {searchVisible && (
        <View style={s.searchBarContainer}>
          <MaterialIcons name="search" size={20} color={Colors.textHint} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="投稿を検索"
            placeholderTextColor={Colors.textHint}
            style={s.searchBarInput}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={Colors.textHint} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tab Bar */}
      <View style={s.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabPill, activeTab === tab.key && s.tabPillActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {loading && (
          <View style={s.centerBox}>
            <ActivityIndicator color={Colors.primaryDark} />
          </View>
        )}
        {!loading && loadError && (
          <View style={s.centerBox}>
            <View style={s.errorBox}>
              <Text style={s.errorText}>{loadError}</Text>
            </View>
            <TouchableOpacity style={s.retryBtn} onPress={loadAll}>
              <Text style={s.retryBtnText}>再読み込み</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !loadError && (
          <>
            {activeTab === 'follow' && (
              followingPosts.length === 0 ? (
                <FollowTab onSearchPress={() => setShowFollowModal(true)} />
              ) : (
                <FeedTab
                  data={followingPosts}
                  meId={me?.id ?? null}
                  onPostPress={setSelectedPost}
                  onEdit={openEditModal}
                  onDelete={setDeletingPost}
                  onToggleLike={handleToggleLike}
                />
              )
            )}
            {activeTab === 'feed' && (
              <FeedTab
                data={filteredFeedData}
                emptyMessage={searchEmptyMessage}
                meId={me?.id ?? null}
                onPostPress={setSelectedPost}
                onEdit={openEditModal}
                onDelete={setDeletingPost}
                onToggleLike={handleToggleLike}
              />
            )}
            {activeTab === 'qa' && (
              <FeedTab
                data={filteredQaData}
                emptyMessage={searchEmptyMessage}
                meId={me?.id ?? null}
                onPostPress={setSelectedPost}
                onEdit={openEditModal}
                onDelete={setDeletingPost}
                onToggleLike={handleToggleLike}
              />
            )}
          </>
        )}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={openCreateModal}
      >
        <MaterialIcons name="edit" size={24} color="#fff" />
      </TouchableOpacity>

      {/* ── ユーザー検索 Modal ───────────────────────────────── */}
      <Modal
        visible={showFollowModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowFollowModal(false);
          setShowQrModal(false);
        }}
        onDismiss={() => {
          setShowFollowModal(false);
          setShowQrModal(false);
        }}
      >
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (showQrModal) {
                  setShowQrModal(false);
                } else {
                  setShowFollowModal(false);
                }
              }}
              style={s.iconBtn}>
              <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>{showQrModal ? 'マイQRコード' : 'ユーザー検索'}</Text>
            <View style={s.iconBtn} />
          </View>

          {showQrModal ? (
            <View style={s.qrContainer}>
              <View style={s.qrCodeBox}>
                <QRCode value={me?.username ?? 'kinpoyo'} size={220} />
              </View>
              <Text style={s.qrIdText}>ID: {me?.username ?? '-'}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.modalBody}>
              {/* Search Input */}
              <View style={s.searchBox}>
                <TextInput
                  value={followSearch}
                  onChangeText={setFollowSearch}
                  placeholder="IDで友達を検索してフォローしましょう"
                  placeholderTextColor={Colors.textHint}
                  style={s.searchInput}
                />
              </View>

              {followSearch.trim() ? (
                followSearchLoading ? (
                  <View style={s.searchResultLoading}>
                    <ActivityIndicator color={Colors.primaryDark} />
                  </View>
                ) : followResults.length === 0 ? (
                  <View style={s.searchResultLoading}>
                    <Text style={s.emptyText}>ユーザーが見つかりませんでした</Text>
                  </View>
                ) : (
                  followResults.map(u => (
                    <View key={u.id} style={s.followResultRow}>
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>
                          {(u.display_name || u.username).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={s.followResultInfo}>
                        <Text style={s.followResultName}>{u.display_name || u.username}</Text>
                        <Text style={s.followResultUsername}>@{u.username}</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.followToggleBtn, u.is_following && s.followToggleBtnActive]}
                        onPress={() => handleToggleFollow(u)}
                      >
                        <Text style={[s.followToggleBtnText, u.is_following && s.followToggleBtnTextActive]}>
                          {u.is_following ? 'フォロー中' : 'フォロー'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )
              ) : (
                /* My ID Card */
                <View style={s.userIdCard}>
                  <View style={[s.avatar, { backgroundColor: Colors.error }]}>
                    <Text style={s.avatarText}>{myInitial}</Text>
                  </View>
                  <Text style={s.userIdText}>ID: {me?.username ?? '-'}</Text>
                  <TouchableOpacity style={s.shareBtn} onPress={() => setShowQrModal(true)}>
                    <MaterialIcons name="qr-code-2" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.shareBtn}>
                    <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* ── 投稿詳細 Modal ──────────────────────────────────── */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedPost(null)}
      >
        {selectedPost && (
          <PostDetailScreen
            post={selectedPost}
            meId={me?.id ?? null}
            token={token}
            onClose={() => setSelectedPost(null)}
            onEdit={openEditModal}
            onDelete={handleDeletePost}
            onToggleLike={handleToggleLike}
            onCommentAdded={bumpCommentCount}
          />
        )}
      </Modal>

      {/* ── 投稿作成・編集 Modal ──────────────────────────────── */}
      <Modal visible={showCreateModal || !!editingPost} animationType="slide" presentationStyle="pageSheet">
        <PostCreateScreen
          key={postModalKey}
          initialPost={editingPost}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPost(null);
          }}
          onSubmit={editingPost ? handleUpdatePost : handleCreatePost}
        />
      </Modal>

      {/* ── 削除確認 Modal（投稿一覧から） ───────────────────── */}
      <Modal
        visible={!!deletingPost}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingPost(null)}
      >
        {deletingPost && (
          <DeleteConfirmDialog
            onCancel={() => setDeletingPost(null)}
            onConfirm={() => {
              const target = deletingPost;
              setDeletingPost(null);
              handleDeletePost(target);
            }}
          />
        )}
      </Modal>

      {/* ── 通知 Modal ──────────────────────────────────────── */}
      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

// ─── フォロー中タブ（空状態） ──────────────────────────────────

function FollowTab({ onSearchPress }: { onSearchPress: () => void }) {
  return (
    <View style={s.emptyState}>
      <MaterialIcons name="person-outline" size={72} color={Colors.textHint} />
      <Text style={s.emptyText}>友達を追加して一緒にトレーニングしよう</Text>
      <TouchableOpacity style={s.findFriendBtn} onPress={onSearchPress}>
        <Text style={s.findFriendBtnText}>友達を探す</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── フィード / Q&A タブ ──────────────────────────────────────

function FeedTab({
  data,
  emptyMessage,
  meId,
  onPostPress,
  onEdit,
  onDelete,
  onToggleLike,
}: {
  data: PostOut[];
  emptyMessage?: string;
  meId: number | null;
  onPostPress: (p: PostOut) => void;
  onEdit: (post: PostOut) => void;
  onDelete: (post: PostOut) => void;
  onToggleLike: (post: PostOut) => void;
}) {
  if (data.length === 0 && emptyMessage) {
    return (
      <View style={s.searchEmptyState}>
        <MaterialIcons name="search-off" size={56} color={Colors.textHint} />
        <Text style={s.searchEmptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.feedList} showsVerticalScrollIndicator={false}>
      {data.map(item => {
        const isOwn = item.author.id === meId;
        return (
          <View key={item.id} style={s.postCard}>
            {/* ユーザー行＋タイトル・本文: タップで詳細へ */}
            <TouchableOpacity onPress={() => onPostPress(item)} activeOpacity={0.85}>
              <View style={s.postUserRow}>
                <View style={s.smallAvatar}>
                  <Text style={s.smallAvatarText}>{initialOf(item.author)}</Text>
                </View>
                <Text style={s.postUser}>{nameOf(item.author)}</Text>
                <Text style={s.postTime}> · {timeAgoJa(item.created_at)}</Text>
              </View>
              {!!item.title && (
                <Text style={s.postTitle} numberOfLines={2}>{item.title}</Text>
              )}
              <Text style={s.postBody} numberOfLines={3}>{item.body}</Text>
            </TouchableOpacity>

            {/* 画像: 独立した横スクロール */}
            {item.image_urls.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.mediaScrollContent}
                style={s.mediaScroll}
              >
                {item.image_urls.map((uri, i) => (
                  <Image key={i} source={{ uri: toAbsoluteMediaUrl(uri) }} style={s.mediaSquare} contentFit="cover" />
                ))}
              </ScrollView>
            )}

            {/* アクション行: 自分の投稿は編集・削除、いいねとコメントは右側 */}
            <View style={s.postActions}>
              <View style={s.postActionsLeft}>
                {isOwn && (
                  <>
                    <TouchableOpacity onPress={() => onEdit(item)}>
                      <Text style={s.textActionBtn}>編集</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item)}>
                      <Text style={[s.textActionBtn, s.textActionBtnDanger]}>削除</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
              <View style={s.postActionsRight}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => onToggleLike(item)}
                >
                  <MaterialIcons
                    name={item.liked_by_me ? 'thumb-up' : 'thumb-up-off-alt'}
                    size={20}
                    color={item.liked_by_me ? Colors.primary : Colors.textHint}
                  />
                  <Text style={s.actionCount}> {item.likes_count}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => onPostPress(item)}
                >
                  <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.textHint} />
                  <Text style={s.actionCount}> {item.comments_count}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── 投稿詳細画面 ──────────────────────────────────────────────

function PostDetailScreen({
  post,
  meId,
  token,
  onClose,
  onEdit,
  onDelete,
  onToggleLike,
  onCommentAdded,
}: {
  post: PostOut;
  meId: number | null;
  token: string | null;
  onClose: () => void;
  onEdit: (post: PostOut) => void;
  onDelete: (post: PostOut) => void;
  onToggleLike: (post: PostOut) => void;
  onCommentAdded: (postId: number) => void;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isOwnPost = post.author.id === meId;

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    fetchComments(token, post.id)
      .then(list => { if (!cancelled) setComments(list); })
      .catch(() => { if (!cancelled) setComments([]); })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [token, post.id]);

  const sortedComments = sortBy === 'popular'
    ? [...comments].sort((a, b) => b.likes_count - a.likes_count)
    : comments;

  const handleSend = async () => {
    const text = commentText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const created = await addComment(token, post.id, text);
      setComments(prev => [...prev, created]);
      setCommentText('');
      onCommentAdded(post.id);
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : 'コメントの送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const insets = useSafeAreaInsets();
  const isEdited = post.updated_at !== post.created_at;

  return (
    <View style={s.safe}>
      {/* ヘッダー: ノッチ分を paddingTop で確保 */}
      <View style={[s.detailHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onClose} style={s.iconBtn}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        {isOwnPost && (
          <View style={s.detailHeaderActions}>
            <TouchableOpacity onPress={() => onEdit(post)} style={s.detailHeaderTextBtn}>
              <Text style={s.textActionBtn}>編集</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={s.detailHeaderTextBtn}>
              <Text style={[s.textActionBtn, s.textActionBtnDanger]}>削除</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={s.detailBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 画像（複数ある場合はmain画像＋サムネイル一覧） */}
          {post.image_urls.length > 0 && (
            <View style={s.detailImageSection}>
              <Image
                source={{ uri: toAbsoluteMediaUrl(post.image_urls[mainImageIndex]) }}
                style={s.detailImagePlaceholder}
                contentFit="cover"
              />
              {post.image_urls.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.detailThumbRow}
                >
                  {post.image_urls.map((uri, i) => (
                    i !== mainImageIndex && (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setMainImageIndex(i)}
                        style={s.detailThumb}
                      >
                        <Image source={{ uri: toAbsoluteMediaUrl(uri) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      </TouchableOpacity>
                    )
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Q&A: タイトル先頭表示 */}
          {post.post_type !== 'feed' && !!post.title && (
            <Text style={s.detailTitle}>{post.title}</Text>
          )}

          {/* 投稿者行 */}
          <View style={[s.postUserRow, { marginTop: Space[2] }]}>
            <View style={s.smallAvatar}>
              <Text style={s.smallAvatarText}>{initialOf(post.author)}</Text>
            </View>
            <Text style={s.postUser}>{nameOf(post.author)}</Text>
            {isEdited && <Text style={s.editedTag}> · 編集済み</Text>}
          </View>

          {/* 本文 */}
          <Text style={s.detailBodyText}>{post.body}</Text>

          {/* いいね・ブックマーク */}
          <View style={s.detailActions}>
            <TouchableOpacity onPress={() => onToggleLike(post)} style={s.actionBtn}>
              <MaterialIcons
                name={post.liked_by_me ? 'thumb-up' : 'thumb-up-off-alt'}
                size={24}
                color={post.liked_by_me ? Colors.primary : Colors.textHint}
              />
              <Text style={s.actionCount}> {post.likes_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBookmarked(p => !p)} style={s.actionBtn}>
              <MaterialIcons
                name={bookmarked ? 'bookmark' : 'bookmark-border'}
                size={24}
                color={bookmarked ? Colors.primary : Colors.textHint}
              />
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* コメントヘッダー */}
          <View style={s.commentsHeader}>
            <Text style={s.commentsTitle}>コメント {comments.length}件</Text>
            <View style={s.sortRow}>
              <TouchableOpacity onPress={() => setSortBy('recent')}>
                <Text style={sortBy === 'recent' ? s.sortActive : s.sortInactive}>最近</Text>
              </TouchableOpacity>
              <Text style={s.sortDivider}> | </Text>
              <TouchableOpacity onPress={() => setSortBy('popular')}>
                <Text style={sortBy === 'popular' ? s.sortActive : s.sortInactive}>人気</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* コメント一覧 */}
          {commentsLoading ? (
            <ActivityIndicator color={Colors.primaryDark} />
          ) : (
            sortedComments.map(c => {
              const isAuthorReply = c.author.id === post.author.id;
              return (
                <View key={c.id} style={[s.commentItem, isAuthorReply && s.commentAuthorBg]}>
                  <View style={s.smallAvatar}>
                    <Text style={s.smallAvatarText}>{initialOf(c.author)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.commentUser}>
                      {nameOf(c.author)}
                      {isAuthorReply && <Text style={s.authorBadge}> 主</Text>}
                    </Text>
                    <Text style={s.commentText}>{c.body}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* コメント入力バー: ホームインジケーター分を paddingBottom で確保 */}
        <View style={[s.commentInputRow, { paddingBottom: insets.bottom || Space[3] }]}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="コメントを入力"
            placeholderTextColor={Colors.textHint}
            style={s.commentInput}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!sending}
          />
          <TouchableOpacity onPress={handleSend} disabled={sending}>
            {sending ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={[s.sendBtn, !commentText.trim() && { color: Colors.textHint }]}>
                送信
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 削除確認: ネストしたModalを避け、画面内オーバーレイで表示 */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => onDelete(post)}
        />
      )}
    </View>
  );
}

// ─── 削除確認ダイアログ ────────────────────────────────────────

function DeleteConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={s.dialogOverlay}>
      <View style={s.dialogBox}>
        <Text style={s.dialogTitle}>投稿を削除しますか？</Text>
        <Text style={s.dialogMessage}>削除すると元に戻せません。</Text>
        <View style={s.dialogActions}>
          <TouchableOpacity style={s.dialogCancelBtn} onPress={onCancel}>
            <Text style={s.dialogCancelBtnText}>キャンセル</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dialogDeleteBtn} onPress={onConfirm}>
            <Text style={s.dialogDeleteBtnText}>削除</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── 投稿作成画面 ────────────────────────────────────────────

function PostCreateScreen({
  initialPost,
  onClose,
  onSubmit,
}: {
  initialPost?: PostOut | null;
  onClose: () => void;
  onSubmit: (type: PostTypeKey, title: string, body: string, images: string[]) => Promise<void>;
}) {
  const isEditing = !!initialPost;
  const [type, setType] = useState<PostTypeKey>(initialPost?.post_type === 'qa' ? 'qa' : 'feed');
  const [title, setTitle] = useState(initialPost?.title ?? '');
  const [body, setBody] = useState(initialPost?.body ?? '');
  const [images, setImages] = useState<string[]>(initialPost?.image_urls ?? []);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  const addImage = async () => {
    if (images.length >= 5) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', '画像を選択するには写真へのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    setImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5));
  };

  const removeImage = (uri: string) => {
    setImages(prev => prev.filter(i => i !== uri));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(type, title.trim(), body.trim(), images);
    } catch (e) {
      Alert.alert('エラー', e instanceof ApiError ? e.detail : '投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.modalHeader}>
        <TouchableOpacity onPress={onClose} style={s.iconBtn}>
          <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.modalTitle}>{isEditing ? '投稿を編集' : '投稿を作成'}</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit} style={[s.iconBtn, s.postSubmitBtn]}>
          {submitting ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={[s.postSubmitText, !canSubmit && s.postSubmitTextDisabled]}>
              {isEditing ? '更新' : '投稿'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.createBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 投稿先タイプ（編集時は変更不可のため非表示） */}
          {!isEditing && (
            <View style={s.createTypeRow}>
              <TouchableOpacity
                style={[s.tabPill, type === 'feed' && s.tabPillActive]}
                onPress={() => setType('feed')}
              >
                <Text style={[s.tabLabel, type === 'feed' && s.tabLabelActive]}>フィード</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tabPill, type === 'qa' && s.tabPillActive]}
                onPress={() => setType('qa')}
              >
                <Text style={[s.tabLabel, type === 'qa' && s.tabLabelActive]}>Q&A</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* タイトル */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={type === 'qa' ? '質問のタイトルを入力' : 'タイトルを入力'}
            placeholderTextColor={Colors.textHint}
            style={s.createTitleInput}
          />

          {/* 本文: 残りスペースを埋める */}
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={type === 'qa' ? '質問内容を入力' : '内容を入力'}
            placeholderTextColor={Colors.textHint}
            style={s.createBodyInput}
            multiline
            textAlignVertical="top"
          />

          {/* 画像添付 */}
          <View>
            <Text style={s.createSectionLabel}>画像（最大5枚）</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.createImageRow}
            >
              {images.map(uri => (
                <View key={uri} style={s.createImagePreview}>
                  <Image source={{ uri: displayImageUri(uri) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <TouchableOpacity onPress={() => removeImage(uri)} style={s.createImageRemoveBtn}>
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={s.createImageAddBtn} onPress={addImage}>
                  <MaterialIcons name="add-photo-alternate" size={36} color={Colors.textHint} />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },

  // ── Header ────────────────────────────────────────────────
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  headerBtn: { padding: Space[1] },
  avatar: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // ── ローディング／エラー ───────────────────────────────────
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space[3], paddingHorizontal: Space[8] },
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
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // ── Search Bar ────────────────────────────────────────────
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
    marginHorizontal: Layout.screenPaddingH,
    marginBottom: Space[3],
    paddingHorizontal: Space[3],
    height: Layout.inputHeight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  searchBarInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  searchEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[3],
    paddingHorizontal: Space[8],
    paddingBottom: 80,
  },
  searchEmptyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // ── Tab Bar ───────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    gap: Space[2],
    paddingHorizontal: Layout.screenPaddingH,
    marginBottom: Space[3],
  },
  tabPill: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabPillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  tabLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  tabLabelActive: { color: Colors.textOnPrimary },

  // ── フォロー中: Empty State ────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[4],
    paddingHorizontal: Space[8],
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  findFriendBtn: {
    backgroundColor: Colors.info,
    paddingHorizontal: Space[6],
    paddingVertical: Space[3],
    borderRadius: Radius.full,
  },
  findFriendBtnText: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },

  // ── Feed List ─────────────────────────────────────────────
  feedList: { paddingBottom: 80 },
  postCard: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  postUserRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Space[2] },
  smallAvatar: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Space[2],
  },
  smallAvatarText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  postUser: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  postTime: { fontSize: FontSize.xs, color: Colors.textHint },
  postTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Space[1],
  },
  postBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Space[2],
  },
  mediaScroll: { marginBottom: Space[2] },
  mediaScrollContent: {
    flexDirection: 'row',
    gap: Space[2],
    paddingRight: Space[2],
  },
  mediaSquare: {
    width: 130, height: 130,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space[2],
  },
  postActionsLeft: { flexDirection: 'row', gap: Space[3] },
  postActionsRight: { flexDirection: 'row', gap: Space[4] },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionCount: { fontSize: FontSize.sm, color: Colors.textHint },
  textActionBtn: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  textActionBtnDanger: { color: Colors.error },

  // ── FAB ──────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: Space[6],
    right: Space[4],
    width: 52, height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.lg,
  },

  // ── Modal共通 ─────────────────────────────────────────────
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space[2],
    paddingVertical: Space[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  iconBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  modalBody: { padding: Layout.screenPaddingH, gap: Space[3] },
  postSubmitText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  postSubmitTextDisabled: { color: Colors.textHint },
  postSubmitBtn: { marginRight: Space[2] },

  // ── 投稿作成 Modal ─────────────────────────────────────────
  createBody: {
    flexGrow: 1,
    padding: Layout.screenPaddingH,
    gap: Space[3],
  },
  createTypeRow: { flexDirection: 'row', gap: Space[2] },
  createTitleInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Space[3],
    height: Layout.inputHeight,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  createBodyInput: {
    flex: 1,
    minHeight: 100,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Space[3],
    paddingVertical: Space[3],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  createSectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  createImageRow: { flexDirection: 'row', gap: Space[3] },
  createImagePreview: {
    width: 110, height: 110,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  createImageRemoveBtn: {
    position: 'absolute',
    top: 6, right: 6,
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createImageAddBtn: {
    width: 110, height: 110,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── ユーザー検索 Modal ─────────────────────────────────────
  searchBox: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Space[3],
    height: Layout.inputHeight,
    justifyContent: 'center',
  },
  searchInput: { fontSize: FontSize.base, color: Colors.textPrimary },
  searchResultLoading: { paddingVertical: Space[8], alignItems: 'center' },
  followResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    paddingVertical: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  followResultInfo: { flex: 1 },
  followResultName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  followResultUsername: { fontSize: FontSize.xs, color: Colors.textHint, marginTop: 1 },
  followToggleBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryDark,
  },
  followToggleBtnActive: { backgroundColor: Colors.bgScreen, borderColor: Colors.border },
  followToggleBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  followToggleBtnTextActive: { color: Colors.textSecondary },
  userIdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    backgroundColor: Colors.bgCard,
    padding: Space[3],
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  userIdText: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  shareBtn: {
    width: 36, height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── マイQRコード（ユーザー検索 Modal内） ───────────────────
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[4],
    paddingHorizontal: Space[5],
  },
  qrCodeBox: {
    backgroundColor: '#FFFFFF',
    padding: Space[4],
    borderRadius: Radius.md,
  },
  qrIdText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },

  // ── 投稿詳細 Modal ─────────────────────────────────────────
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailHeaderActions: { flexDirection: 'row' },
  detailHeaderTextBtn: {
    paddingHorizontal: Space[3],
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 削除確認ダイアログ（画面内オーバーレイ） ──────────────────
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
  },
  dialogMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
  dialogDeleteBtn: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  dialogDeleteBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  detailBody: { padding: Layout.screenPaddingH, paddingBottom: Space[10] },
  detailImageSection: { marginBottom: Space[3] },
  detailImagePlaceholder: {
    width: '100%', height: 220,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailThumbRow: {
    flexDirection: 'row',
    gap: Space[2],
    marginTop: Space[2],
  },
  detailThumb: {
    width: 64, height: 64,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  detailTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[2],
    lineHeight: 28,
  },
  detailBodyText: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginTop: Space[2],
    marginBottom: Space[4],
  },
  editedTag: { fontSize: FontSize.xs, color: Colors.textHint },

  // ── いいね・ブックマーク (詳細) ────────────────────────────
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Space[3],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Space[3],
  },

  // ── コメント ──────────────────────────────────────────────
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[3],
  },
  commentsTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center' },
  sortActive: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  sortInactive: { fontSize: FontSize.sm, color: Colors.textHint },
  sortDivider: { fontSize: FontSize.sm, color: Colors.textHint },
  commentItem: {
    flexDirection: 'row',
    gap: Space[2],
    marginBottom: Space[3],
  },
  commentAuthorBg: {
    backgroundColor: Colors.primarySubtle,
    padding: Space[2],
    borderRadius: Radius.sm,
  },
  commentUser: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  commentText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  authorBadge: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── コメント入力バー ───────────────────────────────────────
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.bgCard,
  },
  commentInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  sendBtn: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginLeft: Space[3],
  },
});
