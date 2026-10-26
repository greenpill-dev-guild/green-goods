import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import type { useSearchParams } from "react-router-dom";
import { toastService } from "../../../components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import type { ClaimJobPayload } from "../../../modules/commitment-pooling/job-types";
import { type TakeUpOutcome, TakeUpNotSent } from "../../../modules/commitment-pooling/take-up";
import {
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  sameWorkLinkIdentity,
  toDraftWorkLink,
  type WorkLinkChoice,
  type WorkLinkIntent,
  workLinkReturnGarden,
  writeWorkLinkIntent,
} from "../../../modules/commitment-pooling/work-link-intent";
import { submissionPromptCount, type WorkLinkStatus } from "../../../modules/work/submission-flow";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import type { Address } from "../../../types/domain";
import { useTakeUpChoices } from "../../commitment-pooling/useTakeUpChoices";
import {
  useWorkablePromises,
  useWorkLinkChoices,
} from "../../commitment-pooling/useWorkLinkChoices";

/** A member takes an Open ask up as themselves (`ClaimType.INDIVIDUAL`). */
const CLAIM_TYPE_INDIVIDUAL = 1;

interface WorkLinkIntentOptions {
  searchParams: URLSearchParams;
  /** Writes the page's search params, keeping its navigation state. */
  setSearchParams: ReturnType<typeof useSearchParams>[1];
  account: Address | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  setGardenAddress: (gardenAddress: Address) => void;
  /** Queues and sends the take-up of an Open ask (`useCommitmentJobs().takeUp`). */
  takeUp: (payload: ClaimJobPayload) => Promise<TakeUpOutcome>;
}

/**
 * The promise a work is for: the page's link, held only once it matches a live, eligible choice,
 * where that link stands, and the two ways to change it. Two kinds of promise qualify:
 *
 * - one of the member's own, which the work links to as it is sent;
 * - one of the garden's Open asks the member could take up (decision 18), which Submit takes up
 *   once the work has passed its own checks, before it is admitted. Declined or refused, nothing
 *   of the work is queued; still waiting to go, the work is queued behind it. A take-up that
 *   landed from this composer is not run again, though the indexer may still list its ask as open.
 *
 * The garden never changes for an ask: it is its own garden's, so choosing one keeps the work
 * there. It also reads the flow's garden's promises the member can work on and its Open asks,
 * which the Start step lists and a promise picked there is matched against (DL-131).
 */
export function useWorkLinkIntent({
  searchParams,
  setSearchParams,
  account,
  gardenAddress,
  actionUID,
  setGardenAddress,
  takeUp,
}: WorkLinkIntentOptions) {
  const intl = useIntl();
  const parsedLinkIntent = useMemo(() => parseWorkLinkIntent(searchParams), [searchParams]);
  const hasLinkIntentParams = useMemo(() => hasWorkLinkIntentParams(searchParams), [searchParams]);
  // A promise link the page was opened with, as from a promise's page; one chosen at Start or
  // brought back with a draft arrives later. Taking it off or choosing another ends it.
  const [linkAtEntry, setLinkAtEntry] = useState(() => hasWorkLinkIntentParams(searchParams));
  // The link is checked in its own garden, which the flow takes up once it holds.
  const linkGardens = {
    chainId: DEFAULT_CHAIN_ID,
    account,
    workGarden: (parsedLinkIntent?.garden ?? gardenAddress) as Address | null,
    returnGarden: (parsedLinkIntent
      ? workLinkReturnGarden(parsedLinkIntent)
      : gardenAddress) as Address | null,
  };
  const linkChoices = useWorkLinkChoices({
    ...linkGardens,
    actionUID: parsedLinkIntent?.actionUID ?? actionUID,
  });
  const takeUpChoices = useTakeUpChoices(linkGardens);
  const [takenUpHere, setTakenUpHere] = useState<ReadonlySet<string>>(() => new Set());
  const { ownLink, takeUpLink } = useMemo(() => {
    if (!parsedLinkIntent) return { ownLink: null, takeUpLink: null };
    const matches = (choice: WorkLinkIntent) => sameWorkLinkIdentity(choice, parsedLinkIntent);
    const own = linkChoices.choices.find(matches) ?? null;
    return { ownLink: own, takeUpLink: own ? null : (takeUpChoices.choices.find(matches) ?? null) };
  }, [linkChoices.choices, takeUpChoices.choices, parsedLinkIntent]);
  const linkIntent = ownLink ?? takeUpLink;
  const takesUp = Boolean(takeUpLink && !takenUpHere.has(takeUpLink.commitmentId.toString()));
  // The flow's garden's promises the member can work on, and its Open asks they could take up:
  // the Start step's lists, and the live choices a promise picked there is matched against.
  const flowGarden = {
    chainId: DEFAULT_CHAIN_ID,
    account,
    workGarden: gardenAddress,
    returnGarden: gardenAddress,
  };
  const workablePromises = useWorkablePromises(flowGarden);
  const openAsks = useTakeUpChoices(flowGarden);
  // An ask the member can take up now is valid whatever the read of their own promises says.
  const linkIntentStatus: WorkLinkStatus = !hasLinkIntentParams
    ? "none"
    : !parsedLinkIntent
      ? "invalid"
      : !account || linkChoices.isLoading
        ? "validating"
        : takeUpLink
          ? "valid"
          : linkChoices.isError
            ? "unavailable"
            : ownLink
              ? "valid"
              : takeUpChoices.isLoading
                ? "validating"
                : takeUpChoices.isError
                  ? "unavailable"
                  : "invalid";
  // The link as a draft keeps it: an ask's take-up as the live asks say once the link holds, and
  // as the page says until then, so a resumed draft keeps saying so while they are read.
  const draftLink = parsedLinkIntent
    ? toDraftWorkLink({
        ...parsedLinkIntent,
        takesUp: (linkIntentStatus === "valid" ? takesUp : parsedLinkIntent.takesUp) || undefined,
      })
    : null;
  /** Reads the link's standing again: the member's promises, and the Open asks it may be one of. */
  const retryLink = () => {
    void linkChoices.refetch();
    takeUpChoices.refetch();
  };
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
        ...openAsks.choices,
        ...linkChoices.choices,
        ...takeUpChoices.choices,
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
    [
      linkChoices.choices,
      takeUpChoices.choices,
      workablePromises.data,
      openAsks.choices,
      searchParams,
      setGardenAddress,
      setSearchParams,
    ]
  );

  /**
   * The take-up, when the promise is an Open ask: Submit runs it once the work has passed its
   * own checks and before the work is admitted. False when it did not go, having queued nothing,
   * and a toast has said why; true otherwise.
   */
  const takeUpFirst = async (): Promise<boolean> => {
    if (!takesUp || !takeUpLink) return true;
    try {
      const outcome = await takeUp({
        commitmentId: takeUpLink.commitmentId,
        kind: CLAIM_TYPE_INDIVIDUAL,
        gardenContext: takeUpLink.garden,
        gardenAddress: takeUpLink.garden,
      });
      if (outcome.status === "landed")
        setTakenUpHere((taken) => new Set(taken).add(takeUpLink.commitmentId.toString()));
      return true;
    } catch (error) {
      // Any other failure was said where it happened (`useCommitmentJobs`).
      if (!(error instanceof TakeUpNotSent)) return false;
      toastService.error({
        id: "take-up",
        title: intl.formatMessage({
          id: error.declined
            ? "app.garden.takeUp.declined.title"
            : "app.garden.takeUp.failed.title",
        }),
        message: intl.formatMessage({
          id: error.declined
            ? "app.garden.takeUp.declined.message"
            : "app.garden.takeUp.failed.message",
        }),
        error: error.declined ? undefined : error,
        context: "promise take-up",
      });
      return false;
    }
  };

  return {
    parsedLinkIntent,
    hasLinkIntentParams,
    linkAtEntry,
    linkChoices,
    linkIntent,
    linkIntentStatus,
    retryLink,
    /** What a draft keeps of the link; null when the page has none. */
    draftLink,
    workablePromises,
    openAsks,
    clearLinkIntent,
    selectLinkIntent,
    takeUpFirst,
    /** Submit takes the link's Open ask up first, as the live asks say. */
    takesUp,
    /** Prompts this submission asks for, to say before the first: take-up, work, link. */
    promptCount: submissionPromptCount({ linksPromise: Boolean(linkIntent), takesUp }),
  };
}
