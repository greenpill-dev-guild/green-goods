/**
 * The promise a work submission is for
 *
 * Submit Work carries the promise in its address: chosen on the Start step, passed from a
 * promise's page, or kept with a resumed draft. This reads it, checks it against what the member
 * may link work to, and says where that check stands. Two kinds of promise qualify:
 *
 * - one of the member's own, which the work links to as it is sent;
 * - one of the garden's Open asks the member could take up (decision 18), which Submit takes up
 *   first, in the same tap. Declined or refused, nothing of the work is queued; still waiting
 *   to go, the work is queued behind it. A take-up that landed from this composer is not run
 *   again, though the indexer may still list its ask as open.
 *
 * The garden never changes here: an ask is its own garden's, so choosing one keeps the work there.
 *
 * @module hooks/client-ui/work/useSubmissionPromiseLink
 */

import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import type { SetURLSearchParams } from "react-router-dom";

import { toastService } from "../../../components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import type { ClaimJobPayload } from "../../../modules/commitment-pooling/job-types";
import { type TakeUpOutcome, TakeUpNotSent } from "../../../modules/commitment-pooling/take-up";
import {
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  sameWorkLinkIdentity,
  type WorkLinkIntent,
  workLinkReturnGarden,
  writeWorkLinkIntent,
} from "../../../modules/commitment-pooling/work-link-intent";
import { submissionPromptCount } from "../../../modules/work/submission-flow";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import type { Address } from "../../../types/domain";
import { useTakeUpChoices } from "../../commitment-pooling/useTakeUpChoices";
import { useWorkLinkChoices } from "../../commitment-pooling/useWorkLinkChoices";

type LinkIntentStatus = "none" | "validating" | "valid" | "invalid" | "unavailable";

/** A member takes an Open ask up as themselves (`ClaimType.INDIVIDUAL`). */
const CLAIM_TYPE_INDIVIDUAL = 1;

export function useSubmissionPromiseLink(input: {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  account: Address | null;
  gardenAddress: Address | null;
  actionUID: number | null;
  setGardenAddress: (garden: Address) => void;
  takeUp: (payload: ClaimJobPayload) => Promise<TakeUpOutcome>;
}) {
  const intl = useIntl();
  const { searchParams, setSearchParams, setGardenAddress } = input;
  const parsedLinkIntent = useMemo(() => parseWorkLinkIntent(searchParams), [searchParams]);
  const hasLinkIntentParams = useMemo(() => hasWorkLinkIntentParams(searchParams), [searchParams]);
  const choiceInput = {
    chainId: DEFAULT_CHAIN_ID,
    account: input.account,
    workGarden: parsedLinkIntent?.garden ?? input.gardenAddress,
    returnGarden: parsedLinkIntent ? workLinkReturnGarden(parsedLinkIntent) : input.gardenAddress,
    actionUID: parsedLinkIntent?.actionUID ?? input.actionUID,
  };
  const linkChoices = useWorkLinkChoices(choiceInput);
  const takeUpChoices = useTakeUpChoices(choiceInput);
  const [takenUpHere, setTakenUpHere] = useState<ReadonlySet<string>>(() => new Set());
  const { ownLink, takeUpLink } = useMemo(() => {
    if (!parsedLinkIntent) return { ownLink: null, takeUpLink: null };
    const matches = (choice: WorkLinkIntent) => sameWorkLinkIdentity(choice, parsedLinkIntent);
    const own = linkChoices.choices.find(matches) ?? null;
    return { ownLink: own, takeUpLink: own ? null : (takeUpChoices.choices.find(matches) ?? null) };
  }, [linkChoices.choices, takeUpChoices.choices, parsedLinkIntent]);
  const linkIntent = ownLink ?? takeUpLink;
  const takesUp = Boolean(takeUpLink && !takenUpHere.has(takeUpLink.commitmentId.toString()));
  // An ask the member can take up now is valid whatever the read of their own promises says.
  const linkIntentStatus: LinkIntentStatus = !hasLinkIntentParams
    ? "none"
    : !parsedLinkIntent
      ? "invalid"
      : !input.account || linkChoices.isLoading
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
  // Taking the promise off is saved with the draft; see draftLinkCleared.
  const clearLinkIntent = useCallback(() => {
    useWorkFlowStore.setState({ draftLinkCleared: true });
    setSearchParams(writeWorkLinkIntent(searchParams, null), { replace: true });
  }, [searchParams, setSearchParams]);
  const selectLinkIntent = useCallback(
    (intent: WorkLinkIntent | null) => {
      const canonical = intent
        ? ([...linkChoices.choices, ...takeUpChoices.choices].find((choice) =>
            sameWorkLinkIdentity(choice, intent)
          ) ?? null)
        : null;
      useWorkFlowStore.setState({ draftLinkCleared: !canonical });
      setSearchParams(writeWorkLinkIntent(searchParams, canonical), { replace: true });
      if (canonical) {
        setGardenAddress(canonical.garden);
        useWorkFlowStore.getState().setActionUID(canonical.actionUID);
      }
    },
    [linkChoices.choices, takeUpChoices.choices, searchParams, setGardenAddress, setSearchParams]
  );

  /**
   * Submit's first act: the take-up, when the promise is an Open ask. False when it was declined
   * or refused, having queued nothing, and the toast has said which; true otherwise.
   */
  const takeUpFirst = async (): Promise<boolean> => {
    if (!takesUp || !takeUpLink) return true;
    try {
      const outcome = await input.takeUp({
        commitmentId: takeUpLink.commitmentId,
        kind: CLAIM_TYPE_INDIVIDUAL,
        gardenContext: takeUpLink.garden,
        gardenAddress: takeUpLink.garden,
      });
      if (outcome.status === "landed")
        setTakenUpHere((taken) => new Set(taken).add(takeUpLink.commitmentId.toString()));
      return true;
    } catch (error) {
      if (!(error instanceof TakeUpNotSent)) throw error;
      const ending = error.declined ? "declined" : "failed";
      toastService.error({
        id: "take-up",
        title: intl.formatMessage({ id: `app.garden.takeUp.${ending}.title` }),
        message: intl.formatMessage({ id: `app.garden.takeUp.${ending}.message` }),
        error: error.declined ? undefined : error,
        context: "promise take-up",
      });
      return false;
    }
  };

  return {
    parsedLinkIntent,
    hasLinkIntentParams,
    linkIntent,
    linkIntentStatus,
    linkChoices,
    takeUpChoices,
    clearLinkIntent,
    selectLinkIntent,
    takeUpFirst,
    /** Prompts this submission asks for, to say before the first: take-up, work, link. */
    promptCount: submissionPromptCount({ linksPromise: Boolean(linkIntent), takesUp }),
  };
}
