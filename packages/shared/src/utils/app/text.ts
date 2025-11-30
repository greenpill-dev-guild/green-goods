export type FormatAddressVariant = "default" | "card" | "long";

export interface FormatAddressOptions {
  variant?: FormatAddressVariant;
  ensName?: string | null;
  fallbackLabel?: string;
}

/** Shortens an Ethereum address or ENS name for display in the UI. */
export const formatAddress = (
  address?: string | null,
  options: FormatAddressOptions = {}
): string => {
  const { variant = "default", ensName, fallbackLabel } = options;
  if (ensName) return ensName;
  if (!address) return fallbackLabel ?? "no address provided";
  if (address.includes(".eth")) return address;

  const slices = {
    default: { start: 6, end: 4 },
    card: { start: 4, end: 3 },
    long: { start: 8, end: 6 },
  } as const satisfies Record<FormatAddressVariant, { start: number; end: number }>;

  const { start, end } = slices[variant] ?? slices.default;
  if (address.length <= start + end) return address;

  const startSlice = address.slice(0, start);
  const endSlice = address.slice(address.length - end);
  return `${startSlice}...${endSlice}`;
};

/** Truncates a string and appends an ellipsis when it exceeds the provided length. */
export function truncate(str: string, n: number) {
  return str.length > n ? `${str.slice(0, n - 1)}...` : str;
}

/** Basic e-mail validation for user inputs. */
export function isValidEmail(email: string) {
  // eslint-disable-next-line no-useless-escape
  return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
    email
  );
}

/** Generates a short description preview capped at 80 characters. */
export function truncateDescription(description: string) {
  return description.length > 80 ? `${description.slice(0, 80 - 1)}...` : description;
}

/** Formats token prices or fiat amounts with a currency label. */
export function formatPrice(price: number | null, currency?: "ETH" | "USDC" | "OP") {
  return price?.toLocaleString("en-US", {
    style: "currency",
    currency: currency ?? "USD",
  });
}

/** Converts a timestamp string into a human friendly "time ago" label. */
export function formatLastUpdated(updatedAt: string) {
  const updatedDate = new Date(updatedAt);
  const differenceInSeconds = Math.floor((Date.now() - updatedDate.getTime()) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(differenceInSeconds / interval.seconds);
    if (count !== 0) {
      return `${count} ${interval.label}${count !== 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}

/** Ensures the first character of a string is capitalized. */
export const capitalize = (s: string): string =>
  (s && String(s[0]).toUpperCase() + String(s).slice(1)) || "";
