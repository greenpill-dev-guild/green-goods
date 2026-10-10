import { isHash } from "viem";
import type { BroadcastReference, TransactionSender } from "../transactions/types";
import { classifySendFailure } from "../work/send-outcome";
import type { AttemptOutcome } from "./api-contract";
import {
  decodeAttestCall,
  EAS_ATTEST_ABI,
  envelopeIssues,
  type EnvelopeIssue,
  type PublicationEnvelope,
  type ReportingDeployment,
} from "./envelope";

/**
 * Sends one frozen publication envelope through the person's own wallet or passkey sender and
 * describes what happened in the Agent's outcome vocabulary. The call is rebuilt from the
 * envelope's calldata after an independent check, so the wallet is only ever asked to sign the
 * exact attestation the Agent froze. A broadcast reference is reported the moment the sender knows
 * it; a failed report never interrupts the send, and an unknown result stays uncertain instead of
 * being treated as "not sent".
 */
export class EnvelopeRejectedError extends Error {
  constructor(readonly issues: readonly EnvelopeIssue[]) {
    super(`The prepared publication does not match its envelope: ${issues.join(", ")}`);
    this.name = "EnvelopeRejectedError";
  }
}

export interface EnvelopeSendResult {
  outcome: AttemptOutcome;
  /** The outcome already reached the Agent through `onReference`. */
  reported: boolean;
}

function referenceOutcome(reference: BroadcastReference | null): {
  transactionHash?: `0x${string}`;
  userOperationHash?: `0x${string}`;
} {
  // Some wallets return an opaque identifier instead of a transaction hash; it is not evidence
  // the Agent can reconcile, so only a canonical hash is reported.
  if (!reference || !isHash(reference.hash)) return {};
  return reference.kind === "transaction"
    ? { transactionHash: reference.hash }
    : { userOperationHash: reference.hash };
}

export async function sendPreparedEnvelope(
  sender: TransactionSender,
  envelope: PublicationEnvelope,
  input: {
    deployment: ReportingDeployment;
    /** Durably reports a broadcast outcome; resolves true once the Agent recorded it. */
    onReference: (outcome: AttemptOutcome) => Promise<boolean>;
  }
): Promise<EnvelopeSendResult> {
  const issues = envelopeIssues(envelope, {
    deployment: input.deployment,
    account: envelope.accountAddress,
  });
  if (issues.length > 0) throw new EnvelopeRejectedError(issues);
  const request = decodeAttestCall(envelope.call.data);
  let intentRecorded = false;
  let reference: BroadcastReference | null = null;
  let reported = false;

  const report = async (known: BroadcastReference) => {
    reference = known;
    const hashes = referenceOutcome(known);
    if (reported || Object.keys(hashes).length === 0) return;
    reported = await input.onReference({ kind: "broadcast", ...hashes }).catch(() => false);
  };

  try {
    const result = await sender.sendContractCall(
      {
        address: envelope.call.to,
        account: envelope.accountAddress,
        abi: EAS_ATTEST_ABI,
        functionName: "attest",
        args: [
          {
            schema: request.schema,
            data: {
              recipient: request.recipient,
              expirationTime: request.expirationTime,
              revocable: request.revocable,
              refUID: request.refUID,
              data: request.data,
              value: request.value,
            },
          },
        ],
        chainId: envelope.chainId,
        value: 0n,
      },
      {
        assertOwnership: () => sender.assertOwnership?.(envelope.accountAddress, envelope.chainId),
        onBeforeBroadcast: async (known) => {
          intentRecorded = true;
          if (known) reference = known;
        },
        onBroadcastReference: report,
      }
    );
    const hashes = referenceOutcome(reference ?? { kind: "transaction", hash: result.hash });
    if (Object.keys(hashes).length === 0) {
      return { outcome: { kind: "uncertain", reason: "wallet_pending" }, reported };
    }
    return { outcome: { kind: "broadcast", ...hashes }, reported };
  } catch (error) {
    const failure = classifySendFailure(error, {
      intentRecorded,
      broadcastKnown: reference !== null,
    });
    if (failure.kind === "not-sent") {
      const reason = failure.cancelled
        ? "user_rejected"
        : intentRecorded
          ? "network_refused"
          : "not_sent";
      return { outcome: { kind: "rejected_before_send", reason }, reported: false };
    }
    return {
      outcome: { kind: "uncertain", reason: "send_unknown", ...referenceOutcome(reference) },
      reported,
    };
  }
}
