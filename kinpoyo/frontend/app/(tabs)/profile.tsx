import React, { useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

// APIのベースURL（環境に合わせて適宜調整してください）
const API_BASE_URL = 'http://localhost:8000';

export default function ProfileScreen() {
  // ── 状態管理 ──────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [displayName, setDisplayName] = useState('ゲスト');

  // BIG3の入力値状態管理 (初期値は空文字)
  const [squat, setSquat] = useState('');
  const [bench, setBench] = useState('');
  const [deadlift, setDeadlift] = useState('');

  // 身体情報の入力値状態管理 (初期値は空文字)
  const [weight, setWeight] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [bodyFat, setBodyFat] = useState('');

  // 💡 【自動計算ロジック】BIG3の値を数値にパースして合計値を算出
  const big3Total = useMemo(() => {
    const s = parseFloat(squat) || 0;
    const b = parseFloat(bench) || 0;
    const d = parseFloat(deadlift) || 0;
    const total = s + b + d;
    return total > 0 ? `${total} kg` : '─';
  }, [squat, bench, deadlift]);

  // ── 💡 【新規追加】APIデータ連携ロジック ──────────────────────────

  // 1. プロフィール読み込み (GET /users/me/profile)
  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // ※ 本来はログイン時に取得したJWTトークンをここに付与します
          'Authorization': 'Bearer MOCK_TOKEN_HERE',
        },
      });

      if (!response.ok) {
        throw new Error('プロフィールの取得に失敗しました');
      }

      const data = await response.json();
      
      // バックエンドのスネークケースデータをフロントエンドのステートにマッピング
      if (data.display_name) setDisplayName(data.display_name);
      if (data.weight_kg) setWeight(String(data.weight_kg));
      if (data.muscle_mass_kg) setMuscleMass(String(data.muscle_mass_kg));
      if (data.body_fat_pct) setBodyFat(String(data.body_fat_pct));
      
      // スキーマ拡張等でBIG3データもバックエンドに含まれる場合のフォールバック
      if (data.squat_1rm) setSquat(String(data.squat_1rm));
      if (data.bench_1rm) setBench(String(data.bench_1rm));
      if (data.deadlift_1rm) setDeadlift(String(data.deadlift_1rm));

    } catch (error: any) {
      console.error(error);
      Alert.alert('エラー', 'プロフィールデータの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. プロフィール更新保存 (PUT /users/me/profile)
  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const bodyData = {
        display_name: displayName,
        weight_kg: weight ? parseFloat(weight) : null,
        muscle_mass_kg: muscleMass ? parseFloat(muscleMass) : null,
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
        // 将来的な1RMテーブル拡張に対応できるように、スキーマ準拠予測フィールドも送信
        squat_1rm: squat ? parseFloat(squat) : null,
        bench_1rm: bench ? parseFloat(bench) : null,
        deadlift_1rm: deadlift ? parseFloat(deadlift) : null,
      };

      const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer MOCK_TOKEN_HERE',
        },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        throw new Error('プロフィールの保存に失敗しました');
      }

      Alert.alert('完了', 'プロフィール情報をサーバーに保存しました！');
      fetchProfile(); // 最新データを再同期
    } catch (error: any) {
      console.error(error);
      Alert.alert('保存エラー', 'サーバーへの保存に失敗しました。ネットワーク接続を確認してください。');
    } finally {
      setIsLoading(false);
    }
  };

  // 画面マウント時に自動ロード
  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>プロフィール</Text>
        <View style={styles.headerRight}>
          {/* 💡 【新規追加】 サーバー保存アクション用の文字ボタン */}
          <TouchableOpacity style={styles.saveTextBtn} onPress={handleSaveProfile} disabled={isLoading}>
            <Text style={styles.saveText}>保存</Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8}>
            <IconSymbol name="gear" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* ── User Card ────────────────────────── */}
          <View style={styles.userCard}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
              </View>
              <View style={styles.avatarOnline} />
            </View>
            <View style={styles.userInfo}>
              <TextInput
                style={styles.userNameInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="ユーザー名を入力"
                placeholderTextColor={Colors.textHint}
              />
            </View>
          </View>

          {/* ── BIG3 ─────────────────────────────── */}
          <Text style={styles.sectionTitle}>BIG3の合計 (1RM)</Text>
          <View style={styles.big3Total}>
            <Text style={styles.big3TotalLabel}>TOTAL</Text>
            <Text style={styles.big3TotalValue}>{big3Total}</Text>
          </View>
          
          <View style={styles.big3Row}>
            {/* SQUAT */}
            <View style={styles.big3Card}>
              <Text style={styles.big3Label}>SQUAT</Text>
              <TextInput
                style={styles.profileInput}
                keyboardType="numeric"
                placeholder="─"
                placeholderTextColor={Colors.textHint}
                value={squat}
                onChangeText={setSquat}
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>

            {/* BENCH */}
            <View style={styles.big3Card}>
              <Text style={styles.big3Label}>BENCH</Text>
              <TextInput
                style={styles.profileInput}
                keyboardType="numeric"
                placeholder="─"
                placeholderTextColor={Colors.textHint}
                value={bench}
                onChangeText={setBench}
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>

            {/* DEADLIFT */}
            <View style={styles.big3Card}>
              <Text style={styles.big3Label}>DEADLIFT</Text>
              <TextInput
                style={styles.profileInput}
                keyboardType="numeric"
                placeholder="─"
                placeholderTextColor={Colors.textHint}
                value={deadlift}
                onChangeText={setDeadlift}
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>
          </View>

          {/* ── Body Data ────────────────────────── */}
          <View style={styles.bodySection}>
            <View style={styles.bodySectionHeader}>
              <Text style={styles.sectionTitle2}>最近の身体情報</Text>
              <IconSymbol name="chevron.right" size={18} color={Colors.textHint} />
            </View>
            
            <View style={styles.bodyGrid}>
              {/* 体重 */}
              <View style={styles.bodyItem}>
                <Text style={styles.bodyEmoji}>⚖️</Text>
                <TextInput
                  style={styles.profileBodyInput}
                  keyboardType="numeric"
                  placeholder="──"
                  placeholderTextColor={Colors.textHint}
                  value={weight}
                  onChangeText={setWeight}
                />
                <Text style={styles.bodyLabel}>体重 (kg)</Text>
              </View>

              {/* 筋肉量 */}
              <View style={styles.bodyItem}>
                <Text style={styles.bodyEmoji}>💪</Text>
                <TextInput
                  style={styles.profileBodyInput}
                  keyboardType="numeric"
                  placeholder="──"
                  placeholderTextColor={Colors.textHint}
                  value={muscleMass}
                  onChangeText={setMuscleMass}
                />
                <Text style={styles.bodyLabel}>筋肉量 (kg)</Text>
              </View>

              {/* 体脂肪率 */}
              <View style={styles.bodyItem}>
                <Text style={styles.bodyEmoji}>📊</Text>
                <TextInput
                  style={styles.profileBodyInput}
                  keyboardType="numeric"
                  placeholder="──"
                  placeholderTextColor={Colors.textHint}
                  value={bodyFat}
                  onChangeText={setBodyFat}
                />
                <Text style={styles.bodyLabel}>体脂肪率 (%)</Text>
              </View>
            </View>
          </View>

          <View style={{ height: Space[10] }} />
        </ScrollView>
      )}
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
    paddingHorizontal: Layout.screenPaddingH,
    paddingVertical: Space[3],
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  saveTextBtn: {
    paddingVertical: 4,
    paddingHorizontal: Space[2],
  },
  saveText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[4],
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    padding: Space[4],
    marginBottom: Space[5],
    gap: Space[4],
    ...Shadow.sm,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  avatarOnline: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primarySubtle,
  },
  userInfo: {
    flex: 1,
  },
  userNameInput: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Space[3],
    marginTop: Space[1],
  },
  sectionTitle2: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  big3Total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[2],
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  big3TotalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  big3TotalValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  big3Row: {
    flexDirection: 'row',
    gap: Space[2],
    marginBottom: Space[5],
  },
  big3Card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingTop: Space[3],
    paddingBottom: Space[2],
    paddingHorizontal: Space[2],
    alignItems: 'center',
    gap: Space[1],
    ...Shadow.sm,
  },
  big3Label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textHint,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  profileInput: {
    width: '100%',
    height: 36,
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  inputUnit: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  bodySection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Space[4],
    marginBottom: Space[5],
    ...Shadow.sm,
  },
  bodySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space[4],
  },
  bodyGrid: {
    flexDirection: 'row',
  },
  bodyItem: {
    flex: 1,
    alignItems: 'center',
    gap: Space[1],
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
    paddingVertical: Space[1],
  },
  bodyEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  profileBodyInput: {
    width: '75%',
    height: 36,
    backgroundColor: Colors.bgScreen,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    textAlign: 'center',
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  bodyLabel: {
    fontSize: FontSize.xs,
    color: Colors.textHint,
  },
});