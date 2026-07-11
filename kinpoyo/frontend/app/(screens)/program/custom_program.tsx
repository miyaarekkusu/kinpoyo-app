import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router'; //
import { IconSymbol } from '@/components/ui/icon-symbol'; //

import {
  Colors,
  FontSize,
  FontWeight,
  Layout,
  Radius,
  Shadow,
  Space,
} from '@/constants/theme'; //

// 分割法の選択肢データ
const SPLIT_METHODS = [
  { id: 'ppl', name: 'PPL (Push/Pull/Legs) - 3分割', description: 'Push（押す）、Pull（引く）、Legs（脚）の3分割' }, //
  { id: 'ul', name: '上半身 / 下半身 - 2分割', description: '上半身と下半身に分ける2分割' }, //
  { id: 'fullbody', name: '全身 - 分割なし', description: '1回のセッションで全身をバランスよく鍛える' }, //
  { id: '4split', name: '4分割', description: '主要な筋肉群を4日間に分けて効率よくアプローチ' }, //
  { id: '5split', name: '5分割', description: '胸・背中・脚・肩・腕を日替わりで徹底的に追い込む' }, //
];

export default function CustomProgramScreen() {
  const router = useRouter(); //
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null); //

  const handleSelect = (id: string) => {
    setSelectedMethod(id); //
  };

  const handleNext = () => {
    if (!selectedMethod) return; //
    
    const method = SPLIT_METHODS.find(m => m.id === selectedMethod);
    if (!method) return;

    // 表示用の短いヘッダータイトルを抽出 (「 - 」または「 (」の前までを取得)
    let headerTitle = method.name.split(' - ')[0].split(' (')[0];

    // 👈 エラー画像の型に合わせて正しいフルパスに変更
    router.push({
      pathname: '/(screens)/program/even_program',
      params: { title: headerTitle, description: method.description }
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} /> {/* */}

      <SafeAreaView style={styles.container} edges={['top', 'bottom']}> {/* */}
        {/* ── Header ─────────────────────────── */}
        <View style={styles.header}> {/* */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={8}> {/* */}
            <IconSymbol name="chevron.left" size={24} color={Colors.primaryDark} /> {/* */}
          </TouchableOpacity> {/* */}
          <Text style={styles.headerTitle}>カスタムプログラム作成</Text> {/* */}
          <TouchableOpacity style={styles.helpButton} hitSlop={8}> {/* */}
            <IconSymbol name="questionmark.circle" size={22} color={Colors.primaryDark} /> {/* */}
          </TouchableOpacity> {/* */}
        </View> {/* */}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}> {/* */}
          <View style={styles.stepCard}> {/* */}
            <View style={styles.stepBadge}> {/* */}
              <Text style={styles.stepBadgeText}>STEP 1 / 3</Text> {/* */}
            </View> {/* */}
            <Text style={styles.sectionTitle}>分割法の選択</Text> {/* */}
            <Text style={styles.sectionDescription}> {/* */}
              トレーニングの目的に合わせて分割法を1つ選択してください。後から変更も可能です。 {/* */}
            </Text> {/* */}
          </View> {/* */}

          <View style={styles.listContainer}> {/* */}
            {SPLIT_METHODS.map((method) => {
              const isSelected = selectedMethod === method.id; //
              return (
                <TouchableOpacity //
                  key={method.id} //
                  style={[ //
                    styles.card, //
                    isSelected && styles.cardSelected //
                  ]} //
                  activeOpacity={0.7} //
                  onPress={() => handleSelect(method.id)} //
                > {/* */}
                  <Text style={[styles.cardName, isSelected && styles.cardTextSelected]}> {/* */}
                    {method.name} {/* */}
                  </Text> {/* */}
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}> {/* */}
                    {isSelected && <View style={styles.radioInner} />} {/* */}
                  </View> {/* */}
                </TouchableOpacity> //
              );
            })}
          </View> {/* */}
        </ScrollView>

        <View style={styles.footer}> {/* */}
          <TouchableOpacity //
            style={[styles.nextButton, !selectedMethod && styles.nextButtonDisabled]} //
            disabled={!selectedMethod} //
            onPress={handleNext} //
            activeOpacity={0.8} //
          > {/* */}
            <Text style={styles.nextButtonText}>次へ</Text> {/* */}
          </TouchableOpacity> {/* */}
        </View> {/* */}
      </SafeAreaView> {/* */}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgScreen }, //
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, paddingHorizontal: Layout.screenPaddingH, backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.divider }, //
  backButton: { width: 40, justifyContent: 'center' }, //
  helpButton: { width: 40, alignItems: 'flex-end', justifyContent: 'center' }, //
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primaryDark, textAlign: 'center' }, //
  scrollContent: { padding: Layout.screenPaddingH, paddingBottom: 120 }, //
  stepCard: { backgroundColor: Colors.primarySubtle, borderRadius: Radius.lg, padding: Space[4], alignItems: 'center', marginBottom: Space[5] }, //
  stepBadge: { backgroundColor: Colors.bgCard, paddingHorizontal: Space[3], paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primaryBorder, marginBottom: Space[2] }, //
  stepBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primaryDark }, //
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Space[2] }, //
  sectionDescription: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 }, //
  listContainer: { gap: Space[3] }, //
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: Radius.md, paddingHorizontal: Space[4], paddingVertical: Space[4], borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm }, //
  cardSelected: { borderColor: Colors.primaryDark, backgroundColor: Colors.bgCard }, //
  cardName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1, paddingRight: Space[2] }, //
  cardTextSelected: { color: Colors.primaryDark }, //
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgCard }, //
  radioOuterSelected: { borderColor: Colors.primaryDark }, //
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryDark }, //
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.bgCard, paddingHorizontal: Layout.screenPaddingH, paddingVertical: Space[4], borderTopWidth: 1, borderTopColor: Colors.divider }, //
  nextButton: { backgroundColor: Colors.primaryDark, borderRadius: Radius.md, height: 48, alignItems: 'center', justifyContent: 'center' }, //
  nextButtonDisabled: { backgroundColor: Colors.border }, //
  nextButtonText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.bold }, //
});