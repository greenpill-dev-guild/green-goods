import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import {
  isSubmissionGardenSettled,
  resolveSubmissionGarden,
} from "../../../modules/work/submission-flow";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import type { Action, Address, Garden } from "../../../types/domain";
import { findActionByUID } from "../../../utils/action/parsers";
import { compareAddresses } from "../../../utils/blockchain/address";
import { useGardens } from "../../blockchain/useBaseLists";
import { useActiveGarden } from "../../garden/useActiveGarden";

interface SubmissionGardenOptions {
  /** The gardens the member can submit work to. */
  gardens: Garden[];
  actions: Action[];
  actionUID: number | null;
  gardenAddress: Address | null;
  setGardenAddress: (gardenAddress: Address) => void;
  /** The page names a promise; `promiseGarden` is its garden once the link is confirmed. */
  hasPromiseLink: boolean;
  promiseGarden: Address | null;
  /** The draft is still being reconciled with the page, so no source is applied yet. */
  isResumingFromUrl: boolean;
}

/**
 * The garden a submission goes to (PWA Home decision 28): a promise link, then a resumed draft,
 * then a garden passed in navigation state, and the active garden last
 * (`resolveSubmissionGarden`). Only a garden the account can submit work to counts as the active
 * one, so an evaluator-only garden is never chosen. It also says whether the Start step can leave
 * the garden question out, and which garden the flow names under its steps: the submission
 * garden while it is not the active one, and not before the active garden is known.
 */
export function useSubmissionGarden({
  gardens,
  actions,
  actionUID,
  gardenAddress,
  setGardenAddress,
  hasPromiseLink,
  promiseGarden,
  isResumingFromUrl,
}: SubmissionGardenOptions) {
  const location = useLocation();
  const activeGarden = useActiveGarden(DEFAULT_CHAIN_ID);
  const { data: chainGardens = [] } = useGardens(DEFAULT_CHAIN_ID);
  const hasDraft = useWorkFlowStore((state) => state.activeDraftId !== null);
  const active =
    gardens.find((garden) => compareAddresses(garden.id, activeGarden.gardenId))?.id ?? null;
  const navigation =
    gardens.length > 0
      ? ((location.state as { gardenId?: string } | null)?.gardenId ?? null)
      : null;

  // Before paint, so a garden it settles never shows the garden question for a frame.
  useLayoutEffect(() => {
    if (isResumingFromUrl) return;
    // Read when a source changes rather than tracked, so a garden the member picks stays
    // until one does.
    const current = useWorkFlowStore.getState().gardenAddress;
    const garden = resolveSubmissionGarden({
      current,
      promise: hasPromiseLink ? { garden: promiseGarden } : null,
      hasDraft,
      navigation,
      active,
    });
    if (garden && !compareAddresses(garden, current)) setGardenAddress(garden as Address);
  }, [
    isResumingFromUrl,
    hasPromiseLink,
    promiseGarden,
    hasDraft,
    navigation,
    active,
    setGardenAddress,
  ]);

  const activeGardenKnown = activeGarden.status !== "loading" || activeGarden.gardenId !== null;
  const namedSubmissionGarden =
    gardenAddress && activeGardenKnown && !compareAddresses(gardenAddress, activeGarden.gardenId)
      ? (gardens.find((garden) => compareAddresses(garden.id, gardenAddress)) ??
        chainGardens.find((garden) => compareAddresses(garden.id, gardenAddress)) ??
        null)
      : null;

  return {
    /** The submission garden the flow names under its steps: set only while it is not the active one. */
    namedSubmissionGarden,
    /** The flow's garden can take the chosen action, so the Start step leaves the garden out. */
    submissionGardenSettled: isSubmissionGardenSettled({
      gardenAddress,
      gardens,
      action: findActionByUID(actions, actionUID),
    }),
  };
}
