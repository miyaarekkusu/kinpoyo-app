/**
 * 計測中の効果音。
 *
 * 画面から目を離していても状態変化が分かるようにするためのもの（計測中は自分が
 * カメラに全身を映しているので画面を見ていられない）。文字表示だけだと気づけない。
 *
 * 音源は `assets/sounds/*.wav`。外部から持ってきたものではなく、
 * 短いサイン波を合成して生成した1秒未満のビープ。
 *
 * expo-audio は Expo Go に同梱されているので dev client を作らなくても鳴る。
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type WorkoutSoundName = 'start' | 'rep' | 'rest' | 'resume' | 'finish';

const SOURCES: Record<WorkoutSoundName, number> = {
  // 計測開始：上昇する2音
  start: require('../assets/sounds/start.wav'),
  // 1回カウント：短いクリック。連続で鳴るので耳障りにならない長さにしてある
  rep: require('../assets/sounds/rep.wav'),
  // 休憩開始：下降する2音
  rest: require('../assets/sounds/rest.wav'),
  // 休憩終了・次セット開始：短い3連
  resume: require('../assets/sounds/resume.wav'),
  // メニュー完了：長めの上昇3音
  finish: require('../assets/sounds/finish.wav'),
};

let players: Partial<Record<WorkoutSoundName, AudioPlayer>> = {};
let prepared = false;

/**
 * プレイヤーを先に作っておく。鳴らす瞬間に生成すると初回だけ遅れて、
 * 「計測開始」の合図が実際の開始とズレる。
 */
export async function prepareWorkoutSounds(): Promise<void> {
  if (prepared) return;
  try {
    // マナーモードでも鳴らす。計測の合図が消音されると意味がないため。
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch (e) {
    console.log('[workoutSounds] オーディオモードの設定に失敗', e);
  }
  for (const name of Object.keys(SOURCES) as WorkoutSoundName[]) {
    try {
      players[name] = createAudioPlayer(SOURCES[name]);
    } catch (e) {
      console.log('[workoutSounds] プレイヤー生成に失敗', name, e);
    }
  }
  prepared = true;
  // 音が鳴らないと言われたときに「プレイヤーが作れていない」のか
  // 「呼ばれていない」のかを切り分けられるようにしておく。
  console.log('[workoutSounds] 準備完了:', Object.keys(players).join(', ') || '(なし)');
}

/** 効果音を鳴らす。失敗しても計測は止めない（音は補助であって本体ではない）。 */
export function playWorkoutSound(name: WorkoutSoundName): void {
  const player = players[name];
  if (player === undefined) {
    console.log('[workoutSounds] プレイヤー未生成のため鳴らせない:', name);
    return;
  }
  // seekTo は Promise を返す。await せずに play() すると前回の再生位置から鳴る
  // ことがあるので、必ず巻き戻し完了を待ってから再生する。
  player
    .seekTo(0)
    .then(() => player.play())
    .catch(e => console.log('[workoutSounds] 再生に失敗', name, e));
}

/** 画面を離れるときに解放する。 */
export function releaseWorkoutSounds(): void {
  for (const player of Object.values(players)) {
    try {
      player?.remove();
    } catch {
      // 解放済みなら無視
    }
  }
  players = {};
  prepared = false;
}
