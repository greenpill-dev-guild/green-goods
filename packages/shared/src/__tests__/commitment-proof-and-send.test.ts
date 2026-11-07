/**
 * Which senders send Add and Send's proof and send as one request, and the
 * pair a Send Now on either half finds. The enablement list is stubbed: a
 * passkey answers from it inside its own sender, a wallet is checked here.
 */

import { describe, expect, it, vi } from "vitest";

import type { TransactionSender } from "../modules/transactions/types";
import type { Job } from "../types/job-queue";

const listing = vi.hoisted(() => ({ wallet: false }));

vi.mock("../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: (query: { action: string; rail: string; profile: string }) =>
    query.action === "proof-and-send" &&
    query.rail === "wallet" &&
    query.profile === "eip-5792" &&
    listing.wallet,
}));

import { proofAndSendBudget, proofAndSendPair } from "../modules/commitment-pooling/proof-and-send";

function sender(authMode: TransactionSender["authMode"], able: boolean, atomic = true) {
  return {
    authMode,
    supportsBatching: false,
    supportsSponsorship: authMode === "passkey",
    sendContractCall: vi.fn(),
    ...(atomic ? { sendAtomicBatch: vi.fn(), canSendAtomicBatch: vi.fn(async () => able) } : {}),
  } as unknown as TransactionSender;
}

describe("Add and Send in one request", () => {
  it.each([
    ["a passkey listed for it", sender("passkey", true), false, 42161, "required"],
    ["a passkey not listed for it", sender("passkey", false), false, 42161, null],
    ["an atomic wallet listed for it", sender("wallet", true), true, 42161, "wallet"],
    ["an atomic wallet not listed for it", sender("wallet", true), false, 42161, null],
    ["a plain wallet", sender("wallet", false, false), true, 42161, null],
    ["an embedded account", sender("embedded", true), true, 42161, null],
    ["a passkey on a chain with no measured ceilings", sender("passkey", true), true, 42220, null],
  ] as const)("is sent together from %s", async (_case, from, walletListed, chainId, payer) => {
    listing.wallet = walletListed;

    const budget = await proofAndSendBudget(from, chainId);

    expect(budget?.sponsorship ?? null).toBe(payer);
    if (from.authMode === "wallet" && !walletListed)
      expect(from.canSendAtomicBatch).not.toHaveBeenCalled();
    if (budget) expect(from.canSendAtomicBatch).toHaveBeenCalledWith(chainId, "proof-and-send");
  });

  it("finds the pair from either half while both wait, and none once the proof has landed", () => {
    const proof = { id: "proof", kind: "evidence", synced: false, payload: {} } as Job;
    const send = {
      id: "send",
      kind: "confirmation",
      synced: false,
      payload: { action: "submit", afterEvidenceJobId: "proof" },
    } as Job;
    const claim = { id: "claim", kind: "claim", synced: false, payload: {} } as Job;

    expect(proofAndSendPair([send, claim, proof], "proof")).toEqual({ proof, send });
    expect(proofAndSendPair([send, claim, proof], "send")).toEqual({ proof, send });
    expect(proofAndSendPair([send, claim, proof], "claim")).toBeNull();
    expect(proofAndSendPair([send, { ...proof, synced: true }], "send")).toBeNull();
  });
});
