// ユーザー情報変更画面。プロフィールタブに表示されている項目（表示名・体重・
// 筋肉量・体脂肪率）に加えて、オンボーディングで入力する項目（性別・身長・
// 体重目標・生まれた年・筋トレ目標）も編集できるようにしている
// （2026-08-30：オンボーディングの入力値が保存されないバグの修正の一環）。
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space } from '@/constants/theme';
import { GENDER_OPTIONS, TRAINING_GOAL_OPTIONS } from '@/constants/profile-options';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import { fetchMyWeightGoal, updateMyWeightGoal } from '@/services/body';
import { fetchMyProfile, updateMyProfile } from '@/services/user';

export default function ProfileEditScreen() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [genderId, setGenderId] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [weightGoalKg, setWeightGoalKg] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [trainingGoal, setTrainingGoal] = useState<string | null>(null);
  const [muscleMassKg, setMuscleMassKg] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [profile, weightGoal] = await Promise.all([
          fetchMyProfile(token),
          fetchMyWeightGoal(token),
        ]);
        setDisplayName(profile.display_name ?? '');
        setGenderId(profile.gender_id ?? null);
        setHeightCm(profile.height_cm != null ? String(profile.height_cm) : '');
        setWeightKg(profile.weight_kg != null ? String(profile.weight_kg) : '');
        setBirthYear(profile.birth_date ? String(new Date(profile.birth_date).getFullYear()) : '');
        setTrainingGoal(profile.training_goal ?? null);
        setMuscleMassKg(profile.muscle_mass_kg != null ? String(profile.muscle_mass_kg) : '');
        setBodyFatPct(profile.body_fat_pct != null ? String(profile.body_fat_pct) : '');
        setWeightGoalKg(weightGoal ? String(weightGoal.target_value) : '');
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.detail : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await updateMyProfile(token, {
        display_name: displayName.trim() !== '' ? displayName.trim() : undefined,
        gender_id: genderId ?? undefined,
        height_cm: heightCm.trim() !== '' ? Number(heightCm) : undefined,
        weight_kg: weightKg.trim() !== '' ? Number(weightKg) : undefined,
        birth_date: birthYear.trim() !== '' ? `${birthYear.trim()}-01-01` : undefined,
        training_goal: trainingGoal ?? undefined,
        muscle_mass_kg: muscleMassKg.trim() !== '' ? Number(muscleMassKg) : undefined,
        body_fat_pct: bodyFatPct.trim() !== '' ? Number(bodyFatPct) : undefined,
      });
      if (weightGoalKg.trim() !== '') {
        await updateMyWeightGoal(token, { target_value: Number(weightGoalKg) });
      }
      router.back();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.detail : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ユーザー情報変更</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      ) : loadError ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>表示名</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="表示名を入力"
              placeholderTextColor={Colors.textHint}
            />
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>性別</Text>
            <View style={styles.pillRow}>
              {GENDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.pill, genderId === opt.id && styles.pillActive]}
                  activeOpacity={0.8}
                  onPress={() => setGenderId(opt.id)}>
                  <Text style={[styles.pillText, genderId === opt.id && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>身長 (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              placeholder="例: 170.0"
              placeholderTextColor={Colors.textHint}
            />
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>体重 (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              placeholder="例: 65.0"
              placeholderTextColor={Colors.textHint}
            />
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>目標体重 (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightGoalKg}
              onChangeText={setWeightGoalKg}
              keyboardType="numeric"
              placeholder="例: 60.0"
              placeholderTextColor={Colors.textHint}
            />
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>生まれた年</Text>
            <TextInput
              style={styles.input}
              value={birthYear}
              onChangeText={v => setBirthYear(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="例: 2000"
              placeholderTextColor={Colors.textHint}
            />
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>筋トレ目標</Text>
            <View style={styles.pillRow}>
              {TRAINING_GOAL_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.pill, trainingGoal === opt.key && styles.pillActive]}
                  activeOpacity={0.8}
                  onPress={() => setTrainingGoal(opt.key)}>
                  <Text style={[styles.pillText, trainingGoal === opt.key && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>筋肉量 (kg)</Text>
            <TextInput
              style={styles.input}
              value={muscleMassKg}
              onChangeText={setMuscleMassKg}
              keyboardType="numeric"
              placeholder="例: 30.0"
              placeholderTextColor={Colors.textHint}
            />
          </View>

          <View style={styles.fieldCard}>
            <Text style={styles.fieldLabel}>体脂肪率 (%)</Text>
            <TextInput
              style={styles.input}
              value={bodyFatPct}
              onChangeText={setBodyFatPct}
              keyboardType="numeric"
              placeholder="例: 18.5"
              placeholderTextColor={Colors.textHint}
            />
          </View>
        </ScrollView>
      )}

      <View style={styles.bottomPanel}>
        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.85} disabled={saving} onPress={handleSave}>
          {saving ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>保存する</Text>
          )}
        </TouchableOpacity>
      </View>
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
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space[6] },
  scroll: { padding: Layout.screenPaddingH, paddingBottom: Space[8], gap: Space[3] },
  fieldCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    ...Shadow.sm,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Space[2],
  },
  input: {
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Space[3],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2] },
  pill: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[2] + 2,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgScreen,
  },
  pillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  pillText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  pillTextActive: { color: Colors.primaryDark, fontWeight: FontWeight.bold },
  bottomPanel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
    paddingBottom: Space[4],
    gap: Space[2],
  },
  errorBox: {
    borderRadius: Radius.md,
    backgroundColor: Colors.errorSubtle,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error },
  saveBtn: {
    height: Layout.buttonHeightLg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  saveBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
