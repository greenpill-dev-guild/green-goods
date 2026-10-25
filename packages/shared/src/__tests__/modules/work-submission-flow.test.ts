import { describe, expect, it } from "vitest";
import { GARDENS_HIDDEN_EVERYWHERE } from "../../config/garden-visibility";
import {
  adjacentWorkSubmissionTab,
  canProceedWithWorkSubmission,
  isSubmissionGardenSettled,
  prepareWorkSubmission,
  resolveSubmissionGarden,
} from "../../modules/work/submission-flow";
import { WorkTab } from "../../stores/workFlowTypes";
import { Domain } from "../../types/domain";

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
