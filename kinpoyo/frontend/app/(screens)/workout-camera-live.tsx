// AI回数カウント（リアルタイム版）。**Expo Go で動く構成**。
//
// Expo Go は Expo SDK の固定セットを内蔵した既製アプリなので、react-native-vision-camera
// や react-native-mediapipe のようなカスタムネイティブモジュールを読み込めない。
// つまり端末上でMediaPipeを回すことはできない。そこで expo-camera で連写し、
// base64 JPEG を WebSocket で backend へ送り、**姿勢推定とカウント判定はサーバー側**で行う。
// （オンデバイス版は experimental/workout-camera-live.ondevice.tsx に退避してある）
//
// ── 画面のフロー ────────────────────────────────────────
//   準備   : モデルが見る**全ての関節**が信頼できる可視性で映るまで待つ
//   計測中 : 自動で開始。1レップごとに音。目標レップ数まで数える
//   予告   : セット完了後「次は何か」（休憩／次の種目／終了）を明示してから進む
//   休憩   : カウントダウン。終わったら自動で次セットへ
//   （↑をセット×種目ぶん繰り返す）
//   完了   : 余韻を置いてから終了画面へ
//
// 操作は**左上の中断ボタン1つだけ**。中断は最初からやり直しになるので確認を挟む。
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSize, FontWeight, Radius, Shadow, Space } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import { API_BASE_URL } from '@/services/api';
import { fetchExercises } from '@/services/exercises';
import {
  abortWorkout, addSessionSet, fetchWorkout, updateSessionSet,
  type RepCycleJson, type WorkoutSessionOut,
} from '@/services/workout';
import {
  playWorkoutSound, prepareWorkoutSounds, releaseWorkoutSounds,
} from '@/lib/workoutSounds';

type RepEventMsg = {
  counted: boolean; not_counted_reason: string | null;
  start_sec: number; end_sec: number;
  bottom_deg: number; top_deg: number; rom_deg: number; period_sec: number;
  depth_gap_deg: number; max_stall_sec: number;
  form_quality: 'good' | 'needs_improvement' | null;
};

type Phase =
  | 'loading' | 'error'
  | 'preparing'   // 監視関節が全て映るのを待っている
  | 'counting'    // 計測中
  | 'announcing'  // セット完了。次に何が起きるかを見せている
  | 'resting'     // 休憩カウントダウン
  | 'finished';   // 全メニュー完了

/** 1種目ぶんの計測プラン。 */
type ExercisePlan = {
  sessionExerciseId: number;
  exerciseId: number;
  name: string;
  sets: { id: number; targetReps: number | null; restSec: number | null }[];
};

// 撮影は setInterval では回さない。iOS の AVCapturePhotoOutput は1枚あたり
// 数百msかかり、前の撮影が内部で終わる前に次を要求すると
// "Image could not be captured" で落ちる（実機で1枚目だけ成功して以降全滅した）。
// 1枚終わってから次を撮る自己駆動ループにし、間に最低限の間隔だけ空ける。
const MIN_CAPTURE_GAP_MS = 60;
const PICTURE_QUALITY = 0.3;
/** 監視関節が全て信頼できる状態が何サンプル続いたら計測を始めるか。単発では始めない。 */
const READY_CONSECUTIVE_SAMPLES = 5;
const DEFAULT_REST_SEC = 60;
/** 「次は○○」を見せている時間。読む間もなく切り替わると何が起きたか分からない。 */
const ANNOUNCE_MS = 2400;
/** メニュー完了後、終了画面へ移るまでの余韻。 */
const FINISH_LINGER_MS = 2800;

const PHASE_UI: Record<Phase, { label: string; color: string }> = {
  loading: { label: '準備中', color: '#9CA3AF' },
  error: { label: 'エラー', color: Colors.error },
  preparing: { label: '計測開始前', color: '#F59E0B' },
  counting: { label: '計測中', color: '#22C55E' },
  announcing: { label: 'セット完了', color: '#8B5CF6' },
  resting: { label: '休憩中', color: '#3B82F6' },
  finished: { label: '完了', color: '#22C55E' },
};

export default function WorkoutCameraLiveScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = Number(params.sessionId);
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);

  const [exerciseName, setExerciseName] = useState('種目');
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [totalExercises, setTotalExercises] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [totalSets, setTotalSets] = useState(0);
  const [targetReps, setTargetReps] = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [liveFps, setLiveFps] = useState(0);
  const [restLeftSec, setRestLeftSec] = useState(0);
  const [announce, setAnnounce] = useState<{ title: string; body: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmAbort, setConfirmAbort] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const loopRunningRef = useRef(false);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>('loading');
  // ws.onmessage は接続時の関数を保持し続けるため、進行状況は必ず ref で持つ。
  // state を直接参照すると初期値に固定され、2セット目以降へ進めなくなる。
  const planRef = useRef<ExercisePlan[]>([]);
  const exIdxRef = useRef(0);
  const setIdxRef = useRef(0);
  const setStartedAtRef = useRef(0);
  const inFlightRef = useRef(false);
  const readySamplesRef = useRef(0);
  const lastCountRef = useRef(0);
  const sampleTimesRef = useRef<number[]>([]);
  const mountedRef = useRef(true);
  // ログは1回だけ出す。毎フレーム出すとMetroのコンソールが埋まって他が読めない。
  const loggedCaptureRef = useRef(false);
  const loggedErrorRef = useRef(false);
  // ws.onmessage は代入時の関数を握り続ける。描画後のeffectで割り当てる方式だと、
  // 割り当て前に届いた ready を取りこぼして「何も起きない」状態になる。
  // ref経由で常に最新のハンドラへ委譲する。
  const handlerRef = useRef<((e: WebSocketMessageEvent) => void) | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  // 計測中だけ枠とドットを脈動させる。色だけだと動いているのか止まっているのか分からない。
  useEffect(() => {
    pulse.stopAnimation();
    if (phase !== 'counting') { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const flashToast = useCallback((text: string) => {
    setToast(text);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(950),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => { if (mountedRef.current) setToast(null); });
  }, [toastOpacity]);

  const stopLoop = () => { loopRunningRef.current = false; };
  const stopRestTimer = () => {
    if (restTimerRef.current !== null) { clearInterval(restTimerRef.current); restTimerRef.current = null; }
  };

  useEffect(() => {
    mountedRef.current = true;
    void prepareWorkoutSounds();
    return () => {
      mountedRef.current = false;
      stopLoop(); stopRestTimer();
      wsRef.current?.close();
      releaseWorkoutSounds();
    };
  }, []);

  // ── 撮影解像度 ──────────────────────────────────
  const handleCameraReady = useCallback(async () => {
    const camera = cameraRef.current;
    if (camera === null) return;
    // ⚠️ pictureSize は指定しない。前面カメラが対応しない値を渡すと
    // takePictureAsync が毎回 "Image could not be captured" で失敗する
    // （実機で発生。1フレームもサーバーに届かなかった）。
    // どんな候補が返るかはログに出して、必要になったら手で選べるようにしておく。
    try {
      const sizes = await camera.getAvailablePictureSizesAsync();
      console.log('[workout-camera-live] 利用可能な撮影サイズ:', JSON.stringify(sizes));
    } catch (e) {
      console.log('[workout-camera-live] 撮影サイズの取得に失敗', e);
    }
  }, []);

  // ── フレーム送信（1枚ずつ、終わったら次）────────────────
  const sendFrame = useCallback(async () => {
    const ws = wsRef.current;
    const camera = cameraRef.current;
    if (ws === null || ws.readyState !== WebSocket.OPEN || camera === null) return;
    if (inFlightRef.current) return;   // 溜めない（時刻と実時間がずれるとテンポ判定が壊れる）
    inFlightRef.current = true;
    try {
      const picture = await camera.takePictureAsync({
        base64: true, quality: PICTURE_QUALITY,
        shutterSound: false,
        // ⚠️ skipProcessing: true にしてはいけない。expo-camera の説明どおり
        // 「向き補正のパイプラインを丸ごと飛ばす」ため、端末を縦に持っていても
        // 横倒しのままの画像が返る。横倒しの人物はMediaPipeの姿勢推定が大きく崩れ、
        // visibility が落ちて「全身が映っているのに計測が始まらない」状態になる。
        // 取得は多少遅くなるが、向きが合っていないと何も始まらない。
        skipProcessing: false,
      });
      if (picture?.base64 == null) {
        console.log('[workout-camera-live] base64が空');
        return;
      }
      if (!loggedCaptureRef.current) {
        loggedCaptureRef.current = true;
        console.log(
          `[workout-camera-live] 撮影成功 ${picture.width}x${picture.height} ` +
          `base64=${Math.round(picture.base64.length / 1024)}KB`
        );
      }
      ws.send(JSON.stringify({
        t: (Date.now() - setStartedAtRef.current) / 1000, image: picture.base64,
      }));
    } catch (e) {
      if (!loggedErrorRef.current) {
        loggedErrorRef.current = true;
        console.log('[workout-camera-live] 撮影に失敗（以降は抑制）', e);
      }
      // 失敗直後に間髪入れず撮り直すと連鎖して失敗し続けるので、少し待つ。
      await new Promise(r => setTimeout(r, 250));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  /** 撮影→送信を繰り返す自己駆動ループ。stopLoop() で止まる。 */
  const startLoop = useCallback(() => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;
    const tick = async () => {
      while (loopRunningRef.current && mountedRef.current) {
        const began = Date.now();
        await sendFrame();
        const rest = MIN_CAPTURE_GAP_MS - (Date.now() - began);
        if (rest > 0) await new Promise(r => setTimeout(r, rest));
      }
    };
    void tick();
  }, [sendFrame]);

  const startRest = useCallback((sec: number, onDone: () => void) => {
    setRestLeftSec(sec);
    setPhaseBoth('resting');
    stopRestTimer();
    restTimerRef.current = setInterval(() => {
      setRestLeftSec(prev => {
        if (prev <= 1) { stopRestTimer(); onDone(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── 次に何が起きるかを見せてから進む ─────────────────
  const announceThen = useCallback(
    (title: string, body: string, sound: 'rest' | 'finish', next: () => void) => {
      stopLoop();
      playWorkoutSound(sound);
      setAnnounce({ title, body });
      setPhaseBoth('announcing');
      setTimeout(() => {
        if (!mountedRef.current) return;
        setAnnounce(null);
        next();
      }, ANNOUNCE_MS);
    }, []);

  // ── セット開始 ───────────────────────────────────
  const beginSet = useCallback((nextSetIdx: number) => {
    if (!mountedRef.current) return;
    const plan = planRef.current[exIdxRef.current];
    setIdxRef.current = nextSetIdx;
    setSetIdx(nextSetIdx);
    setTargetReps(plan?.sets[nextSetIdx]?.targetReps ?? null);
    setLiveCount(0);
    lastCountRef.current = 0;
    readySamplesRef.current = 0;
    playWorkoutSound('resume');
    // 休憩明けも「監視関節が全て映っているか」から入り直す。位置がずれているため。
    setStartedAtRef.current = Date.now();
    setPhaseBoth('preparing');
    stopLoop();
    startLoop();
  }, [sendFrame, startLoop]);

  // ── 種目ごとのWS接続 ──────────────────────────────
  const connectExercise = useCallback((index: number) => {
    const plan = planRef.current[index];
    if (plan === undefined) return;
    wsRef.current?.close();

    exIdxRef.current = index;
    setIdxRef.current = 0;
    setExerciseIdx(index);
    setExerciseName(plan.name);
    setTotalSets(plan.sets.length);
    setSetIdx(0);
    setTargetReps(plan.sets[0]?.targetReps ?? null);
    setLiveCount(0);
    lastCountRef.current = 0;
    readySamplesRef.current = 0;

    const base = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(
      `${base}/exercises/${plan.exerciseId}/count-reps/stream?token=${encodeURIComponent(token ?? '')}`
    );
    wsRef.current = ws;
    ws.onmessage = e => handlerRef.current?.(e);
    ws.onerror = () => {
      if (!mountedRef.current) return;
      setErrorText('サーバーに接続できませんでした');
      setPhaseBoth('error');
      stopLoop();
    };
    ws.onclose = () => stopLoop();
  }, [token]);

  // ── セット完了 → 次の行き先を決める ──────────────────
  const finishSet = useCallback(async (counted: number, events: RepEventMsg[]) => {
    const exIdx = exIdxRef.current;
    const sIdx = setIdxRef.current;
    const plan = planRef.current[exIdx];
    const slot = plan?.sets[sIdx];

    if (plan !== undefined && slot !== undefined) {
      // start/end はリアルタイムでは fps が可変なのでミリ秒。AIレビューは
      // counted / form_quality / 角度 / period_sec しか読まないため影響しない。
      const repCycles: RepCycleJson[] = events.map(e => ({
        start: Math.round(e.start_sec * 1000), end: Math.round(e.end_sec * 1000),
        counted: e.counted, form_quality: e.form_quality, distance: null,
        bottom_deg: e.bottom_deg, top_deg: e.top_deg, period_sec: e.period_sec,
      }));
      const payload = { ai_counted_reps: counted, rep_cycles_json: repCycles };
      try {
        if (slot.id > 0) {
          await updateSessionSet(token, sessionId, plan.sessionExerciseId, slot.id, payload);
        } else {
          await addSessionSet(token, sessionId, plan.sessionExerciseId, payload);
        }
      } catch (e) {
        console.log('[workout-camera-live] セット保存に失敗', e);
      }
    }

    const hasNextSet = plan !== undefined && sIdx < plan.sets.length - 1;
    const hasNextExercise = exIdx < planRef.current.length - 1;
    const restSec = slot?.restSec ?? DEFAULT_REST_SEC;

    if (hasNextSet) {
      announceThen('休憩', `${restSec}秒 休んだら ${sIdx + 2}セット目`, 'rest',
        () => startRest(restSec, () => beginSet(sIdx + 1)));
      return;
    }

    if (hasNextExercise) {
      const nextName = planRef.current[exIdx + 1].name;
      announceThen('次の種目へ', `${restSec}秒 休んだら「${nextName}」`, 'rest',
        () => startRest(restSec, () => connectExercise(exIdx + 1)));
      return;
    }

    // 全種目・全セット完了
    wsRef.current?.send(JSON.stringify({ type: 'stop' }));
    announceThen('メニュー完了', 'おつかれさまでした', 'finish', () => {
      setPhaseBoth('finished');
      setTimeout(() => {
        if (!mountedRef.current) return;
        router.replace({
          pathname: '/(screens)/workout-finish', params: { sessionId: String(sessionId) },
        });
      }, FINISH_LINGER_MS);
    });
  }, [token, sessionId, announceThen, startRest, beginSet, connectExercise]);

  // ── WSメッセージ処理（進行状況は ref を見るのでクロージャ固定に強い）──
  const handleMessage = useCallback((e: WebSocketMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(e.data as string); } catch { return; }
    if (!mountedRef.current) return;

    if (msg.type === 'ready') {
      readySamplesRef.current = 0;
      setStartedAtRef.current = Date.now();
      setPhaseBoth('preparing');
      stopLoop();
      startLoop();
      return;
    }

    if (msg.type === 'sample') {
      const now = Date.now();
      sampleTimesRef.current = [...sampleTimesRef.current, now].filter(t => now - t < 2000);
      setLiveFps(Math.round((sampleTimesRef.current.length / 2) * 10) / 10);

      if (phaseRef.current === 'preparing') {
        // 計測開始の条件は「モデルが見る**全ての**関節が信頼できる可視性で映っている」。
        // 主役関節の角度が取れただけでは体の一部しか入っていないことがある。
        if (msg.joints_ok === true) {
          readySamplesRef.current += 1;
          if (readySamplesRef.current >= READY_CONSECUTIVE_SAMPLES) {
            playWorkoutSound('start');
            flashToast('計測開始');
            setStartedAtRef.current = Date.now();
            lastCountRef.current = 0;
            setPhaseBoth('counting');
          }
        } else {
          readySamplesRef.current = 0;
        }
        return;
      }

      if (phaseRef.current === 'counting') {
        const count = msg.count as number;
        if (count > lastCountRef.current) {
          lastCountRef.current = count;
          playWorkoutSound('rep');   // 1回数えたことを音で返す
        }
        setLiveCount(count);
      }
      return;
    }

    if (msg.type === 'set_done') {
      void finishSet(msg.count as number, msg.events as RepEventMsg[]);
      return;
    }

    if (msg.type === 'error') {
      setErrorText(msg.detail);
      setPhaseBoth('error');
      stopLoop();
    }
  }, [sendFrame, startLoop, flashToast, finishSet]);

  // 毎描画で最新のハンドラに差し替える（ws.onmessage 自体はref経由なので張り替え不要）。
  handlerRef.current = handleMessage;

  // ── 目標レップ数に達したらセット終了 ────────────────
  useEffect(() => {
    if (phase !== 'counting' || targetReps === null || liveCount < targetReps) return;
    const ws = wsRef.current;
    if (ws !== null && ws.readyState === WebSocket.OPEN) {
      stopLoop();
      ws.send(JSON.stringify({ type: 'reset' }));   // → set_done が返る
    }
  }, [liveCount, targetReps, phase]);

  // ── 起動時：セッションを読んで、較正済み種目だけの計測プランを作る ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (permission !== null && !permission.granted) await requestPermission();
        if (!Number.isFinite(sessionId)) {
          setErrorText('セッション情報が渡されていません');
          setPhaseBoth('error');
          return;
        }
        // 較正済みモデルがある種目だけを対象にする。1リクエストで判定できる。
        const [session, aiReady] = await Promise.all([
          fetchWorkout(token, sessionId) as Promise<WorkoutSessionOut>,
          fetchExercises(true),
        ]);
        if (cancelled) return;
        const aiIds = new Set(aiReady.map(e => e.id));
        const plan: ExercisePlan[] = session.exercises
          .filter(ex => aiIds.has(ex.exercise_id))
          .sort((a, b) => a.order_index - b.order_index)
          .map(ex => {
            const planned = [...ex.sets].sort((a, b) => a.set_number - b.set_number);
            const sets = planned.length > 0
              ? planned.map(s => ({ id: s.id, targetReps: s.reps, restSec: s.rest_after_sec }))
              : Array.from({ length: ex.target_sets ?? 1 }, () => ({
                  id: -1, targetReps: null as number | null, restSec: ex.rest_interval_sec,
                }));
            return {
              sessionExerciseId: ex.id, exerciseId: ex.exercise_id,
              name: ex.exercise_name, sets,
            };
          });

        if (plan.length === 0) {
          setErrorText('AI回数カウントに対応した種目がメニューにありません');
          setPhaseBoth('error');
          return;
        }
        planRef.current = plan;
        setTotalExercises(plan.length);
        connectExercise(0);
      } catch (e) {
        if (cancelled) return;
        setErrorText(e instanceof Error ? e.message : 'セッションの取得に失敗しました');
        setPhaseBoth('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  // ── 中断（確認あり。最初からやり直しになるため）──────────
  const doAbort = async () => {
    setConfirmAbort(false);
    stopLoop(); stopRestTimer();
    const ws = wsRef.current;
    if (ws !== null && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }));
    ws?.close();
    // セッションを「予定済み」に戻す。これをしないと開始画面に「実施中」が
    // 残り続け、やり直せなくなる。失敗しても画面は戻す（戻れない方が困る）。
    try {
      await abortWorkout(token, sessionId);
    } catch (e) {
      console.log('[workout-camera-live] 中断処理に失敗', e);
    }
    router.back();
  };

  // ── 表示 ────────────────────────────────────────
  const header = <Stack.Screen options={{ headerShown: false }} />;
  const ui = PHASE_UI[phase];

  if (phase === 'loading' || permission === null) {
    return (
      <SafeAreaView style={styles.container}>{header}
        <View style={styles.centerBox}><ActivityIndicator color={Colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>{header}
        <View style={styles.centerBox}>
          <Text style={styles.noticeTitle}>カメラの使用を許可してください</Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>許可する</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container}>{header}
        <View style={styles.centerBox}>
          <Text style={styles.noticeTitle}>計測を開始できませんでした</Text>
          {errorText !== null && <Text style={styles.noticeBody}>{errorText}</Text>}
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>戻る</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <CameraView
        ref={cameraRef} style={styles.camera}
        facing="front" mode="picture"
        onCameraReady={handleCameraReady}
      />

      {/* 画面全周の枠。周辺視野で状態が分かるようにする最重要要素 */}
      <Animated.View pointerEvents="none" style={[styles.frame, {
        borderColor: ui.color,
        borderWidth: pulse.interpolate({ inputRange: [0, 1], outputRange: [8, 16] }),
      }]} />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable style={styles.abortBtn} onPress={() => setConfirmAbort(true)} hitSlop={12}>
            <IconSymbol name="xmark" size={18} color={Colors.textOnPrimary} />
            <Text style={styles.abortBtnText}>中断</Text>
          </Pressable>
          <View style={styles.setBadge}>
            <Text style={styles.setBadgeText}>
              {totalExercises > 1 ? `種目 ${exerciseIdx + 1}/${totalExercises}・` : ''}
              {totalSets > 0 ? `${setIdx + 1}/${totalSets} セット` : '計測'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow} pointerEvents="none">
          <View style={[styles.statusPill, { backgroundColor: ui.color }]}>
            <Animated.View style={[styles.statusDot, {
              opacity: phase === 'counting'
                ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) : 1,
            }]} />
            <Text style={styles.statusText}>{ui.label}</Text>
          </View>
        </View>

        <View style={styles.center} pointerEvents="none">
          {phase === 'preparing' && (
            <View style={styles.guideBox}>
              <Text style={styles.guideTitle}>全身が映るように{'\n'}立ち位置を調整してください</Text>
              <Text style={styles.guideBody}>
                この種目で見る関節が全て映ると自動で始まります
              </Text>
              <ActivityIndicator color={Colors.textOnPrimary} style={{ marginTop: Space[3] }} />
            </View>
          )}

          {phase === 'announcing' && announce !== null && (
            <View style={styles.guideBox}>
              <Text style={styles.announceTitle}>{announce.title}</Text>
              <Text style={styles.announceBody}>{announce.body}</Text>
            </View>
          )}

          {phase === 'resting' && (
            <View style={styles.guideBox}>
              <Text style={styles.restLabel}>休憩</Text>
              <Text style={styles.restCount}>{restLeftSec}</Text>
            </View>
          )}

          {phase === 'finished' && (
            <View style={styles.guideBox}>
              <Text style={styles.announceTitle}>おつかれさまでした</Text>
              <Text style={styles.announceBody}>メニューをすべて完了しました</Text>
            </View>
          )}
        </View>

        {(phase === 'counting' || phase === 'preparing') && (
          <View style={styles.bottom} pointerEvents="none">
            <Text style={styles.exerciseName} numberOfLines={1} adjustsFontSizeToFit>
              {exerciseName}
            </Text>
            <View style={styles.countRow}>
              <Text style={styles.countValue}>{liveCount}</Text>
              {targetReps !== null && <Text style={styles.countTarget}>/{targetReps}</Text>}
            </View>
            <Text style={styles.fps}>{liveFps} fps</Text>
          </View>
        )}
      </SafeAreaView>

      {toast !== null && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* 中断確認。中断＝最初からやり直しなので、誤タップで消えないようにする */}
      <Modal visible={confirmAbort} transparent animationType="fade"
             onRequestClose={() => setConfirmAbort(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalDialog}>
            <Text style={styles.modalTitle}>計測を中断しますか？</Text>
            <Text style={styles.modalBody}>
              ここまでの計測は保存されず、最初からやり直しになります。
            </Text>
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setConfirmAbort(false)}>
                <Text style={styles.modalCancelBtnText}>続ける</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={() => { void doAbort(); }}>
                <Text style={styles.modalConfirmBtnText}>中断する</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  frame: { ...StyleSheet.absoluteFillObject, borderRadius: Radius.sm },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Space[4], gap: Space[3], backgroundColor: Colors.bgScreen,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space[4], paddingTop: Space[2],
  },
  abortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Space[1],
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.lg,
    paddingHorizontal: Space[3], paddingVertical: Space[2],
  },
  abortBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  setBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.lg,
    paddingHorizontal: Space[3], paddingVertical: Space[2],
  },
  setBadgeText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  statusRow: { alignItems: 'center', marginTop: Space[3] },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: Space[2],
    paddingHorizontal: Space[4], paddingVertical: Space[2], borderRadius: Radius.xl, ...Shadow.md,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  statusText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space[5] },
  guideBox: {
    alignItems: 'center', gap: Space[2],
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.xl, padding: Space[5],
  },
  guideTitle: {
    color: Colors.textOnPrimary, fontSize: FontSize.lg,
    fontWeight: FontWeight.bold, textAlign: 'center', lineHeight: 28,
  },
  guideBody: { color: Colors.textOnPrimary, fontSize: FontSize.sm, textAlign: 'center', opacity: 0.85 },
  announceTitle: {
    color: Colors.textOnPrimary, fontSize: 46, fontWeight: FontWeight.bold, textAlign: 'center',
  },
  announceBody: {
    color: Colors.textOnPrimary, fontSize: FontSize.lg, textAlign: 'center', opacity: 0.9,
  },
  restLabel: { color: Colors.textOnPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  restCount: { color: Colors.textOnPrimary, fontSize: 104, fontWeight: FontWeight.bold, lineHeight: 112 },
  bottom: { alignItems: 'center', paddingBottom: Space[5], paddingHorizontal: Space[3] },
  exerciseName: {
    color: Colors.textOnPrimary, fontSize: 52, fontWeight: FontWeight.bold, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  countValue: {
    color: Colors.textOnPrimary, fontSize: 180, fontWeight: FontWeight.bold, lineHeight: 190,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 10,
  },
  countTarget: {
    color: Colors.textOnPrimary, fontSize: 64, fontWeight: FontWeight.bold, opacity: 0.85,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  fps: { color: Colors.textOnPrimary, fontSize: FontSize.xs, opacity: 0.55 },
  toast: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  toastText: {
    color: Colors.textOnPrimary, fontSize: 60, fontWeight: FontWeight.bold,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: Space[6], paddingVertical: Space[4],
    borderRadius: Radius.xl, overflow: 'hidden', textAlign: 'center',
  },
  noticeTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center',
  },
  noticeBody: { fontSize: FontSize.sm, color: Colors.textHint, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primaryDark, borderRadius: Radius.lg,
    paddingVertical: Space[3], paddingHorizontal: Space[5], alignItems: 'center', ...Shadow.md,
  },
  primaryBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalOverlay: {
    flex: 1, backgroundColor: Colors.bgOverlay, alignItems: 'center', justifyContent: 'center',
    padding: Space[5],
  },
  modalDialog: {
    width: '100%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Space[5], gap: Space[3], ...Shadow.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: Space[3], marginTop: Space[2] },
  modalCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Space[3],
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderStrong,
  },
  modalCancelBtnText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  modalConfirmBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Space[3],
    borderRadius: Radius.md, backgroundColor: Colors.error,
  },
  modalConfirmBtnText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
