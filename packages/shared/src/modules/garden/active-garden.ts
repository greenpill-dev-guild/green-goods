/**
 * The active garden: the garden the installed app's Home opens in. It is a device preference
 * for each chain and account (PWA Home decision 8), never account state. Only a pick changes it,
 * in the chip's switcher or on Home's first-login page, and so does joining an open garden
 * (decision 6, DL-146, DL-147). `resolveActiveGarden` combines the account's gardens
 * (`useMyGardens`) with the garden this device remembers for the chain and account:
 *
 * - `loading` while the account's gardens are being read. It keeps the remembered garden, so Home
 *   names it and the scoped lists keep reading it.
 * - `error` when the read failed before any list arrived, kept apart from no gardens. It keeps
 *   a remembered garden the same way: a remembered garden never hides the failure behind a
 *   loading state that cannot end. A failed refresh of a list that did arrive resolves from that
 *   list, so nothing is lost.
 * - `none` when the account has no garden.
 * - `ready` with the remembered garden while it is still the account's, or with the one
 *   garden, which selects itself and is remembered.
 * - `choose` when several remain and none of them is remembered.
 *
 * A remembered garden the account no longer holds stops winning on the next load and stays
 * stored: nothing is forgotten behind the member's back, and no garden the account cannot see
 * is selected. Drafts, queued jobs, promise links and permission checks never read it; each
 * carries or reads its own garden.
 */

import { isZeroAddress } from "../../utils/blockchain/address";

export type ActiveGardenStatus = "loading" | "error" | "none" | "choose" | "ready";

export type ActiveGardenResolution =
  /**
   * The account's gardens are unknown, being read or after a read that failed; `gardenId` is the
   * remembered garden, if any.
   */
  | { status: "loading" | "error"; gardenId: string | null }
  | { status: "none" | "choose"; gardenId: null }
  /** `remember` is true when the one garden selected itself and the device should keep it. */
  | { status: "ready"; gardenId: string; remember: boolean };

export interface ActiveGardenInputs {
  /** The chain and account the choice belongs to (`activeGardenScope`); null without an account. */
  scope: string | null;
  /** The garden this device remembers for each scope. */
  remembered: Readonly<Record<string, string>>;
  /** The account's gardens and whether they are known (`useMyGardens`). */
  myGardens: {
    gardens: readonly { garden: { id: string } }[];
    isLoaded: boolean;
    isError: boolean;
  };
}

/** The scope an active garden belongs to: one chain and one account, `${chainId}:${account}`. */
export function activeGardenScope(chainId: number, account: string | null | undefined) {
  return account ? `${chainId}:${account.toLowerCase()}` : null;
}

export function resolveActiveGarden({
  scope,
  remembered,
  myGardens,
}: ActiveGardenInputs): ActiveGardenResolution {
  // Without an account nothing is known yet; the app's routes wait for one.
  if (!scope) return { status: "loading", gardenId: null };
  const rememberedId = remembered[scope] ?? null;
  if (!myGardens.isLoaded) {
    return { status: myGardens.isError ? "error" : "loading", gardenId: rememberedId };
  }

  const gardenIds = myGardens.gardens.map(({ garden }) => garden.id);
  if (gardenIds.length === 0) return { status: "none", gardenId: null };
  const stillMine = rememberedId
    ? gardenIds.find((gardenId) => gardenId.toLowerCase() === rememberedId.toLowerCase())
    : undefined;
  if (stillMine) return { status: "ready", gardenId: stillMine, remember: false };
  if (gardenIds.length === 1) return { status: "ready", gardenId: gardenIds[0], remember: true };
  return { status: "choose", gardenId: null };
}

/**
 * What a garden-scoped list reads (DL-129): the Promises and Your Work sheets and their badges.
 */
export interface GardenListScope {
  /** The active garden, or the remembered one while the account's gardens load; null for none. */
  activeGardenId: string | null;
  /** The account's gardens, lowercased, which the chip can switch to; null while unknown. */
  memberGardenIds: ReadonlySet<string> | null;
}

/**
 * Whether a garden-scoped list shows an item that names these gardens. With an active garden it
 * hides only what names another of the account's gardens, since switching the chip shows it
 * there. What names the active garden stays, and so does what names none of the account's
 * gardens: a garden the account left, a promise in a pool of a garden it does not belong to,
 * or a record that names no garden has nowhere else to show. While the account's gardens are
 * unknown, every other garden is taken for one of them. With no active garden nothing is hidden.
 */
export function isInGardenListScope(
  scope: GardenListScope,
  gardens: readonly (string | null | undefined)[]
): boolean {
  if (!scope.activeGardenId) return true;
  const named = gardens.flatMap((garden) =>
    garden && !isZeroAddress(garden) ? [garden.toLowerCase()] : []
  );
  if (named.length === 0 || named.includes(scope.activeGardenId.toLowerCase())) return true;
  const { memberGardenIds } = scope;
  return memberGardenIds !== null && !named.some((garden) => memberGardenIds.has(garden));
}
