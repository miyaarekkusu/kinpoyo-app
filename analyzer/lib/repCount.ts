import type { SeriesPoint } from './api';

/**
 * 回数カウント（状態機械）の設定。
 * 主役関節の角度の生波形に対して、「伸ばし域(high超)から沈み域(low未満)まで下がり、
 * 再び伸ばし域まで戻る」往復を1回と数える（ヒステリシス）。low と high の間の往復
 * ——浅い上下動や姿勢推定のゆらぎ——は何度繰り返されても回数に影響しない。
 * backend rep_model.py の count_reps と同じ意味。
 */
export type RepConfig = {
  /** 平滑化窓（フレーム）。キーポイント推定のブレを消す。 */
  smoothWindow: number;
  /** 「深い」側の閾値。ROM内の割合(0..1)。これを下回ると曲げ切ったと判定。 */
  enterRatio: number;
  /** 「伸ばし切り」側の閾値。ROM内の割合(0..1)。これを上回ると1回完了。 */
  exitRatio: number;
  /** これより短い周期は誤検出として捨てる（デバウンス）。 */
  minPeriodFrames: number;
  /** これ未満のROM(度)しかない関節は動いていないとみなし、カウント対象外。 */
  minRomDeg: number;
  /** フレーム番号の隙間がこれを超えたら姿勢ロストとみなしリセット。連続性の唯一の区切り根拠。 */
  maxGapFrames: number;
  /** デグリッチ用しきい値。1フレームだけ両隣からこれ超で飛びすぐ戻る外れ値（ワープ）
   * を両隣平均で均すのに使う。角度跳躍でリセット/分断はしない（速い動作を潰さない）。 */
  maxStepDeg: number;
};

export const DEFAULT_REP_CONFIG: RepConfig = {
  smoothWindow: 5,
  enterRatio: 0.3,
  exitRatio: 0.7,
  minPeriodFrames: 8,
  minRomDeg: 15,
  maxGapFrames: 6,
  // 単発のワープスパイクを均すデグリッチ閾値。持続的な速い動作は連続して同方向に
  // 動くため触らない＝速さ非依存。以前は「跳躍で波を分断」する用途だったが、走行など
  // 速い動作を潰すため廃止しスパイク除去に転用。
  maxStepDeg: 60,
};

export type RepCountResult = {
  /** 推定回数。 */
  count: number;
  /** 各回が完了した（伸ばし切った）フレーム番号。 */
  repFrames: number[];
  /** 計測に使った可動域(度)。 */
  rom: number;
};

/**
 * 単一フレームだけ両隣から maxStepDeg 超で飛び、すぐ戻る外れ値（ランドマークの
 * ワープ）を両隣平均で置換する。持続的な速い動作は連続して同方向に動く（cur が
 * prev と next の間に入る）ので条件に当たらず温存＝速さ非依存のグリッチ除去。
 * backend rep_model.py の _declitch と同じ意味。
 */
function declitch(
  angles: number[],
  frames: number[],
  maxStepDeg: number,
): number[] {
  const n = angles.length;
  if (n < 3) return angles.slice();
  const out = angles.slice();
  for (let i = 1; i < n - 1; i++) {
    const prev = angles[i - 1];
    const cur = angles[i];
    const nxt = angles[i + 1];
    const gapPrev = Math.max(1, frames[i] - frames[i - 1]);
    const gapNext = Math.max(1, frames[i + 1] - frames[i]);
    const spikeFromPrev = Math.abs(cur - prev) > maxStepDeg * gapPrev;
    const spikeFromNext = Math.abs(cur - nxt) > maxStepDeg * gapNext;
    const neighborsAgree =
      Math.abs(prev - nxt) <= maxStepDeg * Math.max(gapPrev, gapNext);
    if (spikeFromPrev && spikeFromNext && neighborsAgree) {
      out[i] = (prev + nxt) / 2;
    }
  }
  return out;
}

/** 中央寄せの移動平均。端は窓を縮めて平均する。 */
function smooth(values: number[], window: number): number[] {
  if (window <= 1 || values.length === 0) return values.slice();
  const half = Math.floor(window / 2);
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let n = 0;
    for (let k = i - half; k <= i + half; k++) {
      if (k >= 0 && k < values.length) {
        sum += values[k];
        n++;
      }
    }
    out[i] = sum / n;
  }
  return out;
}

/**
 * 1関節の角度時系列から回数を数える。
 * フレーム軸そのままの生 series を渡すこと（0〜100%正規化したカーブは不可：周期が消える）。
 */
export function countReps(
  points: SeriesPoint[],
  cfg: RepConfig = DEFAULT_REP_CONFIG,
): RepCountResult {
  if (points.length < 2) return { count: 0, repFrames: [], rom: 0 };

  const sorted = [...points].sort((a, b) => a.frame - b.frame);
  const frames = sorted.map((p) => p.frame);
  // 単発のワープスパイクだけ均してから平滑化（速い動作は温存）。
  const declitched = declitch(
    sorted.map((p) => p.angle),
    frames,
    cfg.maxStepDeg,
  );
  const angles = smooth(declitched, cfg.smoothWindow);

  let min = Infinity;
  let max = -Infinity;
  for (const a of angles) {
    if (a < min) min = a;
    if (a > max) max = a;
  }
  const rom = max - min;
  if (rom < cfg.minRomDeg) return { count: 0, repFrames: [], rom };

  const low = min + rom * cfg.enterRatio; // 深い側
  const high = min + rom * cfg.exitRatio; // 伸ばし側

  // search: 最初の伸ばし域の出現待ち / down: 沈み域への到達待ち / up: 伸ばし域への復帰待ち
  let state: 'search' | 'down' | 'up' = 'search';
  let count = 0;
  let lastRep = -Infinity;
  const repFrames: number[] = [];

  for (let i = 0; i < angles.length; i++) {
    const a = angles[i];
    const frame = sorted[i].frame;

    // フレーム欠損（姿勢ロスト）だけを連続性の破れとしてリセット。角度跳躍では
    // 区切らない（速い動作を潰さない）。単発スパイクは事前の declitch が均す。
    if (i > 0) {
      const gap = frame - sorted[i - 1].frame;
      if (gap > cfg.maxGapFrames) {
        state = 'search';
      }
    }

    if (state === 'search') {
      if (a > high) state = 'down';
    } else if (state === 'down') {
      // 沈み域に到達したときだけ前進する。伸ばし域と沈み域の間でどれだけ往復しても
      // （＝浅い上下動やジッター）状態は変わらない。
      if (a < low) state = 'up';
    } else {
      if (a > high) {
        // 伸ばし域に復帰 = 1サイクル完了
        if (frame - lastRep >= cfg.minPeriodFrames) {
          count++;
          repFrames.push(frame);
          lastRep = frame;
        }
        state = 'down'; // そのまま次のレップの下降を待つ
      }
    }
  }

  return { count, repFrames, rom };
}

export type JointSeries = { joint: string; points: SeriesPoint[] };

export type RepCountPick = RepCountResult & {
  /** カウントに使った主役関節。候補が無ければ null。 */
  joint: string | null;
};

/**
 * 候補関節の中から「そのセッションで最も大きく動いた（ROM最大）」関節を主役として選び、
 * その関節で回数を数える。candidates は監視関節を渡す想定。
 */
export function countRepsForSession(
  jointSeries: JointSeries[],
  candidates: string[],
  cfg: RepConfig = DEFAULT_REP_CONFIG,
): RepCountPick {
  const allow = candidates.length > 0 ? new Set(candidates) : null;
  let best: RepCountPick = { joint: null, count: 0, repFrames: [], rom: 0 };

  for (const js of jointSeries) {
    if (allow && !allow.has(js.joint)) continue;
    const r = countReps(js.points, cfg);
    if (r.rom > best.rom) best = { joint: js.joint, ...r };
  }
  return best;
}
