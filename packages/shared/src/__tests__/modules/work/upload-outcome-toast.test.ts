/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import en from "../../../i18n/en.json";
import { uploadOutcomeToast } from "../../../modules/work/upload-outcome-toast";
import type { UploadOutcome } from "../../../modules/work/upload-queued-work";

type Toast = NonNullable<ReturnType<typeof uploadOutcomeToast>>;
const stopped = new Error("Max retries (5) exceeded");
const m = (key: string, count?: number) => ({
  id: `app.uploads.${key}`,
  ...(count === undefined ? {} : { values: { count } }),
});
const toast = (tone: Toast["tone"], title: Toast["title"], message: Toast["message"]) => ({
  tone,
  title,
  message,
});

const CASES: Array<[string, UploadOutcome, Toast | undefined]> = [
  [
    "says how many items went",
    { status: "uploaded", sent: 2, flagged: 0 },
    toast("success", m("uploadedTitle", 2), m("uploadedMessage")),
  ],
  [
    "names what still needs attention after an upload",
    { status: "uploaded", sent: 1, flagged: 1 },
    toast("success", m("uploadedTitle", 1), m("flaggedMessage", 1)),
  ],
  [
    "never denies a send that went before the upload stopped",
    { status: "failed", sent: 2, flagged: 0, error: stopped },
    { ...toast("error", m("failedTitle"), m("partlySentMessage", 2)), error: stopped },
  ],
  [
    "says nothing was sent when an upload stops before anything goes",
    { status: "failed", sent: 0, flagged: 0, error: stopped },
    { ...toast("error", m("failedTitle"), m("failedMessage")), error: stopped },
  ],
  [
    "never calls an upload of nothing a success: every ready item was refused",
    { status: "nothing-sent", flagged: 1 },
    toast("info", m("notUploadedTitle"), m("flaggedMessage", 1)),
  ],
  [
    "never calls an upload of nothing a success: every ready item is held elsewhere",
    { status: "nothing-sent", flagged: 0 },
    toast("info", m("notUploadedTitle"), m("nothingSentMessage")),
  ],
  [
    "confirms what already went when a later prompt in a long queue is declined",
    { status: "declined", sent: 5, flagged: 0 },
    toast("success", m("uploadedTitle", 5), m("restWaitingMessage")),
  ],
  ["stays quiet when the person declines", { status: "declined", sent: 0, flagged: 0 }, undefined],
  [
    "says items are still being prepared when the tap finds nothing ready",
    { status: "nothing-ready" },
    toast("info", m("notUploadedTitle"), m("nothingReady")),
  ],
  [
    "says a reverted upload recorded nothing, even when it flagged an item",
    { status: "reverted", sent: 0, flagged: 1 },
    toast("error", m("revertedTitle"), m("revertedMessage")),
  ],
  [
    "keeps what an earlier call sent when a later one reverts",
    { status: "reverted", sent: 5, flagged: 0 },
    toast("error", m("revertedTitle"), m("partlySentMessage", 5)),
  ],
  [
    "says a send whose answer was lost is being checked, not that it failed",
    { status: "send-unconfirmed", sent: 0, flagged: 0 },
    toast("info", m("sendUnconfirmedTitle"), m("sendUnconfirmedMessage")),
  ],
  [
    "says nothing was uploaded on an unstable connection",
    { status: "connection-unconfirmed" },
    toast("info", { id: "app.offline.degraded" }, m("connectionUnconfirmed")),
  ],
];

describe("what the person is told after an Upload all tap", () => {
  it.each(CASES)("%s", (_name, outcome, expected) => {
    expect(uploadOutcomeToast(outcome)).toEqual(expected);
  });

  it("only names messages that exist", () => {
    const ids = CASES.flatMap(([, , expected]) =>
      expected ? [expected.title.id, expected.message.id] : []
    );
    expect(ids.filter((id) => !(id in en))).toEqual([]);
  });
});
