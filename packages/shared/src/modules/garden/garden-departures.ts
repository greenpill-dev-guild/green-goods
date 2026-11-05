import type { Address, Garden } from "../../types/domain";
import { logger } from "../app/logger";

const STORAGE_KEY = "greengoods:garden-departures";
const ROLE_LISTS = [
  "owners",
  "stewards",
  "evaluators",
  "gardeners",
  "funders",
  "communities",
] as const;
// Account and chain scoped. Storage failures retain the departure for this tab.
let memory: Record<string, string> = {};
const forgotten = new Set<string>();
function records(): Record<string, string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved && typeof saved === "object") {
      const result = {
        ...Object.fromEntries(
          Object.entries(saved).filter(
            ([, value]) => typeof value === "string" && /^\d+$/.test(value)
          )
        ),
        ...memory,
      };
      for (const entry of forgotten) delete result[entry];
      return result;
    }
  } catch {
    /* The in-memory record still fences stale rosters. */
  }
  return { ...memory };
}
function save(next: Record<string, string>) {
  memory = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    forgotten.clear();
  } catch (error) {
    logger.warn("Could not save garden departures", { error });
  }
}
function key(chainId: number, garden: string, account: string) {
  return `${chainId}:${garden.toLowerCase()}:${account.toLowerCase()}`;
}

export function recordGardenDeparture(
  chainId: number,
  garden: string,
  account: string,
  blockNumber = 0n
) {
  forgotten.delete(key(chainId, garden, account));
  const next = records();
  const entry = key(chainId, garden, account);
  const previous = BigInt(next[entry] ?? "0");
  save({ ...next, [entry]: (blockNumber > previous ? blockNumber : previous).toString() });
}

export function getGardenDepartureBlock(
  chainId: number,
  garden: string,
  account: string
): bigint | undefined {
  const block = records()[key(chainId, garden, account)];
  return block === undefined ? undefined : BigInt(block);
}

/** A new join supersedes this device's earlier departure. */
export function forgetGardenDeparture(chainId: number, garden: string, account: string) {
  const next = records();
  forgotten.add(key(chainId, garden, account));
  delete next[key(chainId, garden, account)];
  save(next);
}

/** Apply to restored caches too. A stale indexer answer cannot put a leaver back on a roster. */
export function withoutDepartedMembers(gardens: Garden[], chainId: number): Garden[] {
  const pending = records();
  return gardens.map((garden) => {
    const prefix = `${chainId}:${garden.id.toLowerCase()}:`;
    const accounts = new Set(
      Object.keys(pending)
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => entry.slice(prefix.length))
    );
    if (accounts.size === 0) return garden;
    const updated = { ...garden };
    for (const list of ROLE_LISTS)
      updated[list] = (garden[list] ?? []).filter(
        (address) => !accounts.has(address.toLowerCase())
      );
    return updated;
  });
}

/** Only a chain-confirmed regrant releases the fence; unversioned indexer absence proves no ordering. */
export async function reconcileGardenDepartures(
  gardens: Garden[],
  chainId: number,
  readRejoined = async (garden: Address, account: Address, block: bigint) => {
    const { readMembershipAfterDeparture } = await import("./garden-departure-reads");
    return readMembershipAfterDeparture(chainId, garden, account, block);
  }
): Promise<Garden[]> {
  const pending = records();
  for (const garden of gardens) {
    const prefix = `${chainId}:${garden.id.toLowerCase()}:`;
    for (const entry of Object.keys(pending).filter((value) => value.startsWith(prefix))) {
      const account = entry.slice(prefix.length) as Address;
      let rejoined = false;
      try {
        rejoined = await readRejoined(garden.id as Address, account, BigInt(pending[entry]));
      } catch {
        /* Unknown chain state keeps the confirmed departure in force. */
      }
      // A later departure must not be erased by an earlier response still in flight.
      if (rejoined && records()[entry] === pending[entry]) {
        forgetGardenDeparture(chainId, garden.id, account);
      }
    }
  }
  return withoutDepartedMembers(gardens, chainId);
}
