import type { SeriesPoint } from './api';

/**
 * 回数カウント（状態機械）の設定。
 * 主役関節の角度の生波形に対して、「伸ばし域から連続下降で low 到達 → 連続上昇で
 * high 復帰」の連続1サイクルを観測できたときだけ1回と数える。連続性が途切れたら
 * サイクル検出を最初からやり直す。
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
  /** 下降・上昇の追跡中に許容する逆行量（ROM比）。超えたら連続性の破れとしてリセット。 */
  reversalTolRatio: number;
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
  // 速さで波を分断しなくなった分、逆行許容は締めても本物は落ちず怪しい遅サイクルを弾ける。
  reversalTolRatio: 0.1,
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
  const tol = rom * cfg.reversalTolRatio; // これを超える逆行 = 連続性の破れ

  // search: 伸ばし域(high超)の出現待ち / down: 連続下降を追跡 / up: 連続上昇を追跡
  let state: 'search' | 'down' | 'up' = 'search';
  let extreme = 0; // down では下降中の最小値、up では上昇中の最大値
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
      if (a > high) {
        state = 'down';
        extreme = a;
      }
    } else if (state === 'down') {
      if (a < extreme) {
        extreme = a;
      } else if (a - extreme > tol) {
        // ボトムから tol 超の上昇 = 切り返し or 逆行
        if (extreme < low) {
          // 深い域まで下降済み → 本物の切り返し(上昇開始)
          state = 'up';
          extreme = a;
        } else if (a > high) {
          // 深い域に達する前に伸ばし域へ戻った → 再アーム
          extreme = a;
        } else {
          // 中途半端な逆行 → 連続性の破れ
          state = 'search';
        }
      }
    } else {
      if (a > high) {
        // 連続上昇のまま伸ばし域に復帰 = 1サイクル完了
        if (frame - lastRep >= cfg.minPeriodFrames) {
          count++;
          repFrames.push(frame);
          lastRep = frame;
        }
        state = 'down';
        extreme = a; // そのまま次のレップの下降追跡へ
      } else if (a > extreme) {
        extreme = a;
      } else if (extreme - a > tol) {
        // 上昇中の逆行 → 連続性の破れ
        state = 'search';
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
