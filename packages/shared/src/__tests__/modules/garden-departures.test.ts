// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockGarden } from "../test-utils/mock-factories";
import {
  forgetGardenDeparture,
  recordGardenDeparture,
  reconcileGardenDepartures,
  withoutDepartedMembers,
} from "../../modules/garden/garden-departures";
const account = "0x2222222222222222222222222222222222222222" as const;
const other = "0x3333333333333333333333333333333333333333" as const;
const garden = createMockGarden({
  gardeners: [account, other],
  stewards: [account],
  owners: [],
  evaluators: [account],
  funders: [account],
  communities: [account],
});
beforeEach(() => {
  forgetGardenDeparture(42161, garden.id, account);
  forgetGardenDeparture(11155111, garden.id, account);
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("confirmed garden departures", () => {
  it("removes every role while preserving other people and garden details", () => {
    recordGardenDeparture(42161, garden.id, account);
    const [result] = withoutDepartedMembers([garden], 42161);
    expect(result).toMatchObject({
      name: garden.name,
      gardeners: [other],
      stewards: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
    });
    expect(garden.gardeners).toEqual([account, other]);
  });
  it("keeps the fence through an empty pre-join roster followed by stale joined data", async () => {
    recordGardenDeparture(42161, garden.id, account, 40n);
    expect(
      (await reconcileGardenDepartures([garden], 42161, async () => false))[0].stewards
    ).toEqual([]);
    expect(withoutDepartedMembers([garden], 42161)[0].gardeners).toEqual([other]);
    const settled = {
      ...garden,
      gardeners: [other],
      stewards: [],
      evaluators: [],
      funders: [],
      communities: [],
    };
    const chain = vi.fn().mockResolvedValue(false);
    await reconcileGardenDepartures([settled], 42161, chain);
    expect((await reconcileGardenDepartures([garden], 42161, chain))[0].gardeners).toEqual([other]);
    expect(chain).toHaveBeenCalledTimes(2);
    expect(withoutDepartedMembers([garden], 42161)[0].gardeners).toEqual([other]);
  });
  it("does not alter another chain or another garden", () => {
    recordGardenDeparture(42161, garden.id, account);
    expect(withoutDepartedMembers([garden], 11155111)[0]).toBe(garden);
    const elsewhere = { ...garden, id: other };
    expect(withoutDepartedMembers([elsewhere], 42161)[0]).toBe(elsewhere);
  });
  it("a later join releases the departure fence", () => {
    recordGardenDeparture(42161, garden.id, account);
    forgetGardenDeparture(42161, garden.id, account);
    expect(withoutDepartedMembers([garden], 42161)[0]).toBe(garden);
  });
  it("a restored raw roster is still filtered after storage is read", () => {
    localStorage.setItem(
      "greengoods:garden-departures",
      JSON.stringify({ [`42161:${garden.id.toLowerCase()}:${account}`]: "0" })
    );
    expect(withoutDepartedMembers([garden], 42161)[0].gardeners).toEqual([other]);
  });
  it("keeps a session fence when storage refuses writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    recordGardenDeparture(42161, garden.id, account);
    expect(withoutDepartedMembers([garden], 42161)[0].gardeners).toEqual([other]);
  });
  it("accepts a steward regrant even if the indexer never returned the intervening absence", async () => {
    recordGardenDeparture(42161, garden.id, account, 40n);
    const read = vi.fn().mockResolvedValue(true);
    expect((await reconcileGardenDepartures([garden], 42161, read))[0].gardeners).toContain(
      account
    );
    expect(read).toHaveBeenCalledWith(garden.id, account, 40n);
  });
  it("retains the fence when a regrant read is unavailable", async () => {
    recordGardenDeparture(42161, garden.id, account, 40n);
    expect(
      (
        await reconcileGardenDepartures([garden], 42161, async () => {
          throw new Error("offline");
        })
      )[0].gardeners
    ).toEqual([other]);
  });
});

it("does not erase a newer departure while an older regrant read is in flight", async () => {
  recordGardenDeparture(42161, garden.id, account, 40n);
  let resolve!: (value: boolean) => void;
  const read = new Promise<boolean>((done) => {
    resolve = done;
  });
  const pending = reconcileGardenDepartures([garden], 42161, () => read);
  recordGardenDeparture(42161, garden.id, account, 50n);
  resolve(true);
  await pending;
  expect(withoutDepartedMembers([garden], 42161)[0].gardeners).toEqual([other]);
});

it.each([
  40n,
  0n,
])("does not lower a block-50 fence for a delayed block-%s receipt", async (older) => {
  recordGardenDeparture(42161, garden.id, account, 50n);
  recordGardenDeparture(42161, garden.id, account, older);
  const read = vi.fn(async (_garden, _account, minimum) => minimum <= 45n);
  expect((await reconcileGardenDepartures([garden], 42161, read))[0].gardeners).toEqual([other]);
  expect(read).toHaveBeenCalledWith(garden.id, account, 50n);
});
