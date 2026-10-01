/**
 * Add to This Group (PRD-1022 D4, screens 28–30).
 *
 * The steward chooses only how many. At the first Add the new copies are fixed
 * once, like a seeding set: their ids, and payloads built from one copy of the
 * group read from the chain (`modules/commitment-pooling/group-additions`). They
 * are sent through `creation-send` exactly as a set is, so a wallet that can
 * bundle is asked once per ten, and a Try Again sends only the ones that didn't
 * send, as they were built.
 *
 * @module hooks/admin-ui/pool/useAddToGroup
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { logger } from "../../../modules/app/logger";
import {
  type CreationCopy,
  type CreationSendMode,
  creationSendMode,
  sendCreationCopies,
} from "../../../modules/commitment-pooling/creation-send";
import {
  canAddToGroup,
  groupAdditionPayload,
  readGroupTemplate,
} from "../../../modules/commitment-pooling/group-additions";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import {
  copiesToRetry,
  mintGroupAddition,
  type SeedCopyProgress,
  seedSetClearableAfter,
  seedSetLocked,
} from "../../../modules/commitment-pooling/seed-sets";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import type { Address } from "../../../types/domain";
import { CommitmentPoolingModuleABI, createClients } from "../../../utils/blockchain/contracts";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { resolveCommitmentPoolingModule } from "../../commitment-pooling/useCommitmentPoolMutations";
import { useAsyncEffect } from "../../utils/useAsyncEffect";

/** The group being added to, as its inspector knows it. */
export interface GroupToAddTo {
  displayGroupId: string;
  /** Unix seconds; the copies added share it. */
  dueDate: bigint;
  /**
   * A copy of the group to read its terms from. One nobody has taken yet, where
   * there is one, so the reward read is the group's current one.
   */
  templateCommitmentId: bigint;
  /** The group's metadata document, as read from the template's CID. */
  metadata: CommitmentMetadataV1;
  gardenAddress: Address;
}

export type AddToGroupOutcome =
  | "sent"
  | "left"
  /** The deadline has passed: nothing can join the group now. */
  | "expired"
  /** Someone other than the group's creator: their copies would split from it. */
  | "not-creator"
  /** More offers than the steward has room for under the pool's at-once limit. */
  | "full"
  /** Nothing could be read or sent from here. */
  | "blocked";

export interface AddToGroupController {
  mode: CreationSendMode | null;
  isSending: boolean;
  /** Every copy of this addition, where each stands; null before the first Add. */
  copies: readonly SeedCopyProgress[] | null;
  /** The copies the latest Add sent. */
  pass: readonly SeedCopyProgress[] | null;
  /** How many a Try Again would send. */
  retryCount: number;
  /** Some of the addition exists, or may: the count can't change. */
  locked: boolean;
  /** Add `count` copies, or send again the ones that didn't send. */
  add: (count: number) => Promise<AddToGroupOutcome>;
  reset: () => void;
}

interface AdditionSet {
  copies: readonly CreationCopy[];
  progress: readonly SeedCopyProgress[];
}

export function useAddToGroup(input: {
  chainId: number;
  owner: Address | null;
  group: GroupToAddTo | null;
  /**
   * For a group of offers, how many more the steward may hold at once in this
   * pool (`useSeedTrayRoom`): each offer counts against its maker from the
   * moment it is made. Null for requests, or when the room can't be read.
   */
  offerRoom?: number | null;
}): AddToGroupController {
  const { chainId, owner, group, offerRoom = null } = input;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CreationSendMode | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [set, setSet] = useState<AdditionSet | null>(null);
  const [passIds, setPassIds] = useState<readonly string[] | null>(null);
  // Progress arrives copy by copy while React batches renders.
  const setRef = useRef<AdditionSet | null>(null);

  useAsyncEffect(
    async ({ isMounted }) => {
      const next = await creationSendMode(sender, chainId);
      if (isMounted()) setMode(next);
    },
    [sender, chainId]
  );

  const replaceSet = useCallback((next: AdditionSet | null) => {
    setRef.current = next;
    setSet(next);
  }, []);
  const reset = useCallback(() => {
    replaceSet(null);
    setPassIds(null);
  }, [replaceSet]);

  /** The copies of a new addition, fixed once: ids, the group's deadline and terms. */
  const mint = async (count: number): Promise<AdditionSet | AddToGroupOutcome> => {
    if (!group) return "blocked";
    const identity = mintGroupAddition({
      group: { displayGroupId: group.displayGroupId, dueDate: group.dueDate },
      count,
      nowSeconds: Math.floor(Date.now() / 1000),
      newId: () => crypto.randomUUID(),
    });
    if ("refused" in identity) return "expired";
    const moduleAddress = resolveCommitmentPoolingModule(chainId);
    const { publicClient } = createClients(chainId);
    const template = await readGroupTemplate(
      (functionName, commitmentId) =>
        publicClient.readContract({
          address: moduleAddress,
          abi: CommitmentPoolingModuleABI,
          functionName,
          args: [commitmentId],
        }),
      group.templateCommitmentId
    );
    if (!canAddToGroup(template, owner)) return "not-creator";
    const copies = identity.copyIds.map((clientCommitmentId) => ({
      clientCommitmentId,
      setId: group.displayGroupId,
      payload: groupAdditionPayload({
        template,
        metadata: group.metadata,
        clientCommitmentId,
        gardenAddress: group.gardenAddress,
      }),
    }));
    return {
      copies,
      progress: copies.map((copy) => ({
        clientCommitmentId: copy.clientCommitmentId,
        status: "waiting",
        txHash: null,
        jobId: null,
      })),
    };
  };

  const report = (progress: SeedCopyProgress) => {
    const current = setRef.current;
    if (!current) return;
    replaceSet({
      ...current,
      progress: current.progress.map((row) =>
        row.clientCommitmentId === progress.clientCommitmentId ? progress : row
      ),
    });
  };

  const current = set?.progress ?? null;
  const locked = current ? seedSetLocked(current) : false;
  const byId = new Map((current ?? []).map((copy) => [copy.clientCommitmentId, copy]));

  return {
    mode,
    isSending,
    copies: current,
    pass: passIds ? passIds.flatMap((id) => byId.get(id) ?? []) : null,
    retryCount: current ? copiesToRetry(current).length : 0,
    locked,
    reset,
    add: async (count) => {
      if (!owner || !sender || !group) return "blocked";
      // Every send checks the deadline, a Try Again of copies fixed earlier
      // included: past it, a copy would be due before anyone could take it up.
      if (group.dueDate <= BigInt(Math.floor(Date.now() / 1000))) return "expired";
      let next = setRef.current;
      // A new count, while nothing of the last one exists, is a new addition.
      if (!next || (!seedSetLocked(next.progress) && next.copies.length !== count)) {
        // The registry refuses an offer past the limit, so ask nothing of the
        // wallet that can't all land. A Try Again resends copies the room's
        // queue count already holds.
        if (offerRoom !== null && count > offerRoom) return "full";
        try {
          const minted = await mint(count);
          if (typeof minted === "string") return minted;
          next = minted;
        } catch (error) {
          logger.warn("[useAddToGroup] the group's terms could not be read", {
            error: error instanceof Error ? error.message : String(error),
          });
          return "blocked";
        }
        replaceSet(next);
      }
      const { copies, progress } = next;
      const toSend = copies.filter((_, index) => {
        const status = progress[index]?.status;
        return status === "waiting" || status === "not-sent";
      });
      const sentThisPass = new Set(toSend.map((copy) => copy.clientCommitmentId));
      setPassIds([...sentThisPass]);
      setIsSending(true);
      try {
        await sendCreationCopies({
          copies: toSend,
          queue: jobQueue,
          sender,
          owner,
          chainId,
          onCopy: report,
          clearable: () => seedSetClearableAfter(progress, sentThisPass),
        });
      } finally {
        setIsSending(false);
        await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
      }
      const ended = setRef.current?.progress ?? [];
      return copiesToRetry(ended).length > 0 ? "left" : "sent";
    },
  };
}
