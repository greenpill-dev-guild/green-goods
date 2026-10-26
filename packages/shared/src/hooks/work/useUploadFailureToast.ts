import { useCallback, useEffect, useRef } from "react";
import type { FailedInAnotherGarden } from "../../components/Toast/presets/queue";
import { orientUploads, uploadGarden } from "../../modules/work/your-work-on-phone";
import type { Job } from "../../types/job-queue";
import { compareAddresses } from "../../utils/blockchain/address";
import { useActiveGarden } from "../garden/useActiveGarden";

/** A work or review upload the queue gave up on, and the error it reported. */
export interface FailedUpload {
  kind: "work" | "approval";
  detail?: string;
  job: Job;
}

type ShowFailure = (
  kind: FailedUpload["kind"],
  detail?: string,
  elsewhere?: FailedInAnotherGarden,
  openYourWork?: () => void
) => void;

/**
 * Raises the toast for an upload the queue gave up on, pointed where the upload is listed (PWA
 * Home step 12). Your Work lists the active garden only, so a failure in another of the member's
 * gardens names that garden and offers `openSwitcher`; without it, every failure keeps the Your
 * Work toast, whose Review opens Your Work through `openYourWork`. A failure outside the active
 * garden that lands while the member's gardens load waits for them, one of each kind, since a
 * later failure takes the same toast's place. If they can't load, the Your Work toast stands, and
 * a failure held for an account that has since signed out is dropped.
 *
 * The returned function is stable and reads the latest gardens, for event handlers that subscribe
 * once.
 */
export function useUploadFailureToast(
  account: string | null | undefined,
  showFailure: ShowFailure,
  openSwitcher?: () => void,
  openYourWork?: () => void
): (failure: FailedUpload) => void {
  const { inScope, myGardens } = useActiveGarden();
  const heldRef = useRef(new Map<FailedUpload["kind"], FailedUpload>());
  const toastRef = useRef<(failure: FailedUpload) => void>(() => undefined);
  toastRef.current = (failure) => {
    const orientation = openSwitcher
      ? orientUploads(
          inScope,
          myGardens.isLoaded ? myGardens.gardens.map(({ garden }) => garden) : null,
          [uploadGarden(failure.job)]
        )
      : undefined;
    if (orientation === null && !myGardens.isError) {
      heldRef.current.set(failure.kind, failure);
      return;
    }
    showFailure(
      failure.kind,
      failure.detail,
      orientation?.target === "switcher" && openSwitcher
        ? { gardenName: orientation.gardenName, openSwitcher }
        : undefined,
      openYourWork
    );
  };

  const gardensSettled = myGardens.isLoaded || myGardens.isError;
  useEffect(() => {
    if (!gardensSettled) return;
    const held = [...heldRef.current.values()];
    heldRef.current.clear();
    for (const failure of held) {
      if (compareAddresses(failure.job.userAddress, account)) toastRef.current(failure);
    }
  }, [account, gardensSettled]);

  return useCallback((failure: FailedUpload) => toastRef.current(failure), []);
}
