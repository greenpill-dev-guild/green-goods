import { describe, expect, it } from "vitest";
import {
  type CatalogFailure,
  createLiveReportingCatalog,
} from "../../services/reporting/live-catalog";
import { FakeChain } from "./support/fake-chain";
import { TAS } from "./support/fixtures";

/**
 * The live catalog against recorded indexer rows and instruction files, with fetch replaced. It
 * proves which Actions may become snapshots; it does not reach the real indexer or IPFS.
 */
const NOW = Date.UTC(2026, 8, 27);
const DAY = 86_400;

function row(uid: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `42161-${uid}`,
    chainId: 42161,
    startTime: String(NOW / 1000 - DAY),
    endTime: String(NOW / 1000 + 30 * DAY),
    title: `Action ${uid}`,
    slug: "agro.planting_event",
    instructions: `bafy-instructions-${uid}`,
    domain: "AGRO",
    ...overrides,
  };
}

const published = {
  description: "Plant trees",
  uiConfig: {
    media: {
      required: true,
      minImageCount: 1,
      maxImageCount: 4,
      title: "",
      needed: [],
      optional: [],
    },
    details: {
      inputs: [
        {
          key: "seedlings",
          title: "Seedlings planted",
          placeholder: "",
          type: "number",
          required: true,
          options: [],
          unit: "seedlings",
        },
      ],
    },
  },
};

function catalog(rows: unknown[], files: Record<string, unknown>) {
  const chain = new FakeChain();
  const fetched: string[] = [];
  const failures: CatalogFailure[] = [];
  let indexerCalls = 0;
  const instance = createLiveReportingCatalog({
    chain,
    onUnavailable: (failure) => failures.push(failure),
    indexerUrl: "https://indexer.test/graphql",
    registryAddress: "0x00000000000000000000000000000000000000b0",
    fetchInstructions: async (cid) => {
      fetched.push(cid);
      if (!(cid in files)) throw new Error("gateway timeout");
      return files[cid];
    },
    fetch: (async () => {
      indexerCalls += 1;
      return new Response(JSON.stringify({ data: { Action: rows } }));
    }) as unknown as typeof fetch,
  });
  return { chain, instance, fetched, failures, indexerCalls: () => indexerCalls };
}

describe("live Action catalog", () => {
  it("snapshots only published, well-formed and currently eligible Actions", async () => {
    const { instance, chain } = catalog(
      [
        row(1),
        row(2, { instructions: null }),
        row(3, { instructions: "bafy-template-shaped" }),
        row(4, { endTime: String(NOW / 1000 - 1) }),
        row(5, { domain: "SOLAR" }),
      ],
      {
        "bafy-instructions-1": published,
        "bafy-template-shaped": { description: "no field contract" },
        "bafy-instructions-4": published,
        "bafy-instructions-5": published,
      }
    );
    chain.masks.set(TAS.address.toLowerCase(), 1 << 1); // AGRO only
    const result = await instance.eligibleActions(TAS, NOW);
    if (!result.ok) throw new Error("expected actions");
    expect(result.actions.map((action) => action.definition.actionUID)).toEqual([1]);
    const [snapshot] = result.actions;
    expect(snapshot?.source).toEqual({
      registry: "0x00000000000000000000000000000000000000b0",
      instructionsRef: "bafy-instructions-1",
    });
    expect(snapshot?.definition.inputs[0]?.key).toBe("seedlings");
    expect(snapshot?.definition.media).toEqual({
      required: true,
      minImageCount: 1,
      maxImageCount: 4,
    });
    expect(snapshot?.observedBlock).toBe(chain.block.toString());
  });

  it("reports the catalog unavailable when no instruction file can be read", async () => {
    const { instance, failures } = catalog([row(1), row(2)], {});
    expect(await instance.eligibleActions(TAS, NOW)).toEqual({ ok: false, reason: "unavailable" });
    expect(failures).toEqual([{ garden: TAS.address, read: "instructions", cause: "Error" }]);
  });

  it("names the chain read when the RPC refuses, without quoting the address it called", async () => {
    const { instance, chain, failures } = catalog([row(1)], { "bafy-instructions-1": published });
    chain.gardenDomainMask = async () => {
      throw Object.assign(new Error("HTTP request failed. URL: https://rpc.test/v2/provider-key"), {
        name: "HttpRequestError",
        status: 429,
      });
    };
    expect(await instance.eligibleActions(TAS, NOW)).toEqual({ ok: false, reason: "unavailable" });
    expect(failures).toEqual([
      { garden: TAS.address, read: "chain", cause: "HttpRequestError, status 429" },
    ]);
    // A failed read is never cached: the next message reads the chain again.
    chain.gardenDomainMask = async () => 0b11;
    expect((await instance.eligibleActions(TAS, NOW)).ok).toBe(true);
  });

  it("keeps readable eligible Actions when another instruction gateway read fails", async () => {
    const { instance } = catalog([row(1), row(2)], { "bafy-instructions-1": published });
    const result = await instance.eligibleActions(TAS, NOW);
    if (!result.ok) throw new Error("expected the readable Action");
    expect(result.actions.map((action) => action.definition.actionUID)).toEqual([1]);
  });

  it("caches a good list but still rechecks each Action's dates", async () => {
    const { instance, indexerCalls } = catalog([row(1, { endTime: String(NOW / 1000 + 60) })], {
      "bafy-instructions-1": published,
    });
    expect((await instance.eligibleActions(TAS, NOW)).ok).toBe(true);
    const later = await instance.eligibleActions(TAS, NOW + 120_000);
    expect(later).toEqual({ ok: true, actions: [] });
    expect(indexerCalls()).toBe(1);
  });
});
