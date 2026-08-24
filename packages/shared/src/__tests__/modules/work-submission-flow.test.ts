import { describe, expect, it } from "vitest";
import {
  adjacentWorkSubmissionTab,
  canProceedWithWorkSubmission,
  prepareWorkSubmission,
} from "../../modules/work/submission-flow";
import { WorkTab } from "../../stores/workFlowTypes";

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

  it("normalizes submission media through the shared media contract", async () => {
    const photo = new File(["jpeg"], "photo.jpg", { type: "image/jpeg" });
    const result = await prepareWorkSubmission([photo]);

    expect(result.accepted.map((item) => item.file)).toEqual([photo]);
    expect(result.rejected).toEqual([]);
  });
});
