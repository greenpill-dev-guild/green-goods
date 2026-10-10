/** True for a missing value or a zero-filled hexadecimal value such as a bytes32 UID. */
export function isZeroBytes32(value: string | undefined | null): boolean {
  if (!value) return true;
  if (value.length < 3 || !value.startsWith("0x")) return false;
  return /^0+$/.test(value.slice(2));
}
