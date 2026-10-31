import "fake-indexeddb/auto";
import { toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  type GardenSettingsChain,
  type GardenSettingsChange,
  gardenSettingsBudget,
  moveOnFromGardenSettingsHold,
  prepareGardenSettingsBatch,
  readGardenSettingsHold,
  sendGardenSettingsBatch,
  verifyGardenSettings,
} from "../../modules/garden/settings-batch";
import {
  type BatchExecution,
  BatchNotSubmittedError,
} from "../../modules/transactions/batch-types";
import { type Address, Domain } from "../../types/domain";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;

/** Every test gets its own account and garden: the journal outlives each one. */
function address(): Address {
  return toHex(crypto.getRandomValues(new Uint8Array(20)));
}

const NAME_AND_JOINING: GardenSettingsChange[] = [
  { field: "name", value: "Tech and Sun" },
  { field: "openJoining", value: true },
];

/** A chain answering with these getter values; `update` is what a later block holds. */
function chainHolding(values: Record<string, unknown>) {
  const held = { ...values };
  const chain = {
    read: vi.fn(
      async (call: Parameters<GardenSettingsChain["read"]>[0]) => held[call.functionName]
    ),
    simulate: vi.fn(async () => undefined),
  } satisfies GardenSettingsChain;
  return { chain, update: (next: Record<string, unknown>) => Object.assign(held, next) };
}

function setup(execution: Partial<BatchExecution> = {}, values: Record<string, unknown> = {}) {
  const account = address();
  const gardenAddress = address();
  const sender = createFakeBatchingSender(account, execution);
  const batches = sender.batches!;
  const { chain, update } = chainHolding({ name: "Old name", openJoining: false, ...values });
  const input = { batches, chain, gardenAddress, scope: { account, chainId }, retryMs: 0 };
  return { ...input, input, sender, update };
}

const send = (input: ReturnType<typeof setup>["input"], changes = NAME_AND_JOINING) =>
  sendGardenSettingsBatch({ ...input, rail: "passkey", changes });

describe("prepareGardenSettingsBatch", () => {
  const prepare = (changes: GardenSettingsChange[], rail: "passkey" | "wallet" = "passkey") =>
    prepareGardenSettingsBatch({
      id: "attempt-1",
      account: address(),
      chainId,
      gardenAddress: "0x1234567890123456789012345678901234567890",
      rail,
      changes,
    });

  it("sends each change as its own call, in the order it was given", () => {
    const prepared = prepare([
      { field: "name", value: "Tech and Sun" },
      { field: "maxGardeners", value: 25 },
      { field: "domains", value: [Domain.SOLAR, Domain.EDU] },
      { field: "banner", value: "" },
    ]);

    expect(prepared.mode).toBe("atomic");
    expect(prepared.domain).toBe("garden-settings:0x1234567890123456789012345678901234567890");
    expect(prepared.items.map(({ id, call }) => [id, call.functionName, call.args])).toEqual([
      ["name", "updateName", ["Tech and Sun"]],
      ["maxGardeners", "setMaxGardeners", [25n]],
      ["domains", "setGardenDomains", ["0x1234567890123456789012345678901234567890", 5]],
      ["banner", "updateBannerImage", [""]],
    ]);
    expect(prepared.items[2].call.address).toBe(getNetworkContracts(chainId).actionRegistry);
  });

  it("keeps only each call's own function, since the journal stores every call", () => {
    const { items } = prepare(NAME_AND_JOINING);
    expect(items.map(({ call }) => call.abi.length)).toEqual([1, 1]);
  });

  it("holds a save to its rail's ceilings and refuses one that does not fit", () => {
    expect(prepare(NAME_AND_JOINING).budget?.sponsorship).toBe("required");
    expect(prepare(NAME_AND_JOINING, "wallet").budget?.sponsorship).toBe("wallet");
    expect(() =>
      prepare([
        { field: "description", value: "x".repeat(9_000) },
        { field: "openJoining", value: true },
      ])
    ).toThrow("batch-budget-exceeded");
  });

  it("has no ceilings on a chain nobody has measured", () => {
    expect(gardenSettingsBudget("passkey", chainId)).not.toBeNull();
    expect(gardenSettingsBudget("passkey", 42220)).toBeNull();
  });
});

describe("verifyGardenSettings", () => {
  const prepared = (account: Address, gardenAddress: Address, changes: GardenSettingsChange[]) =>
    prepareGardenSettingsBatch({
      id: "attempt-1",
      account,
      chainId,
      gardenAddress,
      rail: "passkey",
      changes,
    });
  const verification = (account: Address, itemIds: string[]) => ({
    account,
    chainId,
    itemIds,
    receipts: [],
  });

  it("confirms a field only when the chain holds what the batch wrote", async () => {
    const account = address();
    const gardenAddress = address();
    const changes: GardenSettingsChange[] = [
      { field: "maxGardeners", value: 25 },
      { field: "domains", value: [Domain.SOLAR, Domain.EDU] },
      { field: "name", value: "Tech and Sun" },
    ];
    const { chain } = chainHolding({ maxGardeners: 25n, gardenDomains: 5, name: "Someone else" });

    const verify = verifyGardenSettings(prepared(account, gardenAddress, changes), {
      gardenAddress,
      chain,
      retryMs: 0,
    });

    await expect(
      verify(verification(account, ["maxGardeners", "domains", "name"]))
    ).resolves.toEqual(["maxGardeners", "domains"]);
    expect(chain.read).toHaveBeenCalledWith({
      address: getNetworkContracts(chainId).actionRegistry,
      abi: ActionRegistryABI,
      functionName: "gardenDomains",
      args: [gardenAddress],
    });
  });

  it("reads again when the RPC answers from before the receipt's block", async () => {
    const account = address();
    const gardenAddress = address();
    const { chain, update } = chainHolding({ name: "Old name" });
    chain.read.mockImplementationOnce(async () => {
      update({ name: "Tech and Sun" });
      return "Old name";
    });

    const verify = verifyGardenSettings(
      prepared(account, gardenAddress, [{ field: "name", value: "Tech and Sun" }]),
      { gardenAddress, chain, retryMs: 0 }
    );

    await expect(verify(verification(account, ["name"]))).resolves.toEqual(["name"]);
  });
});

describe("sendGardenSettingsBatch", () => {
  it("checks each call as the sender before anyone signs", async () => {
    const { input, chain, sender, scope } = setup({
      status: "confirmed",
      receipts: [{ transactionHash: hash, status: "success" }],
    });
    chain.read.mockImplementation(async ({ functionName }) =>
      functionName === "name" ? "Tech and Sun" : true
    );

    await expect(send(input)).resolves.toEqual({ status: "saved", transactionHash: hash });

    expect(chain.simulate).toHaveBeenCalledTimes(2);
    expect(chain.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "updateName", account: scope.account })
    );
    expect(sender.submitAtomicBatch).toHaveBeenCalledTimes(1);
  });

  it("stops before signing when the sender has lost the role, and holds nothing", async () => {
    const { input, chain, sender } = setup();
    chain.simulate.mockRejectedValueOnce(new Error("NotGardenOwner"));

    await expect(send(input)).rejects.toThrow("NotGardenOwner");

    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    await expect(readGardenSettingsHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("reports a revert as not saved and holds nothing", async () => {
    const { input } = setup({ status: "reverted" });

    await expect(send(input)).resolves.toEqual({ status: "not-saved" });
    await expect(readGardenSettingsHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("says a save that cannot go as one batch can go another way, with nothing sent", async () => {
    const { input, sender } = setup();
    const tooLarge: GardenSettingsChange[] = [
      { field: "description", value: "x".repeat(9_000) },
      { field: "openJoining", value: true },
    ];

    await expect(send(input, tooLarge)).resolves.toEqual({ status: "not-batchable" });

    sender.preflightBatch = async () => {
      throw new Error("batch-budget-exceeded");
    };
    await expect(send(input)).resolves.toEqual({ status: "not-batchable" });
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
  });

  it("goes one field at a time when the last check before signing refuses the batch", async () => {
    const { input, sender } = setup();
    sender.submitAtomicBatch = vi.fn(async () => {
      throw new BatchNotSubmittedError(new Error("batch-budget-exceeded"));
    });

    await expect(send(input)).resolves.toEqual({ status: "not-batchable" });
    await expect(readGardenSettingsHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("gives the reason when a send fails for another reason before going out", async () => {
    const { input, sender } = setup();
    sender.submitAtomicBatch = vi.fn(async () => {
      throw new BatchNotSubmittedError(new Error("batch-sponsorship-required"));
    });

    await expect(send(input)).rejects.toThrow("batch-sponsorship-required");
    await expect(readGardenSettingsHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("reports a declined signature as not saved, with nothing to explain", async () => {
    const { input, sender } = setup();
    sender.submitAtomicBatch = vi.fn(async () => {
      throw new BatchNotSubmittedError(new Error("User rejected the request"));
    });

    await expect(send(input)).resolves.toEqual({ status: "not-saved" });
  });
});

describe("holding a save whose outcome is unknown", () => {
  it("holds its fields and shows what the chain holds now", async () => {
    const { input } = setup();

    await expect(send(input)).resolves.toEqual({ status: "unknown" });

    await expect(readGardenSettingsHold(input)).resolves.toEqual({
      hold: {
        operationIds: [expect.any(String)],
        fields: ["name", "openJoining"],
        attempted: NAME_AND_JOINING,
        onChain: [
          { field: "name", value: "Old name" },
          { field: "openJoining", value: false },
        ],
      },
      saved: [],
    });
  });

  it("keeps the hold when a value cannot be read, and leaves that value out", async () => {
    const { input, chain } = setup();
    await send(input);
    chain.read.mockImplementation(async ({ functionName }) => {
      if (functionName === "name") throw new Error("rpc down");
      return false;
    });

    const { hold } = await readGardenSettingsHold(input);

    expect(hold?.fields).toEqual(["name", "openJoining"]);
    expect(hold?.onChain).toEqual([{ field: "openJoining", value: false }]);
  });

  it("is a hold only for its own garden", async () => {
    const { input } = setup();
    await send(input);

    await expect(readGardenSettingsHold({ ...input, gardenAddress: address() })).resolves.toEqual({
      hold: null,
      saved: [],
    });
  });

  it("ends when a read proves the save landed, and reports what it saved", async () => {
    const { input, sender, update } = setup();
    await send(input);

    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    update({ name: "Tech and Sun", openJoining: true });

    await expect(readGardenSettingsHold(input)).resolves.toEqual({
      hold: null,
      saved: NAME_AND_JOINING,
    });
  });

  it("frees its fields when the person moves on, and keeps them free", async () => {
    const { input } = setup();
    await send(input);
    const { hold } = await readGardenSettingsHold(input);

    await expect(moveOnFromGardenSettingsHold(input, hold!)).resolves.toEqual({
      hold: null,
      saved: [],
    });
    await expect(readGardenSettingsHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("reports a save as saved when moving on finds that it landed", async () => {
    const { input, sender, update } = setup();
    await send(input);
    const { hold } = await readGardenSettingsHold(input);
    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    update({ name: "Tech and Sun", openJoining: true });

    await expect(moveOnFromGardenSettingsHold(input, hold!)).resolves.toEqual({
      hold: null,
      saved: NAME_AND_JOINING,
    });
  });

  it("moving on ends only the saves the person was shown", async () => {
    const { input } = setup({}, { location: "Lisbon" });
    await send(input);
    const { hold: shown } = await readGardenSettingsHold(input);
    await send(input, [
      { field: "description", value: "Restoring the river bank." },
      { field: "location", value: "Porto" },
    ]);

    const { hold } = await moveOnFromGardenSettingsHold(input, shown!);

    expect(hold?.fields).toEqual(["description", "location"]);
  });

  it("will not move on from a value the person could not see", async () => {
    const { input, chain, batches } = setup();
    await send(input);
    chain.read.mockRejectedValueOnce(new Error("rpc down"));
    const { hold: unread } = await readGardenSettingsHold(input);
    expect(unread?.onChain).toHaveLength(1);
    const release = vi.spyOn(batches, "release");

    const { hold } = await moveOnFromGardenSettingsHold(input, unread!);

    expect(release).not.toHaveBeenCalled();
    expect(hold?.fields).toEqual(["name", "openJoining"]);
    expect(hold?.onChain).toHaveLength(2);
  });

  it("keeps a partly proven save whole until it ends, then reports what it proved once", async () => {
    const { input, sender, update } = setup();
    await send(input);
    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    // Someone else changed open joining right after, so only the name can be proven.
    update({ name: "Tech and Sun" });

    const partial = await readGardenSettingsHold(input);
    expect(partial.saved).toEqual([]);
    expect(partial.hold?.fields).toEqual(["name", "openJoining"]);
    expect(partial.hold?.attempted).toEqual(NAME_AND_JOINING);

    const ended = await moveOnFromGardenSettingsHold(input, partial.hold!);
    expect(ended).toEqual({ hold: null, saved: [{ field: "name", value: "Tech and Sun" }] });

    await expect(readGardenSettingsHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("stays in place when a record cannot be claimed, so nothing is sent over it", async () => {
    const { input, batches } = setup();
    await send(input);
    vi.spyOn(batches, "reconcile").mockRejectedValueOnce(new Error("batch-items-held"));

    const { hold } = await readGardenSettingsHold(input);

    expect(hold?.fields).toEqual(["name", "openJoining"]);
  });
});
