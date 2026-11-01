/**
 * Sending reviewed decisions as one batch, and settling a send whose outcome is unknown.
 * @vitest-environment happy-dom
 */

import "fake-indexeddb/auto";
import { act, waitFor } from "@testing-library/react";
import { encodeAbiParameters, encodeEventTopics, type Hex, type Log, parseAbi, toHex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEASConfig } from "../../../config/blockchain";
import { worksKeys } from "../../../config/query-keys/work";
import { useMutationLock } from "../../../hooks/utils/useMutationLock";
import { useBatchWorkApproval } from "../../../hooks/work/useBatchWorkApproval";
import type { BatchExecution } from "../../../modules/transactions/batch-types";
import type { OverlayWork } from "../../../modules/work/local-status-overlay";
import type { ReviewDecision } from "../../../modules/work/review-batch";
import type { Address, WorkApprovalDraft } from "../../../types/domain";
import { Confidence, VerificationMethod } from "../../../types/domain";
import { encodeWorkApprovalData } from "../../../utils/eas/encoders";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";
import { createFakeBatchingSender } from "../../test-utils/transaction-fakes";

const { auth, chainState, sending, toasts, listing } = vi.hoisted(() => ({
  auth: { primaryAddress: null as string | null, passkeyAccountProfile: "kernel-0.3.1-legacy" },
  chainState: {
    decided: new Set<string>(),
    logs: [] as Partial<Log>[],
    attestations: new Map<string, string>(),
  },
  sending: { sender: null as unknown },
  toasts: { success: vi.fn(), info: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
  listing: { enabled: true, walletProfile: "contract-call" },
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => sending.sender,
}));
vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("../../../components/toast", () => ({ toastService: toasts }));
vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));
vi.mock("../../../modules/app/posthog", () => ({ track: vi.fn() }));
vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => vi.fn(),
}));
vi.mock("../../../modules/transactions/batch-enablement", () => ({
  isBatchEnabled: (query: { rail: string; profile: string }) =>
    listing.enabled && (query.rail === "passkey" || query.profile === listing.walletProfile),
}));
vi.mock("../../../utils/blockchain/simulation", () => ({
  simulateTransaction: vi.fn(async () => ({ success: true })),
}));
vi.mock("../../../modules/data/eas", () => ({
  getWorkApprovalsForWork: vi.fn(async (workUID: string) =>
    chainState.decided.has(workUID) ? [{ id: "earlier" }] : []
  ),
}));
vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(async (_config, { args }: { args: [string] }) => ({
    data: chainState.attestations.get(args[0]),
  })),
  getTransactionReceipt: vi.fn(async () => ({ logs: chainState.logs })),
}));
// The EAS SDK is stubbed in this project, so this writes what the schema does.
vi.mock("../../../utils/eas/encoders", async (importOriginal) => {
  const viem = await import("viem");
  return {
    ...(await importOriginal<object>()),
    encodeWorkApprovalData: (draft: WorkApprovalDraft) =>
      viem.encodeAbiParameters(viem.parseAbiParameters("bytes32,bool,string"), [
        draft.workUID as Hex,
        draft.approved,
        draft.feedback ?? "",
      ]),
  };
});

const chainId = 42161;
const hash = `0x${"ab".repeat(32)}` as const;
const CONFIRMED: Partial<BatchExecution> = {
  status: "confirmed",
  receipts: [{ transactionHash: hash, status: "success" }],
};
const ATTESTED = parseAbi([
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
]);
const random = (size: number): Hex => toHex(crypto.getRandomValues(new Uint8Array(size)));

function setup(execution: Partial<BatchExecution> = CONFIRMED, authMode = "passkey") {
  const account = random(20) as Address;
  const garden = random(20) as Address;
  const sender = createFakeBatchingSender(account, execution);
  Object.assign(sender, { authMode });
  auth.primaryAddress = account;
  sending.sender = sender;
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } });
  const decide = (approved = true, feedback = ""): ReviewDecision => ({
    gardenAddress: garden,
    draft: {
      actionUID: 1,
      workUID: random(32),
      approved,
      feedback,
      confidence: approved ? Confidence.HIGH : Confidence.NONE,
      verificationMethod: approved ? VerificationMethod.HUMAN : 0,
    },
  });
  const landed = (decision: ReviewDecision) => {
    const attestationUID = random(32);
    const eas = getEASConfig(chainId);
    chainState.attestations.set(attestationUID, encodeWorkApprovalData(decision.draft, chainId));
    chainState.logs.push({
      address: eas.EAS.address as Address,
      topics: encodeEventTopics({
        abi: ATTESTED,
        eventName: "Attested",
        args: {
          recipient: garden,
          attester: account,
          schemaUID: eas.WORK_APPROVAL.uid as Hex,
        },
      }) as Log["topics"],
      data: encodeAbiParameters([{ type: "bytes32" }], [attestationUID]),
    });
    return attestationUID;
  };
  /** The resolver's own attestation in the same transaction, under another schema. */
  const landedUnderAnotherSchema = (decision: ReviewDecision) => {
    landed(decision);
    chainState.logs[chainState.logs.length - 1].topics = encodeEventTopics({
      abi: ATTESTED,
      eventName: "Attested",
      args: { recipient: garden, attester: account, schemaUID: random(32) },
    }) as Log["topics"];
  };
  const listWorks = (decisions: readonly ReviewDecision[]) => {
    const works = decisions.map(
      ({ draft }) => ({ id: draft.workUID, status: "pending" }) as unknown as OverlayWork
    );
    queryClient.setQueryData(worksKeys.merged(garden, chainId), works);
    queryClient.setQueryData(worksKeys.online(garden, chainId), works);
  };
  const workOf = ({ draft }: ReviewDecision) =>
    queryClient
      .getQueryData<OverlayWork[]>(worksKeys.merged(garden, chainId))
      ?.find((work) => work.id === draft.workUID);
  const render = () => renderHookWithProviders(() => useBatchWorkApproval(garden), { queryClient });
  return {
    account,
    garden,
    sender,
    queryClient,
    decide,
    landed,
    landedUnderAnotherSchema,
    listWorks,
    workOf,
    render,
  };
}

describe("useBatchWorkApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listing.enabled = true;
    listing.walletProfile = "contract-call";
    chainState.decided = new Set();
    chainState.logs = [];
    chainState.attestations = new Map();
  });

  it.each([
    "passkey",
    "wallet",
  ])("is available on a %s once listed, since one call does the batching", (mode) => {
    const { render } = setup(CONFIRMED, mode);
    const { result } = render();

    expect(result.current.available).toBe(true);
    expect(result.current.signaturesFor(6)).toBe(2);
  });

  it("isn't available while nothing is listed", () => {
    listing.enabled = false;
    const { render } = setup();
    const { result } = render();

    expect(result.current.available).toBe(false);
  });

  it("keeps each work's own decision and feedback once a read proves it", async () => {
    const { decide, landed, listWorks, workOf, render, sender } = setup();
    const [yes, no] = [decide(true, "Lovely"), decide(false, "No photo")];
    listWorks([yes, no]);
    const attestations = [landed(yes), landed(no)];
    const { result } = render();

    let outcome: Awaited<ReturnType<typeof result.current.send>> | undefined;
    await act(async () => {
      outcome = await result.current.send([yes, no]);
    });

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(outcome?.sent.map((item) => item.attestationUID)).toEqual(attestations);
    expect(workOf(yes)).toMatchObject({
      status: "approved",
      reviewFeedback: "Lovely",
      _isPending: false,
      _txHash: hash,
    });
    expect(workOf(no)).toMatchObject({ status: "rejected", reviewFeedback: "No photo" });
    // A proven decision outranks the indexer until the indexer reports it.
    expect(workOf(yes)?._pendingUntilMs).toBeUndefined();
    expect(toasts.success).toHaveBeenCalledOnce();
  });

  it("tells its caller each decision that lands, from a send and from a later read", async () => {
    const { decide, garden, landed, listWorks, queryClient, sender } = setup();
    const decision = decide();
    listWorks([decision]);
    landed(decision);
    const onLanded = vi.fn();
    const { result } = renderHookWithProviders(() => useBatchWorkApproval(garden, { onLanded }), {
      queryClient,
    });

    await act(() => result.current.send([decision]));

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    expect(onLanded).toHaveBeenCalledWith([decision.draft.workUID]);
  });

  it("passes on a list that takes a signature per review", async () => {
    const { decide, landed, listWorks, render, sender } = setup();
    const decisions = [decide(), decide()];
    listWorks(decisions);
    decisions.forEach((decision) => landed(decision));
    const { result } = render();

    await act(async () => {
      await result.current.send(decisions, { perSignature: 1 });
    });

    expect(sender.sendContractCall).toHaveBeenCalledTimes(2);
  });

  it("treats two quick presses as one send, since they share the approval lock", async () => {
    const { decide, landed, listWorks, render, sender, workOf } = setup();
    const decision = decide();
    listWorks([decision]);
    landed(decision);
    const { result } = render();

    let outcomes: Awaited<ReturnType<typeof result.current.send>>[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        result.current.send([decision]),
        result.current.send([decision]),
      ]);
    });

    expect(sender.sendContractCall).toHaveBeenCalledOnce();
    // Refused by the journal instead, the second press would let go of the first's decision.
    expect(outcomes[1]).toBe(outcomes[0]);
    expect(workOf(decision)).toMatchObject({ status: "approved", _txHash: hash });
  });

  it("counts as sending while a single review holds the approval lock", async () => {
    const { garden, queryClient } = setup();
    let release = () => {};
    const { result } = renderHookWithProviders(
      () => ({ batch: useBatchWorkApproval(garden), lock: useMutationLock("approval") }),
      { queryClient }
    );
    expect(result.current.batch.isSending).toBe(false);

    act(() => {
      void result.current.lock.runWithLock(
        () => new Promise<void>((resolve) => (release = resolve))
      );
    });
    await waitFor(() => expect(result.current.batch.isSending).toBe(true));

    await act(async () => release());
    await waitFor(() => expect(result.current.batch.isSending).toBe(false));
  });

  it("doesn't take the resolver's own attestation as the decision", async () => {
    const { decide, landedUnderAnotherSchema, listWorks, render } = setup();
    const decision = decide();
    listWorks([decision]);
    landedUnderAnotherSchema(decision);
    const { result } = render();

    let outcome: Awaited<ReturnType<typeof result.current.send>> | undefined;
    await act(async () => {
      outcome = await result.current.send([decision]);
    });

    expect(outcome?.sent).toEqual([]);
    expect(outcome?.unknown).toEqual([decision.draft.workUID]);
  }, 15_000);

  it("keeps a decision pending, and says nothing landed, when its outcome is unknown", async () => {
    const { decide, listWorks, workOf, render } = setup({});
    const decision = decide();
    listWorks([decision]);
    const { result } = render();

    await act(async () => {
      await result.current.send([decision]);
    });

    expect(workOf(decision)).toMatchObject({ status: "approved", _isPending: true });
    expect(workOf(decision)?._pendingUntilMs).toBeUndefined();
    expect(toasts.success).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.hold?.workUIDs).toHaveLength(1));
  });

  it("lets go of a decision that didn't go out, so the indexer's answer stands", async () => {
    const { decide, garden, listWorks, queryClient, workOf, render, sender } = setup();
    const decision = decide();
    chainState.decided.add(decision.draft.workUID);
    listWorks([decision]);
    const { result } = render();

    let outcome: Awaited<ReturnType<typeof result.current.send>> | undefined;
    await act(async () => {
      outcome = await result.current.send([decision]);
    });

    expect(outcome?.stale).toEqual([decision.draft.workUID]);
    expect(sender.sendContractCall).not.toHaveBeenCalled();
    expect(workOf(decision)?._isPending).toBe(false);
    expect(workOf(decision)?._pendingUntilMs).toBeLessThanOrEqual(Date.now());
    // The row can't keep reading as decided until the next refetch, and that refetch starts now.
    expect(workOf(decision)?.status).toBe("pending");
    expect(workOf(decision)?.reviewFeedback).toBeUndefined();
    expect(queryClient.getQueryState(worksKeys.merged(garden, chainId))?.isInvalidated).toBe(true);
  });

  it("shows a held send after a reload, even off the list, and moving on lets it go", async () => {
    const { decide, listWorks, workOf, queryClient, render } = setup({});
    const decision = decide();
    listWorks([decision]);
    const { result: first, unmount } = render();
    await act(async () => {
      await first.current.send([decision]);
    });
    unmount();
    listing.enabled = false;
    queryClient.removeQueries({ queryKey: ["greengoods", "batch", "hold"] });

    const { result } = render();

    await waitFor(() => expect(result.current.hold?.workUIDs).toHaveLength(1));
    expect(result.current.available).toBe(false);
    await act(async () => {
      await result.current.moveOn();
    });
    await waitFor(() => expect(result.current.hold).toBeNull());
    expect(workOf(decision)?._isPending).toBe(false);
  });

  it("reads no hold while a send is in flight, even from another form, and reads it after", async () => {
    const { decide, listWorks, sender, render } = setup({});
    const decision = decide();
    listWorks([decision]);
    const call = vi.mocked(sender.sendContractCall);
    const realSend = call.getMockImplementation()!;
    let wake = () => {};
    const woken = new Promise<void>((resolve) => {
      wake = resolve;
    });
    call.mockImplementationOnce(async (...args) => {
      await woken;
      return realSend(...args);
    });
    const { result: sending } = render();
    let sent = Promise.resolve();
    act(() => {
      sent = sending.current.send([decision]).then(() => undefined);
    });
    await waitFor(() => expect(call).toHaveBeenCalledOnce());
    const list = vi.spyOn(sender.batches!, "list");

    const { result: elsewhere } = render();
    await waitFor(() => expect(elsewhere.current.isSending).toBe(true));
    expect(list).not.toHaveBeenCalled();

    await act(async () => {
      wake();
      await sent;
    });
    await waitFor(() => expect(elsewhere.current.hold?.workUIDs).toHaveLength(1));
  });

  it("finishes a send in the garden it started in, whichever garden is open by then", async () => {
    const { decide, garden, listWorks, queryClient, sender, workOf } = setup();
    const decision = decide();
    listWorks([decision]);
    const other = random(20) as Address;
    const otherRow = { id: "other-work", status: "pending" } as OverlayWork;
    queryClient.setQueryData(worksKeys.merged(other, chainId), [otherRow]);
    let decline = (_error: unknown) => {};
    vi.mocked(sender.sendContractCall).mockImplementation(
      () => new Promise((_, reject) => (decline = reject))
    );
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result, rerender } = renderHookWithProviders(
      ({ open }: { open: Address }) => useBatchWorkApproval(open),
      { queryClient, initialProps: { open: garden } }
    );

    let sending: Promise<unknown> = Promise.resolve();
    act(() => {
      sending = result.current.send([decision]);
    });
    await waitFor(() => expect(sender.sendContractCall).toHaveBeenCalledOnce());
    rerender({ open: other });
    invalidate.mockClear();

    await act(async () => {
      decline(new Error("User rejected the request."));
      await sending;
    });

    expect(workOf(decision)).toMatchObject({ status: "pending", _isPending: false });
    expect(queryClient.getQueryData(worksKeys.merged(other, chainId))).toEqual([otherRow]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: worksKeys.merged(garden, chainId) });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: worksKeys.merged(other, chainId) });
  });

  it("lets go of a decision whose held send turned out to revert", async () => {
    const { decide, listWorks, workOf, sender, render } = setup({});
    const decision = decide();
    listWorks([decision]);
    const { result } = render();
    await act(async () => {
      await result.current.send([decision]);
    });
    await waitFor(() => expect(result.current.hold).not.toBeNull());
    expect(workOf(decision)?._isPending).toBe(true);
    sender.reconcileBatch = vi.fn(
      async () =>
        ({
          status: "reverted",
          receipts: [{ transactionHash: hash, status: "reverted" }],
          sponsored: true,
        }) satisfies BatchExecution
    );

    await act(async () => {
      await result.current.checkAgain();
    });

    await waitFor(() => expect(result.current.hold).toBeNull());
    expect(workOf(decision)?._isPending).toBe(false);
    expect(workOf(decision)?._pendingUntilMs).toBeLessThanOrEqual(Date.now());
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("says when a held send proves it landed, once", async () => {
    const { decide, landed, listWorks, workOf, sender, render } = setup({});
    const decision = decide();
    listWorks([decision]);
    const { result } = render();
    await act(async () => {
      await result.current.send([decision]);
    });
    await waitFor(() => expect(result.current.hold).not.toBeNull());
    landed(decision);
    sender.reconcileBatch = vi.fn(async () => CONFIRMED as BatchExecution);

    await act(async () => {
      await result.current.checkAgain();
    });

    await waitFor(() => expect(result.current.hold).toBeNull());
    expect(toasts.success).toHaveBeenCalledOnce();
    expect(workOf(decision)).toMatchObject({ _isPending: false, _txHash: hash });
  });
});
