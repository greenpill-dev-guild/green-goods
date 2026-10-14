export const RECEIPT_TOKEN_SESSION_KEY = "gg.receiptToken";

export function scrubReceiptTokenFragmentFromLocation(win: Window = window): string | undefined {
  const hash = win.location.hash;
  if (!hash) return undefined;

  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const receiptToken = params.get("receiptToken");
  if (!receiptToken) return undefined;

  win.sessionStorage.setItem(RECEIPT_TOKEN_SESSION_KEY, receiptToken);
  params.delete("receiptToken");
  const remainingHash = params.toString();
  const nextUrl = `${win.location.pathname}${win.location.search}${
    remainingHash ? `#${remainingHash}` : ""
  }`;
  win.history.replaceState(win.history.state, "", nextUrl);
  return receiptToken;
}
