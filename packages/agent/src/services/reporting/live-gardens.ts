import { acceptsChatReports } from "@green-goods/shared/modules/agent-reporting";
import * as z from "zod";
import type { GardenDirectory, ReportingGarden } from "./gardens";

/**
 * The live garden directory: every garden the Green Goods indexer knows on the Agent's chain that
 * accepts chat reports. Names come from the indexer and may change; the address is the identity.
 * The role lists are the indexer's view of who may report to a garden. They say which gardens a
 * linked account is offered, and nothing more: publishing reads the account's role from the chain.
 */
export interface LiveGardenOptions {
  indexerUrl: string;
  chainId: number;
  fetch?: typeof fetch;
  ttlMs?: number;
}

const GARDENS_QUERY = `query ReportingGardens($chainId: Int!) {
  Garden(where: { chainId: { _eq: $chainId } }, order_by: { createdAt: asc }, limit: 1000) {
    id chainId name initialized gardeners operators owners
  }
}`;

/**
 * After a failed read, wait this long before asking the indexer again. A caller may name a
 * shorter wait of its own.
 */
const RETRY_MS = 30_000;

/**
 * A garden whose role list cannot be read still accepts reports. A chat with no account can choose
 * it; no linked account is offered it until the list can be read.
 */
const roleList = z.array(z.string()).catch([]);

const rowSchema = z.object({
  id: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int(),
  name: z.string(),
  initialized: z.boolean(),
  gardeners: roleList,
  operators: roleList,
  owners: roleList,
});

function toGarden(row: z.infer<typeof rowSchema>): ReportingGarden {
  const address = row.id.toLowerCase() as `0x${string}`;
  const label = row.name.trim() || `${address.slice(0, 6)}…${address.slice(-4)}`;
  return { key: address, chainId: row.chainId, address, label };
}

export function createLiveGardenDirectory(options: LiveGardenOptions): GardenDirectory {
  const request = options.fetch ?? fetch;
  const ttl = options.ttlMs ?? 5 * 60 * 1000;
  let gardens: readonly ReportingGarden[] = [];
  /** Garden key to the lowercase accounts that hold a reporting role there. */
  let members: ReadonlyMap<string, ReadonlySet<string>> = new Map();
  /** When the list was last read; null before the first read and after one that failed. */
  let readAt: number | null = null;
  /** When a read last failed; null once one has gone through since. */
  let failedAt: number | null = null;
  let loading: Promise<void> | null = null;

  async function load(nowMs: number): Promise<void> {
    try {
      const response = await request(options.indexerUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: GARDENS_QUERY, variables: { chainId: options.chainId } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Indexer returned ${response.status}`);
      const body = (await response.json()) as { data?: { Garden?: unknown } };
      const rows = body.data?.Garden;
      if (!Array.isArray(rows)) throw new Error("Indexer returned no garden list");
      const roles = new Map<string, ReadonlySet<string>>();
      gardens = rows
        .flatMap((row) => {
          const parsed = rowSchema.safeParse(row);
          if (!parsed.success || parsed.data.chainId !== options.chainId) return [];
          const garden = toGarden(parsed.data);
          if (
            !acceptsChatReports({ address: garden.address, initialized: parsed.data.initialized })
          )
            return [];
          const { gardeners, operators, owners } = parsed.data;
          roles.set(
            garden.key,
            new Set([...gardeners, ...operators, ...owners].map((account) => account.toLowerCase()))
          );
          return [garden];
        })
        .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
      members = roles;
      readAt = nowMs;
      failedAt = null;
    } catch (error) {
      readAt = null;
      failedAt = nowMs;
      throw error;
    }
  }

  return {
    list: () => gardens,
    membershipsOf(account) {
      const wanted = account.toLowerCase();
      const own = gardens.filter((garden) => members.get(garden.key)?.has(wanted));
      // Finding the account in no garden only says it has none when the list is a current read.
      return own.length > 0 || readAt !== null
        ? { ok: true, gardens: own }
        : { ok: false, reason: "unavailable" };
    },
    refresh(nowMs, maxAgeMs = ttl, retryAfterMs = RETRY_MS) {
      const fresh = readAt !== null && nowMs - readAt < maxAgeMs;
      const waiting = failedAt !== null && nowMs - failedAt < retryAfterMs;
      if (fresh || waiting) return Promise.resolve();
      loading ??= load(nowMs).finally(() => {
        loading = null;
      });
      return loading;
    },
  };
}
