/**
 * useSeedTray Hook
 *
 * The seeding tray bound to the seeding wizard's one form, so a steward can
 * compose several commitments in a sitting and send them one after another.
 *
 * The form only ever holds one row. Every move starts by keeping that row's
 * answers, which have to pass the composer's rules first: a tray never holds a
 * row the chain would refuse for its shape. When the form is handed another
 * row, the answers go in as the steward's own rather than as new defaults, so a
 * default that a query resolves late (`useCommitmentComposerSession`) cannot
 * undo a choice the copy carried over.
 *
 * The rules themselves live in `modules/commitment-pooling/seed-tray`.
 *
 * @module hooks/admin-ui/pool/useSeedTray
 */

import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import {
  addAnotherRow,
  advanceSeedRow,
  currentTrayRow,
  keepCurrentRow,
  otherTrayRows,
  removeTrayRow,
  type SeedRowProgress,
  type SeedTray,
  type SeedTrayRow,
  selectSeedTrayRoom,
  sendSeedTray,
  settleSeedTray,
  startSeedPass,
  startSeedTray,
  takeUpRow,
} from "../../../modules/commitment-pooling/seed-tray";
import type { Address } from "../../../types/domain";
import {
  type CommitmentComposerValues,
  commitmentComposerSchema,
} from "../../commitment-pooling/useCommitmentComposerForm";
import { useCommitmentPool } from "../../commitment-pooling/useCommitmentPooling";
import type { CommitmentSendReport } from "../../commitment-pooling/useCommitmentJobs";
import type { PendingCommitmentCreation } from "../../commitment-pooling/useCommitmentQueueState";

export {
  type SeedRowProgress,
  type SeedRowStatus,
  type SeedTrayRow,
  selectSeedTrayCapacity,
} from "../../../modules/commitment-pooling/seed-tray";

/** What the last pass over the tray left behind. */
export interface SeedTrayLastSend {
  sent: number;
  left: number;
}

export interface SeedTrayController {
  /** The kept rows beside the one the form holds. */
  others: readonly SeedTrayRow[];
  /** Every commitment a send would make: the others, and the one in the form. */
  size: number;
  /** The row in the form was sent before and nothing was created for it. */
  currentNotSent: boolean;
  isSending: boolean;
  lastSend: SeedTrayLastSend | null;
  /**
   * The last pass, row by row: where each row stands while it runs, and how
   * each one ended once it is over. Null until a pass starts in this sitting.
   */
  pass: readonly SeedRowProgress[] | null;
  /** Put the last pass away, to go back to the rows still in the tray. */
  clearPass: () => void;
  /** A new sitting: an empty tray and a fresh id for the row in the form. */
  restart: () => void;
  /** Keep the row in the form and start another from the same answers. */
  addAnother: () => Promise<void>;
  /** Keep the row in the form and take an earlier one back into it. */
  edit: (clientCommitmentId: string) => Promise<void>;
  remove: (clientCommitmentId: string) => void;
  /** Drop the row in the form; the newest of the others takes its place. */
  removeCurrent: () => void;
  /**
   * Send every row, one after another. `invalid` means the form's answers broke
   * a rule and nothing was sent; `left` means some rows are still here.
   */
  sendAll: () => Promise<"sent" | "left" | "invalid">;
}

export function useSeedTray(input: {
  form: UseFormReturn<CommitmentComposerValues>;
  /**
   * Creates one row's commitment, reporting where its send stands. Rejects when
   * nothing was created for it.
   */
  createRow: (row: SeedTrayRow, report: (event: CommitmentSendReport) => void) => Promise<unknown>;
}): SeedTrayController {
  const { form, createRow } = input;
  const [tray, setTray] = useState<SeedTray>(() => startSeedTray(crypto.randomUUID()));
  const [isSending, setIsSending] = useState(false);
  const [lastSend, setLastSend] = useState<SeedTrayLastSend | null>(null);
  const [pass, setPass] = useState<SeedRowProgress[] | null>(null);

  /** The form's answers once they pass the composer's rules; otherwise it shows why. */
  const readAnswers = async (): Promise<CommitmentComposerValues | null> => {
    const parsed = commitmentComposerSchema.safeParse(form.getValues());
    if (parsed.success) return parsed.data;
    await form.trigger();
    return null;
  };

  /** Hand the form the row now in hand, as answers rather than as new defaults. */
  const hold = (next: SeedTray, values: CommitmentComposerValues) => {
    setTray(next);
    form.reset(values, { keepDefaultValues: true });
  };

  const others = otherTrayRows(tray);

  return {
    others,
    size: others.length + 1,
    currentNotSent: currentTrayRow(tray)?.notSent === true,
    isSending,
    lastSend,
    pass,
    clearPass: () => setPass(null),
    restart: () => {
      setTray(startSeedTray(crypto.randomUUID()));
      setLastSend(null);
      setPass(null);
    },
    addAnother: async () => {
      const values = await readAnswers();
      if (!values) return;
      setLastSend(null);
      hold(addAnotherRow(tray, values, crypto.randomUUID()), values);
    },
    edit: async (clientCommitmentId) => {
      const values = await readAnswers();
      if (!values) return;
      const next = takeUpRow(tray, values, clientCommitmentId);
      setLastSend(null);
      hold(next, currentTrayRow(next)?.values ?? values);
    },
    remove: (clientCommitmentId) => {
      setLastSend(null);
      setTray(removeTrayRow(tray, clientCommitmentId));
    },
    removeCurrent: () => {
      const next = removeTrayRow(tray, tray.currentId);
      const row = currentTrayRow(next);
      if (next === tray || !row) return;
      setLastSend(null);
      hold(next, row.values);
    },
    sendAll: async () => {
      const values = await readAnswers();
      if (!values) return "invalid";
      const kept = keepCurrentRow(tray, values);
      setTray(kept);
      setLastSend(null);
      setPass(startSeedPass(kept.rows));
      setIsSending(true);
      try {
        const result = await sendSeedTray(kept.rows, createRow, (id, event) =>
          setPass((current) => (current ? advanceSeedRow(current, id, event) : current))
        );
        const left = settleSeedTray(kept, result);
        const row = left ? currentTrayRow(left) : undefined;
        if (!left || !row) {
          // Every row is a commitment now; the ids have been spent.
          setTray(startSeedTray(crypto.randomUUID()));
          return "sent";
        }
        hold(left, row.values);
        setLastSend({ sent: result.sent.length, left: left.rows.length });
        return "left";
      } finally {
        setIsSending(false);
      }
    },
  };
}

/**
 * How many more open commitments the steward may hold in this pool, or null
 * while that is not read yet. The cap is the pool's; the count is the indexer's
 * mirror of the registry's own per-provider count.
 */
export function useSeedTrayRoom(input: {
  chainId: number;
  poolId: bigint | undefined;
  /** The pool's `providerOpenCommitmentCap`. */
  cap: bigint | undefined;
  viewer: Address | null | undefined;
  /** Creations still queued on this device for this pool. */
  pendingCreates: readonly Pick<PendingCommitmentCreation, "direction" | "failed">[];
}): number | null {
  const { chainId, poolId, cap, viewer, pendingCreates } = input;
  const { detail } = useCommitmentPool(
    { chainId, poolId: poolId ?? 0n },
    { enabled: poolId !== undefined }
  );
  const exposures = poolId === undefined ? null : (detail?.providerExposures ?? null);

  return useMemo(
    () =>
      selectSeedTrayRoom({
        cap,
        exposures,
        viewer,
        // A creation that gave up is sent again only if the steward asks for it.
        queuedOffers: pendingCreates.filter((row) => row.direction === "OFFER" && !row.failed)
          .length,
      }),
    [cap, exposures, viewer, pendingCreates]
  );
}
