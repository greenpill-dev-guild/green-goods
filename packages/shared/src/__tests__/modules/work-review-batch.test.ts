import "fake-indexeddb/auto";
import { type Hex, toHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  BatchNotSubmittedError,
  type BatchExecution,
} from "../../modules/transactions/batch-types";
import {
  prepareReviewBatch,
  type ReviewDecision,
  sendReviewBatch,
} from "../../modules/work/review-batch";
import { moveOnFromReviewHold, readReviewHold } from "../../modules/work/review-hold";
import {
  type ReviewAttestation,
  type ReviewChain,
  reviewBudget,
  signaturesForReviews,
} from "../../modules/work/review-chain";
import type { Address, WorkApprovalDraft } from "../../types/domain";
import { Confidence, VerificationMethod } from "../../types/domain";
import { encodeWorkApprovalData } from "../../utils/eas/encoders";
import { createFakeBatchingSender } from "../test-utils/transaction-fakes";

// The EAS SDK is stubbed in this project, so this writes what the schema does.
vi.mock("../../utils/eas/encoders", async (importOriginal) => {
  const { encodeAbiParameters, parseAbiParameters } = await import("viem");
  return {
    ...(await importOriginal<object>()),
    encodeWorkApprovalData: (draft: WorkApprovalDraft) =>
      encodeAbiParameters(parseAbiParameters("uint256,bytes32,bool,string,uint8,uint8,string"), [
        BigInt(draft.actionUID),
        draft.workUID as Hex,
        draft.approved,
        draft.feedback ?? "",
        draft.confidence,
        draft.verificationMethod,
        draft.reviewNotesCID ?? "",
      ]),
  };
});

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};

/** Every test gets its own account and garden: the journal outlives each one. */
const address = (): Address => toHex(crypto.getRandomValues(new Uint8Array(20)));
const uid = (): Hex => toHex(crypto.getRandomValues(new Uint8Array(32)));

function setup(execution: Partial<BatchExecution> = CONFIRMED) {
  const account = address();
  const gardenAddress = address();
  const sender = createFakeBatchingSender(account, execution);
  const decide = (approved = true, feedback = ""): ReviewDecision => ({
    gardenAddress,
    draft: {
      actionUID: 1,
      workUID: uid(),
      approved,
      feedback,
      confidence: approved ? Confidence.HIGH : Confidence.NONE,
      verificationMethod: approved ? VerificationMethod.HUMAN : 0,
      reviewNotesCID: approved ? "bafyreviewnotes" : "",
    },
  });
  const made: ReviewAttestation[] = [];
  const landed = (decision: ReviewDecision, overrides: Partial<ReviewAttestation> = {}) => {
    const attestation = {
      uid: uid(),
      attester: account,
      recipient: gardenAddress,
      data: encodeWorkApprovalData(decision.draft, chainId),
      ...overrides,
    };
    made.push(attestation);
    return attestation;
  };
  const chain = {
    refusal: vi.fn<ReviewChain["refusal"]>(async () => null),
    isDecided: vi.fn<ReviewChain["isDecided"]>(async () => false),
    attestationsIn: vi.fn<ReviewChain["attestationsIn"]>(async () => made),
  };
  const input = {
    batches: sender.batches!,
    chain,
    gardenAddress,
    scope: { account, chainId },
    retryMs: 0,
  };
  const send = (decisions: readonly ReviewDecision[]) =>
    sendReviewBatch({ ...input, rail: "passkey", decisions });
  return { account, gardenAddress, sender, decide, landed, made, chain, input, send };
}

describe("prepareReviewBatch", () => {
  it("carries approvals and rejections in one EAS call, each work its own item", () => {
    const { account, gardenAddress, decide } = setup();
    const decisions = [decide(true, "Lovely"), decide(false, "No photo")];

    const prepared = prepareReviewBatch({
      id: "attempt",
      account,
      chainId,
      gardenAddress,
      rail: "wallet",
      decisions,
    });

    expect(prepared.mode).toBe("single-call");
    expect(prepared.items.map((item) => item.id)).toEqual(
      decisions.map(({ draft }) => draft.workUID.toLowerCase())
    );
    const { functionName, args } = prepared.items[0].call;
    expect(functionName).toBe("multiAttest");
    const [[request]] = args as [[{ data: { data: Hex }[] }]];
    expect(request.data.map(({ data }) => data)).toEqual(
      decisions.map(({ draft }) => encodeWorkApprovalData(draft, chainId))
    );
  });

  it("has no ceilings on a chain nobody has measured", () => {
    expect(reviewBudget("passkey", 42161)).not.toBeNull();
    expect(reviewBudget("passkey", 42220)).toBeNull();
    const { account, gardenAddress, decide } = setup();
    expect(() =>
      prepareReviewBatch({
        id: "attempt",
        account,
        chainId: 42220,
        gardenAddress,
        rail: "passkey",
        decisions: [decide()],
      })
    ).toThrow("batch-budget-required");
  });
});

describe("sendReviewBatch", () => {
  it("takes one signature per five, and names each work's attestation whatever order they land", async () => {
    const { sender, decide, landed, send } = setup();
    const decisions = Array.from({ length: 7 }, () => decide());
    const attestations = decisions.map((decision) => landed(decision)).reverse();

    const outcome = await send(decisions);

    expect(signaturesForReviews(7)).toBe(2);
    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
    expect(outcome.sent.map((item) => item.attestationUID)).toEqual(
      [...attestations].reverse().map((attestation) => attestation.uid)
    );
    expect(outcome.sent.every((item) => item.transactionHash === hash)).toBe(true);
    expect(outcome.notSent).toEqual([]);
  });

  it.each([
    ["no attestation", () => undefined],
    ["one from another account", (a: Address) => ({ attester: a })],
    ["one for another garden", (a: Address) => ({ recipient: a })],
    ["one with other data", () => ({ data: "0x1234" as Hex })],
  ])("is not done with %s in the receipt, and holds the next send", async (_case, overrides) => {
    const { decide, landed, send } = setup();
    const decision = decide();
    const change = overrides(address());
    if (change) landed(decision, change);

    const outcome = await send([decision]);

    expect(outcome.sent).toEqual([]);
    expect(outcome.unknown).toEqual([decision.draft.workUID]);
    await expect(send([decision])).resolves.toMatchObject({
      notSent: [decision.draft.workUID],
      failure: expect.objectContaining({ message: "batch-items-held" }),
    });
  });

  it("tries again when a read of the receipt fails", async () => {
    const { decide, landed, chain, send } = setup();
    const decision = decide();
    landed(decision);
    chain.attestationsIn.mockRejectedValueOnce(new Error("rpc behind"));

    await expect(send([decision])).resolves.toMatchObject({
      sent: [{ workUID: decision.draft.workUID }],
    });
  });

  it("sends back to review a work someone has decided, and signs nothing", async () => {
    const { sender, decide, chain, send } = setup();
    const [decided, fresh] = [decide(), decide()];
    chain.isDecided.mockImplementation(async (workUID) => workUID === decided.draft.workUID);

    const outcome = await send([decided, fresh]);

    expect(outcome.stale).toEqual([decided.draft.workUID]);
    expect(outcome.notSent).toEqual([fresh.draft.workUID]);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("signs nothing when it can't read who has decided", async () => {
    const { sender, decide, chain, send } = setup();
    const decision = decide();
    chain.isDecided.mockRejectedValue(new Error("index down"));

    const outcome = await send([decision]);

    expect(outcome.notSent).toEqual([decision.draft.workUID]);
    expect(outcome.failure).toEqual(expect.objectContaining({ message: "index down" }));
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("names the one decision the resolver would refuse, and signs nothing", async () => {
    const { sender, decide, chain, send } = setup();
    const [bad, good] = [decide(), decide()];
    const encoded = encodeWorkApprovalData(bad.draft, chainId);
    chain.refusal.mockImplementation(async ({ args }) =>
      JSON.stringify(args, (_key, value) =>
        typeof value === "bigint" ? String(value) : value
      ).includes(encoded)
        ? "ActionExpired"
        : null
    );

    const outcome = await send([bad, good]);

    expect(outcome.refused).toEqual([{ workUID: bad.draft.workUID, reason: "ActionExpired" }]);
    expect(outcome.notSent).toEqual([good.draft.workUID]);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("sends nothing blind when a group is refused but no decision alone is", async () => {
    const { sender, decide, chain, send } = setup();
    const decisions = [decide(), decide()];
    chain.refusal.mockResolvedValueOnce("OutOfGas");

    const outcome = await send(decisions);

    expect(outcome.notSent).toEqual(decisions.map(({ draft }) => draft.workUID));
    expect(outcome.failure).toEqual(expect.objectContaining({ message: "OutOfGas" }));
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("checks again right before signing, since a role or an action's end can pass", async () => {
    const { sender, decide, chain, send } = setup();
    const decision = decide();
    chain.refusal.mockResolvedValueOnce(null).mockResolvedValueOnce("NotGardenOperator");

    const outcome = await send([decision]);

    expect(outcome.notSent).toEqual([decision.draft.workUID]);
    expect(outcome.failure).toEqual(expect.objectContaining({ message: "NotGardenOperator" }));
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("reads who has decided again before each signature, and sends back what changed", async () => {
    const { sender, decide, landed, chain, send } = setup();
    const decisions = Array.from({ length: 7 }, () => decide());
    decisions.forEach((decision) => landed(decision));
    const late = decisions[5].draft.workUID;
    chain.isDecided.mockImplementation(
      async (workUID) =>
        workUID === late && vi.mocked(sender.sendContractCall).mock.calls.length > 0
    );

    const outcome = await send(decisions);

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(outcome.sent).toHaveLength(5);
    expect(outcome.stale).toEqual([late]);
    expect(outcome.notSent).toEqual([decisions[6].draft.workUID]);
    expect(outcome.failure).toBeUndefined();
  });

  it("signs nothing more when it can't read who has decided right before a signature", async () => {
    const { sender, decide, landed, chain, send } = setup();
    const decisions = Array.from({ length: 6 }, () => decide());
    decisions.forEach((decision) => landed(decision));
    chain.isDecided.mockImplementation(async () => {
      if (vi.mocked(sender.sendContractCall).mock.calls.length > 0) throw new Error("index down");
      return false;
    });

    const outcome = await send(decisions);

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(outcome.sent).toHaveLength(5);
    expect(outcome.stale).toEqual([]);
    expect(outcome.notSent).toEqual([decisions[5].draft.workUID]);
    expect(outcome.failure).toEqual(expect.objectContaining({ message: "index down" }));
  });

  it("refuses a decision from another garden before it reads or signs anything", async () => {
    const { sender, decide, chain, send } = setup();
    const foreign = { ...decide(), gardenAddress: address() };

    await expect(send([decide(), foreign])).rejects.toThrow("review-garden-mismatch");

    expect(chain.isDecided).not.toHaveBeenCalled();
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("keeps an earlier group sent when a later one is declined", async () => {
    const { sender, decide, landed, send } = setup();
    const decisions = Array.from({ length: 6 }, () => decide());
    decisions.forEach((decision) => landed(decision));
    vi.mocked(sender.sendContractCall)
      .mockImplementationOnce(vi.mocked(sender.sendContractCall).getMockImplementation()!)
      .mockRejectedValueOnce(new BatchNotSubmittedError(new Error("User rejected the request")));

    const outcome = await send(decisions);

    expect(outcome.sent).toHaveLength(5);
    expect(outcome.notSent).toEqual([decisions[5].draft.workUID]);
    expect(outcome.unknown).toEqual([]);
  });

  it("reports a list past its ceilings without sending anything for it", async () => {
    const { sender, decide, send } = setup();
    const decision = decide();
    sender.preflightBatch = async () => ({
      gas: "90000000",
      maxFeePerGas: "10000000",
      maxFee: "900000000000000",
      sponsored: true,
      authority: "user-operation",
    });

    const outcome = await send([decision]);

    expect(outcome.notBatchable).toEqual([decision.draft.workUID]);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });
});

describe("holding reviews whose outcome is unknown", () => {
  const onChainAfterReload = async (setupResult: ReturnType<typeof setup>) => {
    const decision = setupResult.decide();
    await setupResult.send([decision]);
    return decision;
  };

  it("survives a reload, and shows what the index says for each work", async () => {
    const context = setup({});
    const decision = await onChainAfterReload(context);
    context.chain.isDecided.mockResolvedValue(true);

    const { hold, saved } = await readReviewHold(context.input);

    expect(saved).toEqual([]);
    expect(hold).toEqual({
      operationIds: [expect.any(String)],
      workUIDs: [decision.draft.workUID.toLowerCase()],
      onChain: [{ workUID: decision.draft.workUID.toLowerCase(), decided: true }],
    });
  });

  it("ends when a read proves it landed, names its attestation, and reports it once", async () => {
    const context = setup({});
    const decision = await onChainAfterReload(context);
    const { uid: attestationUID } = context.landed(decision);
    context.sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);

    await expect(readReviewHold(context.input)).resolves.toEqual({
      hold: null,
      saved: [
        {
          workUID: decision.draft.workUID.toLowerCase(),
          attestationUID,
          transactionHash: hash,
        },
      ],
      notLanded: [],
    });
    await expect(readReviewHold(context.input)).resolves.toEqual({
      hold: null,
      saved: [],
      notLanded: [],
    });
  });

  it("keeps the hash when another tab ended it, so the decision stays on screen", async () => {
    const context = setup({});
    const decision = await onChainAfterReload(context);
    const { hold } = await readReviewHold(context.input);
    context.landed(decision);
    context.sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);
    await readReviewHold(context.input);

    const { saved } = await readReviewHold(context.input, hold);

    expect(saved).toEqual([
      expect.objectContaining({
        workUID: decision.draft.workUID.toLowerCase(),
        transactionHash: hash,
      }),
    ]);
  });

  it("names the works a settled send didn't prove, so nothing keeps showing them decided", async () => {
    const context = setup({});
    const decision = await onChainAfterReload(context);
    context.sender.reconcileBatch = vi.fn(
      async () =>
        ({
          status: "reverted",
          receipts: [{ transactionHash: hash, status: "reverted" }],
          sponsored: true,
        }) satisfies BatchExecution
    );

    await expect(readReviewHold(context.input)).resolves.toEqual({
      hold: null,
      saved: [],
      notLanded: [decision.draft.workUID.toLowerCase()],
    });
  });

  it("frees the work when the person moves on from what they saw", async () => {
    const context = setup({});
    const decision = await onChainAfterReload(context);
    const { hold } = await readReviewHold(context.input);

    await expect(moveOnFromReviewHold(context.input, hold!)).resolves.toEqual({
      hold: null,
      saved: [],
      notLanded: [decision.draft.workUID.toLowerCase()],
    });

    await expect(context.send([decision])).resolves.toMatchObject({
      unknown: [decision.draft.workUID],
    });
  });

  it("will not move on from a work the person could not see", async () => {
    const context = setup({});
    await onChainAfterReload(context);
    context.chain.isDecided.mockRejectedValueOnce(new Error("index down"));
    const { hold: unread } = await readReviewHold(context.input);
    expect(unread?.onChain).toEqual([]);
    const release = vi.spyOn(context.input.batches, "release");

    const { hold } = await moveOnFromReviewHold(context.input, unread!);

    expect(release).not.toHaveBeenCalled();
    expect(hold?.onChain).toHaveLength(1);
  });

  it("shows only that garden's held sends", async () => {
    const context = setup({});
    await onChainAfterReload(context);

    await expect(readReviewHold({ ...context.input, gardenAddress: address() })).resolves.toEqual({
      hold: null,
      saved: [],
      notLanded: [],
    });
    await expect(readReviewHold(context.input)).resolves.toMatchObject({
      hold: { workUIDs: [expect.any(String)] },
    });
  });
});
