/**
 * useGroupTakeUp Hook
 *
 * One press of Take Up One on a group (PRD-1029 c3, c4). It reads the chosen
 * copy again right before sending and sends the existing queued take-up act
 * for that copy alone, in the context the person chose. When somebody got there
 * first it reads the group again and stops, so the person is asked before
 * another copy is chosen: it never signs a second copy on its own, and it
 * never claims the group. Try Again takes up the same copy, never a new choice.
 *
 * @module hooks/client-ui/pool/useGroupTakeUp
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { logger } from "../../../modules/app/logger";
import {
  getCommitmentClaimRequests,
  getCommitmentDetail,
} from "../../../modules/commitment-pooling/data";
import {
  canChooseCopy,
  type GroupCopy,
  pickCopyToTakeUp,
} from "../../../modules/commitment-pooling/group-browsing";
import type { Address } from "../../../types/domain";
import { isCancelledTxError } from "../../../utils/errors/tx-error-classifier";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";

/** Mirrors the contract's claim types, as the promise page sends them. */
const CLAIM_TYPE_GARDEN = 0;
const CLAIM_TYPE_INDIVIDUAL = 1;

/**
 * Who takes a copy up: the person, through a garden they belong to, or a garden
 * they steward. On a garden pool it is always the person through that garden;
 * on the protocol pool the person chooses, as on a promise's own page.
 */
export interface GroupTakeUpContext {
  kind: "personal" | "garden";
  garden: Address;
}

/** Where one press stands. */
export type GroupTakeUpState =
  | { step: "idle" }
  /** Reading the chosen copy again before anything is sent. */
  | { step: "checking"; copyId: bigint }
  | { step: "sending"; copyId: bigint }
  /** The chosen copy went first; `next` is waiting for the person's yes. */
  | { step: "taken"; next: bigint; context: GroupTakeUpContext }
  | { step: "none" }
  /** A read failed, so whether a copy is free is unknown. */
  | { step: "unknown" }
  /** The send didn't go through and nothing is held: Try Again takes up the same copy. */
  | { step: "failed"; copyId: bigint; context: GroupTakeUpContext }
  /**
   * Taken up, or held on this phone to send: the copy's own page is next. A
   * send that failed but stays in the queue is held too, and its page offers
   * Try Again for that job.
   */
  | { step: "done"; copyId: bigint };

export interface GroupTakeUpSource {
  chainId: number;
  viewer: Address | null;
  /** Copies already on their way from this phone, never chosen again. */
  queued: ReadonlySet<string>;
  /** Reads the group's copies and its pending asks again, fresh; null when it can't. */
  reread: () => Promise<{ copies: readonly GroupCopy[]; askedFor: ReadonlySet<string> } | null>;
}

export function useGroupTakeUp(source: GroupTakeUpSource) {
  const { chainId, viewer, queued, reread } = source;
  const queryClient = useQueryClient();
  const jobs = useCommitmentJobs({ chainId });
  const [state, setState] = useState<GroupTakeUpState>({ step: "idle" });
  // One press at a time: a second tap while one is reading or sending must not
  // sign another copy beside it.
  const inFlight = useRef(false);

  // The copy as the chain has it now, and whether anyone has asked for it.
  const readCopy = useCallback(
    async (copyId: bigint) => {
      const detail = await queryClient.fetchQuery({
        queryKey: commitmentPoolingKeys.commitment(chainId, copyId),
        queryFn: () => getCommitmentDetail(chainId, copyId),
        staleTime: 0,
      });
      const copy = detail?.commitment ?? null;
      if (!copy || copy.claimMode !== "APPROVAL_GATED")
        return { copy, askedFor: new Set<string>() };
      const asks = await queryClient.fetchQuery({
        queryKey: commitmentPoolingKeys.claims(chainId, copyId, "PENDING"),
        queryFn: () => getCommitmentClaimRequests(chainId, copyId, "PENDING"),
        staleTime: 0,
      });
      return { copy, askedFor: new Set(asks.length > 0 ? [copyId.toString()] : []) };
    },
    [chainId, queryClient]
  );

  const takeUp = useCallback(
    async (copyId: bigint, context: GroupTakeUpContext) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        setState({ step: "checking", copyId });
        let fresh: Awaited<ReturnType<typeof readCopy>>;
        try {
          fresh = await readCopy(copyId);
        } catch (error) {
          logger.warn("[useGroupTakeUp] the chosen copy could not be read again", { error });
          setState({ step: "unknown" });
          return;
        }
        if (!fresh.copy || !canChooseCopy(fresh.copy, { viewer, askedFor: fresh.askedFor })) {
          // Somebody got there first. Read the group again and ask before choosing another.
          const group = await reread().catch((error: unknown) => {
            logger.warn("[useGroupTakeUp] the group could not be read again", { error });
            return null;
          });
          if (!group) {
            setState({ step: "unknown" });
            return;
          }
          const next = pickCopyToTakeUp(group.copies, {
            viewer,
            askedFor: group.askedFor,
            skip: new Set([...queued, copyId.toString()]),
          });
          setState(next ? { step: "taken", next: next.commitmentId, context } : { step: "none" });
          return;
        }
        setState({ step: "sending", copyId });
        let admitted = false;
        try {
          await jobs.enqueue({
            act: "claim",
            payload: {
              commitmentId: copyId,
              kind: context.kind === "garden" ? CLAIM_TYPE_GARDEN : CLAIM_TYPE_INDIVIDUAL,
              gardenContext: context.garden,
              gardenAddress: context.garden,
            },
            report: (event) => {
              if (event.stage === "admitted") admitted = true;
            },
          });
          setState({ step: "done", copyId });
        } catch (error) {
          // The queue's own handler has logged and told the person. A declined
          // prompt drops the job, as does a refusal before the queue took it, so
          // nothing is held and the sheet offers the same copy again. Any other
          // failure keeps the job on this phone: the copy's own page carries its
          // Try Again, and choosing here could send a second copy beside it.
          if (admitted && !isCancelledTxError(error)) setState({ step: "done", copyId });
          else setState({ step: "failed", copyId, context });
        }
      } finally {
        inFlight.current = false;
      }
    },
    [jobs, queued, readCopy, reread, viewer]
  );

  const reset = useCallback(() => setState({ step: "idle" }), []);
  /** Nothing to choose when the press came: none left, or none readable. */
  const settle = useCallback((step: "none" | "unknown") => setState({ step }), []);

  return { state, takeUp, reset, settle };
}
