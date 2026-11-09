/**
 * A job and the one that waits on it, in one request
 *
 * Add and Send's proof and send go out together where the rail can do it
 * (`commitment-pooling/proof-and-send`). Each still runs through its own
 * `processJob`, so each keeps its claim, its send record and its recovery read.
 * The bundling sender holds both calls and sends them as one atomic request,
 * the lead's first, and only with both in it: a follower never goes without
 * what it follows, and a lead never goes without its follower.
 *
 * @module modules/job-queue/process-together
 */

import type { BatchBudget } from "../transactions/batch-types";
import { createBundlingSender } from "../transactions/bundling-sender";
import type { ProcessJobContext, ProcessJobResult } from "./ports";

export async function processTogether(
  processJob: (jobId: string, context: ProcessJobContext) => Promise<ProcessJobResult>,
  input: {
    leadJobId: string;
    followerJobId: string;
    context: ProcessJobContext;
    batchBudget: BatchBudget;
  }
): Promise<{ lead: ProcessJobResult; follower: ProcessJobResult }> {
  const { leadJobId, followerJobId, context, batchBudget } = input;
  const sender = context.transactionSender;
  if (!sender?.sendAtomicBatch) {
    const unavailable = { success: false, error: "transaction_sender_unavailable", skipped: true };
    return { lead: unavailable, follower: unavailable };
  }
  const bundle = createBundlingSender(sender, [leadJobId, followerJobId], {
    batchBudget,
    everyOrNone: true,
  });
  const [lead, follower] = await Promise.all(
    [leadJobId, followerJobId].map((jobId) =>
      processJob(jobId, { ...context, transactionSender: bundle.senderFor(jobId) }).finally(() =>
        bundle.finished(jobId)
      )
    )
  );
  return { lead: lead as ProcessJobResult, follower: follower as ProcessJobResult };
}
