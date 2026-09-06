/**
 * Commitment composer controller
 *
 * Owns the real form, reader access, draft lifecycle, cycle fallback, and
 * queued creation identity. The client view keeps only journey presentation.
 *
 * @module hooks/client-ui/commitment/useCommitmentComposerController
 */

import { useEffect, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import {
  commitmentComposerDraftKey,
  useCommitmentComposerDraftStore,
} from "../../../stores/useCommitmentComposerDraftStore";
import type { Address } from "../../../types/domain";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useActions, useGardens } from "../../blockchain/useBaseLists";
import { useCommitmentCycleNames } from "../../commitment-pooling/useCommitmentCycleNames";
import {
  buildCommitmentCreationPayload,
  type CommitmentComposerValues,
  useCommitmentComposerForm,
} from "../../commitment-pooling/useCommitmentComposerForm";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import {
  useCommitmentCycles,
  useCommitmentPools,
} from "../../commitment-pooling/useCommitmentPooling";
import { useHasRole } from "../../roles/useHasRole";
import type {
  CommitmentComposerAccess,
  CommitmentComposerController,
  CommitmentComposerDirection,
} from "./composer-controller.types";

export interface UseCommitmentComposerControllerInput {
  chainId: number;
  garden: Address | string | null | undefined;
  direction: CommitmentComposerDirection;
  defaultUnitLabel?: string;
}

export function useCommitmentComposerController(
  input: UseCommitmentComposerControllerInput
): CommitmentComposerController {
  const garden = (input.garden as Address | null | undefined) ?? null;
  const isOnline = useOnlineStatus();
  const viewer = (usePrimaryAddress() as Address | null) ?? null;
  const { pools } = useCommitmentPools({ chainId: input.chainId, garden: garden ?? undefined });
  const pool = pools[0];
  const { cycles } = useCommitmentCycles({
    chainId: input.chainId,
    poolId: pool?.poolId ?? 0n,
    state: "OPEN",
  });
  const openCycles = useMemo(
    () =>
      pool
        ? [...cycles].sort((left, right) =>
            left.cycleType === right.cycleType ? 0 : left.cycleType === "SEASON" ? -1 : 1
          )
        : [],
    [cycles, pool]
  );
  const cycleNames = useCommitmentCycleNames(openCycles);
  const steward = useHasRole(
    pool?.garden as Address | undefined,
    viewer ?? undefined,
    "steward",
    input.chainId
  );
  const owner = useHasRole(
    pool?.garden as Address | undefined,
    viewer ?? undefined,
    "owner",
    input.chainId
  );
  const { data: actions = [] } = useActions(input.chainId);
  const { data: gardens = [] } = useGardens();
  const jobs = useCommitmentJobs({ chainId: input.chainId });

  const draftKey =
    viewer && garden
      ? commitmentComposerDraftKey({
          chainId: input.chainId,
          viewer,
          garden,
          direction: input.direction,
        })
      : null;
  const drafts = useCommitmentComposerDraftStore((state) => state.drafts);
  const saveDraft = useCommitmentComposerDraftStore((state) => state.saveDraft);
  const clearDraft = useCommitmentComposerDraftStore((state) => state.clearDraft);
  const [savedDraft, setSavedDraft] = useState(() => (draftKey ? drafts[draftKey] : undefined));
  const [draftDecision, setDraftDecision] = useState<"pending" | "decided">(
    savedDraft ? "pending" : "decided"
  );
  const [clientCommitmentId, setClientCommitmentId] = useState(
    () => savedDraft?.clientCommitmentId ?? crypto.randomUUID()
  );
  const [resolvedKey, setResolvedKey] = useState(draftKey);
  if (resolvedKey !== draftKey) {
    setResolvedKey(draftKey);
    const next = draftKey ? drafts[draftKey] : undefined;
    setSavedDraft(next);
    setDraftDecision(next ? "pending" : "decided");
    setClientCommitmentId(next?.clientCommitmentId ?? crypto.randomUUID());
  }

  const form = useCommitmentComposerForm({
    direction: input.direction,
    kind: input.direction === "REQUEST" ? "SERVICE" : "GARDEN_WORK",
    ...(input.direction === "OFFER" && input.defaultUnitLabel
      ? { unitLabel: input.defaultUnitLabel }
      : {}),
  });
  const values = useWatch({ control: form.control }) as CommitmentComposerValues;
  const isDirty = form.formState.isDirty;
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (draftDecision !== "decided" || values.cycleId === "0") return;
    if (openCycles.some((cycle) => cycle.cycleId.toString() === values.cycleId)) return;
    form.setValue("cycleId", "0", { shouldValidate: true });
  }, [draftDecision, form, openCycles, values.cycleId]);

  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (!draftKey || placed || draftDecision !== "decided" || !isDirty) return;
    saveDraft(draftKey, {
      values: JSON.parse(serialized) as Record<string, unknown>,
      clientCommitmentId,
    });
  }, [clientCommitmentId, draftDecision, draftKey, isDirty, placed, saveDraft, serialized]);

  const resumeDraft = () => {
    if (savedDraft) {
      form.reset({
        ...form.getValues(),
        ...(savedDraft.values as Partial<CommitmentComposerValues>),
        direction: input.direction,
      });
    }
    setDraftDecision("decided");
  };
  const startFresh = () => {
    if (draftKey) clearDraft(draftKey);
    setClientCommitmentId(crypto.randomUUID());
    setDraftDecision("decided");
  };

  const poolOpen = pool?.state === "OPEN";
  const place = async (): Promise<boolean> => {
    if (!pool || !poolOpen || !viewer || !garden) return false;
    try {
      await jobs.enqueue({
        act: "create",
        payload: buildCommitmentCreationPayload({
          values,
          clientCommitmentId,
          poolId: pool.poolId,
          creator: viewer,
          gardenAddress: garden,
          nowSeconds: Math.floor(Date.now() / 1000),
        }),
      });
      if (draftKey) clearDraft(draftKey);
      setPlaced(true);
      return true;
    } catch {
      return false;
    }
  };

  let access: CommitmentComposerAccess = "allowed";
  if (pool?.poolType === "PROTOCOL") {
    if (steward.isLoading || owner.isLoading) access = "loading";
    else if (!steward.hasRole && !owner.hasRole) access = "barred";
  }
  const gardenName =
    gardens.find((entry) => garden && entry.id.toLowerCase() === garden.toLowerCase())?.name ??
    null;

  return {
    direction: input.direction,
    garden,
    viewer,
    isOnline,
    form,
    values,
    actions,
    openCycles,
    cycleNames: cycleNames.byCycleId,
    gardenName,
    savedDraft,
    draftDecision,
    clientCommitmentId,
    placed,
    access,
    hasPool: Boolean(pool),
    poolOpen,
    isPending: jobs.isPending,
    resumeDraft,
    startFresh,
    place,
  };
}
