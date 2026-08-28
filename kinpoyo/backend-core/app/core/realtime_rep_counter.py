"""リアルタイム回数カウント：因果的（未来フレームを一切参照しない）な逐次カウンタ。

バッチ版（app/core/rep_model.py）は動画を最後まで読んでから閾値を決めるため、
そのままではリアルタイムに使えない::

    lo = min(angles); hi = max(angles)   # 全フレームを見ないと決まらない
    low  = lo + rom * enter_ratio        # ← 未来に依存
    high = lo + rom * exit_ratio

本モジュールはこれを「較正済みの**絶対角度**カーブへの追従」に置き換える。
world ランドマークから出した角度は座標系に依存しないため、絶対角度をそのまま
基準に使える（これが pose_world_landmarks へ移行したことの直接の見返り）。

判定方針（2026-08-27 のすり合わせ結果）
--------------------------------------
- **カウント判定は「流れに沿って最後まで追従できたか」**。流れから外れたら
  ノーカン。ただし単発のブレでは落とさず、**連続して**外れ続けた場合のみ。
- **しきい値は全て秒で持つ**。フレーム数だと端末のフレームレートで意味が変わる。
  バッチ版の `minPeriodFrames` / `maxGapFrames` は動画の fps が固定だったから
  成立していた。
- 計測区間（セット中だけ動かす／休憩中は止める）の制御は呼び出し側の責任とし、
  ここでは `start()` / `stop()` を提供するだけにする。

「流れから外れた」を何で観測するか（実装中に分かったこと）
--------------------------------------------------------
当初は「(経過時間, 角度) の期待コリドー」で見ようとしたが、2段階で行き詰まった。
どちらも合成信号の回帰チェック（scripts/replay_realtime_count.py）で実測している。

1. **許容倍率の包絡線をコリドーにする方式は機能しない。** 較正基準周期の
   0.4〜2.5倍という許容を包絡線にすると、レップ開始直後にカーブ全域を覆って
   しまい、全ケースで逸脱0.0°になった。
2. **序盤でテンポ倍率を1つ確定させる方式は、深さとテンポが結合して破綻する。**
   絶対角度から位相を逆引きすると、較正より深いレップは「同じ時刻でより先の
   位相にいる」ように見えるため、テンポ倍率が systematically 過小に確定する。
   結果、スケジュールが早く終わり、まだ上がっている途中で「期待は既にトップ」と
   なって正常なレップがノーカンになった（ROM 78°・3.0秒のレップで再現）。

最終的に、**位相の進み方（停滞しているか）**を観測軸にした。

- 「途中で止まった」＝位相が進まない。テンポにも深さにも依存しない
- 「速すぎ・遅すぎ」＝レップ全体の所要時間。完了時と追従中の両方で見る
- 「深すぎ（座り込み・床の物を拾う）」＝可動域。ROM上限で弾く

角度そのものの許容帯は持たない。単調区間では角度から位相が一意に決まるため
角度単体では外れようがなく、深さのズレは ROM ガードと二重になるだけだった。
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# --- 較正帯の逆算に使う model-studio 側の定数 -------------------------------
# build_cycle_stats() は実測レンジに余裕幅を足した「ゲート用の帯」を保存しており、
# 実測値そのものは保存していない。リアルタイムの基準には実測値が要るので余裕幅を
# 逆算する。model-studio の定数は途中で緩められている（25.0/(0.5,2.0) →
# 35.0/(0.4,2.5)）ため、どちらで作られたモデルかを整合性で判別する。
# 恒久対応としては、再較正時に実測値を cycleStatsRaw として保存すること。
_GATE_CONSTANTS_NEW = (35.0, 0.4, 2.5)  # _GATE_ANGLE_MARGIN_DEG, _GATE_ROM_SCALE
_GATE_CONSTANTS_OLD = (25.0, 0.5, 2.0)


class State(Enum):
    IDLE = "idle"
    TRACKING = "tracking"


class NoCountReason(Enum):
    """カウントしなかった理由。`counted=False` の内訳を潰さないために持つ。

    バッチ版の `counted=False` は「点数が少なすぎて測定不能」＝データ有効性の
    問題だけを指していた。リアルタイム版はフォーム逸脱によるノーカンが加わるため、
    AIレビュー側で両者を区別できるように理由を残す（`not_counted_reason`）。
    """

    STALLED = "stalled"  # 流れから外れた（位相が進まなくなった）
    TEMPO_OUT_OF_RANGE = "tempo_out_of_range"  # 速すぎ／遅すぎ
    ROM_OUT_OF_RANGE = "rom_out_of_range"  # 往復はしたが可動域が範囲外
    TIMEOUT = "timeout"  # 1レップに時間がかかりすぎた
    POSE_LOST = "pose_lost"  # 姿勢ロストが続いた


@dataclass
class RawCycleStats:
    """較正時の**実測**レンジ（ゲート用に膨らませる前の値）。"""

    bottom_min: float
    bottom_max: float
    top_min: float
    top_max: float
    rom_min: float
    rom_max: float

    @property
    def bottom_mid(self) -> float:
        return (self.bottom_min + self.bottom_max) / 2.0

    @property
    def top_mid(self) -> float:
        return (self.top_min + self.top_max) / 2.0


@dataclass
class RealtimeConfig:
    """リアルタイムカウンタのしきい値。角度は度、時間は秒。

    初期値は較正データが2サイクルしかない現状での暫定値。「本物のレップがどれだけ
    ばらつくか」が分からない以上ここは詰めきれないので、較正動画を増やしたあとに
    実データで決め直すこと。
    """

    # --- 追従開始（アンカー） ---
    # 立位帯から下降し始めたときだけ追従を開始する。座った状態からの動作など、
    # 立位以外から始まる動きを最初から拾わないためのガード。
    anchor_top_tolerance_deg: float = 20.0
    # 立位帯の幅は較正ROMのこの割合を超えないようにする。固定20°のままだと、
    # ROMの小さい種目で「かなり沈んだ位置」まで立位と見なしてしまう。
    # 実測: 腕立て（ROM 57.6°）では20°がROMの35%に相当し、途中で止まった後に
    # その位置から再アンカーして浅いレップを数えてしまった。
    anchor_top_tolerance_rom_ratio: float = 0.2
    anchor_drop_deg: float = 5.0
    anchor_consecutive_samples: int = 3

    # --- テンポ（レップ全体の所要時間） ---
    # 較正時の基準周期。cycleStats は「周期は速さ依存なのでゲートに使わない」方針で
    # 周期を保存していないため、現状は定数で置くしかない。再較正時に periodSec を
    # 保存するようにしたら、そこから渡すこと。
    ref_period_sec: float = 2.0
    time_scale_min: float = 0.4  # 基準周期の何倍まで速いのを許すか
    time_scale_max: float = 2.5  # 何倍まで遅いのを許すか

    # --- 停滞検知（「流れから外れた」の本体） ---
    # 位相の進みが「一番遅い許容ペース」のこの割合を下回っている状態が ng_sec 続いたら
    # 流れから外れたとみなす。テンポにも深さにも依存しない指標なので、ゆっくりな人・
    # 深い人を巻き込まない。
    stall_rate_ratio: float = 0.25
    # 帯に戻ったら即ゼロリセットする（減衰させない）。単発のブレが積み上がらない
    # ようにするため。0.4秒は1レップの2〜3割を外し続けた相当。
    ng_sec: float = 0.4
    # 位相速度のEMA係数。小さいほど安定するが検知が遅れる。
    phase_rate_alpha: float = 0.3
    # 折り返し付近では停滞検知を止める。テンプレートがボトム付近で平坦な種目
    # （腕立てなど、押し切った位置で溜めるもの）では角度がほとんど変わらず、位相の
    # 逆引きが進まないため、正常なレップが「止まった」と誤判定される。ボトムでの
    # 溜めはフォームであって流れから外れたわけではない。
    #
    # 判定は**テンプレートのボトム位相への近さ**ではなく、**自分がどれだけ沈んだか**
    # で行う。浅いレップは自分の折り返しがテンプレートのボトム位相より手前に来るため、
    # 位相ベースだと救えない（実測で確認）。
    #
    # 2026-08-28、腕立てのモデルを紐づけて初めて露見。スクワットのテンプレート形状
    # では出ていなかった＝種目が増えて初めて分かる類の欠陥。
    stall_exempt_descent_ratio: float = 0.7
    # 姿勢ロスト中は停滞カウンタを進めない（判定材料が無いので外れたと言えない）。
    # ただしロストが続けば仮説ごと破棄する。
    gap_sec: float = 0.2
    timeout_sec: float = 10.0

    # --- 往復の判定 ---
    reversal_deg: float = 3.0  # ボトムからこれだけ戻ったら上昇に転じたとみなす
    top_return_margin_deg: float = 20.0  # 立位角度のこれだけ手前まで戻れば完了

    # --- 可動域ガード（レップかどうかの判定。フォーム評価ではない） ---
    # 下限は緩く（浅いレップ・ハーフレップを拾う）、上限は締める（椅子に座る・
    # 床の物を拾うといった、レップよりはるかに深く曲がる動作を弾く）。非対称。
    rom_min_deg: float = 40.0
    rom_max_deg: float = 95.0

    # --- 平滑化 ---
    ema_alpha: float = 0.4  # 大きいほど追従が速く、平滑化は弱い

    # --- 品質ラベル（カウント可否には一切影響しない） ---
    # 較正済みボトム帯からこれ以上ずれていたら needs_improvement。
    depth_tolerance_deg: float = 15.0


# 連写方式（Expo Go の expo-camera で1枚ずつ撮って送る）のプリセット。
# 端末のフレームレートが低く不安定なので、30fps前提の既定値のままでは判定が鈍る。
# しきい値を秒で持つ設計なので低fpsでも意味は保たれるが、サンプル数が少ないぶん
# 位相速度の平滑化を速くして「止まった」の検知が遅れないようにする。
#
# 実測（scripts/replay_realtime_count.py --synthetic --fps N）:
#   カウント自体は5fpsでも連続レップを取りこぼさない。劣化するのは
#   (1) 停滞検知が鈍る (2) 粗いサンプリングでボトムを取り逃してROMが小さく出る
#   の2点。後者のため rom_min_deg も下げてある（8fpsで実測ROMは約3°、5fpsで
#   約8°小さく出る）。
STREAMING_CONFIG = RealtimeConfig(
    ng_sec=0.35,
    gap_sec=0.35,
    phase_rate_alpha=0.6,
    # 低fpsではEMAの追従遅れが効く。合成信号では alpha=0.85 の方が good だったが、
    # 実機では 0.6 の方がカウントできていたため戻した（2026-08-29）。
    # 合成信号は実機のノイズを再現できていないので、実測を優先する。
    ema_alpha=0.6,
    # 粗いサンプリングでボトムを取り逃すぶんROMが小さく出る。
    rom_min_deg=32.0,
)


@dataclass
class RepEvent:
    """1レップぶんの確定結果（カウントされたか否かに関わらず返す）。"""

    counted: bool
    not_counted_reason: Optional[NoCountReason]
    start_sec: float
    end_sec: float
    bottom_deg: Optional[float]
    top_deg: Optional[float]
    rom_deg: Optional[float]
    period_sec: float
    depth_gap_deg: float  # 較正済みボトム帯からの逸脱量（0なら帯の中）
    max_stall_sec: float  # 位相が停滞した最長の連続時間
    form_quality: Optional[str]  # "good" | "needs_improvement" | None（ノーカン時）


class ExpectedCurve:
    """較正済みテンプレートを絶対角度のカーブに変換したもの。

    保存されているテンプレート `mean[32]` は、サイクル自身の min〜max で振幅を
    0〜1 に、サイクル自身の開始〜終了で時間を 0〜1 に正規化した形をしている。
    どちらも「レップが終わって初めて確定する値」なので、そのままでは途中経過と
    比較できない。ここで実測ボトム／トップ角度を使って絶対角度に戻す::

        期待角度[k] = bottom + mean[k] * (top - bottom)
    """

    def __init__(self, mean: list[float], bottom_deg: float, top_deg: float) -> None:
        if len(mean) < 2:
            raise ValueError("テンプレートのビン数が足りません")
        self.n = len(mean)
        self.bottom_deg = bottom_deg
        self.top_deg = top_deg
        span = top_deg - bottom_deg
        self.angles = [bottom_deg + m * span for m in mean]
        self.k_bottom = min(range(self.n), key=lambda i: self.angles[i])

    @property
    def bottom_phase(self) -> float:
        return self.k_bottom / (self.n - 1)

    @property
    def rom_deg(self) -> float:
        return self.top_deg - self.bottom_deg

    def angle_at_phase(self, tau: float) -> float:
        """正規化位相 tau∈[0,1] における期待絶対角度（ビン間は線形補間）。"""
        tau = max(0.0, min(1.0, tau))
        pos = tau * (self.n - 1)
        i = int(math.floor(pos))
        if i >= self.n - 1:
            return self.angles[-1]
        return self.angles[i] + (pos - i) * (self.angles[i + 1] - self.angles[i])

    def phase_at_angle(self, angle: float, ascending: bool) -> tuple[float, bool]:
        """角度から期待位相を逆算する。戻り値は (位相, 端で飽和したか)。

        1サイクル全体は V 字で単調ではないが、ボトムで区切れば各枝は単調なので
        逆引きできる。テンプレートの範囲外（較正より深い／高い）に出た場合は端で
        飽和する。飽和中は位相が進まないので、そのまま停滞と扱うと「較正より深い
        レップ」が流れから外れた判定になってしまう。深さの問題は ROM ガードの担当
        なので、飽和フラグを返して停滞検知から除外できるようにする。
        """
        if not ascending:
            if angle >= self.angles[0]:
                return 0.0, True
            if angle <= self.angles[self.k_bottom]:
                return self.bottom_phase, True
            for k in range(0, self.k_bottom):
                a0, a1 = self.angles[k], self.angles[k + 1]
                if a0 >= angle >= a1 and a0 != a1:
                    return (k + (a0 - angle) / (a0 - a1)) / (self.n - 1), False
            return self.bottom_phase, True

        if angle <= self.angles[self.k_bottom]:
            return self.bottom_phase, True
        if angle >= self.angles[-1]:
            return 1.0, True
        for k in range(self.k_bottom, self.n - 1):
            a0, a1 = self.angles[k], self.angles[k + 1]
            if a0 <= angle <= a1 and a0 != a1:
                return (k + (angle - a0) / (a1 - a0)) / (self.n - 1), False
        return 1.0, True


@dataclass
class _Hypothesis:
    """追従中の1レップ仮説。"""

    start_sec: float
    start_angle: float
    bottom_deg: float
    bottom_sec: float
    prev_phase: Optional[float] = None
    phase_rate: Optional[float] = None
    stall_streak_sec: float = 0.0
    max_stall_sec: float = 0.0
    lost_streak_sec: float = 0.0
    reversed_up: bool = False


class RealtimeRepCounter:
    """1関節の角度を1サンプルずつ食わせると、レップ確定時に `RepEvent` を返す。

    使い方::

        built = build_counter(rep_count_model.config_json)
        counter, main_joint = built
        counter.start()
        for t_sec, angle in stream:      # angle は world 座標由来の絶対角度
            event = counter.update(t_sec, angle)
            if event is not None and event.counted:
                ...
        counter.stop()

    姿勢が取れなかったフレームは `angle=None` で渡すこと（呼び飛ばさない）。
    ロストしていること自体が判定材料であり、飛ばされると経過時間も狂う。
    """

    def __init__(
        self,
        curve: ExpectedCurve,
        raw_stats: RawCycleStats,
        cfg: Optional[RealtimeConfig] = None,
    ) -> None:
        self.curve = curve
        self.raw = raw_stats
        self.cfg = cfg or RealtimeConfig()
        self.state = State.IDLE
        self.count = 0
        self.events: list[RepEvent] = []
        self._raw_window: list[float] = []
        self._smoothed: Optional[float] = None
        self._prev_sec: Optional[float] = None
        self._descending_samples = 0
        self._descent_start_sec: Optional[float] = None
        self._recent_top: Optional[float] = None
        self._hyp: Optional[_Hypothesis] = None
        self._running = False

    # --- 計測区間の制御（呼び出し側が握る） ---------------------------------

    def start(self) -> None:
        """セット開始。休憩中に動かさないための明示的な区間制御。"""
        self._running = True
        self._reset_tracking()

    def stop(self) -> Optional[RepEvent]:
        """セット終了。追従途中の仮説はノーカンで打ち切る。"""
        pending = None
        if self.state is State.TRACKING and self._hyp is not None:
            pending = self._finish(self._prev_sec or 0.0, NoCountReason.TIMEOUT)
        self._running = False
        self._reset_tracking()
        self._recent_top = None
        return pending

    def _reset_tracking(self) -> None:
        self.state = State.IDLE
        self._hyp = None
        self._descending_samples = 0
        self._descent_start_sec = None

    # --- 本体 ---------------------------------------------------------------

    def update(self, t_sec: float, angle: Optional[float]) -> Optional[RepEvent]:
        """1サンプル進める。レップが確定した場合だけ `RepEvent` を返す。"""
        if not self._running:
            return None

        dt = 0.0 if self._prev_sec is None else max(0.0, t_sec - self._prev_sec)
        self._prev_sec = t_sec

        if angle is None:
            return self._on_lost(t_sec, dt)

        a = self._smooth(angle, dt)
        if self.state is State.IDLE:
            self._update_anchor(a)
            return None
        return self._track(t_sec, dt, a)

    def _smooth(self, angle: float, dt: float) -> float:
        """因果的な前処理：3点メディアン（デグリッチ）→ 片側EMA（平滑化）。

        バッチ版の `_declitch()` + `_smooth()` に対応する。どちらも未来フレームを
        参照する実装なので流用できない。

        ⚠️ メディアンは単調変化の区間で必ず「1つ前の値」を返すため1サンプル遅れる
        （2.9fps では 350ms）。遅延を嫌って「変化率が大きいサンプルを1回だけ棄却する」
        方式に置き換えたことがあるが、実機で4回試して1回もカウントされず、
        メディアンの方が明確に良かったため戻した。合成信号では差が出なかった
        （実機のノイズは合成では再現できていない）。
        """
        self._raw_window.append(angle)
        if len(self._raw_window) > 3:
            self._raw_window.pop(0)
        deglitched = sorted(self._raw_window)[len(self._raw_window) // 2]

        if self._smoothed is None:
            self._smoothed = deglitched
        else:
            alpha = self.cfg.ema_alpha
            self._smoothed = alpha * deglitched + (1.0 - alpha) * self._smoothed
        return self._smoothed

    def _on_lost(self, t_sec: float, dt: float) -> Optional[RepEvent]:
        """姿勢ロスト。停滞カウンタは進めないが、続けば仮説ごと破棄する。"""
        self._descending_samples = 0
        if self.state is not State.TRACKING or self._hyp is None:
            return None
        self._hyp.lost_streak_sec += dt
        if self._hyp.lost_streak_sec > self.cfg.gap_sec:
            return self._finish(t_sec, NoCountReason.POSE_LOST)
        return None

    def _update_anchor(self, a: float) -> None:
        """立位帯からの下降が続いたときだけ追従を開始する。"""
        cfg = self.cfg
        top_band = min(
            cfg.anchor_top_tolerance_deg,
            cfg.anchor_top_tolerance_rom_ratio * self.curve.rom_deg,
        )
        if abs(a - self.raw.top_mid) <= top_band:
            self._recent_top = a if self._recent_top is None else max(self._recent_top, a)

        if self._recent_top is None:
            self._descending_samples = 0
            return

        dropped = self._recent_top - a
        if dropped >= cfg.anchor_drop_deg / cfg.anchor_consecutive_samples:
            if self._descending_samples == 0:
                # 追従開始が確定するのは数サンプル後だが、位相の基準時刻は
                # 「下降が始まった瞬間」でなければならない。確定時刻を基準にすると
                # 既に数度沈んだ状態を位相0とみなすことになり、位相がずれる。
                self._descent_start_sec = self._prev_sec or 0.0
            self._descending_samples += 1
        else:
            self._descending_samples = 0
            self._descent_start_sec = None

        if (
            self._descending_samples >= cfg.anchor_consecutive_samples
            and dropped >= cfg.anchor_drop_deg
        ):
            self.state = State.TRACKING
            self._hyp = _Hypothesis(
                start_sec=self._descent_start_sec
                if self._descent_start_sec is not None
                else (self._prev_sec or 0.0),
                start_angle=self._recent_top,
                bottom_deg=a,
                bottom_sec=self._prev_sec or 0.0,
            )
            self._descending_samples = 0

    def _track(self, t_sec: float, dt: float, a: float) -> Optional[RepEvent]:
        cfg = self.cfg
        hyp = self._hyp
        assert hyp is not None
        hyp.lost_streak_sec = 0.0
        elapsed = t_sec - hyp.start_sec

        if elapsed > cfg.timeout_sec:
            return self._finish(t_sec, NoCountReason.TIMEOUT)
        if elapsed > cfg.time_scale_max * cfg.ref_period_sec:
            # 一番遅い許容ペースでも終わっているはずの時間を超えた＝遅すぎ。
            return self._finish(t_sec, NoCountReason.TEMPO_OUT_OF_RANGE)

        # ボトム更新と反転検知
        if a < hyp.bottom_deg:
            hyp.bottom_deg = a
            hyp.bottom_sec = t_sec
        elif a - hyp.bottom_deg >= cfg.reversal_deg:
            hyp.reversed_up = True

        # --- 停滞検知（「流れから外れた」の本体） ---
        phase, saturated = self.curve.phase_at_angle(a, ascending=hyp.reversed_up)
        if hyp.prev_phase is not None and dt > 0.0:
            rate = abs(phase - hyp.prev_phase) / dt
            alpha = cfg.phase_rate_alpha
            hyp.phase_rate = (
                rate if hyp.phase_rate is None else alpha * rate + (1 - alpha) * hyp.phase_rate
            )
            # 一番遅い許容ペースでの位相速度。これを大きく下回る状態が続く＝止まった。
            slowest = 1.0 / (cfg.time_scale_max * cfg.ref_period_sec)
            # 較正ROMのこの割合以上まで沈んでいれば「折り返し付近」とみなす。
            # 道中での停止（まだ浅い位置で止まった）はここに入らないので検知が残る。
            near_turnaround = (hyp.start_angle - a) >= (
                cfg.stall_exempt_descent_ratio * self.curve.rom_deg
            )
            if (
                not saturated
                and not near_turnaround
                and hyp.phase_rate < slowest * cfg.stall_rate_ratio
            ):
                hyp.stall_streak_sec += dt
                hyp.max_stall_sec = max(hyp.max_stall_sec, hyp.stall_streak_sec)
                if hyp.stall_streak_sec > cfg.ng_sec:
                    return self._finish(t_sec, NoCountReason.STALLED)
            else:
                # 流れに戻ったら即ゼロリセット。減衰させないことで、単発のブレが
                # 積み上がってノーカンになるのを防ぐ（緩く運用する方針）。
                hyp.stall_streak_sec = 0.0
        hyp.prev_phase = phase

        # --- 完了判定：ボトムを通過して立位帯に戻ってきたか ---
        if hyp.reversed_up and a >= self.raw.top_mid - cfg.top_return_margin_deg:
            return self._finish(t_sec, None)
        return None

    def _finish(self, t_sec: float, reason: Optional[NoCountReason]) -> RepEvent:
        cfg = self.cfg
        hyp = self._hyp
        assert hyp is not None
        top_deg = max(hyp.start_angle, self._smoothed or hyp.start_angle)
        rom = top_deg - hyp.bottom_deg
        period = t_sec - hyp.start_sec

        if reason is None:
            # 可動域・テンポのガード。「レップかどうか」の判定であって、フォーム
            # 評価ではない。座り込みや床の物を拾う動作をここで弾く。
            if rom < cfg.rom_min_deg or rom > cfg.rom_max_deg:
                reason = NoCountReason.ROM_OUT_OF_RANGE
            elif not (
                cfg.time_scale_min * cfg.ref_period_sec
                <= period
                <= cfg.time_scale_max * cfg.ref_period_sec
            ):
                reason = NoCountReason.TEMPO_OUT_OF_RANGE

        depth_gap = 0.0
        if hyp.bottom_deg > self.raw.bottom_max:
            depth_gap = hyp.bottom_deg - self.raw.bottom_max
        elif hyp.bottom_deg < self.raw.bottom_min:
            depth_gap = self.raw.bottom_min - hyp.bottom_deg

        counted = reason is None
        if counted:
            self.count += 1
            form_quality = (
                "good" if depth_gap <= cfg.depth_tolerance_deg else "needs_improvement"
            )
        else:
            form_quality = None

        event = RepEvent(
            counted=counted,
            not_counted_reason=reason,
            start_sec=round(hyp.start_sec, 3),
            end_sec=round(t_sec, 3),
            bottom_deg=round(hyp.bottom_deg, 1),
            top_deg=round(top_deg, 1),
            rom_deg=round(rom, 1),
            period_sec=round(period, 3),
            depth_gap_deg=round(depth_gap, 1),
            max_stall_sec=round(hyp.max_stall_sec, 3),
            form_quality=form_quality,
        )
        self.events.append(event)
        self._reset_tracking()
        self._recent_top = None
        return event


# --- 較正済み config_json からの組み立て ------------------------------------


def derive_raw_cycle_stats(cycle_stats: dict) -> Optional[RawCycleStats]:
    """`cycleStats`（ゲート用に膨らませた帯）から実測レンジを逆算する。

    build_cycle_stats() は次の形で保存している::

        bottomDeg = [min(bottoms) - M, max(bottoms) + M]
        topDeg    = [min(tops)    - M, max(tops)    + M]
        romDeg    = [min(roms) * S0,   max(roms) * S1]

    M と S は model-studio 側で途中から緩められているため、どちらで作られたモデルか
    を整合性で判別する。誤った定数で逆算すると min > max という矛盾が出るので、
    それを判定に使う。

    `cycleStatsRaw` が入っていればそちらを優先する（再較正時に実測値を保存する
    ようにしたら、この逆算は不要になる）。
    """
    raw = cycle_stats.get("cycleStatsRaw")
    if isinstance(raw, dict):
        try:
            return RawCycleStats(
                bottom_min=float(raw["bottomDeg"][0]),
                bottom_max=float(raw["bottomDeg"][1]),
                top_min=float(raw["topDeg"][0]),
                top_max=float(raw["topDeg"][1]),
                rom_min=float(raw["romDeg"][0]),
                rom_max=float(raw["romDeg"][1]),
            )
        except (KeyError, IndexError, TypeError, ValueError):
            pass

    bottom = cycle_stats.get("bottomDeg")
    top = cycle_stats.get("topDeg")
    rom = cycle_stats.get("romDeg")
    if not (bottom and top and rom):
        return None

    for margin, scale_lo, scale_hi in (_GATE_CONSTANTS_NEW, _GATE_CONSTANTS_OLD):
        b_min, b_max = bottom[0] + margin, bottom[1] - margin
        t_min, t_max = top[0] + margin, top[1] - margin
        r_min, r_max = rom[0] / scale_lo, rom[1] / scale_hi
        if b_min <= b_max and t_min <= t_max and r_min <= r_max:
            return RawCycleStats(
                bottom_min=round(b_min, 1),
                bottom_max=round(b_max, 1),
                top_min=round(t_min, 1),
                top_max=round(t_max, 1),
                rom_min=round(r_min, 1),
                rom_max=round(r_max, 1),
            )
    return None


def build_counter(
    config_json: dict, cfg: Optional[RealtimeConfig] = None
) -> Optional[tuple[RealtimeRepCounter, str]]:
    """`rep_count_models.config_json` からカウンタを組み立てる。

    戻り値は (カウンタ, 主役関節名)。テンプレートか cycleStats が欠けているモデル
    では組み立てられないので None を返す。
    """
    template = config_json.get("template")
    cycle_stats = config_json.get("cycleStats")
    main_joint = config_json.get("mainJoint")
    if not template or not cycle_stats or not main_joint:
        return None
    mean = template.get("mean")
    if not mean:
        return None
    raw = derive_raw_cycle_stats(cycle_stats)
    if raw is None:
        return None

    curve = ExpectedCurve(
        mean=[float(x) for x in mean],
        bottom_deg=raw.bottom_mid,
        top_deg=raw.top_mid,
    )
    return RealtimeRepCounter(curve, raw, cfg), str(main_joint)
