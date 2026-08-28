// AI回数カウント（リアルタイム版）。オンデバイス方式。
//
// バッチ版（workout-camera.tsx）と違い、録画もアップロードもしない。端末上で
// MediaPipe Tasks のポーズ検出を回し、world ランドマークから主役関節の角度を出して、
// 端末上の因果的カウンタ（lib/realtimeRepCounter.ts）に1サンプルずつ流し込む。
// backend へは最終結果（回数・サイクル内訳）だけを保存する。
//
// 設計の詳細は notes/realtime-count-design-memo.txt を参照。要点:
//   - カウント判定＝「流れに沿って最後まで追従できたか」。連続して外れたらノーカン
//   - 判定軸は位相の進み方（停滞検知）。角度の許容帯は持たない
//   - しきい値は全て秒（端末のフレームレートが可変なため）
//
// ⚠️ 較正モデルとの噛み合わせ: 現在の rep_count_models は model-studio の
// legacy API（mp.solutions.pose）で較正されている。本画面が使う MediaPipe Tasks の
// 骨格モデルは別物なので、絶対角度がズレて閾値が合わない可能性がある
// （AGENTS.md『実装中に判明した重要な制約』1）。実機で数値を確認し、必要なら
// Tasks API で再較正すること。
//
// ⚠️ 計測区間: 本画面は「計測開始」を押している間だけカウンタを動かす。セット管理
// フロー（休憩中は止める）と結合する際は、この start()/stop() を呼ぶ側を差し替える。
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { MediapipeCamera, RunningMode, usePoseDetection } from 'react-native-mediapipe';

import { Colors, FontSize, FontWeight, Radius, Shadow, Space } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { fetchRepModel } from '@/services/exercises';
import { addSessionSet, generateAiReview, type RepCycleJson } from '@/services/workout';
import {
  buildCounter,
  type RealtimeRepCounter,
  type RepEvent,
} from '@/lib/realtimeRepCounter';
import { jointAngle, type Point3 } from '@/lib/poseAngles';

// 端末にバンドルされている MediaPipe Tasks のポーズモデル。native 側の assets に
// 置く必要がある（iOS: ios/<Target>/ に追加、Android: android/app/src/main/assets/）。
// lite / full / heavy の3種があり、まずは lite で始めて精度不足なら full を試す。
const POSE_MODEL = 'pose_landmarker_lite';

type ScreenState = 'loading' | 'not-registered' | 'error' | 'ready' | 'counting' | 'result';

export default function WorkoutCameraLiveScreen() {
  const params = useLocalSearchParams<{
    exerciseId: string;
    exerciseName?: string;
    sessionId?: string;
    sessionExerciseId?: string;
  }>();
  const exerciseId = Number(params.exerciseId);
  const exerciseName = params.exerciseName ?? '種目';
  const sessionId = params.sessionId !== undefined ? Number(params.sessionId) : NaN;
  const sessionExerciseId =
    params.sessionExerciseId !== undefined ? Number(params.sessionExerciseId) : NaN;
  const canSaveResult = Number.isFinite(sessionId) && Number.isFinite(sessionExerciseId);

  const { token } = useAuth();
  const { hasPermission, requestPermission } = useCameraPermission();

  const [state, setState] = useState<ScreenState>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [mainJoint, setMainJoint] = useState<string>('');
  const [liveCount, setLiveCount] = useState(0);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [events, setEvents] = useState<RepEvent[]>([]);
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const counterRef = useRef<RealtimeRepCounter | null>(null);
  const mainJointRef = useRef<string>('');
  const countingRef = useRef(false);
  const startedAtRef = useRef<number>(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── 較正済みモデルの取得とカウンタ組み立て ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!hasPermission) await requestPermission();
        const model = await fetchRepModel(exerciseId);
        if (cancelled) return;
        if (model === null) {
          setState('not-registered');
          return;
        }
        const built = buildCounter(model.config);
        if (built === null) {
          setErrorText('較正済みモデルの形式が想定と違います（template / cycleStats を確認）');
          setState('error');
          return;
        }
        counterRef.current = built.counter;
        mainJointRef.current = built.mainJoint;
        setMainJoint(built.mainJoint);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setErrorText(e instanceof Error ? e.message : '較正済みモデルの取得に失敗しました');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseId, hasPermission, requestPermission]);

  // ── ポーズ検出の結果を1サンプルずつカウンタへ ──────────
  const onResults = useCallback((bundle: any) => {
    if (!countingRef.current) return;
    const counter = counterRef.current;
    if (counter === null) return;

    // worldLandmarks は「検出した人物ごと」の配列。先頭の人物だけ使う。
    // 画像座標(landmarks)ではなく world を使うこと（lib/poseAngles.ts の注意書き参照）。
    const world: Point3[] | undefined = bundle?.results?.[0]?.worldLandmarks?.[0];
    const angle = jointAngle(world, mainJointRef.current);

    // 姿勢が取れなかったフレームも null のまま渡す（呼び飛ばすと経過時間が狂う）。
    const tSec = (Date.now() - startedAtRef.current) / 1000;
    const event = counter.update(tSec, angle);

    if (!mountedRef.current) return;
    setLiveAngle(angle === null ? null : Math.round(angle * 10) / 10);
    if (event !== null) {
      setEvents(prev => [...prev, event]);
      if (event.counted) setLiveCount(counter.count);
    }
  }, []);

  const onError = useCallback((e: unknown) => {
    console.log('[workout-camera-live] ポーズ検出エラー', e);
  }, []);

  const solution = usePoseDetection(
    { onResults, onError },
    RunningMode.LIVE_STREAM,
    POSE_MODEL
  );

  // ── 計測の開始・終了 ──────────────────────────────
  const handleStart = () => {
    const counter = counterRef.current;
    if (counter === null) return;
    setEvents([]);
    setLiveCount(0);
    setReviewText(null);
    counter.start();
    startedAtRef.current = Date.now();
    countingRef.current = true;
    setState('counting');
  };

  const handleStop = async () => {
    const counter = counterRef.current;
    if (counter === null) return;
    countingRef.current = false;
    const tail = counter.stop();
    const allEvents = tail === null ? counter.events : counter.events;
    if (mountedRef.current) {
      setEvents(allEvents);
      setLiveCount(counter.count);
      setState('result');
    }

    if (!canSaveResult) return;

    // rep_cycles_json の start/end はバッチ版ではフレーム番号だが、リアルタイムでは
    // fps が可変なので**ミリ秒**を入れる。AIレビュー（review_judge.aggregate_cycles）は
    // counted / form_quality / bottom_deg / top_deg / period_sec しか読まないため、
    // この単位差は判定に影響しない。
    const repCycles: RepCycleJson[] = allEvents.map(e => ({
      start: Math.round(e.startSec * 1000),
      end: Math.round(e.endSec * 1000),
      counted: e.counted,
      form_quality: e.formQuality,
      distance: null,
      bottom_deg: e.bottomDeg,
      top_deg: e.topDeg,
      period_sec: e.periodSec,
    }));

    try {
      await addSessionSet(token, sessionId, sessionExerciseId, {
        ai_counted_reps: counter.count,
        rep_cycles_json: repCycles,
      });
    } catch (saveError) {
      console.log('[workout-camera-live] 計測結果のセット保存に失敗', saveError);
      return;
    }

    setReviewLoading(true);
    generateAiReview(token, sessionId, sessionExerciseId)
      .then(review => {
        if (mountedRef.current) setReviewText(review.feedback_text);
      })
      .catch(e => console.log('[workout-camera-live] AIレビュー生成に失敗', e))
      .finally(() => {
        if (mountedRef.current) setReviewLoading(false);
      });
  };

  // ── 表示 ──────────────────────────────────────
  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'not-registered' || state === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.noticeTitle}>
            {state === 'not-registered'
              ? 'この種目はAI回数カウントに対応していません'
              : '準備に失敗しました'}
          </Text>
          {errorText !== null && <Text style={styles.noticeBody}>{errorText}</Text>}
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>戻る</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'result') {
    const counted = events.filter(e => e.counted);
    const noCount = events.filter(e => !e.counted);
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <Text style={styles.resultTitle}>{exerciseName}</Text>
          <Text style={styles.resultCount}>{counted.length}回</Text>

          {reviewLoading && (
            <View style={styles.reviewBox}>
              <ActivityIndicator color={Colors.primaryDark} />
              <Text style={styles.noticeBody}>AIトレーナーがレビューを作成中…</Text>
            </View>
          )}
          {reviewText !== null && (
            <View style={styles.reviewBox}>
              <Text style={styles.noticeBody}>{reviewText}</Text>
            </View>
          )}

          {noCount.length > 0 && (
            <Text style={styles.noticeBody}>
              流れから外れて数えなかった動作が {noCount.length} 回ありました
            </Text>
          )}

          {events.map((e, i) => (
            <View key={i} style={styles.cycleRow}>
              <Text style={styles.cycleText}>
                {i + 1}: {e.counted ? `カウント（${e.formQuality}）` : `ノーカン（${e.notCountedReason}）`}
              </Text>
              <Text style={styles.cycleSub}>
                深さ {e.bottomDeg}° / ROM {e.romDeg}° / 周期 {e.periodSec}s
              </Text>
            </View>
          ))}

          <Pressable style={styles.primaryBtn} onPress={handleStart}>
            <Text style={styles.primaryBtnText}>もう1セット計測する</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>終了して戻る</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ready / counting
  return (
    <View style={styles.container}>
      <MediapipeCamera style={styles.camera} solution={solution} activeCamera="back" />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.hud}>
          <Text style={styles.hudExercise}>{exerciseName}</Text>
          <Text style={styles.hudCount}>{liveCount}</Text>
          <Text style={styles.hudSub}>
            {mainJoint}: {liveAngle === null ? '検出なし' : `${liveAngle}°`}
          </Text>
        </View>
        <View style={styles.controls}>
          {state === 'ready' ? (
            <Pressable style={styles.primaryBtn} onPress={handleStart}>
              <Text style={styles.primaryBtnText}>計測開始</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.primaryBtnText}>計測終了</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgScreen },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space[4], gap: Space[3] },
  hud: {
    alignSelf: 'center', alignItems: 'center', marginTop: Space[4],
    paddingHorizontal: Space[5], paddingVertical: Space[3],
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: Radius.lg,
  },
  hudExercise: { color: Colors.textOnPrimary, fontSize: FontSize.sm },
  hudCount: { color: Colors.textOnPrimary, fontSize: 64, fontWeight: FontWeight.bold },
  hudSub: { color: Colors.textOnPrimary, fontSize: FontSize.sm },
  controls: { padding: Space[4], gap: Space[2] },
  primaryBtn: {
    backgroundColor: Colors.primaryDark, borderRadius: Radius.lg,
    paddingVertical: Space[3], alignItems: 'center', ...Shadow.md,
  },
  stopBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.lg,
    paddingVertical: Space[3], alignItems: 'center', ...Shadow.md,
  },
  primaryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  secondaryBtn: { paddingVertical: Space[3], alignItems: 'center' },
  secondaryBtnText: { color: Colors.primaryDark, fontSize: FontSize.md },
  resultContent: { padding: Space[4], gap: Space[3] },
  resultTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  resultCount: { fontSize: 56, fontWeight: FontWeight.bold, color: Colors.primaryDark, textAlign: 'center' },
  reviewBox: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Space[3],
    gap: Space[2], ...Shadow.md,
  },
  noticeTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  noticeBody: { fontSize: FontSize.sm, color: Colors.textHint, textAlign: 'center' },
  cycleRow: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Space[2] },
  cycleText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  cycleSub: { fontSize: FontSize.xs, color: Colors.textHint },
});
