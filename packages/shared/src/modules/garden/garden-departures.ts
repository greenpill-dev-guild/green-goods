import type { Address, Garden } from "../../types/domain";
import type { GardenRole } from "../../utils/blockchain/garden-roles";
import { logger } from "../app/logger";

const STORAGE_KEY = "greengoods:garden-departures";
const ROLE_LISTS = {
  owner: "owners",
  steward: "stewards",
  evaluator: "evaluators",
  gardener: "gardeners",
  funder: "funders",
  community: "communities",
} as const;
const ROLES = Object.keys(ROLE_LISTS) as GardenRole[];
const listeners = new Set<() => void>();
const serverFilters = {
  roster: withoutDepartedMembers,
  stewardHints: withoutDepartedStewardHints,
};
let filters = serverFilters;

function notifyFencesChanged() {
  filters = { ...serverFilters };
  for (const listener of listeners) listener();
}

function onFenceStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) notifyFencesChanged();
}

/** Both fetched and cached roster consumers reapply fences when another tab changes them. */
export function subscribeToGardenFences(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onFenceStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onFenceStorage);
  };
}

export function getGardenFenceFilters() {
  return filters;
}

export function getServerGardenFenceFilters() {
  return serverFilters;
}

type Regrant = { block: bigint; roles: GardenRole[] };
type Fence = { departedAt: string; regrant?: { block: string; roles: GardenRole[] } };
type Fences = Record<string, Fence>;

// Successful reads use shared storage. Keep only unsaved changes over a readable snapshot.
let lastRead: Fences = {};
const unsaved = new Map<string, Fence>();

function isBlock(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function parseFence(value: unknown): Fence | undefined {
  if (isBlock(value)) return { departedAt: value }; // Stored by earlier builds.
  if (!value || typeof value !== "object") return;
  const { departedAt, regrant } = value as Partial<Fence>;
  if (!isBlock(departedAt)) return;
  if (
    isBlock(regrant?.block) &&
    BigInt(regrant.block) >= BigInt(departedAt) &&
    Array.isArray(regrant.roles)
  ) {
    return {
      departedAt,
      regrant: {
        block: regrant.block,
        roles: ROLES.filter((role) => regrant.roles.includes(role)),
      },
    };
  }
  return { departedAt };
}

function records(): Fences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    lastRead = {};
    if (saved && typeof saved === "object") {
      for (const [entry, value] of Object.entries(saved)) {
        const fence = parseFence(value);
        if (fence) lastRead[entry] = fence;
      }
    }
  } catch {
    /* Keep the last known fences when storage cannot be read. */
  }
  const next = { ...lastRead };
  for (const [entry, fence] of unsaved) {
    const stored = next[entry];
    if (
      !stored ||
      BigInt(fence.departedAt) > BigInt(stored.departedAt) ||
      (fence.departedAt === stored.departedAt &&
        BigInt(fence.regrant?.block ?? fence.departedAt) >=
          BigInt(stored.regrant?.block ?? stored.departedAt))
    )
      next[entry] = fence;
  }
  return next;
}

function save(next: Fences, changes: ReadonlyMap<string, Fence>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    lastRead = next;
    unsaved.clear();
  } catch (error) {
    for (const [entry, fence] of changes) unsaved.set(entry, fence);
    logger.warn("Could not save garden departures", { error });
  }
  notifyFencesChanged();
}

function prefix(chainId: number, garden: string) {
  return `${chainId}:${garden.toLowerCase()}:`;
}
function key(chainId: number, garden: string, account: string) {
  return prefix(chainId, garden) + account.toLowerCase();
}

export function recordGardenDeparture(
  chainId: number,
  garden: string,
  account: string,
  blockNumber = 0n
) {
  const next = records();
  const entry = key(chainId, garden, account);
  const previous = next[entry];
  if (previous && BigInt(previous.departedAt) >= blockNumber) return;
  const fence = { departedAt: blockNumber.toString() };
  save({ ...next, [entry]: fence }, new Map([[entry, fence]]));
}

export function getGardenFenceBlock(
  chainId: number,
  garden: string,
  account: string
): bigint | undefined {
  const fence = records()[key(chainId, garden, account)];
  return fence && BigInt(fence.regrant?.block ?? fence.departedAt);
}

function applyRegrant(fence: Fence, { block, roles }: Regrant): Fence {
  if (block < BigInt(fence.regrant?.block ?? fence.departedAt)) return fence;
  const readBlock = block.toString();
  if (fence.regrant?.block === readBlock && roles.join() === fence.regrant.roles.join())
    return fence;
  return { ...fence, regrant: { block: readBlock, roles } };
}

export function recordGardenRegrant(
  chainId: number,
  garden: string,
  account: string,
  regrant: Regrant
) {
  const next = records();
  const entry = key(chainId, garden, account);
  const fence = next[entry];
  if (!fence) return;
  const updated = applyRegrant(fence, regrant);
  if (updated !== fence) save({ ...next, [entry]: updated }, new Map([[entry, updated]]));
}

/** The address-filtered indexer query can also contain pre-departure steward or owner data. */
function withoutDepartedStewardHints<T extends { id: string }>(
  gardens: T[],
  chainId: number,
  account: string
): T[] {
  const fences = records();
  return gardens.filter(({ id }) => {
    const fence = fences[key(chainId, id, account)];
    return !fence || fence.regrant?.roles.some((role) => role === "owner" || role === "steward");
  });
}

/** Apply to restored caches too. Each indexed role needs its own post-departure confirmation. */
export function withoutDepartedMembers(gardens: Garden[], chainId: number): Garden[] {
  const fences = records();
  return gardens.map((garden) => {
    const gardenPrefix = prefix(chainId, garden.id);
    if (!Object.keys(fences).some((entry) => entry.startsWith(gardenPrefix))) return garden;
    const updated = { ...garden };
    for (const role of ROLES) {
      const list = ROLE_LISTS[role];
      updated[list] = (garden[list] ?? []).filter((address) => {
        const fence = fences[gardenPrefix + address.toLowerCase()];
        return !fence || Boolean(fence.regrant?.roles.includes(role));
      });
    }
    return updated;
  });
}

async function readRegrant(garden: Address, account: Address, chainId: number, block: bigint) {
  const { readRolesAfterDeparture } = await import("./garden-departure-reads");
  return readRolesAfterDeparture(chainId, garden, account, block);
}

async function reconcileFences(
  members: { garden: Address; account: Address }[],
  chainId: number,
  read: (garden: Address, account: Address, block: bigint) => Promise<Regrant | undefined>
) {
  const pending = records();
  const reads = members.flatMap(({ garden, account }) => {
    const entry = key(chainId, garden, account);
    const fence = pending[entry];
    return fence ? [{ garden, account, entry, fence }] : [];
  });
  const results = await Promise.allSettled(
    reads.map(({ garden, account, fence }) =>
      read(garden, account, BigInt(fence.regrant?.block ?? fence.departedAt))
    )
  );
  const next = records();
  const changes = new Map<string, Fence>();
  for (const [index, result] of results.entries()) {
    const { entry, fence } = reads[index];
    // An earlier read cannot release roles fenced by a departure recorded while it was running.
    if (
      result.status !== "fulfilled" ||
      !result.value ||
      next[entry]?.departedAt !== fence.departedAt
    )
      continue;
    const updated = applyRegrant(next[entry], result.value);
    if (updated !== next[entry]) {
      changes.set(entry, updated);
      next[entry] = updated;
    }
  }
  if (changes.size) save(next, changes);
}

/** A direct steward query also finds gardens outside the paged catalog. */
export async function reconcileStewardHints(
  gardens: { id: string }[],
  chainId: number,
  account: Address
) {
  await reconcileFences(
    gardens.map(({ id }) => ({ garden: id as Address, account })),
    chainId,
    (garden, member, block) => readRegrant(garden, member, chainId, block)
  );
}

/** Unversioned roster absence proves no ordering. Read only fenced accounts present in the roster. */
export async function reconcileGardenDepartures(
  gardens: Garden[],
  chainId: number,
  read: (garden: Address, account: Address, block: bigint) => Promise<Regrant | undefined> = (
    garden,
    account,
    block
  ) => readRegrant(garden, account, chainId, block)
): Promise<Garden[]> {
  const members = gardens.flatMap((garden) => {
    const accounts = new Set(
      ROLES.flatMap((role) =>
        (garden[ROLE_LISTS[role]] ?? []).map((address) => address.toLowerCase() as Address)
      )
    );
    return [...accounts].map((account) => ({ garden: garden.id as Address, account }));
  });
  await reconcileFences(members, chainId, read);
  return withoutDepartedMembers(gardens, chainId);
}
