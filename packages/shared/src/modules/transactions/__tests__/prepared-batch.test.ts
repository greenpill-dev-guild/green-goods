import { describe, expect, it } from "vitest";
import {
  createMockContractCall,
  createMockBatchBudget,
} from "../../../__tests__/test-utils/transaction-fakes";
import { actionEditBudget } from "../../action/action-edit-batch";
import { creationBudget } from "../../commitment-pooling/creation-send";
import { poolSetupBudget } from "../../commitment-pooling/pool-setup";
import { proofAndSendBudget } from "../../commitment-pooling/proof-and-send";
import { rewardEditBudget } from "../../commitment-pooling/reward-edit";
import { campaignJarSyncBudget } from "../../garden/campaign-jar-sync-route";
import { depositBudget } from "../../garden/deposit-route";
import { karmaReconcileBudget } from "../../garden/karma-batch";
import { gardenMembersBudget } from "../../garden/members-batch";
import { gardenSettingsBudget } from "../../garden/settings-batch";
import { marketplaceApprovalBudget } from "../../marketplace/approvals";
import { reviewBudget } from "../../work/review-chain";
import { type BatchEnablement, ENABLED_BATCHES, isBatchEnabled } from "../batch-enablement";
import type { Address } from "../../../types/domain";
import { prepareBatch, assertPreparedBatch } from "../prepared-batch";
import type { TransactionSender } from "../types";

const account = "0x1111111111111111111111111111111111111111" as const;
const input = () => ({
  id: "reviewed",
  account,
  chainId: 42161,
  domain: "settings",
  mode: "atomic" as const,
  items: [{ id: "garden:name", call: createMockContractCall({ account }) }],
});
describe("prepared batch intent", () => {
  it("snapshots the reviewed arguments and detects later calldata corruption", () => {
    const args = [account, 1000n];
    const request = input();
    request.items[0].call.args = args;
    const prepared = prepareBatch(request);
    args[1] = 9999n;
    expect(prepared.items[0].call.args[1]).toBe(1000n);
    expect(() => assertPreparedBatch(prepared)).not.toThrow();
    prepared.items[0].call.data = "0x1234";
    expect(() => assertPreparedBatch(prepared)).toThrow("batch-intent-changed");
  });
  it.each(["account", "chain"])("rejects a mixed %s before submission", (kind) => {
    const request = input();
    if (kind === "account")
      request.items[0].call.account = "0x2222222222222222222222222222222222222222";
    else request.items[0].call.chainId = 42220;
    expect(() => prepareBatch(request)).toThrow("batch-scope-mismatch");
  });
  it("enforces the reviewed call and calldata budget without silently splitting", () => {
    const request = input();
    request.items.push({ id: "garden:description", call: createMockContractCall({ account }) });
    expect(() =>
      prepareBatch({
        ...request,
        budget: createMockBatchBudget({ maxCalls: 2, maxCalldataBytes: 136 }),
      })
    ).not.toThrow();
    expect(() =>
      prepareBatch({
        ...request,
        budget: createMockBatchBudget({ maxCalls: 2, maxCalldataBytes: 135 }),
      })
    ).toThrow("batch-budget-exceeded");
    expect(() =>
      prepareBatch({
        ...request,
        budget: createMockBatchBudget({ maxCalls: 1, maxCalldataBytes: 136 }),
      })
    ).toThrow("batch-budget-exceeded");
  });
  it("rejects empty and duplicate selections and fingerprints the transport choice", () => {
    const request = input();
    expect(() => prepareBatch({ ...request, items: [] })).toThrow("batch-invalid-intent");
    expect(() => prepareBatch({ ...request, items: [...request.items, ...request.items] })).toThrow(
      "batch-duplicate-item"
    );
    expect(prepareBatch(request).fingerprint).not.toBe(
      prepareBatch({ ...request, mode: "sequential" }).fingerprint
    );
  });
});

it("freezes reviewed fee ceilings into the intent fingerprint", () => {
  const limits = createMockBatchBudget();
  const input: Parameters<typeof prepareBatch>[0] = {
    id: "budgeted",
    domain: "settings",
    account: "0x1111111111111111111111111111111111111111",
    chainId: 42161,
    mode: "atomic" as const,
    budget: limits,
    items: [{ id: "item", call: createMockContractCall() }],
  };
  const prepared = prepareBatch(input);
  expect(prepared.budget).toEqual(limits);
  limits.maxGas = "1";
  expect(prepared.budget?.maxGas).toBe("5000000");
  expect(prepareBatch(input).fingerprint).not.toBe(prepared.fingerprint);
  prepared.budget!.maxFee = "1";
  expect(() => assertPreparedBatch(prepared)).toThrow("batch-intent-changed");
});

it("applies a budget to each sequential group, not to the whole selection", () => {
  const request = input();
  request.items.push({ id: "garden:description", call: createMockContractCall({ account }) });
  const oneCall = createMockBatchBudget({ maxCalls: 1, maxCalldataBytes: 68 });
  expect(() => prepareBatch({ ...request, mode: "sequential", budget: oneCall })).not.toThrow();
  expect(() => prepareBatch({ ...request, mode: "atomic", budget: oneCall })).toThrow(
    "batch-budget-exceeded"
  );
  expect(() =>
    prepareBatch({
      ...request,
      mode: "sequential",
      budget: createMockBatchBudget({ maxCalls: 1, maxCalldataBytes: 67 }),
    })
  ).toThrow("batch-budget-exceeded");
});

describe("isBatchEnabled", () => {
  const listed: BatchEnablement = {
    action: "garden-settings",
    rail: "passkey",
    profile: "kernel-0.3.1-legacy",
    chainId: 42161,
  };

  it("lists only combinations that carry ceilings on their chain", async () => {
    // A passkey that can batch, so the proof-and-send ceilings answer from their own table.
    const passkey = {
      authMode: "passkey",
      sendAtomicBatch: async () => ({}),
      canSendAtomicBatch: async () => true,
    } as unknown as TransactionSender;
    const ceilings = async (entry: BatchEnablement) => {
      switch (entry.action) {
        case "garden-settings":
          return gardenSettingsBudget(entry.rail, entry.chainId);
        case "add-members":
          return gardenMembersBudget(entry.rail, entry.chainId);
        case "bulk-reviews":
          return reviewBudget(entry.rail, entry.chainId);
        case "pool-setup":
          return entry.rail === "passkey" ? poolSetupBudget(entry.chainId) : null;
        case "commitment-creations":
          return entry.rail === "passkey" ? creationBudget(entry.chainId) : null;
        case "reward-edits":
          return entry.rail === "passkey" ? rewardEditBudget(entry.chainId) : null;
        case "proof-and-send":
          return entry.rail === "passkey" ? proofAndSendBudget(passkey, entry.chainId) : null;
        case "marketplace-approvals":
          return marketplaceApprovalBudget(entry.rail, entry.chainId);
        case "karma-reconcile":
          return karmaReconcileBudget(entry.rail, entry.chainId);
        case "campaign-jar-sync":
          return campaignJarSyncBudget(entry.rail, entry.chainId);
        case "action-edit":
          return actionEditBudget(entry.rail, entry.chainId);
        case "vault-deposit":
        case "jar-deposit":
          return depositBudget(entry.rail, entry.chainId);
        default:
          // An action this test doesn't know yet has no ceilings to show, so it fails here.
          return null;
      }
    };

    for (const entry of ENABLED_BATCHES) {
      const name = `${entry.action} on ${entry.rail} ${entry.profile}`;
      expect(await ceilings(entry), name).not.toBeNull();
      expect(entry.profile.startsWith("kernel-"), name).toBe(entry.rail === "passkey");
    }
  });

  it("needs the rail, the account profile, and the chain that were proven", () => {
    const list = [listed];
    expect(isBatchEnabled(listed, list)).toBe(true);
    expect(isBatchEnabled({ ...listed, rail: "wallet", profile: "eip-5792" }, list)).toBe(false);
    expect(isBatchEnabled({ ...listed, profile: "kernel-0.3.3-pilot" }, list)).toBe(false);
    expect(isBatchEnabled({ ...listed, chainId: 42220 }, list)).toBe(false);
  });

  it("allows Add and Send for beta's Kernel 0.3.3 passkey on Arbitrum only", () => {
    const proofAndSend = {
      action: "proof-and-send",
      rail: "passkey",
      profile: "kernel-0.3.3",
      chainId: 42161,
    } as const;
    expect(isBatchEnabled(proofAndSend)).toBe(true);
    expect(isBatchEnabled({ ...proofAndSend, profile: "kernel-0.3.1-legacy" })).toBe(false);
    expect(isBatchEnabled({ ...proofAndSend, rail: "wallet", profile: "eip-5792" })).toBe(false);
    expect(isBatchEnabled({ ...proofAndSend, chainId: 42220 })).toBe(false);
    expect(isBatchEnabled({ ...proofAndSend, profile: "kernel-0.3.3-pilot" })).toBe(false);
    expect(isBatchEnabled({ ...proofAndSend, action: "bulk-reviews" })).toBe(false);
  });

  it("lists a deposit for one asset only, and a listing that names none allows none", () => {
    const dai = "0xdA10009cBd5D07dd0CeCc66161FC93D7c9000da1";
    const deposit: BatchEnablement = { ...listed, action: "vault-deposit", asset: dai };

    expect(isBatchEnabled({ ...deposit, asset: dai.toLowerCase() as Address }, [deposit])).toBe(
      true
    );
    expect(isBatchEnabled({ ...deposit, asset: account }, [deposit])).toBe(false);

    const namesNone = { ...deposit, asset: undefined } as unknown as BatchEnablement;
    expect(isBatchEnabled(deposit, [namesNone])).toBe(false);
  });
});
