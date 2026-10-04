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
import { createLogger } from "../logger";
import type { ReportingGarden } from "./gardens";

const log = createLogger("reporting");

/** The read that left a garden's activities unavailable, for the operator's log. */
export interface CatalogFailure {
  garden: `0x${string}`;
  /**
   * The indexer's Action list, a chain read, or every Action's instruction file; `snapshots` when
   * all three were read and the list could not be built from them.
   */
  read: "indexer" | "chain" | "instructions" | "snapshots";
  /**
   * The error's name and its HTTP status or code, when it has one. Never its message: an RPC error
   * quotes the address it called, which can carry a provider key.
   */
  cause: string;
}

/**
 * The live Action catalog: Action rows from the Green Goods indexer and each Action's published
 * instruction JSON, fetched by its CID. Only instructions that are actually published and carry a
 * well-formed field contract become snapshots; the client's built-in templates are never used as
 * a substitute, so a missing or malformed instruction file removes that Action from the choices.
 * A catalog that cannot be read is reported as unavailable, and the read that failed is logged.
 */
export interface LiveCatalogOptions {
  chain: ReportingChain;
  indexerUrl: string;
  registryAddress: `0x${string}`;
  fetchInstructions: (cid: string) => Promise<unknown>;
  fetch?: typeof fetch;
  cacheTtlMs?: number;
  /** Told which read failed whenever the catalog is unavailable; logs a warning by default. */
  onUnavailable?: (failure: CatalogFailure) => void;
}

class CatalogReadError extends Error {
  constructor(
    readonly read: CatalogFailure["read"],
    readonly reason: unknown
  ) {
    super(`The ${read} read failed`);
    this.name = "CatalogReadError";
  }
}

function causeOf(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  const { status, code } = error as { status?: unknown; code?: unknown };
  return [
    error.name,
    typeof status === "number" ? `status ${status}` : null,
    typeof code === "number" || typeof code === "string" ? `code ${code}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Marks a read's failure with which read it was, so the log can name it. */
function reading<T>(read: CatalogFailure["read"], attempt: Promise<T>): Promise<T> {
  return attempt.catch((error: unknown) => {
    throw new CatalogReadError(read, error);
  });
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
  const report = (failure: CatalogFailure): void => {
    if (options.onUnavailable) options.onUnavailable(failure);
    else log.warn(failure, "A garden's activities could not be read");
  };
  const unavailable = (failure: CatalogFailure): CatalogResult => {
    report(failure);
    return { ok: false, reason: "unavailable" };
  };

  async function rows(chainId: number) {
    const response = await request(options.indexerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: ACTIONS_QUERY, variables: { chainId } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw Object.assign(new Error(`Indexer returned ${response.status}`), {
        status: response.status,
      });
    }
    const body = (await response.json()) as { data?: { Action?: unknown[] } };
    return (body.data?.Action ?? []).flatMap((row) => {
      const parsed = rowSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async function definitionOf(
    row: z.infer<typeof rowSchema>,
    unread: unknown[]
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
    } catch (error) {
      unread.push(error);
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
    async eligibleActions(garden: ReportingGarden, nowMs: number): Promise<CatalogResult> {
      const cached = cache.get(garden.address);
      const fresh =
        cached && cached.expiresAt > nowMs
          ? cached.result
          : await (async (): Promise<CatalogResult> => {
              try {
                const [list, mask, block] = await Promise.all([
                  reading("indexer", rows(garden.chainId)),
                  reading("chain", options.chain.gardenDomainMask(garden.chainId, garden.address)),
                  reading("chain", options.chain.blockNumber(garden.chainId)),
                ]);
                const unread: unknown[] = [];
                const loaded = await Promise.all(list.map((row) => definitionOf(row, unread)));
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
                // Rows exist but none could be used. A read that failed is worth another try. Files
                // that were read and refused are not: the garden has no activity to offer, and
                // asking again would only say the same.
                if (list.length > 0 && loaded.every((entry) => entry === null)) {
                  const failure: CatalogFailure = {
                    garden: garden.address,
                    read: "instructions",
                    cause: unread.length > 0 ? causeOf(unread[0]) : "no usable instruction file",
                  };
                  if (unread.length > 0) return unavailable(failure);
                  report(failure);
                }
                const result: CatalogResult = { ok: true, actions: snapshots };
                cache.set(garden.address, { expiresAt: nowMs + ttl, result });
                return result;
              } catch (error) {
                const failed = error instanceof CatalogReadError ? error : null;
                return unavailable({
                  garden: garden.address,
                  read: failed?.read ?? "snapshots",
                  cause: causeOf(failed ? failed.reason : error),
                });
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
