export type FormatAddressVariant = "default" | "card" | "long";

export interface FormatAddressOptions {
  variant?: FormatAddressVariant;
  ensName?: string | null;
  fallbackLabel?: string;
}

const GREEN_GOODS_ENS_SUFFIX = ".greengoods.eth";

/** Formats ENS names for UI display while keeping non-protocol ENS names intact. */
export const formatEnsNameForDisplay = (ensName?: string | null): string | null => {
  const normalized = ensName?.trim();
  if (!normalized) return null;

  return normalized.toLowerCase().endsWith(GREEN_GOODS_ENS_SUFFIX)
    ? normalized.slice(0, -GREEN_GOODS_ENS_SUFFIX.length)
    : normalized;
};

/** Shortens an Ethereum address or ENS name for display in the UI. */
export const formatAddress = (
  address?: string | null,
  options: FormatAddressOptions = {}
): string => {
  const { variant = "default", ensName, fallbackLabel } = options;
  const displayEnsName = formatEnsNameForDisplay(ensName);
  if (displayEnsName) return displayEnsName;
  if (!address) return fallbackLabel ?? "no address provided";
  const normalizedAddress = address.trim();
  const displayAddressName = formatEnsNameForDisplay(normalizedAddress);
  if (displayAddressName && displayAddressName !== normalizedAddress) return displayAddressName;
  if (normalizedAddress.includes(".eth")) return normalizedAddress;

  const slices = {
    default: { start: 6, end: 4 },
    card: { start: 4, end: 3 },
    long: { start: 8, end: 6 },
  } as const satisfies Record<FormatAddressVariant, { start: number; end: number }>;

  const { start, end } = slices[variant] ?? slices.default;
  if (normalizedAddress.length <= start + end) return normalizedAddress;

  const startSlice = normalizedAddress.slice(0, start);
  const endSlice = normalizedAddress.slice(normalizedAddress.length - end);
  return `${startSlice}...${endSlice}`;
};

/** Truncates a string and appends an ellipsis when it exceeds the provided length. */
export function truncate(str: string, n: number) {
  return str.length > n ? `${str.slice(0, n - 1)}...` : str;
}

/** Ensures the first character of a string is capitalized. */
export const capitalize = (s: string): string =>
  (s && String(s[0]).toUpperCase() + String(s).slice(1)) || "";
