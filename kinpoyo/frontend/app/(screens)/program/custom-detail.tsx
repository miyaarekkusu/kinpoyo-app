import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { ProgramActionBar } from '@/components/program-action-bar';
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
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import {
  ProgramExerciseOut,
  ProgramOut,
  fetchMyCreatedPrograms,
  fetchProgramExercises,
} from '@/services/program';

export default function CustomProgramDetailScreen() {
  const { token } = useAuth();
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const id = Number(programId);

  const [program, setProgram] = useState<ProgramOut | null>(null);
  const [exercises, setExercises] = useState<ProgramExerciseOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [myPrograms, exList] = await Promise.all([
        fetchMyCreatedPrograms(token),
        fetchProgramExercises(id, 1, 1),
      ]);
      setProgram(myPrograms.find(p => p.id === id) ?? null);
      setExercises(exList);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
            <IconSymbol name="chevron.left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>プログラム詳細</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={Colors.primaryDark} size="large" />
          </View>
        ) : loadError || !program ? (
          <View style={styles.centerBox}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError ?? 'プログラムが見つかりません'}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>再読み込み</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* ── Hero ─────────────────────────── */}
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIconBox}>
                    <Text style={styles.heroEmoji}>🏋️</Text>
                  </View>
                  <View style={styles.heroInfo}>
                    <Text style={styles.heroTitle}>{program.name}</Text>
                    <Text style={styles.heroSub}>カスタムプログラム</Text>
                  </View>
                </View>
                {program.description && <Text style={styles.heroDesc}>{program.description}</Text>}
              </View>

              {/* ── 種目リスト ───────────────────── */}
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>メニュー</Text>
                  <Text style={styles.countBadge}>{exercises.length}種目</Text>
                </View>
                {exercises.length === 0 ? (
                  <Text style={styles.emptyText}>種目が登録されていません</Text>
                ) : (
                  exercises.map((ex, i) => (
                    <View key={ex.id} style={[styles.exRow, i < exercises.length - 1 && styles.exRowBorder]}>
                      <View style={styles.exInfo}>
                        <Text style={styles.exName}>{ex.exercise_name}</Text>
                        {ex.note && <Text style={styles.exNote}>{ex.note}</Text>}
                      </View>
                      <View style={styles.exVol}>
                        <Text style={styles.exVolText}>
                          {ex.sets}set{ex.reps_min ? ` / ${ex.reps_min}回` : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            <ProgramActionBar programName={program.name} programId={program.id} />
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgScreen },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: Layout.screenPaddingH,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerBack: { width: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSpacer: { width: 40 },

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
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
  },
  retryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },

  // ── Hero
  heroCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.xl,
    padding: Space[4],
    marginBottom: Space[4],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
    marginBottom: Space[3],
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 28 },
  heroInfo: { flex: 1, gap: 4 },
  heroTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    fontWeight: FontWeight.medium,
  },
  heroDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Section card
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[3],
    ...Shadow.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[3],
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  countBadge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: Space[2],
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  emptyText: { fontSize: FontSize.sm, color: Colors.textHint },

  // ── Exercise row
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[3],
    gap: Space[3],
  },
  exRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  exInfo: { flex: 1 },
  exName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  exNote: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
  },
  exVol: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySubtle,
  },
  exVolText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
});
