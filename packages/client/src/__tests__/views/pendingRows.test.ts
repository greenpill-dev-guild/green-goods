import type { PendingProof } from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import messages from "@green-goods/shared/i18n/en.json";
import type { Work } from "@green-goods/shared/types/domain";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  decisionRow,
  type PendingRowContext,
  proofRow,
  submissionRow,
} from "../../views/Home/WorkDashboard/buildPendingRows";
import {
  filterPendingRows,
  type PendingPlace,
  pendingFilterOptions,
  sortPendingRows,
} from "../../views/Home/WorkDashboard/pendingRows";

const intl = createIntl({ locale: "en", messages });
const context: PendingRowContext = {
  intl,
  isOnline: true,
  pausedForDataSaver: false,
  actionTitle: () => undefined,
  isLinked: () => false,
};

const place = (
  name: string,
  kind: PendingPlace["kind"],
  source: PendingPlace["source"],
  at: number
) => ({
  name,
  kind,
  source,
  at,
});

function queuedWork(submissionState: string, blockedReason?: string): Work {
  return {
    id: `job-${submissionState}`,
    title: "Compost Turn",
    actionUID: 1,
    gardenerAddress: "0x1111111111111111111111111111111111111111",
    gardenAddress: "0x2222222222222222222222222222222222222222",
    feedback: "",
    metadata: JSON.stringify({ submissionState, blockedReason }),
    media: [],
    createdAt: 1_790_000_000,
    status: "offline",
  };
}

function proof(overrides: Partial<PendingProof>): PendingProof {
  return {
    id: "proof-1",
    source: "queued",
    commitmentId: 7n,
    garden: "0x2222222222222222222222222222222222222222",
    commitment: null,
    title: "Repair the north fence panel",
    savedAt: Date.now(),
    contents: { photos: 2, videos: 0, voiceNotes: 0, links: 0, words: false },
    waitingReason: null,
    failed: false,
    sending: false,
    discardable: true,
    firstPhoto: null,
    ...overrides,
  };
}

describe("Pending order and filters", () => {
  it("lists what needs you first, then what's ready, drafts, checks and reviews; work before proof, newest first", () => {
    const sorted = sortPendingRows([
      place("mulch log", "review", "work", 10),
      place("fence proof", "upload", "proof", 60),
      place("edging", "checking", "work", 20),
      place("mulching draft", "draft", "work", 40),
      place("compost", "upload", "work", 50),
      place("workshop draft", "draft", "proof", 45),
      place("herbs", "upload", "work", 30),
      place("seed library", "needs", "work", 5),
      place("to review", "needsReview", "work", 1),
    ]);

    expect(sorted.map((row) => row.name)).toEqual([
      "seed library",
      "to review",
      "compost",
      "herbs",
      "fence proof",
      "mulching draft",
      "workshop draft",
      "edging",
      "mulch log",
    ]);
  });

  it("offers All and only the states the list holds, keeping the one in use", () => {
    const rows = [place("a", "upload", "work", 1), place("b", "draft", "proof", 2)];

    expect(pendingFilterOptions(rows, "all")).toEqual(["all", "upload", "editing"]);
    expect(pendingFilterOptions(rows, "review")).toEqual(["all", "upload", "editing", "review"]);
    expect(filterPendingRows(rows, "editing").map((row) => row.name)).toEqual(["b"]);
  });
});

describe("Pending rows", () => {
  it("says why blocked work can't upload in a few words, and lets it be discarded", () => {
    const row = submissionRow(queuedWork("blocked", "NotActiveAction"), true, context);

    expect(row).toMatchObject({ kind: "needs", discardable: true });
    expect(row.type === "work" && row.card).toMatchObject({
      pill: "Can't upload",
      status: "Action ended",
      statusTone: "error",
    });
  });

  it("never offers to discard work that may already be sent, or that is being prepared online", () => {
    const checking = submissionRow(queuedWork("checking-submission"), true, context);
    expect(checking).toMatchObject({ kind: "checking", discardable: false });
    expect(checking.type === "work" && checking.card.locked).toBe(true);

    expect(submissionRow(queuedWork("preparing"), true, context)).toMatchObject({
      kind: "upload",
      discardable: false,
    });
    expect(
      submissionRow(queuedWork("preparing"), true, { ...context, isOnline: false })
    ).toMatchObject({ kind: "upload", discardable: true });
    expect(submissionRow(queuedWork("reverted"), true, context)).toMatchObject({
      kind: "needs",
      discardable: false,
    });
  });

  it("lists sent work as in review, and a review still on its way as being checked", () => {
    const sent = { ...queuedWork("ready"), id: "0xabc", status: "pending" as const };
    expect(submissionRow(sent, false, context)).toMatchObject({ kind: "review" });

    const decision = decisionRow(
      sent,
      { jobId: "approval-1", status: { state: "sent" }, savedAt: 1 },
      context
    );
    expect(decision).toMatchObject({ kind: "checking", type: "decision" });
  });

  it("sorts a review saved here by when it was saved, not by the work's own date", () => {
    const olderWork = { ...queuedWork("ready"), id: "0xold", createdAt: 1_000 };
    const savedNow = 1_000_000_000_000;
    const review = decisionRow(
      olderWork,
      { jobId: "approval-2", status: { state: "ready" }, savedAt: savedNow },
      context
    );
    expect(review.at).toBe(savedNow);
  });

  it("names proof by its promise and holds it while it sends or is checked", () => {
    const draft = proofRow(proof({ source: "draft", firstPhoto: null }), context);
    expect(draft).toMatchObject({ kind: "draft", source: "proof" });
    expect(draft.type === "proof" && draft.card.status).toBe("2 photos · not added yet");

    const sending = proofRow(proof({ sending: true, discardable: false }), context);
    expect(sending.type === "proof" && sending.card).toMatchObject({
      kind: "upload",
      locked: true,
      status: "Uploading now…",
    });

    const checking = proofRow(proof({ waitingReason: "awaiting-confirmation" }), context);
    expect(checking).toMatchObject({ kind: "checking" });
  });
});
