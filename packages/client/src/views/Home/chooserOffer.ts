/**
 * The one-time chooser (DL-123): with several gardens and none remembered, Home opens the
 * switcher once as Choose a Garden. Once offered, a dismissal leaves the quiet prompt for the
 * rest of the browser session, for that chain and account. It is a courtesy, not state: the
 * active garden itself is written only by a pick.
 */
const chooserOfferedKey = (scope: string) => `greengoods:garden-chooser-offered:${scope}`;

/** Offers made on this page load while session storage refused the write. */
const offeredWithoutStorage = new Set<string>();

/** The chain and account the offer belongs to. */
export function chooserScope(chainId: number, account: string | null | undefined): string | null {
  return account ? `${chainId}:${account.toLowerCase()}` : null;
}

export function hasOfferedChooser(scope: string): boolean {
  const key = chooserOfferedKey(scope);
  if (offeredWithoutStorage.has(key)) return true;
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function markChooserOffered(scope: string): void {
  const key = chooserOfferedKey(scope);
  try {
    sessionStorage.setItem(key, "true");
  } catch {
    // Storage can be unavailable; remember the offer for this page load instead.
    offeredWithoutStorage.add(key);
  }
}
