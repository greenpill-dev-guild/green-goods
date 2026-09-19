import en from "@green-goods/shared/i18n/en";
import { describe, expect, it } from "vitest";
import {
  blockedReasonMessage,
  queuedWorkDetailMessage,
  queuedWorkExplanation,
  queuedWorkStatusMessage,
  readQueuedWorkState,
} from "../../components/Cards/Work/queuedWorkCopy";

const messages = en as Record<string, string>;
const textOf = (descriptor: { id?: string } | undefined) =>
  descriptor?.id ? messages[descriptor.id] : undefined;

describe("readQueuedWorkState", () => {
  it("reads the state and the reason a queued work records", () => {
    expect(
      readQueuedWorkState(
        JSON.stringify({ submissionState: "blocked", blockedReason: "NotActiveAction" })
      )
    ).toEqual({ submissionState: "blocked", blockedReason: "NotActiveAction" });
  });

  it.each([
    "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    "null",
    "7",
    "",
    undefined,
  ])("reads nothing from metadata without a state: %s", (metadata) => {
    expect(readQueuedWorkState(metadata)).toEqual({});
  });

  it("ignores fields that are not text", () => {
    expect(readQueuedWorkState(JSON.stringify({ submissionState: 3, blockedReason: {} }))).toEqual({
      submissionState: undefined,
      blockedReason: undefined,
    });
  });
});

describe("queuedWorkStatusMessage", () => {
  it.each([
    ["ready", "To upload"],
    ["preparing", "To upload"],
    ["photo-pending", "To upload"],
    ["blocked", "Blocked"],
    ["photo-needs-attention", "Blocked"],
    ["awaiting-confirmation", "Awaiting confirmation"],
    ["checking-submission", "Checking whether this work was sent"],
  ])("names %s work on its chip", (state, text) => {
    expect(textOf(queuedWorkStatusMessage(state))).toBe(text);
  });

  it("leaves the chip to the work status for other states", () => {
    expect(queuedWorkStatusMessage("retry-required")).toBeUndefined();
    expect(queuedWorkStatusMessage(undefined)).toBeUndefined();
  });
});

describe("queuedWorkDetailMessage", () => {
  it.each([
    ["preparing", "Preparing to upload"],
    ["photo-pending", "A photo is still converting"],
    ["photo-needs-attention", "A photo couldn't be converted"],
  ])("says what %s work waits for", (submissionState, text) => {
    expect(textOf(queuedWorkDetailMessage({ submissionState }))).toBe(text);
  });

  it("says why the chain would refuse blocked work", () => {
    expect(
      textOf(
        queuedWorkDetailMessage({ submissionState: "blocked", blockedReason: "ActionExpired" })
      )
    ).toBe("Can't upload: this action has ended");
  });

  it.each([
    "ready",
    "awaiting-confirmation",
    "checking-submission",
    "queued",
    undefined,
  ])("adds no line the chip already says: %s", (submissionState) => {
    expect(queuedWorkDetailMessage({ submissionState })).toBeUndefined();
  });

  it.each([
    "reverted",
    "sending",
    "retry-required",
  ])("keeps the existing line for %s work", (submissionState) => {
    expect(textOf(queuedWorkDetailMessage({ submissionState }))).toBeTruthy();
  });
});

describe("blockedReasonMessage", () => {
  it.each([
    ["NotGardenMember", "Can't upload: you're not a member of this garden"],
    ["NotGardenOperator", "Can't upload: you're not a steward of this garden"],
    ["NotActiveAction", "Can't upload: this action has ended"],
    ["ActionExpired", "Can't upload: this action has ended"],
    ["NotInActionRegistry", "Can't upload: this action no longer exists"],
    ["ActionDomainMismatch", "Can't upload: this garden doesn't offer this action"],
    ["NotInWorkRegistry", "Can't upload: this work isn't on the garden record"],
    ["SelfAttestation", "Can't upload: you can't review your own work"],
    // Upload all's own mark for a batch the chain reverted with no single item
    // to blame. Saying the record won't accept it would contradict the per-item
    // check that just passed.
    [
      "reverted",
      "This upload didn't go through. Your media is saved; try again when you're ready.",
    ],
  ])("explains %s", (reason, text) => {
    expect(textOf(blockedReasonMessage(reason))).toBe(text);
  });

  it.each([
    "unknown",
    "MetadataRequired",
    "constructor",
    "__proto__",
    undefined,
  ])("falls back to a refusal for %s", (reason) => {
    expect(textOf(blockedReasonMessage(reason))).toBe(
      "Can't upload: the garden record won't accept it"
    );
  });
});

describe("queuedWorkExplanation", () => {
  const online = { isOnline: true };

  it.each([
    ["ready", "Saved on your device. Upload it from Your Work."],
    ["preparing", "Preparing to upload"],
    ["photo-pending", "A photo is still converting"],
    ["photo-needs-attention", "A photo couldn't be converted"],
    ["retry-required", "Your media stays saved. Choose Upload now when you’re ready to try again."],
    [
      "reverted",
      "This upload didn't go through. Your media is saved; try again when you're ready.",
    ],
    ["awaiting-confirmation", messages["app.work.confirmationExplanation"]],
    ["checking-submission", messages["app.work.checkingSubmissionInfo"]],
    ["sending", "Uploading to the garden record..."],
    [undefined, "Saved on your device. Upload it from Your Work."],
  ])("has one sentence for %s work", (submissionState, text) => {
    expect(textOf(queuedWorkExplanation({ submissionState }, online))).toBe(text);
  });

  it("says why refused work cannot go, instead of telling the person to upload it", () => {
    expect(
      textOf(
        queuedWorkExplanation(
          { submissionState: "blocked", blockedReason: "NotActiveAction" },
          online
        )
      )
    ).toBe("Can't upload: this action has ended");
  });

  it("never says work is uploading while the device is offline", () => {
    expect(textOf(queuedWorkExplanation({ submissionState: "sending" }, { isOnline: false }))).toBe(
      "Saved on your device. Upload it from Your Work."
    );
  });

  it("says a failed upload can be tried again, whatever the queue last recorded", () => {
    expect(
      textOf(
        queuedWorkExplanation({ submissionState: "ready" }, { isOnline: true, sendFailed: true })
      )
    ).toBe("Your media stays saved. Choose Upload now when you’re ready to try again.");
  });

  it("carries an English default for every sentence, so none can render empty", () => {
    for (const submissionState of [
      "ready",
      "preparing",
      "photo-pending",
      "photo-needs-attention",
      "blocked",
      "retry-required",
      "reverted",
      "awaiting-confirmation",
      "checking-submission",
      "sending",
    ])
      expect(queuedWorkExplanation({ submissionState }, online).defaultMessage).toBeTruthy();
  });
});
