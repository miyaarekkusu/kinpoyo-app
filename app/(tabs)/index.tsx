import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

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
  const flatListRef = useRef<FlatList<DayInfo[]>>(null);

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

  // 体重モーダル
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [savedWeight, setSavedWeight] = useState('');
  const [savedBodyFat, setSavedBodyFat] = useState('');

  const openWeightModal = () => {
    setWeight(savedWeight);
    setBodyFat(savedBodyFat);
    setWeightModalOpen(true);
  };

  const saveWeight = () => {
    setSavedWeight(weight);
    setSavedBodyFat(bodyFat);
    setWeightModalOpen(false);
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
          <TouchableOpacity hitSlop={8} style={styles.iconBtn}>
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

        {/* ── Selected Day / Empty State ───────── */}
        <View style={styles.emptyCard}>
          <Text style={styles.selDateLabel}>{selLabel}</Text>
          <Text style={styles.emptyIcon}>🏋️</Text>
          <Text style={styles.emptyTitle}>トレーニングなし</Text>
          <Text style={styles.emptySubtitle}>ワークアウトを登録してみましょう</Text>
        </View>

        {/* ── Register Button ──────────────────── */}
        <TouchableOpacity style={styles.registerBtn} activeOpacity={0.85} onPress={() => router.push('/calendar')}>
          <IconSymbol name="dumbbell.fill" size={20} color={Colors.textOnPrimary} style={styles.registerBtnIcon} />
          <Text style={styles.registerBtnText}>ワークアウト登録</Text>
        </TouchableOpacity>

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

        {/* ── Body Weight Card ─────────────────── */}
        <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={openWeightModal}>
          <View style={styles.cardRow}>
            <View style={styles.cardLeft}>
              <View style={[styles.cardIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.cardEmoji}>⚖️</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>体重</Text>
                <Text style={styles.cardValue}>
                  {savedWeight ? `${savedWeight} kg` : '-- kg'}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={Colors.textHint} />
          </View>
          {savedWeight ? (
            <Text style={styles.cardHint}>
              {savedBodyFat ? `体脂肪率 ${savedBodyFat}%` : 'タップして更新'}
            </Text>
          ) : (
            <Text style={styles.cardHint}>タップして体重を記録しましょう</Text>
          )}
        </TouchableOpacity>

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

        <View style={{ height: Space[8] }} />
      </ScrollView>

      {/* ── 体重入力モーダル ─────────────────── */}
      <Modal
        visible={weightModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWeightModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={StyleSheet.absoluteFillObject} />

          <View style={styles.modalDialog}>
            {/* ヘッダー */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>体重を記録</Text>
              <TouchableOpacity
                onPress={() => setWeightModalOpen(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}>
                <IconSymbol name="xmark" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 体重入力 */}
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>⚖️</Text>
              <TextInput
                style={styles.weightInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={Colors.textHint}
                textAlign="center"
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>

            {/* 体脂肪率入力（任意） */}
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>📊</Text>
              <TextInput
                style={[styles.weightInput, styles.secondaryInput]}
                value={bodyFat}
                onChangeText={setBodyFat}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={Colors.textHint}
                textAlign="center"
              />
              <Text style={styles.inputUnit}>%　体脂肪率（任意）</Text>
            </View>

            {/* 保存ボタン */}
            <TouchableOpacity
              style={[styles.saveBtn, !weight && styles.saveBtnDisabled]}
              onPress={saveWeight}
              activeOpacity={0.85}
              disabled={!weight}>
              <Text style={styles.saveBtnText}>保存する</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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

  // ── Scroll
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: Space[2],
  },

  // ── Hero Banner
  heroBanner: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.xl,
    paddingHorizontal: Space[5],
    paddingVertical: Space[5],
    marginBottom: Space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    marginBottom: Space[1],
    lineHeight: FontSize['2xl'] * 1.25,
  },
  heroDate: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    fontWeight: FontWeight.medium,
  },
  weeklyBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.md,
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginLeft: Space[4],
  },
  weeklyBadgeLabel: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  weeklyBadgeCount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },

  // ── Calendar Card
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

  // ── Week Page
  weekPage: {
    width: CARD_W,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Space[1],
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

  // ── Page Dots
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

  // ── Empty State
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

  // ── Register Button
  registerBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    height: Layout.buttonHeightLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space[4],
    flexDirection: 'row',
    gap: Space[2],
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  registerBtnIcon: {},
  registerBtnText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },

  // ── Stats Row
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

  // ── Cards
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
  cardValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
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

  // ── 体重モーダル
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgOverlay,
    paddingHorizontal: Space[5],
  },
  modalDialog: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    width: '100%',
    padding: Space[5],
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[5],
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    marginBottom: Space[4],
  },
  inputIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  weightInput: {
    width: 90,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primarySubtle,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  secondaryInput: {
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    width: 80,
    height: 44,
  },
  inputUnit: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  saveBtn: {
    height: Layout.buttonHeightMd,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space[2],
    ...Shadow.sm,
    shadowColor: Colors.primaryDark,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.border,
  },
  saveBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
});
