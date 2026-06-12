import React, { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NotificationsModal } from '@/components/notifications-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space,
} from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────

type TabKey = 'follow' | 'feed' | 'qa' | 'news';

interface CommentItem {
  id: string;
  user: string;
  userInitial: string;
  text: string;
  isAuthor?: boolean;
  isPro?: boolean;
}

interface FeedItem {
  id: string;
  type: 'feed' | 'qa' | 'news';
  user: string;
  userInitial: string;
  isAdmin?: boolean;
  timeAgo: string;
  title: string;
  body: string;
  imageCount?: number;
  likes: number;
  commentCount: number;
  comments?: CommentItem[];
}

// ─── Mock Data ────────────────────────────────────────────────

const FEED_DATA: FeedItem[] = [
  {
    id: 'f1',
    type: 'feed',
    user: '연하아빠 🇰🇷',
    userInitial: '연',
    timeAgo: '1時間前',
    title: '2026-06-06 等運動',
    body: '운동을 공유했어요 💪',
    imageCount: 1,
    likes: 0,
    commentCount: 0,
    comments: [],
  },
  {
    id: 'f2',
    type: 'feed',
    user: 'たろ 🇯🇵',
    userInitial: 'た',
    timeAgo: '3時間前',
    title: '2026年6月6日 腕 トレーニング',
    body: '今日からリストカール始めてみたけど上手くできない。どうやって上手くやるんだろ',
    imageCount: 3,
    likes: 2,
    commentCount: 1,
    comments: [
      {
        id: 'c1',
        user: 'ヤマダ',
        userInitial: 'ヤ',
        text: 'リストを固定して、肘を動かさないのがコツですよ！',
      },
    ],
  },
  {
    id: 'f3',
    type: 'feed',
    user: 'みき 🇯🇵',
    userInitial: 'み',
    timeAgo: '5時間前',
    title: '今日もお疲れ様でした！',
    body: '久しぶりに脚トレ。スクワットのフォームを見直したらしっくりきた気がする。明日は筋肉痛かな〜',
    likes: 1,
    commentCount: 0,
    comments: [],
  },
];

const QA_DATA: FeedItem[] = [
  {
    id: 'q1',
    type: 'qa',
    user: 'よねむ一。🇯🇵',
    userInitial: 'よ',
    timeAgo: '2日前',
    title: '[質問] ベンチプレスなどのプッシュ系？の時に左の肘が痛みます。',
    body: '左の肘の痛みでベンチプレスの重量が伸びません。\nベンチの姿勢もよくわかっていないままちから任せにしてしまったせいなのか、、、\n安静にして、痛みが消えても、再開したらまたすぐに痛みます。対処法はありませんかね、、、',
    likes: 0,
    commentCount: 2,
    comments: [
      {
        id: 'c1',
        user: '덤벨수집가',
        userInitial: '덤',
        text: 'もしグリップが狭すぎるのではないでしょうか？それとも手首が折れすぎる場合も、肘に痛みが行くと言いました。',
      },
      {
        id: 'c2',
        user: 'よねむ一。🇯🇵',
        userInitial: 'よ',
        isAuthor: true,
        text: '気をつけて次はやってみます！',
      },
    ],
  },
  {
    id: 'q2',
    type: 'qa',
    user: 'tsukii 🇯🇵',
    userInitial: 'ts',
    timeAgo: '4日前',
    title: '[質問] Drax Roman Chairの調節方法',
    body: 'どなたかDrax製のRoman Chairの調節方法をご存知の方いらっしゃいますか？😅\n\nDoes anyone know how to adjust Drax Roman Chair? 😭',
    likes: 1,
    commentCount: 0,
    comments: [],
  },
];

const NEWS_DATA: FeedItem[] = [
  {
    id: 'n1',
    type: 'news',
    user: 'Admin',
    userInitial: 'A',
    isAdmin: true,
    timeAgo: '2ヶ月前',
    title: '[お知らせ] 📌 kinpoyoコミュニティ利用規約およびエチケットのご案内',
    body: 'kinpoyoコミュニティは、すべてのユーザーが自身のワークアウト記録を共有し、互いにモチベーションを高め合う大切な空間です。\n皆様が快適かつ健康的にコミュニケーションを取れるよう、以下のコミュニティ利用ガイドラインを必ずご確認ください。\n\n1. 互いを尊重し、配慮し合う文化を作りましょう。\n自由な意見交換や有益な情報共有はいつでも歓迎します。しかし、他者への誹謗中傷、暴言、嫌悪表現など、不快感を与える投稿やコメントは厳しく禁止されています。\n\n2. 商業目的の宣伝やスパム行為を禁止します。\n個人の商品販売や外部リンクへの誘導など、商業的な目的が明らかな投稿は、コミュニティ本来の目的を損なう恐れがあるため、発見次第直ちに削除させていただきます。\n\n3. 快適なコミュニティ環境を共に守りましょう。\nスパム投稿、性的または不快感を与える画像など、健全なコミュニケーションを阻害するすべての活動はペナルティの対象となります。',
    likes: 3,
    commentCount: 0,
    comments: [],
  },
  {
    id: 'n2',
    type: 'news',
    user: 'Admin',
    userInitial: 'A',
    isAdmin: true,
    timeAgo: '8日前',
    title: '[お知らせ] 🆕 kinpoyo「今日」タブ 新規アップデート',
    body: '今日一日の運動を一度に確認できる「今日」タブが新しくオープンしました！✨\n\n🕯 新しくなった「今日」タブ、ここが変わりました！\n記録をひと目で確認！「ウィークリー記録表示」',
    likes: 5,
    commentCount: 2,
    comments: [],
  },
];

// ─── Main Screen ──────────────────────────────────────────────

export default function CommunityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('follow');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [followSearch, setFollowSearch] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedData, setFeedData] = useState<FeedItem[]>(FEED_DATA);
  const [qaData, setQaData] = useState<FeedItem[]>(QA_DATA);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'follow', label: 'フォロー中' },
    { key: 'feed',   label: 'フィード' },
    { key: 'qa',     label: 'Q&A' },
    { key: 'news',   label: 'お知らせ' },
  ];

  const handleCreatePost = (type: 'feed' | 'qa', title: string, body: string, imageCount: number) => {
    const newPost: FeedItem = {
      id: `${type}-${Date.now()}`,
      type,
      user: 'あなた',
      userInitial: 'あ',
      timeAgo: '今',
      title,
      body,
      ...(imageCount > 0 ? { imageCount } : {}),
      likes: 0,
      commentCount: 0,
      comments: [],
    };
    if (type === 'feed') {
      setFeedData(prev => [newPost, ...prev]);
      setActiveTab('feed');
    } else {
      setQaData(prev => [newPost, ...prev]);
      setActiveTab('qa');
    }
    setShowCreateModal(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>コミュニティー</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn}>
            <IconSymbol name="magnifyingglass" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowNotifModal(true)}
            hitSlop={8}
            style={s.notifBtn}>
            <IconSymbol name="bell.fill" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>K</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Banner */}
      <TouchableOpacity style={s.infoBanner} activeOpacity={0.8}>
        <MaterialIcons name="info-outline" size={18} color={Colors.warning} style={{ marginTop: 2 }} />
        <View style={s.infoBannerBody}>
          <Text style={s.infoBannerTitle}>コミュニティ機能を利用するにはIDを登録してください</Text>
          <Text style={s.infoBannerSub}>IDを登録して、友達追加やQ&Aなどを利用しましょう</Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={Colors.textHint} />
      </TouchableOpacity>

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
        {activeTab === 'follow' && (
          <FollowTab onSearchPress={() => setShowFollowModal(true)} />
        )}
        {activeTab === 'feed' && (
          <FeedTab data={feedData} onPostPress={setSelectedPost} />
        )}
        {activeTab === 'qa' && (
          <FeedTab data={qaData} onPostPress={setSelectedPost} />
        )}
        {activeTab === 'news' && (
          <FeedTab data={NEWS_DATA} onPostPress={setSelectedPost} />
        )}
      </View>

      {/* FAB (フォロー中・フィード・Q&A のみ) */}
      {activeTab !== 'news' && (
        <TouchableOpacity
          style={s.fab}
          activeOpacity={0.85}
          onPress={() => setShowCreateModal(true)}
        >
          <MaterialIcons name="edit" size={24} color="#fff" />
        </TouchableOpacity>
      )}

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
                <QRCode value="user_kinpoyo" size={220} />
              </View>
              <Text style={s.qrIdText}>ID: user_kinpoyo</Text>
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

              {/* My ID Card */}
              <View style={s.userIdCard}>
                <View style={[s.avatar, { backgroundColor: Colors.error }]}>
                  <Text style={s.avatarText}>K</Text>
                </View>
                <Text style={s.userIdText}>ID: user_kinpoyo</Text>
                <TouchableOpacity style={s.shareBtn} onPress={() => setShowQrModal(true)}>
                  <MaterialIcons name="qr-code-2" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.shareBtn}>
                  <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

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
            onClose={() => setSelectedPost(null)}
          />
        )}
      </Modal>

      {/* ── 投稿作成 Modal ──────────────────────────────────── */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <PostCreateScreen
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePost}
        />
      </Modal>

      {/* ── 通知 Modal ──────────────────────────────────────── */}
      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

// ─── フォロー中タブ ────────────────────────────────────────────

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

// ─── フィード / Q&A / お知らせ タブ ──────────────────────────

function FeedTab({
  data,
  onPostPress,
}: {
  data: FeedItem[];
  onPostPress: (p: FeedItem) => void;
}) {
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const toggleLike = (id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView contentContainerStyle={s.feedList} showsVerticalScrollIndicator={false}>
      {data.map(item => {
        const liked = likedIds.has(item.id);
        return (
          <View key={item.id} style={s.postCard}>
            {/* ユーザー行＋タイトル・本文: タップで詳細へ */}
            <TouchableOpacity onPress={() => onPostPress(item)} activeOpacity={0.85}>
              <View style={s.postUserRow}>
                <View style={[s.smallAvatar, item.isAdmin && s.adminAvatar]}>
                  <Text style={s.smallAvatarText}>{item.userInitial}</Text>
                </View>
                <Text style={s.postUser}>{item.user}</Text>
                <Text style={s.postTime}> · {item.timeAgo}</Text>
              </View>
              <Text style={s.postTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={s.postBody} numberOfLines={3}>{item.body}</Text>
            </TouchableOpacity>

            {/* 画像: 独立した横スクロール */}
            {!!item.imageCount && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.mediaScrollContent}
                style={s.mediaScroll}
              >
                {Array.from({ length: item.imageCount }).map((_, i) => (
                  <View key={i} style={s.mediaSquare} />
                ))}
              </ScrollView>
            )}

            {/* アクション行: いいねは色変更のみ、コメントは詳細を開く */}
            <View style={s.postActions}>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => toggleLike(item.id)}
              >
                <MaterialIcons
                  name={liked ? 'thumb-up' : 'thumb-up-off-alt'}
                  size={20}
                  color={liked ? Colors.primary : Colors.textHint}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => onPostPress(item)}
              >
                <MaterialIcons name="chat-bubble-outline" size={20} color={Colors.textHint} />
                <Text style={s.actionCount}> {item.commentCount}</Text>
              </TouchableOpacity>
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
  onClose,
}: {
  post: FeedItem;
  onClose: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentItem[]>(post.comments ?? []);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [mainImageIndex, setMainImageIndex] = useState(0);

  const handleSend = () => {
    if (!commentText.trim()) return;
    setComments(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        user: 'あなた',
        userInitial: 'あ',
        text: commentText.trim(),
      },
    ]);
    setCommentText('');
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={s.safe}>
      {/* ヘッダー: ノッチ分を paddingTop で確保 */}
      <View style={[s.detailHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onClose} style={s.iconBtn}>
          <MaterialIcons name="chevron-left" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
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
          {!!post.imageCount && (
            <View style={s.detailImageSection}>
              <View style={s.detailImagePlaceholder}>
                <Text style={s.detailImageLabel}>{mainImageIndex + 1}</Text>
              </View>
              {post.imageCount > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.detailThumbRow}
                >
                  {Array.from({ length: post.imageCount }).map((_, i) => (
                    i !== mainImageIndex && (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setMainImageIndex(i)}
                        style={s.detailThumb}
                      >
                        <Text style={s.detailImageLabel}>{i + 1}</Text>
                      </TouchableOpacity>
                    )
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Q&A・お知らせ: タイトル先頭表示 */}
          {post.type !== 'feed' && (
            <Text style={s.detailTitle}>{post.title}</Text>
          )}

          {/* 投稿者行 */}
          <View style={[s.postUserRow, { marginTop: Space[2] }]}>
            <View style={[s.smallAvatar, post.isAdmin && s.adminAvatar]}>
              <Text style={s.smallAvatarText}>{post.userInitial}</Text>
            </View>
            <Text style={s.postUser}>{post.user}</Text>
            {post.isAdmin && <Text style={s.editedTag}> · 編集済み</Text>}
          </View>

          {/* 本文 */}
          <Text style={s.detailBodyText}>{post.body}</Text>

          {/* いいね・ブックマーク */}
          <View style={s.detailActions}>
            <TouchableOpacity onPress={() => setLiked(p => !p)} style={s.actionBtn}>
              <MaterialIcons
                name={liked ? 'thumb-up' : 'thumb-up-off-alt'}
                size={24}
                color={liked ? Colors.primary : Colors.textHint}
              />
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
          {comments.map(c => (
            <View key={c.id} style={[s.commentItem, c.isAuthor && s.commentAuthorBg]}>
              <View style={s.smallAvatar}>
                <Text style={s.smallAvatarText}>{c.userInitial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.commentUser}>
                  {c.user}
                  {c.isPro && <Text style={s.proBadge}> PRO</Text>}
                  {c.isAuthor && <Text style={s.authorBadge}> 主</Text>}
                </Text>
                <Text style={s.commentText}>{c.text}</Text>
                <View style={s.commentActions}>
                  <MaterialIcons name="thumb-up-off-alt" size={16} color={Colors.textHint} />
                  <MaterialIcons name="edit" size={16} color={Colors.textHint} style={{ marginLeft: Space[2] }} />
                  <MaterialIcons name="block" size={16} color={Colors.textHint} style={{ marginLeft: Space[2] }} />
                  <MaterialIcons name="error-outline" size={16} color={Colors.textHint} style={{ marginLeft: Space[2] }} />
                </View>
              </View>
            </View>
          ))}
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
          />
          <TouchableOpacity onPress={handleSend}>
            <Text style={[s.sendBtn, !commentText.trim() && { color: Colors.textHint }]}>
              送信
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── 投稿作成画面 ────────────────────────────────────────────

function PostCreateScreen({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (type: 'feed' | 'qa', title: string, body: string, imageCount: number) => void;
}) {
  const [type, setType] = useState<'feed' | 'qa'>('feed');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<number[]>([]);
  const nextImageId = useRef(0);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const addImage = () => {
    if (images.length >= 5) return;
    nextImageId.current += 1;
    setImages(prev => [...prev, nextImageId.current]);
  };

  const removeImage = (id: number) => {
    setImages(prev => prev.filter(i => i !== id));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(type, title.trim(), body.trim(), images.length);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.modalHeader}>
        <TouchableOpacity onPress={onClose} style={s.iconBtn}>
          <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.modalTitle}>投稿を作成</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit} style={s.iconBtn}>
          <Text style={[s.postSubmitText, !canSubmit && s.postSubmitTextDisabled]}>投稿</Text>
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
          {/* 投稿先タイプ */}
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
              {images.map(id => (
                <View key={id} style={s.createImagePreview}>
                  <TouchableOpacity onPress={() => removeImage(id)} style={s.createImageRemoveBtn}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Space[2] },
  headerBtn: { padding: Space[1] },
  notifBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    ...Shadow.sm,
  },
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

  // ── Info Banner ───────────────────────────────────────────
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space[2],
    marginHorizontal: Layout.screenPaddingH,
    marginBottom: Space[3],
    padding: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.warningSubtle,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  infoBannerBody: { flex: 1 },
  infoBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  infoBannerSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
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
  adminAvatar: { backgroundColor: Colors.info },
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
    justifyContent: 'flex-end',
    gap: Space[4],
    marginTop: Space[2],
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionCount: { fontSize: FontSize.sm, color: Colors.textHint },

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
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    backgroundColor: Colors.infoSubtle,
    padding: Space[3],
    borderRadius: Radius.md,
  },
  inviteTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  inviteSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center' },
  inviteBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.info,
  },

  // ── 投稿詳細 Modal ─────────────────────────────────────────
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
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
  detailImageLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
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
  commentActions: { flexDirection: 'row', marginTop: Space[1] },
  proBadge: {
    fontSize: FontSize.xs,
    color: Colors.info,
    fontWeight: FontWeight.bold,
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
