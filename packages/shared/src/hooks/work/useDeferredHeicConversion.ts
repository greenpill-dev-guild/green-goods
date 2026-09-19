/**
 * Converting a composer's HEIC photos as soon as the decoder can load.
 *
 * A photo picked before the decoder was on the device waits in the composer as
 * it was picked. This watches for the moment conversion can succeed (the
 * offline-ready files arriving, or the connection coming back) and swaps each
 * waiting photo for its JPEG in place, so the draft saves the JPEG.
 *
 * @module hooks/work/useDeferredHeicConversion
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observePwaShellTier } from "../../modules/app/service-worker-registration";
import { convertHeicPhoto } from "../../modules/work/heic-conversion";
import { getWorkMediaId } from "../../modules/work/media-processing";
import { isHeicFile } from "../../modules/work/work-attachments";
import { connectivityStore } from "../../stores/connectivity";

/** `failed`: the decoder loaded and could not read the photo; only a retry tries again. */
export type DeferredHeicState = "waiting" | "converting" | "failed";

export interface UseDeferredHeicConversionOptions {
  files: File[];
  /** Swap one photo, by media id, for its converted JPEG in the same position. */
  replace: (mediaId: string, converted: File) => void;
  onConverted?: (original: File, converted: File) => void;
  onFailed?: (file: File, error: unknown) => void;
}

export function useDeferredHeicConversion(options: UseDeferredHeicConversionOptions) {
  const [states, setStates] = useState<ReadonlyMap<string, DeferredHeicState>>(new Map());
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(options);
  latest.current = options;
  // One conversion pass at a time for the life of the composer. A pass keeps
  // going when a swap re-renders it; a wake that arrives meanwhile runs after.
  const alive = useRef(true);
  const running = useRef(false);
  const rerun = useRef(false);
  const failed = useRef(new Set<string>());

  const waitingIds = options.files.filter(isHeicFile).map(getWorkMediaId).join(":");
  const wake = useCallback(() => setAttempt((count) => count + 1), []);
  const setState = useCallback((mediaId: string, state: DeferredHeicState | null) => {
    setStates((current) => {
      if ((current.get(mediaId) ?? null) === state) return current;
      const next = new Map(current);
      if (state) next.set(mediaId, state);
      else next.delete(mediaId);
      return next;
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!waitingIds) return;
    const stopTier = observePwaShellTier("priority", (status) => {
      if (status === "ready") wake();
    });
    const stopStatus = connectivityStore.subscribeStatus(wake);
    return () => {
      stopTier();
      stopStatus();
    };
  }, [waitingIds, wake]);

  useEffect(() => {
    if (!waitingIds) return;
    if (running.current) {
      rerun.current = true;
      return;
    }
    running.current = true;
    const convertWaiting = async () => {
      for (const file of latest.current.files.filter(isHeicFile)) {
        const mediaId = getWorkMediaId(file);
        if (failed.current.has(mediaId)) continue;
        setState(mediaId, "converting");
        const result = await convertHeicPhoto(file);
        if (!alive.current) return;
        if (result.status === "unavailable") {
          setState(mediaId, "waiting");
          return;
        }
        if (result.status === "failed") {
          failed.current.add(mediaId);
          setState(mediaId, "failed");
          latest.current.onFailed?.(file, result.error);
          continue;
        }
        setState(mediaId, null);
        latest.current.replace(mediaId, result.file);
        latest.current.onConverted?.(file, result.file);
      }
    };
    void convertWaiting().finally(() => {
      running.current = false;
      if (alive.current && rerun.current) {
        rerun.current = false;
        wake();
      }
    });
  }, [attempt, waitingIds, setState, wake]);

  const stateOf = useCallback(
    (file: File): DeferredHeicState | undefined =>
      isHeicFile(file) ? (states.get(getWorkMediaId(file)) ?? "waiting") : undefined,
    [states]
  );
  const retry = useCallback(
    (file: File) => {
      const mediaId = getWorkMediaId(file);
      failed.current.delete(mediaId);
      setState(mediaId, "waiting");
      wake();
    },
    [setState, wake]
  );

  return { stateOf, retry };
}
