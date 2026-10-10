import { describe, expect, it } from "vitest";
import type { GardenMemberships } from "../../services/reporting/gardens";
import { createLiveGardenDirectory } from "../../services/reporting/live-gardens";

/** The live garden list: the indexer's gardens on the Agent's chain that accept chat reports. */
const garden = (suffix: string, name: string, initialized = true, chainId = 42161) => ({
  id: `0x${suffix.padStart(40, "0")}`,
  chainId,
  name,
  initialized,
});

const STRANGER = "0x00000000000000000000000000000000000000ff";
const UNAVAILABLE = { ok: false, reason: "unavailable" };
const labelsOf = (memberships: GardenMemberships) =>
  memberships.ok ? memberships.gardens.map((entry) => entry.label) : null;

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
  it("keeps an empty directory when the first indexer read fails", async () => {
    const { fetchStub } = indexer(["down"]);
    const gardens = createLiveGardenDirectory({
      indexerUrl: "https://indexer.test",
      chainId: 42161,
      fetch: fetchStub,
    });
    await expect(gardens.refresh(0)).rejects.toThrow(/503/);
    expect(gardens.list()).toEqual([]);
  });

  it("shares concurrent refreshes instead of issuing duplicate indexer reads", async () => {
    const { requests, fetchStub } = indexer([[garden("A1", "TAS")]]);
    const gardens = createLiveGardenDirectory({
      indexerUrl: "https://indexer.test",
      chainId: 42161,
      fetch: fetchStub,
    });
    const first = gardens.refresh(0);
    const second = gardens.refresh(0);
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(requests()).toBe(1);
    expect(gardens.list().map((entry) => entry.label)).toEqual(["TAS"]);
  });

  it("rejects a malformed indexer list rather than treating it as an empty garden set", async () => {
    const gardens = createLiveGardenDirectory({
      indexerUrl: "https://indexer.test",
      chainId: 42161,
      fetch: (async () => Response.json({ data: { Garden: {} } })) as unknown as typeof fetch,
    });
    await expect(gardens.refresh(0)).rejects.toThrow(/no garden list/);
    expect(gardens.list()).toEqual([]);
  });
  it("names the gardens an account holds a role in, whatever the letter case, and no others", async () => {
    const ada = "0xAbCdEf0000000000000000000000000000000001";
    const { fetchStub } = indexer([
      [
        { ...garden("A1", "TAS"), gardeners: [ada], operators: [], owners: [] },
        { ...garden("A2", "Aiyeloja Family Garden"), gardeners: [], operators: [ada], owners: [] },
        { ...garden("A3", "Greenpill Kenya"), gardeners: [], operators: [], owners: [ada] },
        // A funder or evaluator cannot report, and unreadable role lists place no one.
        { ...garden("A4", "Mama Gardens"), funders: [ada], evaluators: [ada] },
        { ...garden("A5", "Vida Verde"), gardeners: null, operators: "x", owners: [7] },
        { ...garden("A6", "Placeholder", false), gardeners: [ada], operators: [], owners: [] },
      ],
    ]);
    const gardens = createLiveGardenDirectory({
      indexerUrl: "https://indexer.test",
      chainId: 42161,
      fetch: fetchStub,
    });
    // Before any read there is nothing to say about an account, least of all that it has no garden.
    expect(gardens.membershipsOf(ada.toLowerCase() as `0x${string}`)).toEqual(UNAVAILABLE);
    await gardens.refresh(0);
    expect(gardens.list().map((entry) => entry.label)).toEqual([
      "Aiyeloja Family Garden",
      "Greenpill Kenya",
      "Mama Gardens",
      "TAS",
      "Vida Verde",
    ]);
    expect(labelsOf(gardens.membershipsOf(ada.toLowerCase() as `0x${string}`))).toEqual([
      "Aiyeloja Family Garden",
      "Greenpill Kenya",
      "TAS",
    ]);
    expect(gardens.membershipsOf(STRANGER)).toEqual({ ok: true, gardens: [] });
  });

  it("keeps a known account's gardens through a failed read, and stops calling a stranger gardenless", async () => {
    const ada = "0xabcdef0000000000000000000000000000000001";
    const { requests, fetchStub } = indexer([
      [{ ...garden("A1", "TAS"), gardeners: [ada], operators: [], owners: [] }],
      "down",
      [{ ...garden("A1", "TAS"), gardeners: [ada, STRANGER], operators: [], owners: [] }],
    ]);
    const gardens = createLiveGardenDirectory({
      indexerUrl: "https://indexer.test",
      chainId: 42161,
      fetch: fetchStub,
      ttlMs: 60_000,
    });
    await gardens.refresh(0);
    // A turn about to use an account's gardens reads again sooner than the list's own lifetime.
    await expect(gardens.refresh(40_000, 30_000)).rejects.toThrow(/503/);
    expect(labelsOf(gardens.membershipsOf(ada))).toEqual(["TAS"]);
    expect(gardens.membershipsOf(STRANGER)).toEqual(UNAVAILABLE);

    // The failed read is not repeated at once. A caller may ask for it sooner than the
    // directory's own wait, though not within the wait it names.
    await gardens.refresh(50_000, 30_000);
    await gardens.refresh(42_000, 3_000, 3_000);
    expect(requests()).toBe(2);
    await gardens.refresh(50_000, 3_000, 3_000);
    expect(requests()).toBe(3);
    // The good read settles both answers, and serves until it is too old for its caller.
    expect(labelsOf(gardens.membershipsOf(STRANGER))).toEqual(["TAS"]);
    await gardens.refresh(70_000, 30_000);
    expect(requests()).toBe(3);
  });

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
