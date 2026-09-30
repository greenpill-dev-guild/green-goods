/**
 * useSeedTray Hook
 *
 * The seeding tray bound to the seeding wizard's one form, so a steward can
 * compose several answers in a sitting and create them together. Each answer
 * creates `count` separate commitments (one by default): ten surveys at one
 * survey each are ten promises, each taken up and kept on its own.
 *
 * The form only ever holds one row. Every move starts by keeping that row's
 * answers, which have to pass the composer's rules first: a tray never holds a
 * row the chain would refuse for its shape. When the form is handed another
 * row, the answers go in as the steward's own rather than as new defaults, so a
 * default that a query resolves late (`useCommitmentComposerSession`) cannot
 * undo a choice the copy carried over.
 *
 * A row's copies are fixed at its first Create: their ids, one deadline for
 * all of them, and the payload each one sends, built once and kept for every
 * retry. Once any copy exists, or may, the row's answers can't change.
 *
 * The rules live in `modules/commitment-pooling`: the tray's rows in
 * `seed-tray`, a row's copies in `seed-sets`, and how they are sent in
 * `creation-send`.
 *
 * @module hooks/admin-ui/pool/useSeedTray
 */

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { logger } from "../../../modules/app/logger";
import {
  type CreationCopy,
  type CreationSendMode,
  creationSendMode,
  sendCreationCopies,
} from "../../../modules/commitment-pooling/creation-send";
import type { CommitmentCreationPayload } from "../../../modules/commitment-pooling/job-types";
import {
  COMMITMENT_DISPLAY_GROUP_VERSION,
  type CommitmentDisplayGroup,
} from "../../../modules/commitment-pooling/metadata";
import {
  addAnotherRow,
  currentTrayRow,
  keepCurrentRow,
  otherTrayRows,
  removeTrayRow,
  type SeedTray,
  type SeedTrayRow,
  selectSeedTrayRoom,
  startSeedTray,
  takeUpRow,
} from "../../../modules/commitment-pooling/seed-tray";
import {
  copiesToRetry,
  mintSeedSet,
  type SeedCopyProgress,
  seedSetLocked,
} from "../../../modules/commitment-pooling/seed-sets";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import type { Address } from "../../../types/domain";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import {
  type CommitmentComposerValues,
  commitmentComposerSchema,
} from "../../commitment-pooling/useCommitmentComposerForm";
import { useCommitmentPool } from "../../commitment-pooling/useCommitmentPooling";
import type { PendingCommitmentCreation } from "../../commitment-pooling/useCommitmentQueueState";
import { useAsyncEffect } from "../../utils/useAsyncEffect";

export {
  CREATION_BUNDLE_SIZE,
  countSeedCopies,
  type SeedCopyProgress,
  type SeedCopyStatus,
  selectSeedSetCapacity,
} from "../../../modules/commitment-pooling/seed-sets";
export { type SeedTrayRow } from "../../../modules/commitment-pooling/seed-tray";
export type { CreationSendMode } from "../../../modules/commitment-pooling/creation-send";

/** What one copy is built with: its own id, and what it shares with its set. */
export interface SeedCopyTerms {
  clientCommitmentId: string;
  /** The set's deadline, fixed at its first Create. */
  dueDate: bigint;
  /** The set's group, when it has more than one copy. */
  displayGroup?: CommitmentDisplayGroup;
}

/**
 * Builds one copy's creation payload from a row's answers. Called once per
 * copy, at the row's first Create. Throws when the row can't be created as it
 * stands; nothing in the tray is sent then.
 */
export type SeedCopyBuilder = (
  values: CommitmentComposerValues,
  copy: SeedCopyTerms
) => Omit<CommitmentCreationPayload, "creationRequestKey">;

interface SeedSetState {
  /** The answers the copies were built from, to tell when they changed. */
  answers: string;
  copies: readonly CreationCopy[];
  progress: readonly SeedCopyProgress[];
}

export interface SeedTrayController {
  /** The kept rows beside the one the form holds. */
  others: readonly SeedTrayRow[];
  /** Every promise a Create would make: each row's count, the one in the form included. */
  size: number;
  /** How the wallet will be asked: once per bundle, once per copy, or not from here. */
  mode: CreationSendMode | null;
  isSending: boolean;
  /**
   * Every copy sent at least once in this sitting, where each stands, in tray
   * order. Null before the first Create.
   */
  copies: readonly SeedCopyProgress[] | null;
  /**
   * The copies the latest Create sent, in the order it sent them: the whole
   * tray the first time, only the ones that didn't send on a Try Again. Null
   * before the first Create.
   */
  pass: readonly SeedCopyProgress[] | null;
  /** How many copies a Try Again would send: the ones that didn't send. */
  retryCount: number;
  /** Some of the form's row exists, or may: its answers can't change. */
  currentLocked: boolean;
  /** Some of this row exists, or may: it can be neither edited nor removed. */
  isLocked: (clientCommitmentId: string) => boolean;
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
   * Create every copy not yet created. `invalid`: the form's answers broke a
   * rule. `blocked`: a row couldn't be built, and nothing was sent. `left`:
   * some copies didn't send.
   */
  sendAll: () => Promise<"sent" | "left" | "invalid" | "blocked">;
}

const answersOf = (values: CommitmentComposerValues) => JSON.stringify(values);

function waiting(copy: CreationCopy): SeedCopyProgress {
  return {
    clientCommitmentId: copy.clientCommitmentId,
    status: "waiting",
    txHash: null,
    jobId: null,
  };
}

export function useSeedTray(input: {
  form: UseFormReturn<CommitmentComposerValues>;
  chainId: number;
  /** Who is creating; nothing is sent without someone signed in. */
  owner: Address | null;
  buildCopy: SeedCopyBuilder;
}): SeedTrayController {
  const { form, chainId, owner, buildCopy } = input;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const [tray, setTray] = useState<SeedTray>(() => startSeedTray(crypto.randomUUID()));
  const [sets, setSets] = useState<ReadonlyMap<string, SeedSetState>>(() => new Map());
  // The pass reports copy by copy while React batches renders, so the latest
  // sets are kept here as well, for the next report to build on.
  const setsRef = useRef(sets);
  const [isSending, setIsSending] = useState(false);
  const [passIds, setPassIds] = useState<readonly string[] | null>(null);
  const [mode, setMode] = useState<CreationSendMode | null>(null);

  useAsyncEffect(
    async ({ isMounted }) => {
      const next = await creationSendMode(sender, chainId);
      if (isMounted()) setMode(next);
    },
    [sender, chainId]
  );

  const replaceSets = (next: ReadonlyMap<string, SeedSetState>) => {
    setsRef.current = next;
    setSets(next);
  };

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

  const isLocked = (clientCommitmentId: string) => {
    const set = sets.get(clientCommitmentId);
    return set ? seedSetLocked(set.progress) : false;
  };

  const others = otherTrayRows(tray);
  const currentCount = form.watch("count") ?? 1;
  const { copies, pass } = useMemo(() => {
    // Only a kept row can have been sent, so the kept rows hold every copy.
    const progress = tray.rows.flatMap((row) => sets.get(row.clientCommitmentId)?.progress ?? []);
    const byId = new Map(progress.map((copy) => [copy.clientCommitmentId, copy]));
    return {
      copies: progress.length > 0 ? progress : null,
      pass: passIds ? passIds.flatMap((id) => byId.get(id) ?? []) : null,
    };
  }, [sets, tray, passIds]);

  /** Build the copies of a row that has none, or whose answers changed while nothing of it exists. */
  const freeze = (
    row: SeedTrayRow,
    current: SeedSetState | undefined,
    nowSeconds: number
  ): SeedSetState => {
    const answers = answersOf(row.values);
    if (current && (current.answers === answers || seedSetLocked(current.progress))) return current;
    const set = mintSeedSet({
      count: row.values.count ?? 1,
      dueInDays: row.values.dueInDays,
      nowSeconds,
      newId: () => crypto.randomUUID(),
    });
    const displayGroup: CommitmentDisplayGroup | undefined = set.displayGroupId
      ? { version: COMMITMENT_DISPLAY_GROUP_VERSION, id: set.displayGroupId }
      : undefined;
    const built = set.copyIds.map((clientCommitmentId) => ({
      clientCommitmentId,
      setId: row.clientCommitmentId,
      payload: buildCopy(row.values, {
        clientCommitmentId,
        dueDate: set.dueDate,
        ...(displayGroup ? { displayGroup } : {}),
      }),
    }));
    return { answers, copies: built, progress: built.map(waiting) };
  };

  /** One copy moved: its row's progress follows. */
  const report = (progress: SeedCopyProgress) => {
    const next = new Map(setsRef.current);
    for (const [rowId, set] of next) {
      const index = set.copies.findIndex(
        (copy) => copy.clientCommitmentId === progress.clientCommitmentId
      );
      if (index < 0) continue;
      next.set(rowId, {
        ...set,
        progress: set.progress.map((row, at) => (at === index ? progress : row)),
      });
      replaceSets(next);
      return;
    }
  };

  const retryCount = copies ? copiesToRetry(copies).length : 0;

  return {
    others,
    size: others.reduce((sum, row) => sum + (row.values.count ?? 1), 0) + currentCount,
    mode,
    isSending,
    copies,
    pass,
    retryCount,
    currentLocked: isLocked(tray.currentId),
    isLocked,
    restart: () => {
      setTray(startSeedTray(crypto.randomUUID()));
      replaceSets(new Map());
      setPassIds(null);
    },
    addAnother: async () => {
      const values = await readAnswers();
      if (!values) return;
      hold(addAnotherRow(tray, values, crypto.randomUUID()), values);
    },
    edit: async (clientCommitmentId) => {
      if (isLocked(clientCommitmentId)) return;
      // The row in hand keeps what it was sent with when some of it exists.
      const values = isLocked(tray.currentId)
        ? (currentTrayRow(tray)?.values ?? null)
        : await readAnswers();
      if (!values) return;
      const next = takeUpRow(tray, values, clientCommitmentId);
      hold(next, currentTrayRow(next)?.values ?? values);
    },
    remove: (clientCommitmentId) => {
      if (isLocked(clientCommitmentId)) return;
      setTray(removeTrayRow(tray, clientCommitmentId));
    },
    removeCurrent: () => {
      if (isLocked(tray.currentId)) return;
      const next = removeTrayRow(tray, tray.currentId);
      const row = currentTrayRow(next);
      if (next === tray || !row) return;
      hold(next, row.values);
    },
    sendAll: async () => {
      if (!owner) return "blocked";
      // A locked row in the form keeps the answers it was sent with.
      const locked = isLocked(tray.currentId) ? currentTrayRow(tray) : undefined;
      const values = locked ? locked.values : await readAnswers();
      if (!values) return "invalid";
      const kept = keepCurrentRow(tray, values);
      setTray(kept);

      const nowSeconds = Math.floor(Date.now() / 1000);
      const next = new Map<string, SeedSetState>();
      try {
        for (const row of kept.rows) {
          next.set(
            row.clientCommitmentId,
            freeze(row, setsRef.current.get(row.clientCommitmentId), nowSeconds)
          );
        }
      } catch (error) {
        logger.warn("[useSeedTray] a row could not be built, so nothing was sent", {
          error: error instanceof Error ? error.message : String(error),
        });
        return "blocked";
      }
      replaceSets(next);

      const toSend = [...next.values()].flatMap((set) =>
        set.copies.filter((_, index) => {
          const status = set.progress[index]?.status;
          return status === "waiting" || status === "not-sent";
        })
      );
      setPassIds(toSend.map((copy) => copy.clientCommitmentId));
      setIsSending(true);
      try {
        await sendCreationCopies({
          copies: toSend,
          queue: jobQueue,
          sender,
          owner,
          chainId,
          onCopy: report,
        });
      } finally {
        setIsSending(false);
        await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
      }
      const ended = [...setsRef.current.values()].flatMap((set) => set.progress);
      return copiesToRetry(ended).length > 0 ? "left" : "sent";
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
