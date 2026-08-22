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

import type { Address } from "../../../types/domain";

export const DEMO_POOLING_PARAM = "mockPooling";
const DEMO_POOLING_STORAGE_KEY = "greengoods_dev_mock_pooling";
/** Mirrors DevAuthProvider's storage key and address table, which live a layer above this module. */
const DEV_MOCK_AUTH_STORAGE_KEY = "greengoods_dev_mock_auth";
const DEV_MOCK_AUTH_PARAM = "mockAuth";

export const DEMO_VIEWER_ADDRESSES: Record<"deployer" | "operator" | "user", Address> = {
  deployer: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  operator: "0x04D60647836bcA09c37B379550038BdaaFD82503",
  user: "0x1234567890123456789012345678901234567890",
};

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function isDemoPoolingActive(): boolean {
  if (!import.meta.env.DEV || !hasWindow()) return false;
  const flag = new URLSearchParams(window.location.search).get(DEMO_POOLING_PARAM);
  if (flag === "0" || flag === "off" || flag === "false") {
    window.sessionStorage.removeItem(DEMO_POOLING_STORAGE_KEY);
    return false;
  }
  if (flag !== null) {
    window.sessionStorage.setItem(DEMO_POOLING_STORAGE_KEY, "1");
    return true;
  }
  return window.sessionStorage.getItem(DEMO_POOLING_STORAGE_KEY) === "1";
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
  const role = fromUrl ?? stored;
  if (role === "deployer" || role === "operator" || role === "user") {
    return DEMO_VIEWER_ADDRESSES[role];
  }
  return DEMO_VIEWER_ADDRESSES.user;
}
