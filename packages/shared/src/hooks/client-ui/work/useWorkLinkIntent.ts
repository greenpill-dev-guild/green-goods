import { useCallback, useMemo, useState } from "react";
import type { useSearchParams } from "react-router-dom";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import {
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  sameWorkLinkIdentity,
  type WorkLinkChoice,
  type WorkLinkIntent,
  workLinkReturnGarden,
  writeWorkLinkIntent,
} from "../../../modules/commitment-pooling/work-link-intent";
import type { WorkLinkStatus } from "../../../modules/work/submission-flow";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import type { Address } from "../../../types/domain";
import {
  useWorkablePromises,
  useWorkLinkChoices,
} from "../../commitment-pooling/useWorkLinkChoices";

interface WorkLinkIntentOptions {
  searchParams: URLSearchParams;
  /** Writes the page's search params, keeping its navigation state. */
  setSearchParams: ReturnType<typeof useSearchParams>[1];
  account: Address | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  setGardenAddress: (gardenAddress: Address) => void;
}

/**
 * The promise a work is for: the page's link, held only once it matches a live, eligible choice,
 * where that link stands, and the two ways to change it. It also reads the flow's garden's
 * promises the member can work on, which the Start step lists and a promise picked there is
 * matched against (DL-131).
 */
export function useWorkLinkIntent({
  searchParams,
  setSearchParams,
  account,
  gardenAddress,
  actionUID,
  setGardenAddress,
}: WorkLinkIntentOptions) {
  const parsedLinkIntent = useMemo(() => parseWorkLinkIntent(searchParams), [searchParams]);
  const hasLinkIntentParams = useMemo(() => hasWorkLinkIntentParams(searchParams), [searchParams]);
  // A promise link the page was opened with, as from a promise's page; one chosen at Start or
  // brought back with a draft arrives later. Taking it off or choosing another ends it.
  const [linkAtEntry, setLinkAtEntry] = useState(() => hasWorkLinkIntentParams(searchParams));
  const linkChoices = useWorkLinkChoices({
    chainId: DEFAULT_CHAIN_ID,
    account,
    workGarden: (parsedLinkIntent?.garden ?? gardenAddress) as `0x${string}` | null,
    returnGarden: (parsedLinkIntent ? workLinkReturnGarden(parsedLinkIntent) : gardenAddress) as
      | `0x${string}`
      | null,
    actionUID: parsedLinkIntent?.actionUID ?? actionUID,
  });
  const linkIntent = useMemo(
    () =>
      parsedLinkIntent
        ? (linkChoices.choices.find((choice) => sameWorkLinkIdentity(choice, parsedLinkIntent)) ??
          null)
        : null,
    [linkChoices.choices, parsedLinkIntent]
  );
  // The flow's garden's promises the member can work on: the Start step's list, and the live
  // choices a promise picked there is matched against.
  const workablePromises = useWorkablePromises({
    chainId: DEFAULT_CHAIN_ID,
    account,
    workGarden: gardenAddress,
    returnGarden: gardenAddress,
  });
  const linkIntentStatus: WorkLinkStatus = !hasLinkIntentParams
    ? "none"
    : !parsedLinkIntent
      ? "invalid"
      : !account || linkChoices.isLoading
        ? "validating"
        : linkChoices.isError
          ? "unavailable"
          : linkIntent
            ? "valid"
            : "invalid";
  // Taking the promise off is saved with the draft; see draftLinkCleared.
  const clearLinkIntent = useCallback(() => {
    setLinkAtEntry(false);
    useWorkFlowStore.setState({ draftLinkCleared: true });
    setSearchParams(writeWorkLinkIntent(searchParams, null), { replace: true });
  }, [searchParams, setSearchParams]);
  /** Links the work to a live choice matching `intent`, and returns it; null takes the link off. */
  const selectLinkIntent = useCallback(
    (intent: WorkLinkIntent | null): WorkLinkChoice | null => {
      const live = [
        ...(workablePromises.data ?? []).flatMap((promise) => promise.choices),
        ...linkChoices.choices,
      ];
      const canonical = intent
        ? (live.find((choice) => sameWorkLinkIdentity(choice, intent)) ?? null)
        : null;
      setLinkAtEntry(false);
      useWorkFlowStore.setState({ draftLinkCleared: !canonical });
      setSearchParams(writeWorkLinkIntent(searchParams, canonical), { replace: true });
      if (canonical) {
        setGardenAddress(canonical.garden);
        useWorkFlowStore.getState().setActionUID(canonical.actionUID);
      }
      return canonical;
    },
    [linkChoices.choices, workablePromises.data, searchParams, setGardenAddress, setSearchParams]
  );

  return {
    parsedLinkIntent,
    hasLinkIntentParams,
    linkAtEntry,
    linkChoices,
    linkIntent,
    linkIntentStatus,
    workablePromises,
    clearLinkIntent,
    selectLinkIntent,
  };
}
