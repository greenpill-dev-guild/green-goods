import en from "@green-goods/shared/i18n/en";
import { describe, expect, it } from "vitest";
import {
  blockedReasonMessage,
  queuedWorkDetailMessage,
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
    ["ready", "Waiting to upload"],
    ["preparing", "Waiting to upload"],
    ["photo-pending", "Waiting to upload"],
    ["blocked", "Needs attention"],
    ["photo-needs-attention", "Needs attention"],
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
  ])("explains %s", (reason, text) => {
    expect(textOf(blockedReasonMessage(reason))).toBe(text);
  });

  it.each([
    "reverted",
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
