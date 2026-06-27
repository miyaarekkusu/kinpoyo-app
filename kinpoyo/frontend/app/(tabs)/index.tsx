import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { NotificationsModal } from '@/components/notifications-modal';
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

const SCREEN_W = Dimensions.get('window').width;
const H_PAD = Layout.screenPaddingH;
const CARD_W = SCREEN_W - H_PAD * 2;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const NUM_WEEKS = 8;

const STREAK_COUNT = 0;
const WEEKLY_COUNT = 0;

type DayInfo = {
  date: number;
  month: number;
  year: number;
  dateStr: string;
  isToday: boolean;
};

function buildWeeks(): DayInfo[][] {
  const today = new Date();
  const todayStr = today.toDateString();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  return Array.from({ length: NUM_WEEKS }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + wi * 7 + di);
      return {
        date: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        dateStr: d.toDateString(),
        isToday: d.toDateString() === todayStr,
      };
    }),
  );
}

export default function HomeScreen() {
  const today = new Date();
  const weeks = useMemo(() => buildWeeks(), []);
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedDateStr, setSelectedDateStr] = useState(today.toDateString());
  const [showNotifModal, setShowNotifModal] = useState(false);
  const flatListRef = useRef<FlatList<DayInfo[]>>(null);

  // 📝 カスタムプログラムのモック状態（nullに切り替えると元の「トレーニングなし」の表示に戻せます）
  const [registeredProgram, setRegisteredProgram] = useState<{
    title: string;
    exercises: { name: string; setsCount: number; maxWeight: string; targetRpe: string }[];
  } | null>({
    title: 'PPL (Push)',
    exercises: [
      { name: 'ベンチプレス', setsCount: 3, maxWeight: '60', targetRpe: '8' },
      { name: 'インクラインベンチプレス', setsCount: 3, maxWeight: '50', targetRpe: '8' },
      { name: 'ダンベルベンチプレス', setsCount: 3, maxWeight: '24', targetRpe: '8' },
    ]
  });

  const currentWeek = weeks[weekIndex];
  const firstDay = currentWeek[0];
  const monthLabel = `${firstDay.year}年${firstDay.month + 1}月`;

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
      setWeekIndex(idx);
    },
    [],
  );

  const renderWeek = useCallback(
    ({ item: week }: { item: DayInfo[] }) => (
      <View style={styles.weekPage}>
        {week.map((day, i) => {
          const isSelected = day.dateStr === selectedDateStr;
          return (
            <TouchableOpacity
              key={i}
              style={styles.dayCol}
              onPress={() => setSelectedDateStr(day.dateStr)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.dateCircle,
                  day.isToday && styles.dateCircleToday,
                  isSelected && !day.isToday && styles.dateCircleSelected,
                ]}>
                <Text
                  style={[
                    styles.dateText,
                    i === 0 && styles.sunText,
                    i === 6 && styles.satText,
                    day.isToday && styles.dateTextToday,
                    isSelected && !day.isToday && styles.dateTextSelected,
                  ]}>
                  {day.date}
                </Text>
              </View>
              {/* placeholder dot — replace with real data check later */}
              <View style={styles.dotPlaceholder} />
            </TouchableOpacity>
          );
        })}
      </View>
    ),
    [selectedDateStr],
  );

  const selDate = new Date(selectedDateStr);
  const selLabel = `${selDate.getMonth() + 1}月${selDate.getDate()}日（${WEEKDAYS[selDate.getDay()]}）`;

  // カードをタップした際に program_choice.tsx にシリアライズして移動するロジック
  const handleEditProgram = () => {
    if (!registeredProgram) return;

    const chosenNames = registeredProgram.exercises.map(ex => ex.name);

    router.push({
      pathname: '/(screens)/program/program_choice' as any,
      params: {
        title: registeredProgram.title,
        exercises: JSON.stringify(chosenNames)
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.streakBadge}>
          <IconSymbol name="flame.fill" size={20} color="#F97316" />
          <Text style={styles.streakCount}>{STREAK_COUNT}</Text>
        </View>

        <Text style={styles.appName}>kinpoyo</Text>

        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => router.push('/calendar')}
            hitSlop={8}
            style={styles.iconBtn}>
            <IconSymbol name="calendar" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowNotifModal(true)}
            hitSlop={8}
            style={styles.iconBtn}>
            <IconSymbol name="bell.fill" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {/* ── Weekly Calendar Card ─────────────── */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <View style={styles.dayNameRow}>
              {WEEKDAYS.map((d, i) => (
                <Text
                  key={i}
                  style={[
                    styles.dayName,
                    i === 0 && styles.sunText,
                    i === 6 && styles.satText,
                  ]}>
                  {d}
                </Text>
              ))}
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={weeks}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderWeek}
            onMomentumScrollEnd={onScrollEnd}
            getItemLayout={(_, index) => ({
              length: CARD_W,
              offset: CARD_W * index,
              index,
            })}
            style={{ width: CARD_W }}
          />

          <View style={styles.pageDots}>
            {weeks.map((_, i) => (
              <View key={i} style={[styles.dot, i === weekIndex && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Selected Day / Program State ───────── */}
        {registeredProgram ? (
          /* 💡 プログラムが登録されている場合は、トレーニングリストをカード形式で表示 */
          <TouchableOpacity 
            style={styles.programCard} 
            onPress={handleEditProgram}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{registeredProgram.title}</Text>
              </View>
              <View style={styles.editLink}>
                <Text style={styles.editLinkText}>詳細設定へ</Text>
                <IconSymbol name="chevron.right" size={14} color={Colors.primaryDark} />
              </View>
            </View>

            <Text style={styles.programCardTitle}>本日のトレーニングメニュー</Text>

            {registeredProgram.exercises.map((ex, idx) => (
              <View key={idx} style={styles.exerciseRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>• {ex.name}</Text>
                <Text style={styles.exerciseDetails}>
                  {ex.setsCount}set / {ex.maxWeight}kg / RPE {ex.targetRpe}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        ) : (
          /* 🍏 登録がない場合は従来の「トレーニングなし」空状態を表示 */
          <View style={styles.emptyCard}>
            <Text style={styles.selDateLabel}>{selLabel}</Text>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>トレーニングなし</Text>
            <Text style={styles.emptySubtitle}>ワークアウトを登録してみましょう</Text>
          </View>
        )}

        {/* ── Stats Row ────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <IconSymbol name="timer" size={20} color={Colors.primaryDark} />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statUnit}>時間</Text>
            <Text style={styles.statLabel}>合計時間</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <IconSymbol name="flame.fill" size={20} color="#F97316" />
            </View>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statUnit}>回</Text>
            <Text style={styles.statLabel}>今週の筋トレ</Text>
          </View>
        </View>

        {/* ── Program Card ─────────────────────── */}
        <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => router.push('/program')}>
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <View style={[styles.cardIconWrap, { backgroundColor: Colors.primarySubtle }]}>
                <Text style={styles.cardEmoji}>📋</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>プログラム</Text>
                <Text style={styles.cardSubtitle}>未参加</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
          </View>
          <Text style={styles.cardHint}>プログラムに参加して一歩成長しましょう</Text>
        </TouchableOpacity>

        {/* ── トレーニング知識セクション ── */}
        <View style={styles.knowledgeSection}>
          <Text style={styles.knowledgeSectionTitle}>💡 トレーニング知識</Text>

          <View style={styles.knowledgeGrid}>
            {/* 筋肥大とは */}
            <TouchableOpacity
              style={styles.knowledgeCard}
              activeOpacity={0.75}
              onPress={() => router.push('/program/hypertrophy' as any)}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={styles.cardEmoji}>💪</Text>
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>筋肥大とは</Text>
                    <Text style={styles.cardSubtitle}>効率よく筋肉を大きくするメカニズム</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
              </View>
            </TouchableOpacity>

            {/* プログラム組み方 */}
            <TouchableOpacity
              style={styles.knowledgeCard}
              activeOpacity={0.75}
              onPress={() => router.push('/program/program-design' as any)}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#E0F2FE' }]}>
                    <Text style={styles.cardEmoji}>📋</Text>
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>プログラム組み方</Text>
                    <Text style={styles.cardSubtitle}>分割法や適切なボリュームの設定方法</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
              </View>
            </TouchableOpacity>

            {/* RPEとは */}
            <TouchableOpacity
              style={styles.knowledgeCard}
              activeOpacity={0.75}
              onPress={() => router.push('/program/rpe' as any)}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={styles.cardEmoji}>🏋️</Text>
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>RPEとは</Text>
                    <Text style={styles.cardSubtitle}>自覚的運動強度を用いた強度管理</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: Space[8] }} />
      </ScrollView>

      <NotificationsModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgScreen,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: Radius.full,
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    gap: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  streakCount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#F97316',
    lineHeight: FontSize.xl * 1.2,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[1],
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    ...Shadow.sm,
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: Space[2],
  },
  calendarCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingTop: Space[4],
    paddingBottom: Space[3],
    marginBottom: Space[4],
    overflow: 'hidden',
    ...Shadow.sm,
  },
  calendarHeader: {
    paddingHorizontal: Space[4],
    marginBottom: Space[2],
  },
  monthLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  dayNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayName: {
    width: 36,
    textAlign: 'center',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textHint,
  },
  sunText: { color: '#EF4444' },
  satText: { color: '#3B82F6' },
  weekPage: {
    width: CARD_W,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Space[1],
    paddingHorizontal: Space[4],
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleToday: {
    backgroundColor: Colors.primary,
  },
  dateCircleSelected: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  dateText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  dateTextToday: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.bold,
  },
  dateTextSelected: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.bold,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space[1],
    marginTop: Space[3],
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 14,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[8],
    alignItems: 'center',
    marginBottom: Space[4],
    ...Shadow.sm,
  },
  selDateLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryDark,
    marginBottom: Space[3],
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Space[2],
    marginTop: Space[2],
  },
  emptyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Space[1],
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Space[3],
    marginBottom: Space[4],
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingVertical: Space[4],
    paddingHorizontal: Space[3],
    alignItems: 'center',
    ...Shadow.sm,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space[2],
  },
  statNumber: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: FontSize['2xl'] * 1.1,
  },
  statUnit: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Space[1],
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Layout.cardPadding,
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[2],
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
    marginTop: 2,
  },
  cardHint: {
    fontSize: FontSize.sm,
    color: Colors.textHint,
  },
  knowledgeSection: {
    marginTop: Space[4],
  },
  knowledgeSectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
    paddingLeft: Space[1],
  },
  knowledgeGrid: {
    gap: Space[2],
  },
  knowledgeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Layout.cardPadding,
    paddingTop: Layout.cardPadding,
    paddingBottom: Layout.cardPadding - Space[2],
    ...Shadow.sm,
  },

  // ── 💡 登録済みプログラムカードのスタイル
  programCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[2],
  },
  tagBadge: {
    backgroundColor: Colors.primarySubtle,
    // 👈 型エラーを完全に防ぐため、Space配列ではなく直値の整数 10 に変更
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  tagBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  editLinkText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primaryDark,
  },
  programCardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // 👈 型エラーを完全に防ぐため、小数(1.5)ではなく整数である Space[2] に変更
    paddingVertical: Space[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exerciseName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Space[2],
  },
  exerciseDetails: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
});