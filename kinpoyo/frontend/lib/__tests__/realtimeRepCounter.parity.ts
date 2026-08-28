/**
 * TS版カウンタの回帰＋Python版との一致確認。
 *
 * 実行（Node 24 の型ストリップで直接動く。ビルド不要）::
 *
 *     node lib/__tests__/realtimeRepCounter.parity.ts <config.json>
 *
 * backend-core/scripts/replay_realtime_count.py --synthetic と**同じ合成ケース**を
 * 同じ順序で流し、同じカウント数になることを確認する。オンデバイス方式では TS版が
 * 本番になるため、Python版（検証ハーネスのリファレンス）とズレたら気づけるように
 * しておく。
 *
 * config.json は rep_count_models.config_json 相当。
 */
import { readFileSync } from 'node:fs';
import {
  buildCounter,
  bottomMid,
  topMid,
  deriveRawCycleStats,
  DEFAULT_REALTIME_CONFIG,
  type RepEvent,
} from '../realtimeRepCounter.ts';

const FPS = 30.0;

type Sample = [number, number | null];

function sampleMean(mean: number[], tau: number): number {
  const t = Math.max(0, Math.min(1, tau));
  const pos = t * (mean.length - 1);
  const i = Math.floor(pos);
  if (i >= mean.length - 1) return mean[mean.length - 1];
  return mean[i] + (pos - i) * (mean[i + 1] - mean[i]);
}

type SynthOpts = {
  pauseAtTau?: number;
  pauseSec?: number;
  lostAtTau?: number;
  lostSec?: number;
  standBefore?: number;
  standAfter?: number;
};

/** Python版 synth_series() と同じ手順で1レップぶんの信号を作る。 */
function synthSeries(
  mean: number[], bottom: number, top: number, periodSec: number, opts: SynthOpts = {}
): Sample[] {
  const { pauseAtTau, pauseSec = 0, lostAtTau, lostSec = 0,
          standBefore = 1.0, standAfter = 0.6 } = opts;
  const dt = 1 / FPS;
  const out: Sample[] = [];
  let t = 0;

  for (let i = 0; i < Math.trunc(standBefore * FPS); i++) { out.push([t, top]); t += dt; }

  const nRep = Math.max(2, Math.trunc(periodSec * FPS));
  let paused = false;
  let lostDone = false;
  for (let i = 0; i <= nRep; i++) {
    const tau = i / nRep;
    const angle = bottom + sampleMean(mean, tau) * (top - bottom);

    if (pauseAtTau !== undefined && !paused && tau >= pauseAtTau) {
      paused = true;
      for (let k = 0; k < Math.trunc(pauseSec * FPS); k++) { out.push([t, angle]); t += dt; }
    }
    if (lostAtTau !== undefined && !lostDone && tau >= lostAtTau) {
      lostDone = true;
      for (let k = 0; k < Math.trunc(lostSec * FPS); k++) { out.push([t, null]); t += dt; }
    }
    out.push([t, angle]);
    t += dt;
  }

  for (let i = 0; i < Math.trunc(standAfter * FPS); i++) { out.push([t, top]); t += dt; }
  return out;
}

function concat(...seriesList: Sample[][]): Sample[] {
  const dt = 1 / FPS;
  const out: Sample[] = [];
  let t = 0;
  for (const series of seriesList) {
    for (const [, angle] of series) { out.push([t, angle]); t += dt; }
  }
  return out;
}

function addSpikes(series: Sample[], every: number, amplitude: number): Sample[] {
  return series.map(([t, angle], i) => {
    if (angle !== null && i % every === 0 && i > 0) {
      return [t, angle + (Math.trunc(i / every) % 2 === 0 ? amplitude : -amplitude)] as Sample;
    }
    return [t, angle] as Sample;
  });
}

function main(): number {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error('使い方: node lib/__tests__/realtimeRepCounter.parity.ts <config.json>');
    return 1;
  }
  const configJson = JSON.parse(readFileSync(configPath, 'utf-8'));

  const built = buildCounter(configJson);
  if (built === null) {
    console.error('カウンタを組み立てられません');
    return 1;
  }
  const raw = deriveRawCycleStats(configJson.cycleStats)!;
  const mean: number[] = configJson.template.mean.map(Number);

  console.log(`主役関節      : ${built.mainJoint}`);
  console.log(`実測ボトム帯  : ${raw.bottomMin}〜${raw.bottomMax}°  (中央 ${bottomMid(raw).toFixed(1)}°)`);
  console.log(`実測トップ帯  : ${raw.topMin}〜${raw.topMax}°  (中央 ${topMid(raw).toFixed(1)}°)`);
  console.log(`実測ROM帯     : ${raw.romMin}〜${raw.romMax}°`);
  console.log();

  const bottom = bottomMid(raw);
  const top = topMid(raw);
  const ideal = synthSeries(mean, bottom, top, 2.0, { standBefore: 0.5, standAfter: 0.5 });

  // backend-core/scripts/replay_realtime_count.py の cases と同一・同順
  const cases: Array<[string, Sample[], number]> = [
    ['理想レップ（テンプレート通り・2.0秒）', synthSeries(mean, bottom, top, 2.0), 1],
    ['ゆっくり（4.0秒）', synthSeries(mean, bottom, top, 4.0), 1],
    ['浅いレップ（ROM 45°）', synthSeries(mean, top - 45.0, top, 2.0), 1],
    ['座り込み相当（ROM 110°）', synthSeries(mean, top - 110.0, top, 2.5), 0],
    // 「流れから外れた」の検知は沈み込みの浅い段階で止まった場合に限る。深く沈んだ
    // 位置での溜めはボトムホールドという正当なフォームで、因果的な情報だけでは両者を
    // 区別できない（実測: スクワットのtau=0.3での停止は沈み込み79.6%、腕立ての浅い
    // レップのボトムは79.2%。前者の方が深く、閾値で分けられない）。
    ['序盤で1.5秒停止（＝流れから外れた）',
     synthSeries(mean, bottom, top, 2.0, { pauseAtTau: 0.10, pauseSec: 1.5 }), 0],
    ['ボトムで1.5秒溜める（＝正当なフォーム）',
     synthSeries(mean, bottom, top, 2.0, { pauseAtTau: 0.55, pauseSec: 1.5 }), 1],
    ['姿勢ロスト0.1秒（許容内）', synthSeries(mean, bottom, top, 2.0, { lostAtTau: 0.4, lostSec: 0.1 }), 1],
    ['姿勢ロスト0.5秒（許容外）', synthSeries(mean, bottom, top, 2.0, { lostAtTau: 0.4, lostSec: 0.5 }), 0],
    ['速すぎ（0.5秒）', synthSeries(mean, bottom, top, 0.5), 0],
    ['連続3レップ', concat(ideal, ideal, ideal), 3],
    ['連続5レップ（テンポばらつき）', concat(
      synthSeries(mean, bottom, top, 1.8, { standBefore: 0.5, standAfter: 0.4 }),
      synthSeries(mean, bottom, top, 2.2, { standBefore: 0.4, standAfter: 0.4 }),
      synthSeries(mean, bottom, top, 2.6, { standBefore: 0.4, standAfter: 0.4 }),
      synthSeries(mean, bottom - 6, top, 3.0, { standBefore: 0.4, standAfter: 0.4 }),
      synthSeries(mean, bottom + 12, top, 3.2, { standBefore: 0.4, standAfter: 0.5 }),
    ), 5],
    ['単発スパイクノイズ ±18°（3フレームおき）', addSpikes(ideal, 3, 18.0), 1],
    ['単発スパイクノイズ ±30°（5フレームおき）', addSpikes(ideal, 5, 30.0), 1],
  ];

  let failures = 0;
  for (const [label, series, expected] of cases) {
    const b = buildCounter(configJson)!;
    const counter = b.counter;
    counter.start();
    const events: RepEvent[] = [];
    for (const [tSec, angle] of series) {
      const ev = counter.update(tSec, angle);
      if (ev !== null) events.push(ev);
    }
    const tail = counter.stop();
    if (tail !== null) events.push(tail);

    const counted = events.filter(e => e.counted);
    const ok = counted.length === expected;
    if (!ok) failures += 1;
    let detail: string;
    if (counted.length > 0) {
      detail = `ROM ${counted.map(e => e.romDeg).join('/')}° `
        + `深さ逸脱 ${counted.map(e => e.depthGapDeg).join('/')}° `
        + `停滞 ${counted.map(e => e.maxStallSec).join('/')}s `
        + counted.map(e => e.formQuality).join('/');
    } else if (events.length > 0) {
      detail = '理由: ' + events.map(e => e.notCountedReason).filter(Boolean).join(', ');
    } else {
      detail = 'イベントなし（追従開始せず）';
    }
    console.log(`${ok ? 'OK ' : 'NG '} ${label.padEnd(34)} 期待=${expected} 実際=${counted.length}  ${detail}`);
  }

  const cfg = DEFAULT_REALTIME_CONFIG;
  console.log();
  console.log(`ROM基準: ガード ${cfg.romMinDeg}〜${cfg.romMaxDeg}°`);
  console.log(`テンポ許容: 基準${cfg.refPeriodSec}秒の ${cfg.timeScaleMin}〜${cfg.timeScaleMax}倍`);
  console.log(`連続停滞でノーカン: ${cfg.ngSec}秒 / 姿勢ロスト許容: ${cfg.gapSec}秒`);
  console.log('NG件数:', failures);
  return failures === 0 ? 0 : 1;
}

process.exit(main());
