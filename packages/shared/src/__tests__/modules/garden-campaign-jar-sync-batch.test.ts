import "fake-indexeddb/auto";
import { getAddress, toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  type CampaignJarSync,
  type CampaignJarSyncChain,
  moveOnFromCampaignJarSyncHold,
  prepareCampaignJarSyncBatch,
  readCampaignJarSyncHold,
  sendCampaignJarSyncBatch,
  verifyCampaignJarSync,
} from "../../modules/garden/campaign-jar-sync-batch";
import {
  campaignJarSyncBudget,
  campaignJarSyncRoute,
} from "../../modules/garden/campaign-jar-sync-route";
import type { BatchEnablement } from "../../modules/transactions/batch-enablement";
import {
  type BatchExecution,
  BatchNotSubmittedError,
} from "../../modules/transactions/batch-types";
import type { Address } from "../../types/domain";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

const { listed } = vi.hoisted(() => ({ listed: [] as BatchEnablement[] }));

// The real matching, over a list each test sets: nothing lists this action yet.
vi.mock("../../modules/transactions/batch-enablement", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../modules/transactions/batch-enablement")>();
  return {
    ...actual,
    isBatchEnabled: (query: BatchEnablement) => actual.isBatchEnabled(query, listed),
  };
});

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};

/** Every test gets its own addresses: the journal outlives each one. */
function address(): Address {
  return toHex(crypto.getRandomValues(new Uint8Array(20)));
}

/** A jar that grants `joining`, revokes `leaving`, and writes new metadata. */
function setup(execution: Partial<BatchExecution> = {}) {
  const account = address();
  const jarAddress = address();
  const [kept, leaving, joining] = [address(), address(), address()];
  const held = { allowlist: [kept, leaving], metadata: "old" };
  const chain = {
    allowlist: vi.fn(async () => held.allowlist),
    metadata: vi.fn(async () => held.metadata),
    simulate: vi.fn(async () => undefined),
  } satisfies CampaignJarSyncChain;
  const sender = createFakeBatchingSender(account, execution);
  const input = {
    batches: sender.batches!,
    chain,
    jarAddress,
    scope: { account, chainId },
    retryMs: 0,
  };
  const sync: CampaignJarSync = {
    jarAddress,
    grant: [joining],
    revoke: [leaving],
    metadata: { factoryAddress: address(), value: "new" },
  };
  /** What the chain holds once the sync lands. */
  const land = () => Object.assign(held, { allowlist: [kept, joining], metadata: "new" });
  return { input, sender, chain, sync, land, held, account, joining, leaving };
}

const send = (input: ReturnType<typeof setup>["input"], sync: CampaignJarSync) =>
  sendCampaignJarSyncBatch({ ...input, rail: "passkey", sync });

describe("prepareCampaignJarSyncBatch", () => {
  const prepare = (sync: CampaignJarSync) =>
    prepareCampaignJarSyncBatch({
      id: "attempt-1",
      account: address(),
      chainId,
      rail: "passkey",
      sync,
    });

  it("puts grant, revoke, and metadata in one all-or-nothing group, in that order", () => {
    const { sync, joining, leaving } = setup();
    const prepared = prepare(sync);

    expect(prepared.mode).toBe("atomic");
    expect(prepared.domain).toBe(`campaign-jar-sync:${sync.jarAddress.toLowerCase()}`);
    expect(
      prepared.items.map(({ id, call }) => [id, call.address, call.functionName, call.args])
    ).toEqual([
      ["grant", sync.jarAddress, "grantJarAllowlistRole", [[joining]]],
      ["revoke", sync.jarAddress, "revokeJarAllowlistRole", [[leaving]]],
      ["metadata", sync.metadata!.factoryAddress, "updateMetadata", [sync.jarAddress, "new"]],
    ]);
    // The journal stores every call, so each carries only its own function.
    expect(prepared.items.map(({ call }) => call.abi.length)).toEqual([1, 1, 1]);
  });

  it("sends only the steps a sync has", () => {
    const { sync } = setup();
    expect(prepare({ ...sync, revoke: [], metadata: null }).items.map(({ id }) => id)).toEqual([
      "grant",
    ]);
    expect(prepare({ ...sync, grant: [], revoke: [] }).items.map(({ id }) => id)).toEqual([
      "metadata",
    ]);
  });

  it("refuses a sync past its ceilings, and has none on a chain nobody measured", () => {
    const { sync } = setup();
    const grant = Array.from({ length: 600 }, address);
    expect(() => prepare({ ...sync, grant })).toThrow("batch-budget-exceeded");
    expect(campaignJarSyncBudget("passkey", 42220)).toBeNull();
  });
});

describe("campaignJarSyncRoute", () => {
  const route = (input: Partial<Parameters<typeof campaignJarSyncRoute>[0]>) =>
    campaignJarSyncRoute({
      rail: "passkey",
      passkeyProfile: "kernel-0.3.1-legacy",
      walletAtomic: false,
      chainId,
      ...input,
    });

  it("goes as one request only on a listed rail, and a wallet only when it batches", () => {
    listed.length = 0;
    expect(route({})).toBeNull();
    expect(route({ rail: "wallet", walletAtomic: true })).toBeNull();

    listed.push(
      { action: "campaign-jar-sync", rail: "passkey", profile: "kernel-0.3.1-legacy", chainId },
      { action: "campaign-jar-sync", rail: "wallet", profile: "eip-5792", chainId }
    );
    expect(route({})).toBe("passkey");
    expect(route({ passkeyProfile: "kernel-0.3.3-pilot" })).toBeNull();
    expect(route({ rail: "wallet", walletAtomic: true })).toBe("wallet");
    // A plain wallet keeps one signature per step.
    expect(route({ rail: "wallet", walletAtomic: false })).toBeNull();
    expect(route({ rail: null })).toBeNull();
    expect(route({ chainId: 42220 })).toBeNull();
    listed.length = 0;
  });
});

describe("verifyCampaignJarSync", () => {
  const verification = (account: Address, itemIds: string[]) => ({
    account,
    chainId,
    itemIds,
    receipts: [],
  });

  it("confirms each step only when the chain holds what it wrote", async () => {
    const { input, sync, held, account, joining, leaving } = setup();
    const prepared = prepareCampaignJarSyncBatch({
      id: "a",
      account,
      chainId,
      rail: "passkey",
      sync,
    });
    // The grant and the metadata landed, but someone gave the revoked address its access back.
    Object.assign(held, { allowlist: [getAddress(joining), leaving], metadata: "new" });

    await expect(
      verifyCampaignJarSync(prepared, input)(verification(account, ["grant", "revoke", "metadata"]))
    ).resolves.toEqual(["grant", "metadata"]);
  });

  it("reads again when a node answers from before the receipt's block, or not at all", async () => {
    const { input, chain, sync, land, account } = setup();
    const prepared = prepareCampaignJarSyncBatch({
      id: "a",
      account,
      chainId,
      rail: "passkey",
      sync,
    });
    chain.allowlist.mockRejectedValueOnce(new Error("rpc down"));
    chain.allowlist.mockImplementationOnce(async () => {
      land();
      return [];
    });

    await expect(
      verifyCampaignJarSync(prepared, input)(verification(account, ["grant"]))
    ).resolves.toEqual(["grant"]);
  });
});

describe("sendCampaignJarSyncBatch", () => {
  it("sends the whole sync as one request, checked first as the jar owner", async () => {
    const { input, sender, chain, sync, land, account } = setup(CONFIRMED);
    const submit = sender.submitAtomicBatch!;
    sender.submitAtomicBatch = vi.fn(async (calls, options) => {
      land();
      return submit(calls, options);
    });

    await expect(send(input, sync)).resolves.toEqual({ status: "synced", transactionHash: hash });

    expect(sender.submitAtomicBatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sender.submitAtomicBatch).mock.calls[0][0]).toHaveLength(3);
    expect(chain.simulate).toHaveBeenCalledTimes(3);
    expect(chain.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "revokeJarAllowlistRole", account })
    );
  });

  it("never calls a sync done when the chain does not hold it, whatever the receipt says", async () => {
    const { input, sync } = setup(CONFIRMED);

    await expect(send(input, sync)).resolves.toEqual({ status: "unknown" });
    expect((await readCampaignJarSyncHold(input)).hold?.grant).toEqual(sync.grant);
  });

  it.each([
    ["reverted", (sender: ReturnType<typeof setup>["sender"]) => sender],
    [
      "declined",
      (sender: ReturnType<typeof setup>["sender"]) =>
        vi
          .mocked(sender.submitAtomicBatch!)
          .mockRejectedValueOnce(
            new BatchNotSubmittedError(new Error("User rejected the request"))
          ),
    ],
  ])("reports a %s group, which changed nothing, and holds nothing", async (status, arrange) => {
    const { input, sender, sync } = setup({ status: "reverted" });
    arrange(sender);

    await expect(send(input, sync)).resolves.toEqual({ status });
    await expect(readCampaignJarSyncHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("stops before signing when the account no longer owns the jar", async () => {
    const { input, sender, chain, sync } = setup();
    chain.simulate.mockRejectedValueOnce(new Error("NotAuthorized"));

    await expect(send(input, sync)).rejects.toThrow("NotAuthorized");
    expect(sender.submitAtomicBatch).not.toHaveBeenCalled();
    await expect(readCampaignJarSyncHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("says a sync past its ceilings can go step by step, with nothing sent", async () => {
    const { input, sender, sync } = setup();
    const tooLarge = { ...sync, grant: Array.from({ length: 600 }, address) };
    await expect(send(input, tooLarge)).resolves.toEqual({ status: "not-batchable" });

    sender.submitAtomicBatch = vi.fn(async () => {
      throw new BatchNotSubmittedError(new Error("batch-budget-exceeded"));
    });
    await expect(send(input, sync)).resolves.toEqual({ status: "not-batchable" });
    await expect(readCampaignJarSyncHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("holds the jar's next sync while one is in doubt, whatever steps each has", async () => {
    const { input, sender, sync } = setup();
    await expect(send(input, { ...sync, grant: [], revoke: [] })).resolves.toEqual({
      status: "unknown",
    });

    // A late landing of the first could give access back that this one leaves off.
    await expect(send(input, { ...sync, metadata: null })).rejects.toThrow("batch-items-held");
    expect(sender.submitAtomicBatch).toHaveBeenCalledTimes(1);
    // Another jar is its own.
    const otherJar = address();
    await expect(send(input, { ...sync, jarAddress: otherJar })).resolves.toEqual({
      status: "unknown",
    });
  });
});

describe("holding a sync whose outcome is unknown", () => {
  it("shows what the chain holds now for each step", async () => {
    const { input, sync, land } = setup();
    await send(input, sync);

    const { hold } = await readCampaignJarSyncHold(input);
    expect(hold).toEqual({
      operationIds: [expect.any(String)],
      grant: sync.grant,
      revoke: sync.revoke,
      writesMetadata: true,
      onChain: { granted: 0, revoked: 0, metadataWritten: false },
    });

    // Without a receipt nothing proves it ran, so it stays held, showing what landed.
    land();
    expect((await readCampaignJarSyncHold(input, hold)).hold?.onChain).toEqual({
      granted: 1,
      revoked: 1,
      metadataWritten: true,
    });
  });

  it("ends when a read proves the sync landed, and reports it once", async () => {
    const { input, sender, sync, land } = setup();
    await send(input, sync);
    sender.reconcileBatch = vi.fn(async () => ({
      status: "confirmed" as const,
      receipts: [{ transactionHash: hash, status: "success" as const }],
      sponsored: true,
    }));
    land();

    await expect(readCampaignJarSyncHold(input)).resolves.toEqual({
      hold: null,
      saved: [{ steps: ["grant", "revoke", "metadata"], whole: true }],
    });
    await expect(readCampaignJarSyncHold(input)).resolves.toEqual({ hold: null, saved: [] });
  });

  it("moves on only from what the person could see, then frees the jar", async () => {
    const { input, chain, sync } = setup();
    await send(input, sync);
    chain.allowlist.mockRejectedValueOnce(new Error("rpc down"));
    const { hold: unread } = await readCampaignJarSyncHold(input);
    expect(unread?.onChain).toBeNull();
    const release = vi.spyOn(input.batches, "release");

    const { hold: seen } = await moveOnFromCampaignJarSyncHold(input, unread!);
    expect(release).not.toHaveBeenCalled();
    expect(seen?.onChain).not.toBeNull();

    await expect(moveOnFromCampaignJarSyncHold(input, seen!)).resolves.toEqual({
      hold: null,
      saved: [],
    });
    await expect(send(input, sync)).resolves.toEqual({ status: "unknown" });
  });
});
