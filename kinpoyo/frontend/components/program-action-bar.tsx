import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSize, FontWeight, Layout, Radius, Shadow, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/services/api';
import {
  UserProgramOut,
  fetchMyPrograms,
  fetchPrograms,
  joinProgram,
  leaveProgram,
} from '@/services/program';

type DialogState =
  | { kind: 'none' }
  | { kind: 'join-confirm' }
  | { kind: 'leave-confirm' }
  | { kind: 'blocked-notice'; otherName: string };

type ResolvedProgram = { id: number; name: string };

export function ProgramActionBar({
  programName,
  programId,
}: {
  programName: string;
  /** 非公開のプログラム（例：カスタムプログラム）を指す場合に指定。公開一覧の名前検索をスキップする */
  programId?: number;
}) {
  const { token } = useAuth();
  const [program, setProgram] = useState<ResolvedProgram | null>(null);
  const [myPrograms, setMyPrograms] = useState<UserProgramOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (programId != null) {
        const mine = await fetchMyPrograms(token);
        const own = mine.find(up => up.program_id === programId);
        setProgram(own ? { id: own.program_id, name: own.program_name } : null);
        setMyPrograms(mine);
      } else {
        const [programs, mine] = await Promise.all([fetchPrograms(), fetchMyPrograms(token)]);
        setProgram(programs.find(p => p.name === programName) ?? null);
        setMyPrograms(mine);
      }
    } catch {
      setProgram(null);
      setMyPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [token, programName, programId]);

  useEffect(() => {
    load();
  }, [load]);

  const mine = program ? myPrograms.find(up => up.program_id === program.id) : undefined;
  const otherActive = program
    ? myPrograms.find(up => up.status_code === 'active' && up.program_id !== program.id)
    : undefined;
  const disabled = mine?.status_code === 'dropped' || mine?.status_code === 'completed';

  const closeDialog = () => setDialog({ kind: 'none' });

  const handlePress = () => {
    if (!program || disabled) return;
    if (mine?.status_code === 'active') {
      setDialog({ kind: 'leave-confirm' });
    } else if (otherActive) {
      setDialog({ kind: 'blocked-notice', otherName: otherActive.program_name });
    } else {
      setDialog({ kind: 'join-confirm' });
    }
  };

  const handleJoin = async () => {
    if (!program) return;
    setBusy(true);
    setError(null);
    try {
      await joinProgram(token, program.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '参加処理に失敗しました');
    } finally {
      setBusy(false);
      closeDialog();
    }
  };

  const handleLeave = async () => {
    if (!mine) return;
    setBusy(true);
    setError(null);
    try {
      await leaveProgram(token, mine.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '中断処理に失敗しました');
    } finally {
      setBusy(false);
      closeDialog();
    }
  };

  const label = !program
    ? '読み込みに失敗しました'
    : mine?.status_code === 'active'
      ? 'プログラムを中断する'
      : mine?.status_code === 'dropped'
        ? 'このプログラムは中断済みです'
        : mine?.status_code === 'completed'
          ? 'このプログラムは完了済みです'
          : otherActive
            ? '参加できません'
            : 'このプログラムに参加する';

  return (
    <>
      <View style={styles.bottomBar}>
        <SafeAreaView edges={['bottom']}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[
              styles.startBtn,
              (disabled || !!otherActive || !program) && styles.startBtnMuted,
              mine?.status_code === 'active' && styles.startBtnDanger,
            ]}
            onPress={handlePress}
            disabled={disabled || busy || loading || !program}
            activeOpacity={0.85}>
            {loading || busy ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.startBtnText}>{label}</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <Modal visible={dialog.kind === 'join-confirm'} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>『{programName}』に参加しますか？</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={closeDialog}>
                <Text style={styles.dialogCancelBtnText}>拒否</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogConfirmBtn} onPress={handleJoin}>
                <Text style={styles.dialogConfirmBtnText}>参加する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dialog.kind === 'leave-confirm'} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>『{programName}』を中断しますか？</Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={closeDialog}>
                <Text style={styles.dialogCancelBtnText}>拒否</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogDangerBtn} onPress={handleLeave}>
                <Text style={styles.dialogConfirmBtnText}>中断する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={dialog.kind === 'blocked-notice'} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.dialogTitle}>参加できません</Text>
            <Text style={styles.dialogMessage}>
              参加中のプログラム（{dialog.kind === 'blocked-notice' ? dialog.otherName : ''}
              ）があるため、新しいプログラムには参加できません。
            </Text>
            <TouchableOpacity style={styles.dialogConfirmBtn} onPress={closeDialog}>
              <Text style={styles.dialogConfirmBtnText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Layout.screenPaddingH,
    paddingTop: Space[3],
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Space[2],
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    height: Layout.buttonHeightLg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDark,
    marginBottom: Space[3],
    ...Shadow.md,
    shadowColor: Colors.primaryDark,
  },
  startBtnMuted: {
    backgroundColor: Colors.textHint,
    shadowOpacity: 0,
  },
  startBtnDanger: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },

  // ── 確認/通知ダイアログ（画面内オーバーレイ）
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
  dialogConfirmBtn: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
  },
  dialogDangerBtn: {
    flex: 1,
    paddingVertical: Space[3],
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  dialogConfirmBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});
