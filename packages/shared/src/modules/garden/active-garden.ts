/**
 * The active garden: the garden the installed app's Home opens in. It is a device preference
 * for each chain and account (PWA Home decision 8), never account state, and only the chip
 * changes it (decision 6). `resolveActiveGarden` combines the account's gardens
 * (`useMyGardens`) with the garden this device remembers for the chain and account:
 *
 * - `loading` while the account's gardens are unknown. It keeps the remembered garden so an
 *   offline open goes straight in, after a failed read too.
 * - `error` when the read failed and nothing is remembered, kept apart from no gardens.
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

export type ActiveGardenStatus = "loading" | "error" | "none" | "choose" | "ready";

export type ActiveGardenResolution =
  /** The account's gardens are unknown; `gardenId` is the remembered garden, if any. */
  | { status: "loading"; gardenId: string | null }
  | { status: "error" | "none" | "choose"; gardenId: null }
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
    if (myGardens.isError && !rememberedId) return { status: "error", gardenId: null };
    return { status: "loading", gardenId: rememberedId };
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
