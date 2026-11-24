import { describe, expect, it, vi } from "vitest";
import { getPromiseDecisions } from "../../../modules/commitment-pooling/data-activity";
import type { GraphQLReader } from "../../../modules/data/graphql-client";
import { deriveHubGardenChanges } from "../../../modules/garden/hub-changes";
import type { EASWorkListRow } from "../../../types/eas-responses";

const me = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const gardener = "0x3333333333333333333333333333333333333333";

const decided = (id: string, by: string, approved: boolean, at: number): EASWorkListRow => ({
  id,
  title: id,
  actionUID: 1,
  gardenerAddress: gardener,
  gardenAddress: "0x4444444444444444444444444444444444444444",
  feedback: "",
  metadata: "{}",
  media: [],
  createdAt: at - 10,
  approval: {
    id: `d-${id}`,
    workUID: id,
    approved,
    createdAt: at,
    stewardAddress: by,
    gardenerAddress: gardener,
    actionUID: 1,
    feedback: "",
    confidence: 0,
    verificationMethod: 0,
    reviewNotesCID: "",
  },
});

const sources = {
  account: me,
  canManageMembers: true,
  canReviewWork: true,
  canDecidePromises: true,
  joinRequests: { waiting: 2, since: 500 },
  roleChanges: [
    {
      id: "r1",
      account: gardener as `0x${string}`,
      role: "gardener" as const,
      kind: "joined" as const,
      at: 300,
    },
    {
      id: "r2",
      account: gardener as `0x${string}`,
      role: "evaluator" as const,
      kind: "granted" as const,
      at: 400,
    },
  ],
  activity: [decided("w-other", other, true, 600), decided("w-mine", me, false, 700)],
  promiseDecisions: [
    {
      id: "p1",
      commitmentId: 9n,
      decision: "canceled" as const,
      by: other as `0x${string}`,
      at: 800,
    },
    {
      id: "p2",
      commitmentId: 9n,
      decision: "confirmed" as const,
      by: me as `0x${string}`,
      at: 900,
    },
  ],
};

describe("the Hub bell's changes", () => {
  it("lists joins, role changes and other stewards' decisions, newest first", () => {
    expect(deriveHubGardenChanges(sources).map((change) => [change.kind, change.at])).toEqual([
      ["promiseDecided", 800],
      ["workDecided", 600],
      ["joinRequested", 500],
      ["roleGranted", 400],
      ["joined", 300],
    ]);
  });

  it("leaves out the account's own decisions, which are not news to it", () => {
    const ids = deriveHubGardenChanges(sources).map((change) => change.id);
    expect(ids).not.toContain("decision:d-w-mine");
    expect(ids).not.toContain("promise:p2");
  });

  it("shows each kind only to someone who can act on it", () => {
    const evaluator = deriveHubGardenChanges({
      ...sources,
      canManageMembers: false,
      canDecidePromises: false,
    });
    expect(evaluator.map((change) => change.kind)).toEqual(["workDecided"]);
    expect(
      deriveHubGardenChanges({
        ...sources,
        canManageMembers: false,
        canReviewWork: false,
        canDecidePromises: false,
      })
    ).toEqual([]);
  });

  it("counts a role given to someone already in the garden as a change, not a new member", () => {
    const changes = deriveHubGardenChanges(sources);
    expect(changes.filter((change) => change.kind === "joined")).toHaveLength(1);
    expect(changes.find((change) => change.kind === "roleGranted")).toMatchObject({
      role: "evaluator",
    });
  });
});

describe("a pool's promise decisions", () => {
  it("reads confirmations and cancellations by the pool's promises, with the steward who decided", async () => {
    const query = vi.fn(async (_document: string, _variables: unknown) => ({
      data: {
        CommitmentEvent: [
          { id: "e2", commitmentId: "9", eventType: "CANCELLED", actor: other, timestamp: 900 },
          {
            id: "e1",
            commitmentId: "9",
            eventType: "CONFIRMATION_RECORDED",
            actor: me,
            timestamp: 800,
          },
        ],
      },
    }));
    const decisions = await getPromiseDecisions(
      { chainId: 42161, commitmentEntityIds: ["42161-9"], since: 100 },
      { query } as unknown as GraphQLReader
    );
    expect(decisions.map(({ decision, at }) => [decision, at])).toEqual([
      ["canceled", 900],
      ["confirmed", 800],
    ]);
    // A decision event carries no pool, so the read names the pool's promises.
    expect(query.mock.calls[0][1]).toMatchObject({ ids: ["42161-9"], since: 100 });
    expect(String(query.mock.calls[0][0])).toContain("CONFIRMATION_RECORDED, CANCELLED");
    // No promises, no read.
    query.mockClear();
    await expect(
      getPromiseDecisions({ chainId: 42161, commitmentEntityIds: [], since: 100 }, {
        query,
      } as unknown as GraphQLReader)
    ).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
