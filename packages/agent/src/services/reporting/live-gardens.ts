import { acceptsChatReports } from "@green-goods/shared/modules/agent-reporting";
import * as z from "zod";
import type { GardenDirectory, ReportingGarden } from "./gardens";

/**
 * The live garden directory: every garden the Green Goods indexer knows on the Agent's chain that
 * accepts chat reports. Names come from the indexer and may change; the address is the identity.
 */
export interface LiveGardenOptions {
  indexerUrl: string;
  chainId: number;
  fetch?: typeof fetch;
  ttlMs?: number;
}

const GARDENS_QUERY = `query ReportingGardens($chainId: Int!) {
  Garden(where: { chainId: { _eq: $chainId } }, order_by: { createdAt: asc }, limit: 1000) {
    id chainId name initialized
  }
}`;

/** After a failed read, wait this long before asking the indexer again. */
const RETRY_MS = 30_000;

const rowSchema = z.object({
  id: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.number().int(),
  name: z.string(),
  initialized: z.boolean(),
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
  let staleAt = 0;
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
      gardens = rows
        .flatMap((row) => {
          const parsed = rowSchema.safeParse(row);
          if (!parsed.success || parsed.data.chainId !== options.chainId) return [];
          const garden = toGarden(parsed.data);
          return acceptsChatReports({
            address: garden.address,
            initialized: parsed.data.initialized,
          })
            ? [garden]
            : [];
        })
        .sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
      staleAt = nowMs + ttl;
    } catch (error) {
      staleAt = nowMs + RETRY_MS;
      throw error;
    }
  }

  return {
    list: () => gardens,
    refresh(nowMs) {
      if (nowMs < staleAt) return Promise.resolve();
      loading ??= load(nowMs).finally(() => {
        loading = null;
      });
      return loading;
    },
  };
}
