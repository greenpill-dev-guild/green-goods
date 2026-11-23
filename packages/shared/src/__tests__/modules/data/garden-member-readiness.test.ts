import { describe, expect, it, vi } from "vitest";
import type { GraphQLReader } from "../../../modules/data/graphql-client";

const visibility = vi.hoisted(() => ({
  current: {
    chainId: 42161,
    excludedWorkUIDs: [] as string[],
    excludedApprovalUIDs: [] as string[],
  },
}));
vi.mock("../../../modules/work/work-visibility", async (original) => ({
  ...(await original<typeof import("../../../modules/work/work-visibility")>()),
  readWorkVisibility: async () => visibility.current,
}));

const { getGardenMemberReadiness } = await import("../../../modules/data/garden-member-readiness");

const garden = "0x1111111111111111111111111111111111111111";
const sender = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const newcomer = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const chainId = 42161;
const uid = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const workRow = (n: number, at: number, attester = sender) => ({
  id: uid(n),
  attester,
  recipient: garden,
  timeCreated: at,
  decodedDataJson: JSON.stringify([{ name: "title", value: { value: `Work ${n}` } }]),
});
const decisionRow = (n: number, work: number, at: number, approved: boolean) => ({
  id: uid(n),
  attester: "0xcccccccccccccccccccccccccccccccccccccccc",
  recipient: garden,
  timeCreated: at,
  decodedDataJson: JSON.stringify([
    { name: "workUID", value: { value: uid(work) } },
    { name: "approved", value: { value: approved } },
  ]),
});

/** A reader that answers the works query per account and the decision lookup. */
function reader({
  works,
  decisions = [],
  decisionsFail = false,
}: {
  works: Record<string, unknown[]>;
  decisions?: unknown[];
  decisionsFail?: boolean;
}) {
  const query = vi.fn(async (_document: unknown, variables: Record<string, any>, operation) => {
    if (operation === "getMemberReadinessWorks") {
      const rows = works[variables.where.attester.equals.toLowerCase()] ?? [];
      return {
        data: { attestations: rows.slice(variables.skip, variables.skip + variables.take) },
      };
    }
    if (decisionsFail) return { error: new Error("provider limit") };
    return { data: { attestations: variables.skip ? [] : decisions } };
  });
  return { query } as unknown as GraphQLReader;
}

const scope = { garden, accounts: [sender, newcomer], chainId } as const;

describe("getGardenMemberReadiness", () => {
  it("reads joined only, work sent and work approved from the garden's own records", async () => {
    const readiness = await getGardenMemberReadiness(
      scope,
      reader({
        works: { [sender]: [workRow(1, 1_000), workRow(2, 2_000)] },
        // A rejection does not count; the first approval does.
        decisions: [decisionRow(10, 1, 1_500, false), decisionRow(11, 2, 2_500, true)],
      })
    );
    expect(readiness[sender]).toEqual({
      status: "read",
      stage: "contributing",
      firstSentAt: 1_000_000,
      firstApprovedAt: 2_500_000,
    });
    expect(readiness[newcomer]).toEqual({
      status: "read",
      stage: "registered",
      firstSentAt: null,
      firstApprovedAt: null,
    });
  });

  it("counts sent work with no approval as getting started, leaving hidden decisions out", async () => {
    visibility.current = { ...visibility.current, excludedApprovalUIDs: [uid(11)] };
    const readiness = await getGardenMemberReadiness(
      { ...scope, accounts: [sender] },
      reader({
        works: { [sender]: [workRow(1, 1_000)] },
        decisions: [decisionRow(11, 1, 1_200, true)],
      })
    );
    visibility.current = { ...visibility.current, excludedApprovalUIDs: [] };
    expect(readiness[sender]).toMatchObject({ stage: "gettingStarted", firstApprovedAt: null });
  });

  it("counts a work by the decision that stands, so a reversed approval does not count", async () => {
    const readiness = await getGardenMemberReadiness(
      { ...scope, accounts: [sender] },
      reader({
        works: { [sender]: [workRow(1, 1_000)] },
        decisions: [decisionRow(10, 1, 1_500, true), decisionRow(11, 1, 1_600, false)],
      })
    );
    expect(readiness[sender]).toMatchObject({ stage: "gettingStarted", firstApprovedAt: null });
  });

  it("reads a member as unavailable when a decision row on their work could not be read", async () => {
    // The unreadable row could reverse the approval that was read.
    const readiness = await getGardenMemberReadiness(
      { ...scope, accounts: [sender] },
      reader({
        works: { [sender]: [workRow(1, 1_000)] },
        decisions: [decisionRow(10, 1, 1_500, true), { id: uid(12) }],
      })
    );
    expect(readiness[sender]).toEqual({ status: "unavailable" });
  });

  it("reads a member as unavailable when the decisions on their work could not be read", async () => {
    const failed = await getGardenMemberReadiness(
      { ...scope, accounts: [sender] },
      reader({ works: { [sender]: [workRow(1, 1_000)] }, decisionsFail: true })
    );
    expect(failed[sender]).toEqual({ status: "unavailable" });
  });

  it("reads a member as unavailable when one of their works is malformed", async () => {
    const malformed = await getGardenMemberReadiness(
      { ...scope, accounts: [sender] },
      reader({ works: { [sender]: [workRow(1, 1_000), { id: uid(2) }] } })
    );
    expect(malformed[sender]).toEqual({ status: "unavailable" });
  });
});
