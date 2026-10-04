import { describe, expect, it } from "vitest";
import {
  actionEligibilityIssues,
  ActionSnapshotError,
  parseActionSnapshot,
  serializeActionSnapshot,
  snapshotActionDefinition,
} from "../../../modules/agent-reporting/action-snapshot";
import {
  CanonicalEncodingError,
  canonicalJson,
  reportingDigest,
} from "../../../modules/agent-reporting/canonical";

describe("canonicalJson", () => {
  it("is independent of key order and Unicode composition", () => {
    expect(canonicalJson({ b: 1, a: ["é"] })).toBe(canonicalJson({ a: ["é"], b: 1 }));
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    [undefined],
    () => 1,
  ])("rejects values it cannot represent exactly: %s", (value) => {
    expect(() => canonicalJson(value)).toThrow(CanonicalEncodingError);
  });

  it("separates digest kinds so one digest cannot stand in for another", () => {
    expect(reportingDigest("report-summary", { a: 1 })).not.toBe(
      reportingDigest("review-summary", { a: 1 })
    );
  });
});

const definition = {
  chainId: 42161,
  actionUID: 7,
  slug: "planting",
  title: "Planting",
  startTime: 1_000,
  endTime: 2_000,
  domain: 1,
  inputs: [],
  media: { required: false, minImageCount: 0, maxImageCount: null },
};
const source = {
  registry: "0x00000000000000000000000000000000000000BB" as const,
  instructionsRef: "bafyinstructions",
};

describe("Action definition snapshots", () => {
  it("round-trips through persistence and detects tampering", () => {
    const snapshot = snapshotActionDefinition(definition, source, 100n);
    const stored = serializeActionSnapshot(snapshot);
    expect(parseActionSnapshot(stored)).toEqual(snapshot);
    const tampered = stored.replace('"Planting"', '"Weeding"');
    expect(() => parseActionSnapshot(tampered)).toThrow(ActionSnapshotError);
  });

  it("refuses a definition with no published instructions reference", () => {
    expect(() =>
      snapshotActionDefinition(definition, { ...source, instructionsRef: "" }, 1n)
    ).toThrow(ActionSnapshotError);
  });

  it.each([
    [500, 0b10, ["not_started"]],
    [2_500, 0b10, ["ended"]],
    [1_500, 0b01, ["domain_mismatch"]],
    [1_500, 0b10, []],
  ])("at %i with domain mask %i reports %j", (now, mask, issues) => {
    expect(actionEligibilityIssues(definition, mask, now)).toEqual(issues);
  });
});
