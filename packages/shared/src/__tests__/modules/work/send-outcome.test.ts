/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { WorkSendCancelledError, classifySendFailure } from "../../../modules/work/send-outcome";
import { isWorkSubmissionCancelled } from "../../../modules/work/work-confirmation";

const declinedPasskey = () =>
  new DOMException("The operation either timed out or was not allowed.", "NotAllowedError");
const rejectedInWallet = () =>
  Object.assign(new Error("User rejected the request."), { code: 4001 });
const bundlerRejection = () =>
  Object.assign(new Error("UserOperation reverted during simulation"), {
    name: "UserOperationExecutionError",
    cause: Object.assign(new Error("AA21 didn't pay prefund"), {
      name: "RpcRequestError",
      code: -32500,
    }),
  });
const lostResponse = () =>
  Object.assign(new Error("The request took too long"), { name: "TimeoutError" });

describe("what a failed send means for the work it carried", () => {
  it("recognises a declined passkey prompt as a cancellation", () => {
    expect(isWorkSubmissionCancelled(declinedPasskey())).toBe(true);
    expect(isWorkSubmissionCancelled(new Error("wrapped", { cause: declinedPasskey() }))).toBe(
      true
    );
    expect(isWorkSubmissionCancelled(rejectedInWallet())).toBe(true);
    expect(isWorkSubmissionCancelled(new WorkSendCancelledError())).toBe(true);
    expect(isWorkSubmissionCancelled(lostResponse())).toBe(false);
  });

  it("treats anything that fails before the intent was recorded as never sent", () => {
    expect(
      classifySendFailure(lostResponse(), { intentRecorded: false, broadcastKnown: false })
    ).toEqual({ kind: "not-sent", cancelled: false });
    expect(
      classifySendFailure(declinedPasskey(), { intentRecorded: false, broadcastKnown: false })
    ).toEqual({ kind: "not-sent", cancelled: true });
  });

  it("clears the intent only for a refusal the network or the person gave back", () => {
    expect(
      classifySendFailure(rejectedInWallet(), { intentRecorded: true, broadcastKnown: false })
    ).toEqual({ kind: "not-sent", cancelled: true });
    expect(
      classifySendFailure(bundlerRejection(), { intentRecorded: true, broadcastKnown: false })
    ).toEqual({ kind: "not-sent", cancelled: false });
  });

  it("keeps the intent when the response was lost, since the send may have landed", () => {
    expect(
      classifySendFailure(lostResponse(), { intentRecorded: true, broadcastKnown: false })
    ).toEqual({ kind: "may-have-sent" });
  });

  // A node can answer with either after its own broadcast: -32000 also carries
  // "already known" and "nonce too low". Clearing the intent on one of them
  // would let the same attestation go out twice.
  it.each([
    -32000, -32603,
  ])("keeps the intent on RPC code %i, which says nothing about the broadcast", (code) => {
    const error = Object.assign(new Error("RPC error"), { code });
    expect(classifySendFailure(error, { intentRecorded: true, broadcastKnown: false })).toEqual({
      kind: "may-have-sent",
    });
  });

  it.each([
    -32602, -32500, -32599,
  ])("clears the intent on RPC code %i, an outright refusal", (code) => {
    const error = Object.assign(new Error("RPC error"), { code });
    expect(classifySendFailure(error, { intentRecorded: true, broadcastKnown: false })).toEqual({
      kind: "not-sent",
      cancelled: false,
    });
  });

  it("never clears a send the bundler or wallet already acknowledged", () => {
    expect(
      classifySendFailure(lostResponse(), { intentRecorded: false, broadcastKnown: true })
    ).toEqual({ kind: "may-have-sent" });
    expect(
      classifySendFailure(bundlerRejection(), { intentRecorded: true, broadcastKnown: true })
    ).toEqual({ kind: "may-have-sent" });
    expect(
      classifySendFailure(rejectedInWallet(), { intentRecorded: true, broadcastKnown: true })
    ).toEqual({ kind: "may-have-sent" });
  });
});
