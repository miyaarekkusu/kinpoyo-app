/**
 * リアルタイム回数カウント（端末側）。
 *
 * backend-core/app/core/realtime_rep_counter.py の忠実な移植。オンデバイス方式では
 * カウント判定を端末で完結させるため、判定ロジックはこちらが本番になる。Python版は
 * 検証ハーネス（scripts/replay_realtime_count.py）で回すためのリファレンス実装として
 * 残す。**両者は必ず同じ結果を返すこと**（lib/__tests__/realtimeRepCounter.parity.ts）。
 *
 * 設計の詳細と、実装中に潰した3つの行き止まりは notes/realtime-count-design-memo.txt
 * を参照。要点だけ再掲する:
 *
 * - 判定軸は「位相の進み方（停滞しているか）」。角度の許容帯は持たない——単調区間では
 *   角度から位相が一意に決まるため、角度単体では定義上ほぼ外れようがない
 * - 流れから連続して外れたらノーカン。単発のブレでは落とさない
 * - しきい値は全て秒。フレーム数だと端末のフレームレートで意味が変わる
 *
 * 注意: Node の型ストリップで直接実行できるよう、enum・パラメータプロパティなど
 * 「消去できない」TypeScript構文は使わない。
 */

/** カウントしなかった理由。counted=false の内訳を潰さないために持つ。 */
export type NoCountReason =
  | 'stalled' // 流れから外れた（位相が進まなくなった）
  | 'tempo_out_of_range' // 速すぎ／遅すぎ
  | 'rom_out_of_range' // 往復はしたが可動域が範囲外
  | 'timeout' // 1レップに時間がかかりすぎた
  | 'pose_lost'; // 姿勢ロストが続いた

export type FormQuality = 'good' | 'needs_improvement';

/** 較正時の実測レンジ（ゲート用に膨らませる前の値）。 */
export type RawCycleStats = {
  bottomMin: number;
  bottomMax: number;
  topMin: number;
  topMax: number;
  romMin: number;
  romMax: number;
};

export function bottomMid(raw: RawCycleStats): number {
  return (raw.bottomMin + raw.bottomMax) / 2;
}

export function topMid(raw: RawCycleStats): number {
  return (raw.topMin + raw.topMax) / 2;
}

export type RealtimeConfig = {
  // 追従開始（アンカー）
  anchorTopToleranceDeg: number;
  /** 立位帯の幅の上限（較正ROMに対する割合）。ROMの小さい種目で広すぎないように。 */
  anchorTopToleranceRomRatio: number;
  anchorDropDeg: number;
  anchorConsecutiveSamples: number;
  // テンポ（レップ全体の所要時間）
  refPeriodSec: number;
  timeScaleMin: number;
  timeScaleMax: number;
  // 停滞検知
  stallRateRatio: number;
  /** 折り返し付近で停滞検知を止める閾値（較正ROMに対する沈み込み割合）。 */
  stallExemptDescentRatio: number;
  ngSec: number;
  phaseRateAlpha: number;
  gapSec: number;
  timeoutSec: number;
  // 往復の判定
  reversalDeg: number;
  topReturnMarginDeg: number;
  // 可動域ガード（レップかどうかの判定。フォーム評価ではない）
  romMinDeg: number;
  romMaxDeg: number;
  // 平滑化
  emaAlpha: number;
  // 品質ラベル（カウント可否には一切影響しない）
  depthToleranceDeg: number;
};

/**
 * 初期値は較正データが2サイクルしかない現状での暫定値。
 * 「本物のレップがどれだけばらつくか」が分からないと決められないため、較正動画を
 * 増やしたあとに実データで詰め直すこと。
 */
export const DEFAULT_REALTIME_CONFIG: RealtimeConfig = {
  anchorTopToleranceDeg: 20,
  anchorTopToleranceRomRatio: 0.2,
  anchorDropDeg: 5,
  anchorConsecutiveSamples: 3,
  refPeriodSec: 2.0,
  timeScaleMin: 0.4,
  timeScaleMax: 2.5,
  stallRateRatio: 0.25,
  stallExemptDescentRatio: 0.7,
  ngSec: 0.4,
  phaseRateAlpha: 0.3,
  gapSec: 0.2,
  timeoutSec: 10.0,
  reversalDeg: 3.0,
  topReturnMarginDeg: 20.0,
  romMinDeg: 40.0,
  romMaxDeg: 95.0,
  emaAlpha: 0.4,
  depthToleranceDeg: 15.0,
};

export type RepEvent = {
  counted: boolean;
  notCountedReason: NoCountReason | null;
  startSec: number;
  endSec: number;
  bottomDeg: number;
  topDeg: number;
  romDeg: number;
  periodSec: number;
  /** 較正済みボトム帯からの逸脱量（0なら帯の中）。 */
  depthGapDeg: number;
  /** 位相が停滞した最長の連続時間。 */
  maxStallSec: number;
  formQuality: FormQuality | null;
};

function round(value: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(value * f) / f;
}

/**
 * 較正済みテンプレートを絶対角度のカーブに変換したもの。
 *
 * 保存されている `mean[32]` は、サイクル自身の min〜max で振幅を、サイクル自身の
 * 開始〜終了で時間を正規化した形。どちらも「レップが終わって初めて確定する値」なので
 * そのままでは途中経過と比較できない。実測ボトム／トップ角度で絶対角度に戻す。
 */
export class ExpectedCurve {
  readonly n: number;
  readonly bottomDeg: number;
  readonly topDeg: number;
  readonly angles: number[];
  readonly kBottom: number;

  constructor(mean: number[], bottomDeg: number, topDeg: number) {
    if (mean.length < 2) throw new Error('テンプレートのビン数が足りません');
    this.n = mean.length;
    this.bottomDeg = bottomDeg;
    this.topDeg = topDeg;
    const span = topDeg - bottomDeg;
    this.angles = mean.map(m => bottomDeg + m * span);
    let k = 0;
    for (let i = 1; i < this.n; i++) if (this.angles[i] < this.angles[k]) k = i;
    this.kBottom = k;
  }

  get bottomPhase(): number {
    return this.kBottom / (this.n - 1);
  }

  get romDeg(): number {
    return this.topDeg - this.bottomDeg;
  }

  /** 正規化位相 tau∈[0,1] における期待絶対角度（ビン間は線形補間）。 */
  angleAtPhase(tau: number): number {
    const t = Math.max(0, Math.min(1, tau));
    const pos = t * (this.n - 1);
    const i = Math.floor(pos);
    if (i >= this.n - 1) return this.angles[this.n - 1];
    return this.angles[i] + (pos - i) * (this.angles[i + 1] - this.angles[i]);
  }

  /**
   * 角度から期待位相を逆算する。戻り値は [位相, 端で飽和したか]。
   *
   * 1サイクル全体は V 字で単調ではないが、ボトムで区切れば各枝は単調なので逆引き
   * できる。テンプレートの範囲外（較正より深い／高い）に出た場合は端で飽和する。
   * 飽和中は位相が進まないので、そのまま停滞と扱うと「較正より深いレップ」が流れから
   * 外れた判定になってしまう。深さの問題は ROM ガードの担当なので、飽和フラグを返して
   * 停滞検知から除外できるようにする。
   */
  phaseAtAngle(angle: number, ascending: boolean): [number, boolean] {
    if (!ascending) {
      if (angle >= this.angles[0]) return [0, true];
      if (angle <= this.angles[this.kBottom]) return [this.bottomPhase, true];
      for (let k = 0; k < this.kBottom; k++) {
        const a0 = this.angles[k];
        const a1 = this.angles[k + 1];
        if (a0 >= angle && angle >= a1 && a0 !== a1) {
          return [(k + (a0 - angle) / (a0 - a1)) / (this.n - 1), false];
        }
      }
      return [this.bottomPhase, true];
    }

    if (angle <= this.angles[this.kBottom]) return [this.bottomPhase, true];
    if (angle >= this.angles[this.n - 1]) return [1, true];
    for (let k = this.kBottom; k < this.n - 1; k++) {
      const a0 = this.angles[k];
      const a1 = this.angles[k + 1];
      if (a0 <= angle && angle <= a1 && a0 !== a1) {
        return [(k + (angle - a0) / (a1 - a0)) / (this.n - 1), false];
      }
    }
    return [1, true];
  }
}

type Hypothesis = {
  startSec: number;
  startAngle: number;
  bottomDeg: number;
  bottomSec: number;
  prevPhase: number | null;
  phaseRate: number | null;
  stallStreakSec: number;
  maxStallSec: number;
  lostStreakSec: number;
  reversedUp: boolean;
};

/**
 * 1関節の角度を1サンプルずつ食わせると、レップ確定時に RepEvent を返す。
 *
 * 姿勢が取れなかったフレームは angle=null で渡すこと（呼び飛ばさない）。ロストして
 * いること自体が判定材料であり、飛ばされると経過時間も狂う。
 */
export class RealtimeRepCounter {
  readonly curve: ExpectedCurve;
  readonly raw: RawCycleStats;
  readonly cfg: RealtimeConfig;
  count = 0;
  events: RepEvent[] = [];

  private tracking = false;
  private rawWindow: number[] = [];
  private smoothed: number | null = null;
  private prevSec: number | null = null;
  private descendingSamples = 0;
  private descentStartSec: number | null = null;
  private recentTop: number | null = null;
  private hyp: Hypothesis | null = null;
  private running = false;

  constructor(curve: ExpectedCurve, raw: RawCycleStats, cfg?: Partial<RealtimeConfig>) {
    this.curve = curve;
    this.raw = raw;
    this.cfg = { ...DEFAULT_REALTIME_CONFIG, ...(cfg ?? {}) };
  }

  /** セット開始。休憩中に動かさないための明示的な区間制御。 */
  start(): void {
    this.running = true;
    this.resetTracking();
  }

  /** セット終了。追従途中の仮説はノーカンで打ち切る。 */
  stop(): RepEvent | null {
    let pending: RepEvent | null = null;
    if (this.tracking && this.hyp !== null) {
      pending = this.finish(this.prevSec ?? 0, 'timeout');
    }
    this.running = false;
    this.resetTracking();
    this.recentTop = null;
    return pending;
  }

  private resetTracking(): void {
    this.tracking = false;
    this.hyp = null;
    this.descendingSamples = 0;
    this.descentStartSec = null;
  }

  /** 1サンプル進める。レップが確定した場合だけ RepEvent を返す。 */
  update(tSec: number, angle: number | null): RepEvent | null {
    if (!this.running) return null;

    const dt = this.prevSec === null ? 0 : Math.max(0, tSec - this.prevSec);
    this.prevSec = tSec;

    if (angle === null || !Number.isFinite(angle)) return this.onLost(tSec, dt);

    const a = this.smooth(angle);
    if (!this.tracking) {
      this.updateAnchor(a);
      return null;
    }
    return this.track(tSec, dt, a);
  }

  /**
   * 因果的な前処理：3点メディアン（デグリッチ）→ 片側EMA（平滑化）。
   * メディアンは1サンプル分の群遅延と引き換えに単発の外れ値を完全に除去できる。
   * EMA単体では外れ値を薄めるだけで残るため、位相の逆引きが汚れて停滞検知が誤爆する。
   */
  private smooth(angle: number): number {
    this.rawWindow.push(angle);
    if (this.rawWindow.length > 3) this.rawWindow.shift();
    const sorted = [...this.rawWindow].sort((x, y) => x - y);
    const deglitched = sorted[Math.floor(sorted.length / 2)];

    if (this.smoothed === null) {
      this.smoothed = deglitched;
    } else {
      const alpha = this.cfg.emaAlpha;
      this.smoothed = alpha * deglitched + (1 - alpha) * this.smoothed;
    }
    return this.smoothed;
  }

  /** 姿勢ロスト。停滞カウンタは進めないが、続けば仮説ごと破棄する。 */
  private onLost(tSec: number, dt: number): RepEvent | null {
    this.descendingSamples = 0;
    if (!this.tracking || this.hyp === null) return null;
    this.hyp.lostStreakSec += dt;
    if (this.hyp.lostStreakSec > this.cfg.gapSec) return this.finish(tSec, 'pose_lost');
    return null;
  }

  /** 立位帯からの下降が続いたときだけ追従を開始する。 */
  private updateAnchor(a: number): void {
    const cfg = this.cfg;
    // 立位帯の幅は較正ROMの一定割合を超えないようにする。固定20°のままだと、
    // ROMの小さい種目（腕立て: ROM 57.6°）で3分の1以上沈んだ位置まで立位と
    // みなし、途中で止まった後にそこから再アンカーして浅いレップを数えてしまう。
    const topBand = Math.min(
      cfg.anchorTopToleranceDeg,
      cfg.anchorTopToleranceRomRatio * this.curve.romDeg
    );
    if (Math.abs(a - topMid(this.raw)) <= topBand) {
      this.recentTop = this.recentTop === null ? a : Math.max(this.recentTop, a);
    }
    if (this.recentTop === null) {
      this.descendingSamples = 0;
      return;
    }

    const dropped = this.recentTop - a;
    if (dropped >= cfg.anchorDropDeg / cfg.anchorConsecutiveSamples) {
      if (this.descendingSamples === 0) {
        // 追従開始が確定するのは数サンプル後だが、位相の基準時刻は「下降が始まった
        // 瞬間」でなければならない。確定時刻を基準にすると既に数度沈んだ状態を位相0と
        // みなすことになり、位相がずれる。
        this.descentStartSec = this.prevSec ?? 0;
      }
      this.descendingSamples += 1;
    } else {
      this.descendingSamples = 0;
      this.descentStartSec = null;
    }

    if (this.descendingSamples >= cfg.anchorConsecutiveSamples && dropped >= cfg.anchorDropDeg) {
      this.tracking = true;
      this.hyp = {
        startSec: this.descentStartSec !== null ? this.descentStartSec : (this.prevSec ?? 0),
        startAngle: this.recentTop,
        bottomDeg: a,
        bottomSec: this.prevSec ?? 0,
        prevPhase: null,
        phaseRate: null,
        stallStreakSec: 0,
        maxStallSec: 0,
        lostStreakSec: 0,
        reversedUp: false,
      };
      this.descendingSamples = 0;
    }
  }

  private track(tSec: number, dt: number, a: number): RepEvent | null {
    const cfg = this.cfg;
    const hyp = this.hyp;
    if (hyp === null) return null;
    hyp.lostStreakSec = 0;
    const elapsed = tSec - hyp.startSec;

    if (elapsed > cfg.timeoutSec) return this.finish(tSec, 'timeout');
    if (elapsed > cfg.timeScaleMax * cfg.refPeriodSec) {
      // 一番遅い許容ペースでも終わっているはずの時間を超えた＝遅すぎ。
      return this.finish(tSec, 'tempo_out_of_range');
    }

    if (a < hyp.bottomDeg) {
      hyp.bottomDeg = a;
      hyp.bottomSec = tSec;
    } else if (a - hyp.bottomDeg >= cfg.reversalDeg) {
      hyp.reversedUp = true;
    }

    // --- 停滞検知（「流れから外れた」の本体） ---
    const [phase, saturated] = this.curve.phaseAtAngle(a, hyp.reversedUp);
    if (hyp.prevPhase !== null && dt > 0) {
      const rate = Math.abs(phase - hyp.prevPhase) / dt;
      const alpha = cfg.phaseRateAlpha;
      hyp.phaseRate = hyp.phaseRate === null ? rate : alpha * rate + (1 - alpha) * hyp.phaseRate;
      // 一番遅い許容ペースでの位相速度。これを大きく下回る状態が続く＝止まった。
      const slowest = 1 / (cfg.timeScaleMax * cfg.refPeriodSec);
      // 較正ROMの一定割合以上まで沈んでいれば「折り返し付近」とみなして停滞検知を
      // 止める。ボトムでの溜めは正当なフォームであり、テンプレートがボトム付近で
      // 平坦な種目（腕立て）では位相の逆引きが進まず誤検知になる。
      const nearTurnaround =
        hyp.startAngle - a >= cfg.stallExemptDescentRatio * this.curve.romDeg;
      if (!saturated && !nearTurnaround && hyp.phaseRate < slowest * cfg.stallRateRatio) {
        hyp.stallStreakSec += dt;
        hyp.maxStallSec = Math.max(hyp.maxStallSec, hyp.stallStreakSec);
        if (hyp.stallStreakSec > cfg.ngSec) return this.finish(tSec, 'stalled');
      } else {
        // 流れに戻ったら即ゼロリセット。減衰させないことで、単発のブレが積み上がって
        // ノーカンになるのを防ぐ（緩く運用する方針）。
        hyp.stallStreakSec = 0;
      }
    }
    hyp.prevPhase = phase;

    // --- 完了判定：ボトムを通過して立位帯に戻ってきたか ---
    if (hyp.reversedUp && a >= topMid(this.raw) - cfg.topReturnMarginDeg) {
      return this.finish(tSec, null);
    }
    return null;
  }

  private finish(tSec: number, reason: NoCountReason | null): RepEvent {
    const cfg = this.cfg;
    const hyp = this.hyp!;
    const topDeg = Math.max(hyp.startAngle, this.smoothed ?? hyp.startAngle);
    const rom = topDeg - hyp.bottomDeg;
    const period = tSec - hyp.startSec;

    let finalReason = reason;
    if (finalReason === null) {
      // 可動域・テンポのガード。「レップかどうか」の判定であって、フォーム評価ではない。
      if (rom < cfg.romMinDeg || rom > cfg.romMaxDeg) {
        finalReason = 'rom_out_of_range';
      } else if (
        period < cfg.timeScaleMin * cfg.refPeriodSec ||
        period > cfg.timeScaleMax * cfg.refPeriodSec
      ) {
        finalReason = 'tempo_out_of_range';
      }
    }

    let depthGap = 0;
    if (hyp.bottomDeg > this.raw.bottomMax) depthGap = hyp.bottomDeg - this.raw.bottomMax;
    else if (hyp.bottomDeg < this.raw.bottomMin) depthGap = this.raw.bottomMin - hyp.bottomDeg;

    const counted = finalReason === null;
    let formQuality: FormQuality | null = null;
    if (counted) {
      this.count += 1;
      formQuality = depthGap <= cfg.depthToleranceDeg ? 'good' : 'needs_improvement';
    }

    const event: RepEvent = {
      counted,
      notCountedReason: finalReason,
      startSec: round(hyp.startSec, 3),
      endSec: round(tSec, 3),
      bottomDeg: round(hyp.bottomDeg, 1),
      topDeg: round(topDeg, 1),
      romDeg: round(rom, 1),
      periodSec: round(period, 3),
      depthGapDeg: round(depthGap, 1),
      maxStallSec: round(hyp.maxStallSec, 3),
      formQuality,
    };
    this.events.push(event);
    this.resetTracking();
    this.recentTop = null;
    return event;
  }
}

// --- 較正済み config からの組み立て ------------------------------------------

// build_cycle_stats() は実測レンジに余裕幅を足した「ゲート用の帯」を保存しており、
// 実測値そのものは保存していない。model-studio 側の定数は途中で緩められているため、
// 新旧どちらで作られたモデルかを整合性で判別する。
// 恒久対応としては、再較正時に実測値を cycleStatsRaw として保存すること。
const GATE_CONSTANTS: Array<[number, number, number]> = [
  [35.0, 0.4, 2.5], // NEW
  [25.0, 0.5, 2.0], // OLD
];

/** cycleStats（膨らませた帯）から実測レンジを逆算する。 */
export function deriveRawCycleStats(cycleStats: any): RawCycleStats | null {
  const rawSaved = cycleStats?.cycleStatsRaw;
  if (rawSaved && typeof rawSaved === 'object') {
    const b = rawSaved.bottomDeg;
    const t = rawSaved.topDeg;
    const r = rawSaved.romDeg;
    if (Array.isArray(b) && Array.isArray(t) && Array.isArray(r)) {
      return {
        bottomMin: Number(b[0]), bottomMax: Number(b[1]),
        topMin: Number(t[0]), topMax: Number(t[1]),
        romMin: Number(r[0]), romMax: Number(r[1]),
      };
    }
  }

  const bottom = cycleStats?.bottomDeg;
  const top = cycleStats?.topDeg;
  const rom = cycleStats?.romDeg;
  if (!bottom || !top || !rom) return null;

  for (const [margin, scaleLo, scaleHi] of GATE_CONSTANTS) {
    const bMin = bottom[0] + margin;
    const bMax = bottom[1] - margin;
    const tMin = top[0] + margin;
    const tMax = top[1] - margin;
    const rMin = rom[0] / scaleLo;
    const rMax = rom[1] / scaleHi;
    if (bMin <= bMax && tMin <= tMax && rMin <= rMax) {
      return {
        bottomMin: round(bMin, 1), bottomMax: round(bMax, 1),
        topMin: round(tMin, 1), topMax: round(tMax, 1),
        romMin: round(rMin, 1), romMax: round(rMax, 1),
      };
    }
  }
  return null;
}

export type BuiltCounter = { counter: RealtimeRepCounter; mainJoint: string };

/**
 * rep_count_models.config_json（GET /exercises/{id}/rep-model の config）から
 * カウンタを組み立てる。テンプレートか cycleStats が欠けているモデルでは null。
 */
export function buildCounter(
  configJson: any,
  cfg?: Partial<RealtimeConfig>
): BuiltCounter | null {
  const template = configJson?.template;
  const cycleStats = configJson?.cycleStats;
  const mainJoint = configJson?.mainJoint;
  if (!template || !cycleStats || !mainJoint) return null;
  const mean = template.mean;
  if (!Array.isArray(mean) || mean.length < 2) return null;

  const raw = deriveRawCycleStats(cycleStats);
  if (raw === null) return null;

  const curve = new ExpectedCurve(mean.map(Number), bottomMid(raw), topMid(raw));
  return { counter: new RealtimeRepCounter(curve, raw, cfg), mainJoint: String(mainJoint) };
}
