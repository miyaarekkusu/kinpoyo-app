import React, { useState, useMemo } from 'react';
import {
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

// ─── カレンダー用の定数・型定義 ────────────────────────────
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const H_PAD = Layout.screenPaddingH;

type Cell = { date: number; current: boolean };

const DUMMY_WORKOUT_DOTS: Record<string, string[]> = {
  '6-2':  ['#EF4444'],
  '6-4':  ['#3B82F6'],
  '6-6':  ['#22C55E', '#F59E0B'],
  '6-9':  ['#EF4444', '#8B5CF6'],
  '6-11': ['#3B82F6'],
  '6-13': ['#22C55E'],
  '6-16': ['#EC4899'],
  '6-18': ['#EF4444', '#3B82F6'],
  '6-20': ['#22C55E', '#F59E0B'],
  '6-23': ['#8B5CF6'],
  '6-25': ['#EF4444'],
  '6-27': ['#EF4444'], 
};

function buildGrid(year: number, month: number): Cell[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ date: daysInPrev - i, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: d, current: true });
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) cells.push({ date: d, current: false });
  return cells;
}

function getDotsForCell(cell: Cell, month: number): string[] {
  if (!cell.current) return [];
  const key = `${month + 1}-${cell.date}`;
  return DUMMY_WORKOUT_DOTS[key] ?? [];
}

export default function HomeScreen() {
  const today = new Date();
  const [showNotifModal, setShowNotifModal] = useState(false);

  // 🗓️ カレンダー状態管理
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(today.toDateString());

  // 📝 カスタムプログラムのモック状態
  const [registeredProgram] = useState<{
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

  // カレンダーグリッドのビルド
  const grid = buildGrid(year, month);
  const rows = useMemo(() => {
    const rs: Cell[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
      rs.push(grid.slice(i, i + 7));
    }
    return rs;
  }, [grid]);

  const isToday = (d: number, m: number, y: number) => {
    return d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  };

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const selDate = new Date(selectedDateStr);
  const selLabel = `${selDate.getMonth() + 1}月${selDate.getDate()}日（${WEEKDAYS[selDate.getDay()]}）`;

  // 詳細確認遷移
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
        {/* 左右のヘッダー要素の幅を揃えてアプリ名を綺麗に中央配置 */}
        <View style={{ width: 36 }} />
        <Text style={styles.appName}>kinpoyo</Text>
        <View style={styles.headerIcons}>
          {/* 💡 修正: カレンダー遷移アイコンボタンを完全に削除しました */}
          <TouchableOpacity
            onPress={() => setShowNotifModal(true)}
            hitSlop={8}
            style={styles.iconBtn}>
            <IconSymbol name="bell.fill" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 月間カレンダーカード ──────────────── */}
        <View style={styles.calendarCard}>
          {/* カレンダーの月移動ナビゲーション */}
          <View style={styles.calendarNavRow}>
            <TouchableOpacity onPress={prevMonth} hitSlop={8}>
              <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{`${year}年${month + 1}月`}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={8}>
              <IconSymbol name="chevron.right" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* 曜日ヘッダー */}
          <View style={styles.dayNameRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.dayName, i === 0 && styles.sunText, i === 6 && styles.satText]}>
                {d}
              </Text>
            ))}
          </View>
          
          {/* 日付グリッド */}
          {rows.map((row: Cell[], ri: number) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((cell: Cell, ci: number) => {
                const cellDate = new Date(year, month, cell.date);
                const isSelected = cell.current && cellDate.toDateString() === selectedDateStr;
                const cellToday = cell.current && isToday(cell.date, month, year);
                
                return (
                  <TouchableOpacity
                    key={ci}
                    style={styles.cell}
                    disabled={!cell.current}
                    onPress={() => setSelectedDateStr(cellDate.toDateString())}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dateBubble,
                      cellToday && styles.dateBubbleToday,
                      isSelected && !cellToday && styles.dateBubbleSelected,
                    ]}>
                      <Text style={[
                        styles.cellText,
                        !cell.current && { color: Colors.textHint },
                        ci === 0 && cell.current && styles.sunText,
                        ci === 6 && cell.current && styles.satText,
                        cellToday && styles.dateTextToday,
                        isSelected && !cellToday && styles.dateTextSelected,
                      ]}>
                        {cell.date}
                      </Text>
                    </View>
                    <View style={styles.dotsRow}>
                      {cell.current && getDotsForCell(cell, month).map((color, di) => (
                        <View key={di} style={[styles.dot, { backgroundColor: color }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Selected Day / Program State ───────── */}
        {registeredProgram ? (
          <TouchableOpacity style={styles.programCard} onPress={handleEditProgram} activeOpacity={0.8}>
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
          <View style={styles.emptyCard}>
            <Text style={styles.selDateLabel}>{selLabel}</Text>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>トレーニングなし</Text>
            <Text style={styles.emptySubtitle}>ワークアウトを登録してみましょう</Text>
          </View>
        )}

        {/* 💡 修正: 統計グリッド（statsRow：合計時間、今週の筋トレ回数）を丸ごと消去しました */}

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
            <TouchableOpacity style={styles.knowledgeCard} activeOpacity={0.75} onPress={() => router.push('/program/hypertrophy' as any)}>
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

            <TouchableOpacity style={styles.knowledgeCard} activeOpacity={0.75} onPress={() => router.push('/program/program-design' as any)}>
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

            <TouchableOpacity style={styles.knowledgeCard} activeOpacity={0.75} onPress={() => router.push('/program/rpe' as any)}>
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

// ─── スタイル ─────────────────────────────────────────────────
const CALENDAR_ROW_H = 56;

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
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
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
    ...Shadow.sm,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space[3],
    gap: Space[4],
  },
  monthTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  dayNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Space[2],
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
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: CALENDAR_ROW_H,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  dateBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBubbleToday: {
    backgroundColor: Colors.primary,
  },
  dateBubbleSelected: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  cellText: {
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
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
  // 💡 整理: 不要になった統計カード（statsRow, statCard, statIconWrap, statNumber 等）のスタイル定義を削除しました
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