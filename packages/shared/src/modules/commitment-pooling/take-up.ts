/**
 * Taking a promise up in the tap that logs work for it (PWA Home decision 18, DL-131)
 *
 * The take-up is the chain's first act: the claim is queued and sent as the person's own tap in
 * every sign-in, so the work can follow it in the same tap once it lands. How it ends decides
 * what the tap queues next:
 *
 * - Landed: the work goes now, as work for a promise the member has taken up.
 * - Still queued (no confirmed connection, the member's garden role still being read, a send on
 *   record awaiting its receipt): the work is queued behind it, and the queue sends the two in
 *   order (`job-queue/take-up-hold`).
 * - Declined by the person, or refused by the chain: the take-up is taken back out of the queue
 *   when this tap queued it, and nothing else is queued. The form keeps its draft.
 *
 * @module modules/commitment-pooling/take-up
 */

import type { Address } from "../../types/domain";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { parseContractError } from "../../utils/errors/contract-errors";
import type { JobQueueHandle } from "../job-queue/ports";
import type { TransactionSender } from "../transactions/types";
import type { ClaimJobPayload } from "./job-types";

/** How the take-up a work goes after ended in the tap. */
export type TakeUpOutcome = { status: "landed" } | { status: "queued"; reason?: string };

/** Nothing was queued: the member must review the reward on the promise's page first. */
export class TakeUpAgreementRequired extends Error {
  constructor() {
    super("VoucherConsentMissing: agree to this promise's reward before taking it up");
    this.name = "TakeUpAgreementRequired";
  }
}

/** A queued/offline send may return the contract refusal after the local check could not read. */
export function takeUpNeedsRewardAgreement(error: unknown): boolean {
  return (
    error instanceof TakeUpAgreementRequired ||
    parseContractError(error).name === "VoucherConsentMissing"
  );
}

/** The take-up was declined or refused in the tap; nothing of the tap stays queued. */
export class TakeUpNotSent extends Error {
  readonly declined: boolean;

  constructor(reason: string, declined: boolean) {
    super(reason);
    this.name = "TakeUpNotSent";
    this.declined = declined;
  }
}

type TakeUpQueue = Pick<
  JobQueueHandle,
  "addJob" | "getJobs" | "retryJob" | "processJob" | "discardJob"
>;

export async function takeUpBeforeWork(
  input: {
    payload: ClaimJobPayload;
    owner: Address;
    chainId: number;
    sender: TransactionSender | null;
  },
  queue: TakeUpQueue
): Promise<TakeUpOutcome> {
  // The queue answers a repeated take-up with the job it already holds, which keeps its token.
  const admissionToken = crypto.randomUUID();
  const jobId = await queue.addJob("claim", input.payload, input.owner, {
    chainId: input.chainId,
    admissionToken,
  });
  if (!input.sender) return { status: "queued" };
  const queued = await queue.getJobs(input.owner, { kind: "claim", synced: false });
  const queuedHere = queued.some(
    (job) => job.id === jobId && job.meta?.admissionToken === admissionToken
  );
  // Every tap starts the take-up on a fresh run of tries, as Send Now does.
  await queue.retryJob(jobId);
  const result = await queue.processJob(jobId, {
    transactionSender: input.sender,
    explicit: true,
  });
  if (result.success) return { status: "landed" };
  if (result.skipped)
    return { status: "queued", ...(result.error ? { reason: result.error } : {}) };
  // A take-up queued before this tap is left as it was: its own page offers its recovery.
  if (queuedHere) await queue.discardJob(jobId);
  throw new TakeUpNotSent(
    result.error ?? "The take-up could not be sent",
    isCancelledTxError(result.error)
  );
}
