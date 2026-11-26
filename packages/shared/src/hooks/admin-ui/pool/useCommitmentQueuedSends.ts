/**
 * The inspector's sends that go through the queue, each followed to where it stands: Send for
 * Confirmation, and this reader's Confirm Kept (PRD-1205). The queue says whether a send landed
 * or stays queued on this device, so the inspector can hold the act and say so once its review
 * has closed.
 *
 * @module hooks/admin-ui/pool/useCommitmentQueuedSends
 */

import { useMemo } from "react";

import { actPhaseFor, sendForConfirmationActKey } from "../../../modules/transactions/act-phase";
import type { Address } from "../../../types/domain";
import { useTxActPhase } from "../../blockchain/useTxActPhase";
import { toActPhaseReport, useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";

/** The act-phase key for this reader's Confirm Kept on one commitment. */
function confirmKeptActKey(commitmentId: bigint): string {
  return `confirm-kept:${commitmentId.toString()}`;
}

export function useCommitmentQueuedSends(input: {
  chainId: number;
  commitmentId: bigint;
  garden: Address;
  /** The chain authorizes this reader by account (named or default confirmer), not by a hat. */
  membershipNotRequired: boolean;
  /** Reread the record as a confirmation lands, until its own state shows Kept. */
  onConfirmSent: () => void;
}) {
  const { chainId, commitmentId, garden, membershipNotRequired, onConfirmSent } = input;
  const sendAct = useTxActPhase();
  const trackSend = sendAct.trackReported;
  const jobs = useCommitmentJobs({ chainId, execution: "foreground" });
  const sends = useMemo(
    () => ({
      sendForConfirmation: () =>
        trackSend(sendForConfirmationActKey(commitmentId), (report) =>
          jobs.enqueue({
            act: "sendForConfirmation",
            commitmentId,
            gardenAddress: garden,
            report: toActPhaseReport(report),
          })
        ),
      confirmOrdinary: () =>
        trackSend(confirmKeptActKey(commitmentId), (report) =>
          jobs.enqueue({
            act: "confirm",
            commitmentId,
            gardenAddress: garden,
            membershipNotRequired,
            report: toActPhaseReport(report),
          })
        ).then((jobId) => {
          onConfirmSent();
          return jobId;
        }),
    }),
    [trackSend, jobs, commitmentId, garden, membershipNotRequired, onConfirmSent]
  );
  return {
    ...sends,
    sendPhase: actPhaseFor(sendAct.phase, sendForConfirmationActKey(commitmentId)),
    confirmPhase: actPhaseFor(sendAct.phase, confirmKeptActKey(commitmentId)),
    isPending: jobs.isPending,
  };
}
