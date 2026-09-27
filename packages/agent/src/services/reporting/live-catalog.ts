import {
  type ActionDefinition,
  type ActionDefinitionSnapshot,
  actionEligibilityIssues,
  snapshotActionDefinition,
} from "@green-goods/shared/modules/agent-reporting";
import { Domain, type WorkInput } from "@green-goods/shared/types/domain";
import * as z from "zod";
import type { CatalogResult, ReportingCatalog } from "./catalog";
import type { ReportingChain } from "./chain";
import type { EnabledGarden } from "./runtime";

/**
 * The live Action catalog: Action rows from the Green Goods indexer and each Action's published
 * instruction JSON, fetched by its CID. Only instructions that are actually published and carry a
 * well-formed field contract become snapshots; the client's built-in templates are never used as
 * a substitute, so a missing or malformed instruction file removes that Action from the choices.
 */
export interface LiveCatalogOptions {
  chain: ReportingChain;
  indexerUrl: string;
  registryAddress: `0x${string}`;
  fetchInstructions: (cid: string) => Promise<unknown>;
  fetch?: typeof fetch;
  cacheTtlMs?: number;
}

const DOMAINS: Record<string, Domain> = {
  SOLAR: Domain.SOLAR,
  AGRO: Domain.AGRO,
  EDU: Domain.EDU,
  WASTE: Domain.WASTE,
};

const workInputSchema: z.ZodType<WorkInput> = z.lazy(() =>
  z.object({
    key: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    placeholder: z.string().max(500).default(""),
    type: z.enum(["text", "textarea", "select", "multi-select", "number", "band", "repeater"]),
    required: z.boolean(),
    options: z.array(z.string().max(200)).max(255).default([]),
    bands: z.array(z.string().max(200)).max(50).optional(),
    optionLabels: z.record(z.string(), z.string().max(200)).optional(),
    bandLabels: z.record(z.string(), z.string().max(200)).optional(),
    unit: z.string().max(40).optional(),
    repeaterFields: z.array(workInputSchema).max(20).optional(),
  })
) as z.ZodType<WorkInput>;

/** The published contract must state its own inputs and media rules; nothing is filled in. */
const instructionsSchema = z.object({
  uiConfig: z.object({
    media: z.object({
      required: z.boolean(),
      minImageCount: z.number().int().min(0).max(50),
      maxImageCount: z.number().int().min(0).max(50),
    }),
    details: z.object({ inputs: z.array(workInputSchema).max(50) }),
  }),
});

const rowSchema = z.object({
  id: z.string(),
  chainId: z.number().int(),
  startTime: z.union([z.string(), z.number()]).nullable(),
  endTime: z.union([z.string(), z.number()]).nullable(),
  title: z.string(),
  slug: z.string(),
  instructions: z.string().nullable(),
  domain: z.string().nullable(),
});

const ACTIONS_QUERY = `query Actions($chainId: Int!) {
  Action(where: { chainId: { _eq: $chainId } }, order_by: { createdAt: desc }, limit: 100) {
    id chainId startTime endTime title slug instructions domain
  }
}`;

function seconds(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1000 : null;
}

export function createLiveReportingCatalog(options: LiveCatalogOptions): ReportingCatalog {
  const request = options.fetch ?? fetch;
  const ttl = options.cacheTtlMs ?? 5 * 60 * 1000;
  const cache = new Map<string, { expiresAt: number; result: CatalogResult }>();

  async function rows(chainId: number) {
    const response = await request(options.indexerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: ACTIONS_QUERY, variables: { chainId } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Indexer returned ${response.status}`);
    const body = (await response.json()) as { data?: { Action?: unknown[] } };
    return (body.data?.Action ?? []).flatMap((row) => {
      const parsed = rowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async function definitionOf(
    row: z.infer<typeof rowSchema>
  ): Promise<{ definition: ActionDefinition; cid: string } | null> {
    const actionUID = Number(row.id.split("-").at(-1));
    const startTime = seconds(row.startTime);
    const endTime = seconds(row.endTime);
    if (!row.instructions || !Number.isSafeInteger(actionUID) || !startTime || !endTime)
      return null;
    const cid = row.instructions.replace(/^ipfs:\/\//, "");
    let published: unknown;
    try {
      published = await options.fetchInstructions(cid);
    } catch {
      return null;
    }
    const instructions = instructionsSchema.safeParse(published);
    if (!instructions.success) return null;
    const { media, details } = instructions.data.uiConfig;
    return {
      cid,
      definition: {
        chainId: row.chainId,
        actionUID,
        slug: row.slug,
        title: row.title,
        startTime,
        endTime,
        domain: row.domain ? (DOMAINS[row.domain] ?? null) : null,
        inputs: details.inputs,
        media: {
          required: media.required,
          minImageCount: media.minImageCount,
          maxImageCount: media.maxImageCount,
        },
      },
    };
  }

  return {
    async eligibleActions(garden: EnabledGarden, nowMs: number): Promise<CatalogResult> {
      const cached = cache.get(garden.address);
      const fresh =
        cached && cached.expiresAt > nowMs
          ? cached.result
          : await (async (): Promise<CatalogResult> => {
              try {
                const [list, mask, block] = await Promise.all([
                  rows(garden.chainId),
                  options.chain.gardenDomainMask(garden.chainId, garden.address),
                  options.chain.blockNumber(garden.chainId),
                ]);
                const loaded = await Promise.all(list.map(definitionOf));
                const snapshots: ActionDefinitionSnapshot[] = [];
                for (const entry of loaded) {
                  if (!entry) continue;
                  if (actionEligibilityIssues(entry.definition, mask, nowMs).length > 0) continue;
                  snapshots.push(
                    snapshotActionDefinition(
                      entry.definition,
                      { registry: options.registryAddress, instructionsRef: entry.cid },
                      block
                    )
                  );
                }
                // Rows exist but no instructions could be read: the catalog is not usable now.
                if (list.length > 0 && loaded.every((entry) => entry === null)) {
                  return { ok: false, reason: "unavailable" };
                }
                const result: CatalogResult = { ok: true, actions: snapshots };
                cache.set(garden.address, { expiresAt: nowMs + ttl, result });
                return result;
              } catch {
                return { ok: false, reason: "unavailable" };
              }
            })();
      if (!fresh.ok) return fresh;
      // Dates are rechecked on every call even when the list came from the cache.
      return {
        ok: true,
        actions: fresh.actions.filter(
          (snapshot) => actionEligibilityIssues(snapshot.definition, null, nowMs).length === 0
        ),
      };
    },
  };
}
