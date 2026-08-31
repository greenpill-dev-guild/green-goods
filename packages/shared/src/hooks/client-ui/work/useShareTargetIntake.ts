import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import type { SetURLSearchParams } from "react-router-dom";

import { toastService } from "../../../components/Toast/toast.service";
import { logger } from "../../../modules/app/logger";
import {
  consumeShareTarget,
  loadShareTarget,
  type LoadedShareTarget,
} from "../../../modules/app/share-target";
import { normalizeWorkMediaFiles } from "../../../modules/work/media-processing";
import type { Address } from "../../../types/domain";

interface ShareTargetIntakeParams {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  setValue: (name: "feedback", value: string, options: { shouldDirty: boolean }) => void;
  setImages: (files: File[]) => void;
  saveOnExit: () => Promise<string | null | undefined>;
  gardenAddress: Address | null;
  actionUID: number | null;
}

/**
 * Imports PWA share-target payloads into the work-submission form: surfaces
 * invalid-share errors, loads and applies a shared payload exactly once, and
 * persists it into a draft (consuming the share token) as soon as a garden and
 * action are selected. Extracted verbatim from useWorkSubmissionFlowController.
 */
export function useShareTargetIntake({
  searchParams,
  setSearchParams,
  setValue,
  setImages,
  saveOnExit,
  gardenAddress,
  actionUID,
}: ShareTargetIntakeParams): void {
  const intl = useIntl();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const [pendingShare, setPendingShare] = useState<LoadedShareTarget | null>(null);
  const pendingShareRef = useRef<LoadedShareTarget | null>(null);
  const appliedShareTokenRef = useRef<string | null>(null);
  const shareLoadGenerationRef = useRef(0);
  const shareSaveInFlightRef = useRef(false);
  const shareSaveRetryRef = useRef<{ token: string | null; count: number }>({
    token: null,
    count: 0,
  });
  const [shareLoadRetryNonce, setShareLoadRetryNonce] = useState(0);
  const [shareSaveRetryNonce, setShareSaveRetryNonce] = useState(0);

  const clearShareParams = useCallback(
    (keys: string[], expected?: { key: string; value: string }) => {
      const current = searchParamsRef.current;
      if (expected && current.get(expected.key) !== expected.value) return;
      const next = new URLSearchParams(current);
      keys.forEach((key) => next.delete(key));
      setSearchParams(next, { replace: true });
    },
    [setSearchParams]
  );

  useEffect(() => {
    const shareError = searchParams.get("shareTargetError");
    if (!shareError) return;
    toastService.error({
      title: intl.formatMessage({
        id: "app.shareTarget.invalid.title",
        defaultMessage: "That share could not be imported",
      }),
      message: intl.formatMessage({
        id: "app.shareTarget.invalid.message",
        defaultMessage: "Try sharing up to five supported photos again.",
      }),
    });
    clearShareParams(["shareTargetError"]);
  }, [clearShareParams, intl, searchParams]);

  useEffect(() => {
    const token = searchParams.get("shareTarget");
    if (!token || appliedShareTokenRef.current === token) return;
    const pendingToken = pendingShareRef.current?.envelope.token;
    if (shareSaveInFlightRef.current || (pendingToken && pendingToken !== token)) return;
    const generation = ++shareLoadGenerationRef.current;
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await loadShareTarget(token);
        if (!loaded) throw new Error("Shared payload is missing or expired");
        const normalized = await normalizeWorkMediaFiles(loaded.files);
        if (normalized.rejected.length > 0) {
          throw new Error("Shared payload contains unsupported media");
        }
        if (cancelled || generation !== shareLoadGenerationRef.current) return;
        setValue("feedback", loaded.feedback, { shouldDirty: true });
        setImages(normalized.accepted.map((entry) => entry.file));
        pendingShareRef.current = loaded;
        setPendingShare(loaded);
        appliedShareTokenRef.current = token;
      } catch (error) {
        if (cancelled || generation !== shareLoadGenerationRef.current) return;
        logger.warn("Share Target import failed", { source: "GardenFlow", error });
        toastService.error({
          title: intl.formatMessage({
            id: "app.shareTarget.invalid.title",
            defaultMessage: "That share could not be imported",
          }),
          message: intl.formatMessage({
            id: "app.shareTarget.invalid.message",
            defaultMessage: "Try sharing up to five supported photos again.",
          }),
        });
        try {
          await consumeShareTarget(token);
        } catch (cleanupError) {
          logger.warn("Share Target cleanup failed", {
            source: "GardenFlow",
            error: cleanupError,
          });
        }
        clearShareParams(["shareTarget"], { key: "shareTarget", value: token });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearShareParams, intl, searchParams, setImages, setValue, shareLoadRetryNonce]);

  useEffect(() => {
    if (!pendingShare || !gardenAddress || actionUID === null || shareSaveInFlightRef.current) {
      return;
    }
    const shareToken = pendingShare.envelope.token;
    if (shareSaveRetryRef.current.token !== shareToken) {
      shareSaveRetryRef.current = { token: shareToken, count: 0 };
    }
    shareSaveInFlightRef.current = true;
    void (async () => {
      let shouldRetry = false;
      try {
        const draftId = await saveOnExit();
        if (!draftId) {
          shouldRetry = true;
          return;
        }
        await consumeShareTarget(shareToken);
        shareSaveRetryRef.current = { token: null, count: 0 };
        if (pendingShareRef.current?.envelope.token === shareToken) {
          pendingShareRef.current = null;
          setPendingShare(null);
        }
        clearShareParams(["shareTarget"], { key: "shareTarget", value: shareToken });
        toastService.success({
          title: intl.formatMessage({
            id: "app.shareTarget.imported.title",
            defaultMessage: "Shared work added to your draft",
          }),
        });
      } catch (error) {
        shouldRetry = true;
        logger.warn("Share Target draft save failed", { source: "GardenFlow", error });
      } finally {
        shareSaveInFlightRef.current = false;
        setShareLoadRetryNonce((current) => current + 1);
        if (
          shouldRetry &&
          shareSaveRetryRef.current.token === shareToken &&
          shareSaveRetryRef.current.count < 1
        ) {
          shareSaveRetryRef.current.count += 1;
          setShareSaveRetryNonce((current) => current + 1);
        }
      }
    })();
  }, [
    actionUID,
    clearShareParams,
    gardenAddress,
    intl,
    pendingShare,
    saveOnExit,
    shareSaveRetryNonce,
  ]);
}
