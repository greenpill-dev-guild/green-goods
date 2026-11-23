import { describe, expect, it } from "vitest";
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
      decision: "accepted" as const,
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
