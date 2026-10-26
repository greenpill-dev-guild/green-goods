import { describe, expect, it } from "vitest";
import { GARDENS_HIDDEN_EVERYWHERE } from "../../config/garden-visibility";
import type {
  WorkablePromise,
  WorkLinkChoice,
} from "../../modules/commitment-pooling/work-link-intent";
import {
  adjacentWorkSubmissionTab,
  answerStartStep,
  canProceedWithWorkSubmission,
  gardenActionDomains,
  isSubmissionGardenSettled,
  listGardenActions,
  listStartPromises,
  prepareWorkSubmission,
  resolveSubmissionGarden,
  startPromiseKind,
} from "../../modules/work/submission-flow";
import { WorkTab } from "../../stores/workFlowTypes";
import { type Action, Domain } from "../../types/domain";

const ACTIVE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const NAVIGATION = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const DRAFT = "0xcccccccccccccccccccccccccccccccccccccccc";
const PROMISE = "0xdddddddddddddddddddddddddddddddddddddddd";
const nothingNamed = {
  current: null,
  promise: null,
  hasDraft: false,
  navigation: null,
  active: null,
};

const base = {
  gardenAddress: "0xgarden",
  gardenSettled: true,
  actionUID: 1,
  imageCount: 1,
  minRequired: 1,
  isValid: true,
  isSubmitting: false,
  isMutationPending: false,
};

describe("work submission flow", () => {
  it("owns tab order and boundary behavior", () => {
    expect(adjacentWorkSubmissionTab(WorkTab.Intro, "previous")).toBe(WorkTab.Intro);
    expect(adjacentWorkSubmissionTab(WorkTab.Intro, "next")).toBe(WorkTab.Media);
    expect(adjacentWorkSubmissionTab(WorkTab.Review, "next")).toBe(WorkTab.Review);
  });

  it("evaluates each tab's progress gate", () => {
    expect(canProceedWithWorkSubmission({ ...base, tab: WorkTab.Intro })).toBe(true);
    expect(canProceedWithWorkSubmission({ ...base, tab: WorkTab.Media, imageCount: 0 })).toBe(
      false
    );
    expect(canProceedWithWorkSubmission({ ...base, tab: WorkTab.Details, isValid: false })).toBe(
      false
    );
    expect(
      canProceedWithWorkSubmission({ ...base, tab: WorkTab.Review, isMutationPending: true })
    ).toBe(false);
  });

  it("keeps the garden step closed while the chosen garden is hidden everywhere", () => {
    const gardenAddress = GARDENS_HIDDEN_EVERYWHERE[0].address;
    expect(canProceedWithWorkSubmission({ ...base, tab: WorkTab.Intro, gardenAddress })).toBe(
      false
    );
  });

  it("keeps the garden step closed while the chosen garden cannot take the work", () => {
    // The picker reopens, so Start waits for one of the gardens it offers.
    expect(
      canProceedWithWorkSubmission({ ...base, tab: WorkTab.Intro, gardenSettled: false })
    ).toBe(false);
  });

  it.each([
    ["the active garden fills a flow nothing else named", { active: ACTIVE }, ACTIVE],
    [
      "navigation state comes before the active garden",
      { navigation: NAVIGATION, active: ACTIVE },
      NAVIGATION,
    ],
    [
      "a resumed draft keeps its own garden",
      { current: DRAFT, hasDraft: true, navigation: NAVIGATION, active: ACTIVE },
      DRAFT,
    ],
    [
      // A draft whose garden was curated away resumes without one, so the member chooses again.
      "a draft without a garden waits for the member's choice, not navigation state",
      { hasDraft: true, navigation: NAVIGATION, active: ACTIVE },
      null,
    ],
    [
      "a draft without a garden waits for the member's choice, not the active garden",
      { hasDraft: true, active: ACTIVE },
      null,
    ],
    [
      "a promise link names its own garden over a draft's",
      {
        current: DRAFT,
        hasDraft: true,
        promise: { garden: PROMISE },
        navigation: NAVIGATION,
        active: ACTIVE,
      },
      PROMISE,
    ],
    [
      "a promise still being checked keeps the flow's garden, never the active one",
      { promise: { garden: null }, navigation: NAVIGATION, active: ACTIVE },
      null,
    ],
    [
      "a promise still being checked keeps a draft's garden",
      { current: DRAFT, hasDraft: true, promise: { garden: null }, active: ACTIVE },
      DRAFT,
    ],
    [
      "until the work has a draft, an earlier garden gives way to the active one",
      { current: NAVIGATION, active: ACTIVE },
      ACTIVE,
    ],
    ["with no source to follow, the member's own pick stays", { current: DRAFT }, DRAFT],
  ] as const)("chooses the submission garden: %s", (_case, sources, garden) => {
    expect(resolveSubmissionGarden({ ...nothingNamed, ...sources })).toBe(garden);
  });

  it.each([
    ["one of the member's gardens before an action is chosen", ACTIVE, null, true],
    [
      "the same garden written in another case",
      ACTIVE.toUpperCase().replace("0X", "0x"),
      null,
      true,
    ],
    ["a garden the member cannot submit work to", PROMISE, null, false],
    ["no garden yet", null, null, false],
    ["a garden whose domains include the action's", ACTIVE, { domain: Domain.SOLAR }, true],
    ["a garden whose domains leave the action out", ACTIVE, { domain: Domain.AGRO }, false],
    ["a garden with no domains set", NAVIGATION, { domain: Domain.AGRO }, true],
    ["an action whose domain this client does not know", ACTIVE, { domain: null }, true],
  ] as const)("settles the garden question for %s", (_case, gardenAddress, action, settled) => {
    const gardens = [
      { id: ACTIVE, domainMask: 1 << Domain.SOLAR },
      { id: NAVIGATION, domainMask: 0 },
    ];
    expect(isSubmissionGardenSettled({ gardenAddress, gardens, action })).toBe(settled);
  });

  it("normalizes submission media through the shared media contract", async () => {
    const photo = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    const result = await prepareWorkSubmission([photo]);

    expect(result.accepted.map((item) => item.file)).toEqual([photo]);
    expect(result.rejected).toEqual([]);
  });
});

const NOW = Date.UTC(2026, 9, 25);
const DAY = 86_400_000;

function startAction(uid: number, domain: Domain | null, overrides: Partial<Action> = {}): Action {
  return {
    id: `42161-${uid}`,
    slug: `action-${uid}`,
    title: `Action ${uid}`,
    startTime: NOW - DAY,
    endTime: NOW + DAY,
    capitals: [],
    media: [],
    domain,
    createdAt: NOW - DAY,
    description: "",
    inputs: [],
    ...overrides,
  };
}

function linkChoice(actionUID: number, requirementIndex: number, done = 0, total = 4) {
  return {
    commitmentId: 9n,
    requirementIndex,
    actionUID,
    garden: ACTIVE,
    commitmentTitle: "Workshop photos",
    requirementLabel: String(requirementIndex + 1),
    returnTo: `/home/${ACTIVE}/commitments/9`,
    approvedCount: done,
    requiredCount: total,
  } satisfies WorkLinkChoice;
}

function workable(
  choices: readonly WorkLinkChoice[],
  takesEvidence: boolean,
  commitmentId = 9n
): WorkablePromise {
  return {
    commitmentId,
    title: "Workshop photos",
    direction: "REQUEST",
    state: "ACTIVE",
    dueDate: null,
    targetUnits: 0n,
    unitLabel: null,
    choices,
    takesEvidence,
  };
}

/** A step with nothing yet to decide: the garden settled, no link, nothing owed. */
const quietStep = {
  link: { status: "none", atEntry: false },
  gardenSettled: true,
  promises: { status: "ready", count: 0 },
  openAsks: 0,
  actionUIDs: [7, 8],
} as const;

describe("the Start step (DL-131)", () => {
  it("offers the garden's live actions in its domains, and any of a domain the app does not know", () => {
    const actions = [
      startAction(1, Domain.SOLAR),
      startAction(2, Domain.AGRO),
      startAction(3, null),
      startAction(4, Domain.SOLAR, { endTime: NOW - 1 }),
      startAction(5, Domain.SOLAR, { id: "" }),
    ];
    const listed = (domainMask?: number) =>
      listGardenActions(actions, { domainMask }, NOW).map((action) => action.id);

    expect(listed(1 << Domain.SOLAR)).toEqual(["42161-1", "42161-3"]);
    // A garden with no domains set takes every live action.
    expect(listed(0)).toEqual(["42161-1", "42161-2", "42161-3"]);
    expect(listed(undefined)).toEqual(["42161-1", "42161-2", "42161-3"]);
  });

  it("draws the domain chips from the garden's domains, else from its actions' own", () => {
    const actions = [
      startAction(1, Domain.WASTE),
      startAction(2, Domain.SOLAR),
      startAction(3, null),
    ];
    expect(
      gardenActionDomains({ domainMask: (1 << Domain.EDU) | (1 << Domain.SOLAR) }, actions)
    ).toEqual([Domain.SOLAR, Domain.EDU]);
    expect(gardenActionDomains({ domainMask: 0 }, actions)).toEqual([Domain.SOLAR, Domain.WASTE]);
  });

  it.each([
    [
      "a promise link the page opened with goes straight to Media once it is confirmed",
      { link: { status: "valid", atEntry: true }, actionUIDs: [7] },
      { kind: "skip", actionUID: null },
    ],
    [
      "a promise link still being checked waits for its answer",
      { link: { status: "validating", atEntry: true } },
      { kind: "wait" },
    ],
    [
      "a promise link that no longer holds stays, so the step can say so",
      { link: { status: "invalid", atEntry: true }, actionUIDs: [7] },
      { kind: "stay" },
    ],
    [
      "a promise chosen at Start never skips back over the step it was chosen on",
      { link: { status: "valid", atEntry: false } },
      { kind: "stay" },
    ],
    [
      "one action with nothing owed and no Open ask goes to Media with that action",
      { actionUIDs: [7] },
      { kind: "skip", actionUID: 7 },
    ],
    [
      "the same garden with an Open ask listed stays, since there is a choice to make",
      { actionUIDs: [7], openAsks: 1 },
      { kind: "stay" },
    ],
    [
      "a promise the member owes keeps the step",
      { actionUIDs: [7], promises: { status: "ready", count: 1 } },
      { kind: "stay" },
    ],
    ["several actions keep the step", {}, { kind: "stay" }],
    [
      "while the member's promises are read the step waits rather than jump",
      { actionUIDs: [7], promises: { status: "loading" } },
      { kind: "wait" },
    ],
    [
      "promises that could not be read keep the step, never assumed none",
      { actionUIDs: [7], promises: { status: "unknown" } },
      { kind: "stay" },
    ],
    [
      "a garden still to choose keeps the step, link or not",
      { gardenSettled: false, link: { status: "valid", atEntry: true }, actionUIDs: [7] },
      { kind: "stay" },
    ],
    ["a garden with no live action keeps the step", { actionUIDs: [] }, { kind: "stay" }],
    [
      "while the garden's actions are read the step waits, even with nothing owed",
      { actionUIDs: null },
      { kind: "wait" },
    ],
  ] as const)("answers the Start step: %s", (_case, input, answer) => {
    expect(answerStartStep({ ...quietStep, ...input })).toEqual(answer);
  });

  it("lists the promises the member can do here, one choice per action, and names each one's kind", () => {
    const listed = listStartPromises(
      [
        // The second requirement of action 7 is the open one; action 9 is not in this garden.
        workable([linkChoice(7, 0, 4, 4), linkChoice(7, 1, 1, 4), linkChoice(9, 2)], false, 1n),
        workable([linkChoice(9, 0)], false, 2n),
        workable([linkChoice(9, 0)], true, 3n),
        workable([linkChoice(8, 0)], true, 4n),
      ],
      new Set([7, 8])
    );

    expect(listed.map((promise) => promise.commitmentId)).toEqual([1n, 3n, 4n]);
    expect(listed[0].choices.map((choice) => choice.requirementIndex)).toEqual([1]);
    expect(listed.map(startPromiseKind)).toEqual(["actions", "evidence", "both"]);
    expect(startPromiseKind(workable([], false))).toBeNull();
  });
});
