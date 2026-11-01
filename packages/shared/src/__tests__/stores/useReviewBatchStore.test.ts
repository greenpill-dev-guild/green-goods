/**
 * Review batch store tests: the decisions a steward hasn't sent yet, one list per chain, account,
 * and garden, brought back after a reload, with malformed saved reviews dropped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../modules/app/logger";
import {
  REVIEW_BATCH_STORAGE_KEY,
  reviewBatchScope,
  useReviewBatchStore,
} from "../../stores/useReviewBatchStore";
import { Confidence, VerificationMethod, type WorkApprovalDraft } from "../../types/domain";

const ALICE = "0xA11CE00000000000000000000000000000000001";
const BOB = "0xB0B0000000000000000000000000000000000002";
const GARDEN_A = "0xA000000000000000000000000000000000000001";
const GARDEN_B = "0xB000000000000000000000000000000000000002";
const SCOPE = reviewBatchScope(42161, ALICE, GARDEN_A);

const draft = (workUID: string, approved = true): WorkApprovalDraft => ({
  actionUID: 1,
  workUID,
  approved,
  feedback: approved ? undefined : "No photo",
  confidence: approved ? Confidence.HIGH : Confidence.NONE,
  verificationMethod: approved ? VerificationMethod.HUMAN : 0,
});
const reviews = (scope = SCOPE) => useReviewBatchStore.getState().reviewsByScope[scope];

beforeEach(() => {
  localStorage.clear();
  useReviewBatchStore.setState({ reviewsByScope: {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stores/useReviewBatchStore", () => {
  it("keeps a list per chain, account, and garden, whatever the address's case", () => {
    expect(reviewBatchScope(42161, ALICE, GARDEN_A)).toBe(
      reviewBatchScope(42161, ALICE.toLowerCase(), GARDEN_A.toUpperCase().replace("0X", "0x"))
    );
    const others = [
      reviewBatchScope(1, ALICE, GARDEN_A),
      reviewBatchScope(42161, BOB, GARDEN_A),
      reviewBatchScope(42161, ALICE, GARDEN_B),
    ];

    useReviewBatchStore.getState().stage(SCOPE, draft("0xW1"));

    expect(Object.keys(reviews())).toEqual(["0xw1"]);
    for (const other of others) expect(reviews(other)).toBeUndefined();
  });

  it("holds one decision per work: staging again replaces it and forgets its notes", () => {
    const { stage, note } = useReviewBatchStore.getState();
    stage(SCOPE, draft("0xW1"));
    note(SCOPE, new Map([["0xW1", { refusal: "Action expired" }]]));
    expect(reviews()["0xw1"].refusal).toBe("Action expired");

    stage(SCOPE, draft("0xw1", false));

    expect(reviews()).toEqual({ "0xw1": { draft: draft("0xw1", false) } });
  });

  it("forgets a note the next send doesn't repeat, and keeps the decision", () => {
    const { stage, note } = useReviewBatchStore.getState();
    stage(SCOPE, draft("0xW1"));
    stage(SCOPE, draft("0xW2"));
    note(SCOPE, new Map([["0xW1", { refusal: "Action expired" }]]));

    note(SCOPE, new Map([["0xW2", { notBatchable: true }]]));

    expect(reviews()).toEqual({
      "0xw1": { draft: draft("0xW1") },
      "0xw2": { draft: draft("0xW2"), notBatchable: true },
    });
  });

  it("drops what leaves, and changes nothing when nothing does", () => {
    const { stage, unstage } = useReviewBatchStore.getState();
    stage(SCOPE, draft("0xW1"));
    stage(SCOPE, draft("0xW2"));
    const before = useReviewBatchStore.getState().reviewsByScope;

    // A caller that runs on every read settles instead of re-rendering itself.
    unstage(SCOPE, ["0xW9"]);
    expect(useReviewBatchStore.getState().reviewsByScope).toBe(before);

    unstage(SCOPE, ["0xW1"]);
    expect(Object.keys(reviews())).toEqual(["0xw2"]);

    unstage(SCOPE, ["0xw2"]);
    expect(useReviewBatchStore.getState().reviewsByScope).toEqual({});
  });

  it("brings the list back after a reload without last time's notes, dropping malformed reviews", async () => {
    localStorage.setItem(
      REVIEW_BATCH_STORAGE_KEY,
      JSON.stringify({
        state: {
          reviewsByScope: {
            [SCOPE]: {
              "0xw1": { draft: draft("0xW1"), refusal: "Action expired" },
              noDraft: {},
              noUID: { draft: { ...draft("0xW3"), workUID: undefined } },
              wrongType: { draft: { ...draft("0xW4"), approved: "yes" } },
              wrongFeedback: { draft: { ...draft("0xW5"), feedback: 7 } },
            },
            emptied: { noDraft: {} },
            notAList: "nope",
          },
        },
        version: 0,
      })
    );

    await useReviewBatchStore.persist.rehydrate();

    expect(useReviewBatchStore.getState().reviewsByScope).toEqual({
      [SCOPE]: { "0xw1": { draft: draft("0xW1") } },
    });
  });

  it("starts every write from what's saved, so another tab's review survives", () => {
    const { stage, unstage } = useReviewBatchStore.getState();
    stage(SCOPE, draft("0xW1"));
    // Another tab saved its list a moment ago, and its storage event hasn't arrived here.
    const saveFromAnotherTab = (workUIDs: string[]) =>
      localStorage.setItem(
        REVIEW_BATCH_STORAGE_KEY,
        JSON.stringify({
          state: {
            reviewsByScope: {
              [SCOPE]: Object.fromEntries(
                workUIDs.map((id) => [id.toLowerCase(), { draft: draft(id) }])
              ),
            },
          },
          version: 0,
        })
      );
    saveFromAnotherTab(["0xW1", "0xW2"]);

    stage(SCOPE, draft("0xW3"));
    expect(Object.keys(reviews())).toEqual(["0xw1", "0xw2", "0xw3"]);

    saveFromAnotherTab(["0xW1", "0xW2", "0xW3", "0xW4"]);
    unstage(SCOPE, ["0xW1"]);
    expect(Object.keys(reviews())).toEqual(["0xw2", "0xw3", "0xw4"]);
  });

  it("keeps this tab's notes when it picks up another tab's list", async () => {
    const { stage, note } = useReviewBatchStore.getState();
    stage(SCOPE, draft("0xW1"));
    note(SCOPE, new Map([["0xW1", { refusal: "Action expired" }]]));

    await useReviewBatchStore.persist.rehydrate();

    expect(reviews()["0xw1"].refusal).toBe("Action expired");
  });

  it("lasts the session when the device refuses the write", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      removeItem: () => {},
    });

    useReviewBatchStore.getState().stage(SCOPE, draft("0xW1"));

    expect(Object.keys(reviews())).toEqual(["0xw1"]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
