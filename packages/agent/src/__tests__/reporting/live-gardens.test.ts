import { describe, expect, it } from "vitest";
import { createLiveGardenDirectory } from "../../services/reporting/live-gardens";

/** The live garden list: the indexer's gardens on the Agent's chain that accept chat reports. */
const garden = (suffix: string, name: string, initialized = true, chainId = 42161) => ({
  id: `0x${suffix.padStart(40, "0")}`,
  chainId,
  name,
  initialized,
});

function indexer(responses: Array<unknown[] | "down">) {
  let requests = 0;
  const fetchStub = (async () => {
    requests += 1;
    const next = responses.shift();
    return !next || next === "down"
      ? new Response("unavailable", { status: 503 })
      : Response.json({ data: { Garden: next } });
  }) as unknown as typeof fetch;
  return { requests: () => requests, fetchStub };
}

describe("live garden directory", () => {
  it("lists every garden that accepts reports by name and keeps the last list while the indexer is down", async () => {
    const { requests, fetchStub } = indexer([
      [
        garden("A1", "TAS"),
        garden("A2", " Aiyeloja Family Garden "),
        garden("A3", "", true),
        garden("A4", "Placeholder", false),
        garden("A5", "Elsewhere", true, 10),
        { ...garden("A6", "Hidden"), id: "0x3F22568aE0deAA24dA7b8c669AfDcBD72A6A7fd8" },
        { id: "not-an-address", chainId: 42161, name: "Broken", initialized: true },
      ],
      "down",
    ]);
    const gardens = createLiveGardenDirectory({
      indexerUrl: "https://indexer.test",
      chainId: 42161,
      fetch: fetchStub,
      ttlMs: 60_000,
    });

    await gardens.refresh(0);
    expect(gardens.list().map(({ key, address, label }) => ({ key, address, label }))).toEqual([
      {
        key: "0x00000000000000000000000000000000000000a3",
        address: "0x00000000000000000000000000000000000000a3",
        label: "0x0000…00a3",
      },
      {
        key: "0x00000000000000000000000000000000000000a2",
        address: "0x00000000000000000000000000000000000000a2",
        label: "Aiyeloja Family Garden",
      },
      {
        key: "0x00000000000000000000000000000000000000a1",
        address: "0x00000000000000000000000000000000000000a1",
        label: "TAS",
      },
    ]);
    await gardens.refresh(30_000);
    expect(requests()).toBe(1);

    await expect(gardens.refresh(60_000)).rejects.toThrow(/503/);
    expect(gardens.list()).toHaveLength(3);
    await gardens.refresh(80_000);
    expect(requests()).toBe(2);
  });
});
