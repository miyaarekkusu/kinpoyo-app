/**
 * バックエンドのDecimalフィールド（weight_kg・rpe・total_volumeなど）はJSON上で
 * "80.00" のような文字列で返るため、そのまま表示すると余計な小数点が出る。
 * 数値に変換してから文字列化することで末尾の0を落とす（80.00→80、62.50→62.5）。
 */
export function formatDecimal(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return String(num);
}
