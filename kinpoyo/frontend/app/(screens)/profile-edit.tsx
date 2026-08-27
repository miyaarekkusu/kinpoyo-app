// ユーザー情報変更画面。プロフィールタブに表示されている項目（表示名・体重・
// 筋肉量・体脂肪率）だけを編集対象にする（表示されていない項目まで一気に
// 増やさない）。
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
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import { fetchMyProfile, updateMyProfile } from '@/services/user';

export default function ProfileEditScreen() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [muscleMassKg, setMuscleMassKg] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const profile = await fetchMyProfile(token);
        setDisplayName(profile.display_name ?? '');
        setWeightKg(profile.weight_kg != null ? String(profile.weight_kg) : '');
        setMuscleMassKg(profile.muscle_mass_kg != null ? String(profile.muscle_mass_kg) : '');
        setBodyFatPct(profile.body_fat_pct != null ? String(profile.body_fat_pct) : '');
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
        weight_kg: weightKg.trim() !== '' ? Number(weightKg) : undefined,
        muscle_mass_kg: muscleMassKg.trim() !== '' ? Number(muscleMassKg) : undefined,
        body_fat_pct: bodyFatPct.trim() !== '' ? Number(bodyFatPct) : undefined,
      });
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
