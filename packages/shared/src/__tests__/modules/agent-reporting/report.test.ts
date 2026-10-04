import { describe, expect, it } from "vitest";
import { snapshotActionDefinition } from "../../../modules/agent-reporting/action-snapshot";
import {
  applyReportChanges,
  emptyReport,
  type FieldChange,
  type FieldProvenance,
  reconcileDetailsWithAction,
  type ReportContent,
  withEvidence,
} from "../../../modules/agent-reporting/report";
import {
  buildReportSummary,
  outstandingRequirements,
  reportQuestionPosition,
  ReportNotReadyError,
  reportSummaryDigest,
} from "../../../modules/agent-reporting/report-summary";

const GARDEN = { chainId: 42161, address: "0x00000000000000000000000000000000000000aa" } as const;

const snapshot = snapshotActionDefinition(
  {
    chainId: 42161,
    actionUID: 7,
    slug: "planting",
    title: "Planting",
    startTime: 0,
    endTime: Number.MAX_SAFE_INTEGER,
    domain: 1,
    inputs: [
      {
        key: "seedlings",
        title: "Seedlings",
        placeholder: "",
        type: "number",
        required: true,
        options: [],
        unit: "seedlings",
      },
      { key: "notes", title: "Notes", placeholder: "", type: "text", required: false, options: [] },
    ],
    media: { required: true, minImageCount: 1, maxImageCount: 3 },
  },
  { registry: "0x00000000000000000000000000000000000000bb", instructionsRef: "bafyinstructions" },
  100n
);

const gardener = (sourceEntryId = "s1"): FieldProvenance => ({
  kind: "reported",
  origin: "gardener",
  sources: [{ sourceEntryId }],
  gardenerStated: true,
});
const model = (kind: FieldProvenance["kind"] = "reported"): FieldProvenance => ({
  kind,
  origin: "model",
  sources: [{ sourceEntryId: "s1" }],
  model: "fixture",
  gardenerStated: false,
});
const change = (
  field: FieldChange["field"],
  value: unknown,
  provenance: FieldProvenance
): FieldChange => ({
  field,
  value,
  provenance,
});

function readyReport(): ReportContent {
  return applyReportChanges(
    { ...emptyReport(), evidence: [{ assetId: "a1", sanitizedDigest: "d1", mime: "image/jpeg" }] },
    [
      change("garden", GARDEN, gardener()),
      change("action", 7, gardener()),
      change("details.seedlings", 12, gardener()),
      change("timeSpentMinutes", 90, gardener()),
      change("title", "Planting", { ...model(), origin: "system", kind: "computed" }),
      change("feedback", "Planted along the fence", gardener()),
    ],
    snapshot
  ).content;
}

describe("applyReportChanges", () => {
  it("never lets a model proposal overwrite a value the gardener stated", () => {
    const stated = applyReportChanges(
      emptyReport(),
      [change("timeSpentMinutes", 90, gardener())],
      snapshot
    ).content;
    const outcome = applyReportChanges(
      stated,
      [change("timeSpentMinutes", 120, model())],
      snapshot
    );
    expect(outcome.content.timeSpentMinutes).toBe(90);
    expect(outcome.conflicts).toHaveLength(1);
    expect(outstandingRequirements(outcome.content, snapshot)[0]).toEqual({
      kind: "conflict",
      field: "timeSpentMinutes",
    });
  });

  it("lets the gardener's correction win and settles the recorded conflict", () => {
    const conflicted = applyReportChanges(
      applyReportChanges(emptyReport(), [change("timeSpentMinutes", 90, gardener())], snapshot)
        .content,
      [change("timeSpentMinutes", 120, model())],
      snapshot
    ).content;
    const corrected = applyReportChanges(
      conflicted,
      [change("timeSpentMinutes", 150, gardener("s2"))],
      snapshot
    );
    expect(corrected.content.timeSpentMinutes).toBe(150);
    expect(corrected.content.conflicts).toEqual([]);
  });

  it("rejects details until the Action and its snapshot are established", () => {
    const outcome = applyReportChanges(
      emptyReport(),
      [change("details.seedlings", 12, gardener())],
      snapshot
    );
    expect(outcome.rejected).toEqual([
      { field: "details.seedlings", reason: "action_not_confirmed" },
    ]);
  });

  it.each([
    ["details.seedlings", "12", "invalid_value"],
    ["details.unknown", 1, "unknown_field"],
    ["timeSpentMinutes", 90.5, "invalid_value"],
    ["garden", { chainId: 42161, address: "not-an-address" }, "invalid_value"],
  ] as const)("rejects %s = %j as %s", (field, value, reason) => {
    const base = applyReportChanges(
      emptyReport(),
      [change("garden", GARDEN, gardener()), change("action", 7, gardener())],
      snapshot
    ).content;
    expect(applyReportChanges(base, [change(field, value, gardener())], snapshot).rejected).toEqual(
      [{ field, reason }]
    );
  });

  it("clears the Action when the garden changes, because Actions are garden-scoped", () => {
    const other = { chainId: 42161, address: "0x00000000000000000000000000000000000000cc" };
    const next = applyReportChanges(
      readyReport(),
      [change("garden", other, gardener("s3"))],
      snapshot
    ).content;
    expect(next.actionUID).toBeNull();
    expect(next.provenance.action).toBeUndefined();
  });

  it("drops details a newly adopted Action does not define", () => {
    const content = { ...readyReport(), details: { seedlings: 12, legacy: "x" } };
    expect(reconcileDetailsWithAction(content, snapshot).dropped).toEqual(["legacy"]);
  });
});

describe("withEvidence", () => {
  it("adds each sanitized image once, keyed by its digest", () => {
    const photo = { assetId: "asset-1", sanitizedDigest: "digest-1", mime: "image/jpeg" as const };
    const once = withEvidence(emptyReport(), photo);
    expect(once.evidence).toEqual([photo]);
    expect(withEvidence(once, { ...photo, assetId: "asset-2" })).toBe(once);
  });
});

describe("reportQuestionPosition", () => {
  it("keeps required field positions stable as a report is answered", () => {
    const empty = emptyReport();
    expect(reportQuestionPosition(empty, snapshot, { kind: "detail", key: "seedlings" })).toEqual({
      position: 1,
      total: 5,
    });
    expect(
      reportQuestionPosition(readyReport(), snapshot, { kind: "evidence", minimum: 1, have: 0 })
    ).toEqual({ position: 5, total: 5 });
    expect(reportQuestionPosition(empty, snapshot, { kind: "garden" })).toBeNull();
    expect(
      reportQuestionPosition(empty, snapshot, { kind: "conflict", field: "title" })
    ).toBeNull();
  });
});

describe("outstandingRequirements", () => {
  it("does not accept time spent read from a photograph", () => {
    const observed = applyReportChanges(
      readyReport(),
      [change("timeSpentMinutes", null, gardener())],
      snapshot
    ).content;
    const guessed = applyReportChanges(
      observed,
      [change("timeSpentMinutes", 60, model("observed"))],
      snapshot
    ).content;
    expect(outstandingRequirements(guessed, snapshot)).toEqual([{ kind: "time" }]);
  });

  it("orders a story-only draft garden, Action, time, title, feedback", () => {
    expect(outstandingRequirements(emptyReport(), null).map((r) => r.kind)).toEqual([
      "garden",
      "action",
      "time",
      "title",
      "feedback",
    ]);
  });

  it("refuses a required repeater honestly and enforces the evidence bounds", () => {
    const repeaterSnapshot = snapshotActionDefinition(
      {
        ...snapshot.definition,
        inputs: [
          {
            key: "crew",
            title: "Crew",
            placeholder: "",
            type: "repeater",
            required: true,
            options: [],
          },
        ],
      },
      snapshot.source,
      100n
    );
    const content = { ...readyReport(), details: {}, evidence: [] };
    expect(outstandingRequirements(content, repeaterSnapshot)).toEqual([
      { kind: "unsupported_input", key: "crew" },
      { kind: "evidence", minimum: 1, have: 0 },
    ]);
  });
});

describe("buildReportSummary", () => {
  it("binds revision, content, Action definition and account into one digest", () => {
    const content = readyReport();
    const base = buildReportSummary({
      draftId: "d1",
      revision: 3,
      content,
      snapshot,
      account: null,
    });
    const digest = reportSummaryDigest(base);
    expect(base.actionDefinitionDigest).toBe(snapshot.digest);
    expect(reportSummaryDigest({ ...base, revision: 4 })).not.toBe(digest);
    expect(
      reportSummaryDigest(
        buildReportSummary({
          draftId: "d1",
          revision: 3,
          content,
          snapshot,
          account: "0x00000000000000000000000000000000000000dd",
        })
      )
    ).not.toBe(digest);
  });

  it("refuses to summarize an incomplete report", () => {
    expect(() =>
      buildReportSummary({
        draftId: "d1",
        revision: 1,
        content: emptyReport(),
        snapshot,
        account: null,
      })
    ).toThrow(ReportNotReadyError);
  });
});
