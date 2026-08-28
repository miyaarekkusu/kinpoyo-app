/**
 * 関節定義とMediaPipeランドマークからの角度計算（端末側）。
 *
 * backend-core/app/core/pose_analysis.py の移植。インデックス・計算式は必ず同じに
 * すること——ここがズレると較正済みモデルの絶対角度と噛み合わなくなる。
 *
 * ⚠️ **必ず world ランドマーク**（`PoseLandmarkerResult.worldLandmarks`、腰中点を
 * 原点とするメートル単位の実3D座標）を渡すこと。画像正規化座標（`landmarks`）は
 * x が画像幅・y が画像高さで別々に正規化されておりアスペクト比の分だけ歪み、z は
 * さらに別スケールなので、3点を混ぜた内積はカメラと動画サイズに依存した無意味な
 * 角度になる。これは実際に数日がかりの調査になった不具合であり、
 * notes/ai-count-debug-memo.txt に経緯が残っている。
 */

export type Point3 = { x: number; y: number; z: number; visibility?: number };

/** MediaPipe Pose の33点インデックス -> 関節名: [a, 頂点, c]。角度は頂点で測る。 */
export const JOINT_DEFINITIONS_JA: Record<string, [number, number, number]> = {
  右肘: [12, 14, 16], // 右肩 -> 右肘 -> 右手首
  左肘: [11, 13, 15],
  右膝: [24, 26, 28],
  左膝: [23, 25, 27],
  右肩: [24, 12, 14], // 右腰 -> 右肩 -> 右肘
  左肩: [23, 11, 13],
  右股関節: [12, 24, 26],
  左股関節: [11, 23, 25],
};

/** pB を頂点とする、pB->pA と pB->pC のなす角度(度)。計算不能なら null。 */
export function angleAt(pA: Point3, pB: Point3, pC: Point3): number | null {
  const vx1 = pA.x - pB.x;
  const vy1 = pA.y - pB.y;
  const vz1 = pA.z - pB.z;
  const vx2 = pC.x - pB.x;
  const vy2 = pC.y - pB.y;
  const vz2 = pC.z - pB.z;
  const dot = vx1 * vx2 + vy1 * vy2 + vz1 * vz2;
  const mag1 = Math.sqrt(vx1 * vx1 + vy1 * vy1 + vz1 * vz1);
  const mag2 = Math.sqrt(vx2 * vx2 + vy2 * vy2 + vz2 * vz2);
  if (mag1 === 0 || mag2 === 0) return null;
  const cosA = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosA) * 180) / Math.PI;
}

/**
 * world ランドマーク33点から、指定した関節の角度を1つ取り出す。
 * ランドマークが足りない・計算不能なら null（＝姿勢ロスト扱いでカウンタへ渡す）。
 */
export function jointAngle(landmarks: Point3[] | undefined, jointName: string): number | null {
  if (!landmarks || landmarks.length < 33) return null;
  const def = JOINT_DEFINITIONS_JA[jointName];
  if (!def) return null;
  const [ai, bi, ci] = def;
  const a = landmarks[ai];
  const b = landmarks[bi];
  const c = landmarks[ci];
  if (!a || !b || !c) return null;
  return angleAt(a, b, c);
}
