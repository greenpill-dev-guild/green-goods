/**
 * useUsernameController Hook
 *
 * Everything the Account tab's Username card reads and does (PRD-1026),
 * gathered once so the view is composition only: where the account's name
 * stands (`selectUsernameCard`), the change this device started, the name
 * field with its suggestion and availability, and the acts: claim a name,
 * start a change, choose another name mid-change, and check again.
 *
 * A change is the two signatures the contract needs, in order (D6): the
 * release now, and the claim once the release has cleared on Ethereum. The
 * new name is chosen before the release and kept on this device
 * (`useUsernameChangeStore`), so the card can offer its claim when the time
 * comes, after a reload included. Nothing is kept unless the release landed,
 * and a claim that doesn't land leaves the change open.
 *
 * Passkey accounts can't release on today's Arbitrum sender (D8), so their
 * change goes through the support request: `changeBySupport` says so.
 *
 * @module hooks/client-ui/profile/useUsernameController
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SW_MESSAGE } from "../../../modules/app/service-worker-protocol";
import { selectUsernameCard } from "../../../modules/ens/username";
import { useUsernameChangeStore } from "../../../stores/useUsernameChangeStore";
import type { Address } from "../../../types/domain";
import { chosenPasskeyUsername } from "../../../utils/app/text";
import { suggestSlug } from "../../../utils/blockchain/ens";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useAuthState } from "../../auth/useAuth";
import { useEnsName } from "../../blockchain/useEnsName";
import { useENSClaim } from "../../ens/useENSClaim";
import { useENSRegistrationStatus } from "../../ens/useENSRegistrationStatus";
import { useENSReleaseName } from "../../ens/useENSReleaseName";
import { useGreenGoodsEnsName } from "../../ens/useGreenGoodsEnsName";
import { useProtocolMemberStatus } from "../../ens/useProtocolMemberStatus";
import { useSlugAvailability } from "../../ens/useSlugAvailability";
import { useSlugForm } from "../../ens/useSlugForm";
import { useEventListener } from "../../utils/useEventListener";

export type { UsernameCardState, UsernameChange } from "../../../modules/ens/username";

const GREEN_GOODS_SUFFIX = /\.greengoods\.eth$/;

export function useUsernameController(primaryAddress: Address | undefined) {
  const isOnline = useOnlineStatus();
  const { authMode, userName } = useAuthState();
  const membership = useProtocolMemberStatus(primaryAddress);
  const current = useGreenGoodsEnsName(primaryAddress);
  const existingSlug =
    current.data && GREEN_GOODS_SUFFIX.test(current.data)
      ? current.data.replace(GREEN_GOODS_SUFFIX, "")
      : null;
  // A claim in flight, set before the wallet opens so the card holds on it
  // rather than on a form a read may already call taken; and the name claimed
  // here once it lands, which the card follows while it sets up.
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimedSlug, setClaimedSlug] = useState<string | null>(null);
  const slug = claimedSlug ?? existingSlug;

  const owner = primaryAddress?.toLowerCase();
  const change = useUsernameChangeStore((state) => (owner ? (state.changes[owner] ?? null) : null));
  const beginChange = useUsernameChangeStore((state) => state.begin);
  const retargetChange = useUsernameChangeStore((state) => state.retarget);
  const finishChange = useUsernameChangeStore((state) => state.finish);
  const awaitNotice = useUsernameChangeStore((state) => state.awaitNotice);
  const clearNotice = useUsernameChangeStore((state) => state.clearNotice);
  const noticeFor = useUsernameChangeStore((state) =>
    owner ? (state.notices[owner] ?? null) : null
  );
  const changeOpen = change !== null && (slug === null || slug === change.from);
  const followed = changeOpen ? change.from : slug;
  const status = useENSRegistrationStatus(followed ?? undefined);
  const target = useSlugAvailability(changeOpen ? (change.to ?? undefined) : undefined);

  const claimMutation = useENSClaim();
  const release = useENSReleaseName();
  const claimAsync = claimMutation.mutateAsync;
  const releaseAsync = release.mutateAsync;

  const card = selectUsernameCard({
    owner: primaryAddress,
    isMember: membership.isLoading ? undefined : (membership.data ?? false),
    nameLoading: current.isLoading,
    slug,
    claimedHere: claimedSlug !== null,
    claiming,
    status: status.data,
    statusError: status.isError,
    change,
    changeTargetFree: target.data,
  });

  // Start from the name the account already goes by: the username it chose for
  // its passkey, or the label of its wallet's ENS name. It stays editable, and
  // the availability check runs on it like on anything typed.
  const { data: walletEnsName } = useEnsName(primaryAddress);
  const knownName = chosenPasskeyUsername(authMode, userName) ?? walletEnsName?.split(".")[0];
  const suggestedSlug = knownName ? suggestSlug(knownName) : "";
  const slugForm = useSlugForm(suggestedSlug);
  const typed = slugForm.watch("slug");
  // The suggestion can arrive after the form mounts or change with the
  // account; it replaces only what it put in the field itself.
  const appliedSuggestion = useRef(suggestedSlug);
  useEffect(() => {
    const value = slugForm.getValues("slug");
    if (value === suggestedSlug || value !== appliedSuggestion.current) return;
    appliedSuggestion.current = suggestedSlug;
    slugForm.reset({ slug: suggestedSlug });
  }, [suggestedSlug, slugForm]);
  const typedAvailability = useSlugAvailability(
    card.kind === "choose" && typed ? typed : undefined
  );

  // A change is over once the account holds some other name, claimed here or
  // on another device. The lookup decides, not a claim still in flight.
  const staleChange = change !== null && existingSlug !== null && existingSlug !== change.from;
  useEffect(() => {
    if (staleChange && primaryAddress) finishChange(primaryAddress);
  }, [staleChange, primaryAddress, finishChange]);

  // The service worker hears once when a name claimed on this device becomes
  // ready. The name waits in the store, so leaving Profile or reloading during
  // the minutes it takes doesn't lose the notice, and it waits until a worker
  // controls the page: a page loaded before one took over can't tell it yet,
  // and the worker taking over here hears it then.
  const noticeReady = noticeFor !== null && card.kind === "ready" && slug === noticeFor;
  const [workerTurn, setWorkerTurn] = useState(0);
  useEventListener(
    typeof navigator === "undefined" ? undefined : navigator.serviceWorker,
    "controllerchange",
    () => setWorkerTurn((turn) => turn + 1)
  );
  useEffect(() => {
    if (!noticeReady || !noticeFor || !primaryAddress) return;
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return;
    worker.postMessage({ type: SW_MESSAGE.ENS_REGISTRATION_COMPLETE, slug: noticeFor });
    clearNotice(primaryAddress);
  }, [noticeReady, noticeFor, primaryAddress, clearNotice, workerTurn]);

  /** Claims `name`; true once it landed. The claim hook reports a failure. */
  const claim = useCallback(
    async (name: string) => {
      setClaiming(name);
      try {
        await claimAsync({ slug: name });
        // The claim hook has seeded the name's status as setting up.
        setClaimedSlug(name);
        if (primaryAddress) {
          finishChange(primaryAddress);
          awaitNotice(primaryAddress, name);
        }
        return true;
      } catch {
        return false;
      } finally {
        setClaiming(null);
      }
    },
    [claimAsync, finishChange, awaitNotice, primaryAddress]
  );

  /**
   * Step 1 of a change: releases the account's name and, once the release has
   * landed, keeps `to` as the name to claim when it clears. Throws when the
   * release doesn't land, so the sheet stays open with the name typed; the
   * release hook says why.
   */
  const startChange = useCallback(
    async (to: string) => {
      const released = await releaseAsync();
      beginChange(primaryAddress ?? released.owner, {
        from: released.slug,
        to,
        releasedAt: released.submittedAt,
      });
    },
    [releaseAsync, beginChange, primaryAddress]
  );

  /** Mid-change, the person wants a different name: the claim form takes the new one's place. */
  const chooseAnother = useCallback(() => {
    if (primaryAddress) retargetChange(primaryAddress, null);
  }, [primaryAddress, retargetChange]);

  const refetchStatus = status.refetch;
  const checkStatus = useCallback(() => void refetchStatus(), [refetchStatus]);

  return {
    isOnline,
    card,
    /** The name the account holds today, for the sheet's first line. */
    currentSlug: existingSlug,
    /** Passkey accounts change their name through support for now (D8). */
    changeBySupport: release.isSponsoredReleaseUnavailable,
    form: {
      slugForm,
      typed,
      available: typedAvailability.data,
      checking: typedAvailability.isFetching,
    },
    isCheckingStatus: status.isFetching,
    isClaiming: claimMutation.isPending,
    isReleasing: release.isPending,
    acts: { claim, startChange, chooseAnother, checkStatus },
  };
}

export type UsernameController = ReturnType<typeof useUsernameController>;
