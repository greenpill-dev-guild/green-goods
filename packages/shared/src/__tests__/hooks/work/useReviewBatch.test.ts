/**
 * The reviews a steward has decided and not yet sent: which stay on the device, which leave, and
 * what a send says about the ones it could not take.
 * @vitest-environment happy-dom
 */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReviewBatch } from "../../../hooks/work/useReviewBatch";
import type { OverlayWork } from "../../../modules/work/local-status-overlay";
import type { ReviewBatchOutcome } from "../../../modules/work/review-batch";
import {
  REVIEW_BATCH_STORAGE_KEY,
  reviewBatchScope,
  useReviewBatchStore,
} from "../../../stores/useReviewBatchStore";
import { Confidence, VerificationMethod, type WorkApprovalDraft } from "../../../types/domain";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const { auth, batch, toasts } = vi.hoisted(() => ({
  auth: { primaryAddress: "0xA11CE00000000000000000000000000000000001" as string | null },
  batch: {
    available: true,
    hold: null as null | {
      operationIds: string[];
      workUIDs: string[];
      onChain: { workUID: string; decided: boolean }[];
    },
    isSending: false,
    isSettlingHold: false,
    send: vi.fn(),
    checkAgain: vi.fn(async () => {}),
    moveOn: vi.fn(async () => {}),
    onLanded: (_workUIDs: readonly string[]) => {},
  },
  toasts: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../hooks/auth/useUser", () => ({ useUser: () => auth }));
vi.mock("../../../components/toast", () => ({ toastService: toasts }));
vi.mock("../../../hooks/work/useBatchWorkApproval", () => ({
  useBatchWorkApproval: (
    _gardenId: string,
    options: { onLanded: (workUIDs: readonly string[]) => void }
  ) => {
    batch.onLanded = options.onLanded;
    return {
      ...batch,
      signaturesFor: (count: number) => Math.ceil(count / 5),
    };
  },
}));

const GARDEN = "0xA000000000000000000000000000000000000001";
const SCOPE = () => reviewBatchScope(42161, auth.primaryAddress as string, GARDEN);

const decide = (workUID: string, approved = true): WorkApprovalDraft => ({
  actionUID: 1,
  workUID,
  approved,
  feedback: approved ? undefined : "No photo",
  confidence: approved ? Confidence.HIGH : Confidence.NONE,
  verificationMethod: approved ? VerificationMethod.HUMAN : 0,
});
const outcomeOf = (partial: Partial<ReviewBatchOutcome>): ReviewBatchOutcome => ({
  sent: [],
  stale: [],
  refused: [],
  notSent: [],
  notBatchable: [],
  unknown: [],
  ...partial,
});
const render = (works?: OverlayWork[]) =>
  renderHookWithProviders(({ list }) => useReviewBatch(GARDEN, { works: list }), {
    initialProps: { list: works },
  });
const stagedIds = (result: { current: ReturnType<typeof useReviewBatch> }) =>
  result.current.reviews.map(({ draft }) => draft.workUID);

describe("useReviewBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useReviewBatchStore.setState({ reviewsByScope: {} });
    auth.primaryAddress = "0xA11CE00000000000000000000000000000000001";
    Object.assign(batch, { available: true, hold: null, isSending: false, isSettlingHold: false });
    batch.send.mockResolvedValue(outcomeOf({}));
  });

  it("counts what is decided and how many signatures it takes", () => {
    const { result } = render();

    act(() => {
      for (const id of ["0x1", "0x2", "0x3", "0x4", "0x5"]) result.current.stage(decide(id));
      result.current.stage(decide("0x6", false));
    });

    expect(result.current.approvals).toBe(5);
    expect(result.current.rejections).toBe(1);
    expect(result.current.signatures).toBe(2);
    expect(result.current.reviewFor("0X6")?.draft.approved).toBe(false);
    expect(result.current.reviewFor("0x7")).toBeUndefined();
  });

  it("shows nothing off the list, and keeps the decisions for when it's back", () => {
    const { result, rerender } = render();
    act(() => result.current.stage(decide("0x1")));

    batch.available = false;
    rerender({ list: undefined });
    expect(result.current.reviews).toEqual([]);
    expect(result.current.reviewFor("0x1")).toBeUndefined();

    batch.available = true;
    rerender({ list: undefined });
    expect(stagedIds(result)).toEqual(["0x1"]);
  });

  it("keeps each account's list its own", () => {
    const { result, rerender } = render();
    act(() => result.current.stage(decide("0x1")));

    auth.primaryAddress = "0xB0B0000000000000000000000000000000000002";
    rerender({ list: undefined });
    expect(result.current.reviews).toEqual([]);

    auth.primaryAddress = "0xA11CE00000000000000000000000000000000001";
    rerender({ list: undefined });
    expect(stagedIds(result)).toEqual(["0x1"]);
  });

  it("sends each decision as it was made, and each lands off the list, moving the count on", async () => {
    const ids = ["0x1", "0x2", "0x3", "0x4", "0x5", "0x6", "0x7"];
    let finish = (_outcome: ReviewBatchOutcome) => {};
    batch.send.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = render();
    act(() => {
      for (const id of ids) result.current.stage(decide(id));
    });

    act(() => void result.current.send());
    expect(batch.send).toHaveBeenCalledWith(
      ids.map((id) => ({ draft: decide(id), gardenAddress: GARDEN }))
    );
    await waitFor(() => expect(result.current.sendSize).toBe(2));
    expect(result.current.signatureStep).toBe(1);

    act(() => batch.onLanded(ids.slice(0, 5)));
    expect(stagedIds(result)).toEqual(["0x6", "0x7"]);
    expect(result.current.signatureStep).toBe(2);

    await act(async () => finish(outcomeOf({})));
    act(() => batch.onLanded(ids.slice(5)));
    expect(result.current.reviews).toEqual([]);
  });

  it("takes out what someone already decided, says so, and leaves the rest to send again", async () => {
    batch.send.mockResolvedValue(outcomeOf({ stale: ["0x1"], notSent: ["0x2"] }));
    const { result } = render();
    act(() => {
      result.current.stage(decide("0x1"));
      result.current.stage(decide("0x2"));
    });

    await act(() => result.current.send());

    expect(stagedIds(result)).toEqual(["0x2"]);
    expect(toasts.info).toHaveBeenCalledOnce();
    expect(toasts.info.mock.calls[0][0].title).toContain("1 work");
  });

  it("keeps a refused review with the contract's reason, in words, until it's taken out", async () => {
    batch.send.mockResolvedValue(
      outcomeOf({ refused: [{ workUID: "0x1", reason: "ActionExpired" }], notSent: ["0x2"] })
    );
    const { result } = render();
    act(() => {
      result.current.stage(decide("0x1"));
      result.current.stage(decide("0x2"));
    });

    await act(() => result.current.send());

    expect(result.current.blockedCount).toBe(1);
    const refusal = result.current.reviewFor("0x1")?.refusal;
    expect(refusal).toBeTruthy();
    expect(refusal).not.toContain("ActionExpired");
    expect(result.current.reviewFor("0x2")?.refusal).toBeUndefined();

    act(() => result.current.unstageBlocked());
    expect(stagedIds(result)).toEqual(["0x2"]);
    expect(result.current.blockedCount).toBe(0);
  });

  it("clears a note the next send doesn't repeat", async () => {
    batch.send.mockResolvedValueOnce(outcomeOf({ notBatchable: ["0x1"] }));
    const { result } = render();
    act(() => result.current.stage(decide("0x1")));

    await act(() => result.current.send());
    expect(result.current.reviewFor("0x1")?.notBatchable).toBe(true);

    batch.send.mockResolvedValueOnce(outcomeOf({ notSent: ["0x1"] }));
    await act(() => result.current.send());
    expect(result.current.reviewFor("0x1")?.notBatchable).toBeUndefined();
  });

  it("hands a send it can't confirm to the journal, so nothing can send it again", async () => {
    batch.send.mockResolvedValue(outcomeOf({ unknown: ["0x1"] }));
    const { result } = render();
    act(() => result.current.stage(decide("0x1")));

    await act(() => result.current.send());

    expect(useReviewBatchStore.getState().reviewsByScope[SCOPE()]).toBeUndefined();
  });

  it("lets go of whatever a hold names, as after a tab closed mid-send, and locks that work", () => {
    useReviewBatchStore.getState().stage(SCOPE(), decide("0xAB"));
    useReviewBatchStore.getState().stage(SCOPE(), decide("0xCD"));
    batch.hold = {
      operationIds: ["op"],
      workUIDs: ["0xab"],
      onChain: [{ workUID: "0xab", decided: false }],
    };

    const { result } = render();

    expect(stagedIds(result)).toEqual(["0xCD"]);
    expect(result.current.isHeld("0xAB")).toBe(true);
    expect(result.current.isHeld("0xCD")).toBe(false);
    expect(result.current.reviewFor("0xAB")).toBeUndefined();
    expect(useReviewBatchStore.getState().reviewsByScope[SCOPE()]["0xab"]).toBeUndefined();
  });

  it("says what a hold can see, and moving on waits for a read of everything", () => {
    batch.hold = {
      operationIds: ["op"],
      workUIDs: ["0x1", "0x2"],
      onChain: [{ workUID: "0x1", decided: true }],
    };
    const { result, rerender } = render();

    expect(result.current.holdFeedback?.detail).toContain("1 of 2");
    expect(result.current.holdFeedback?.hasUnreadValues).toBe(true);

    batch.hold = {
      operationIds: ["op"],
      workUIDs: ["0x1", "0x2"],
      onChain: [
        { workUID: "0x1", decided: true },
        { workUID: "0x2", decided: false },
      ],
    };
    rerender({ list: undefined });
    expect(result.current.holdFeedback?.hasUnreadValues).toBe(false);

    result.current.holdFeedback?.onMoveOn();
    expect(batch.moveOn).toHaveBeenCalledOnce();
  });

  it("still shows a hold off the list, since recovery doesn't depend on it", () => {
    batch.available = false;
    batch.hold = { operationIds: ["op"], workUIDs: ["0x1"], onChain: [] };

    const { result } = render();

    expect(result.current.isHeld("0x1")).toBe(true);
    expect(result.current.holdFeedback).not.toBeNull();
  });

  it("takes out a work someone has since decided, and says so", () => {
    useReviewBatchStore.getState().stage(SCOPE(), decide("0xAB"));
    useReviewBatchStore.getState().stage(SCOPE(), decide("0xCD"));
    const row = (id: string, status: OverlayWork["status"]) => ({ id, status }) as OverlayWork;

    const { result } = render([row("0xab", "approved"), row("0xcd", "pending")]);

    expect(stagedIds(result)).toEqual(["0xCD"]);
    expect(toasts.info).toHaveBeenCalledOnce();
  });

  it.each([
    ["a send is in flight", { isSending: true }, {}],
    ["its status is this device's own guess", {}, { _isPending: true }],
  ])("keeps a decision while %s", (_name, batchState, overlay) => {
    Object.assign(batch, batchState);
    useReviewBatchStore.getState().stage(SCOPE(), decide("0xAB"));
    const row = { id: "0xab", status: "approved", ...overlay } as OverlayWork;

    render([row]);

    expect(Object.keys(useReviewBatchStore.getState().reviewsByScope[SCOPE()])).toEqual(["0xab"]);
    expect(toasts.info).not.toHaveBeenCalled();
  });

  it("cleans up off the list without news, since the steward decided that work at once", () => {
    batch.available = false;
    useReviewBatchStore.getState().stage(SCOPE(), decide("0xAB"));

    render([{ id: "0xab", status: "rejected" } as OverlayWork]);

    expect(useReviewBatchStore.getState().reviewsByScope[SCOPE()]).toBeUndefined();
    expect(toasts.info).not.toHaveBeenCalled();
  });

  it("picks up another tab's list, so this tab's next write can't overwrite it", async () => {
    const { result } = render();
    localStorage.setItem(
      REVIEW_BATCH_STORAGE_KEY,
      JSON.stringify({
        state: { reviewsByScope: { [SCOPE()]: { "0x1": { draft: decide("0x1") } } } },
        version: 0,
      })
    );

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: REVIEW_BATCH_STORAGE_KEY }));
    });

    await waitFor(() => expect(stagedIds(result)).toEqual(["0x1"]));
  });
});
