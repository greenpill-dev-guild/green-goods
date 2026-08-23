/**
 * Demo pooling mode, dev builds only.
 *
 * `?mockPooling=1` on any client URL swaps the commitment pooling reads for a
 * fixture world and treats pooling as available on the current chain, so
 * every screen in the loop can be walked on a phone before the hosted
 * indexer carries real pools. `?mockPooling=0` turns it off. Like
 * `?mockAuth=`, the choice persists in sessionStorage for the tab.
 *
 * The fixtures are written around whoever is signed in through `mockAuth`,
 * so the same world reads as a steward's or a member's depending on the
 * role. Nothing here ships: the guard is `import.meta.env.DEV`, which
 * production builds replace with `false`, and the fixtures load through a
 * dynamic import behind it.
 *
 * @module modules/commitment-pooling/demo/demo-mode
 */

import { queryClient } from "../../../config/react-query";
import type { Address } from "../../../types/domain";

export const DEMO_POOLING_PARAM = "mockPooling";
const DEMO_POOLING_STORAGE_KEY = "greengoods_dev_mock_pooling";
/** Mirrors DevAuthProvider's storage key and address table, which live a layer above this module. */
const DEV_MOCK_AUTH_STORAGE_KEY = "greengoods_dev_mock_auth";
const DEV_MOCK_AUTH_PARAM = "mockAuth";

export const DEMO_VIEWER_ADDRESSES: Record<"deployer" | "steward" | "user", Address> = {
  deployer: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  steward: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  user: "0x1234567890123456789012345678901234567890",
};

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/**
 * Drop every pooling read the moment the flag flips, in either direction. The
 * real and demo readers answer under the same cache keys, so without this a
 * fresh fixture result would survive `?mockPooling=0`: the write guard lifts,
 * a screen still drawn from fixture ids offers an act, and the dehydration
 * rule (which only excludes pooling reads while the flag is on) persists the
 * fixture. Evicting at the flip is what keeps the two worlds apart.
 */
function evictPoolingReads(): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[1] === "commitment-pooling" });
}

export function isDemoPoolingActive(): boolean {
  if (!import.meta.env.DEV || !hasWindow()) return false;
  const flag = new URLSearchParams(window.location.search).get(DEMO_POOLING_PARAM);
  const wasOn = window.sessionStorage.getItem(DEMO_POOLING_STORAGE_KEY) === "1";
  if (flag === "0" || flag === "off" || flag === "false") {
    if (wasOn) {
      window.sessionStorage.removeItem(DEMO_POOLING_STORAGE_KEY);
      evictPoolingReads();
    }
    return false;
  }
  if (flag !== null) {
    if (!wasOn) {
      window.sessionStorage.setItem(DEMO_POOLING_STORAGE_KEY, "1");
      evictPoolingReads();
    }
    return true;
  }
  return wasOn;
}

/**
 * The signed-in mock identity, which the fixture world is written around.
 * Falls back to the member when no mock role is set, so the world still
 * reads sensibly for a real wallet in dev.
 */
export function demoViewer(): Address {
  if (!hasWindow()) return DEMO_VIEWER_ADDRESSES.user;
  const fromUrl = new URLSearchParams(window.location.search).get(DEV_MOCK_AUTH_PARAM);
  const stored = window.sessionStorage.getItem(DEV_MOCK_AUTH_STORAGE_KEY);
  // `operator` is the role's former name, still accepted from saved QA links.
  const role = (fromUrl ?? stored) === "operator" ? "steward" : (fromUrl ?? stored);
  if (role === "deployer" || role === "steward" || role === "user") {
    return DEMO_VIEWER_ADDRESSES[role];
  }
  return DEMO_VIEWER_ADDRESSES.user;
}
