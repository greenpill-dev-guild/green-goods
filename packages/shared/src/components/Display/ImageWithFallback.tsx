import { RiImageLine } from "@remixicon/react";
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getIPFSFallbackGateways } from "../../modules/data/ipfs/resolve";
import { displayImageUrl } from "../../modules/offline-content/policy";
import { connectivityStore } from "../../stores/connectivity";
import { cn } from "../../utils/styles/cn";

/** A visible image that has not loaded in this long moves to the next gateway. */
const STALLED_GATEWAY_MS = 6_000;

/**
 * Extract the IPFS content path (CID plus any sub-path) from a gateway URL,
 * without the gateway's own query parameters.
 */
function extractIpfsPath(url: string): string | null {
  const match = url.match(/\/ipfs\/([^?#]+)/);
  return match ? match[1] : null;
}

/**
 * Module-level memory of the gateway that last served each IPFS path, shared by
 * every instance so a CID resolved once opens from the same gateway everywhere.
 */
const resolvedGateways = new Map<string, string>();

/**
 * Gateways in the order to try: the one that already worked this session, the
 * configured gateways (the first is the one offline preparation downloads from),
 * then the gateway the URL arrived with.
 */
function gatewayCandidates(src: string, ipfsPath: string | null): string[] {
  if (!ipfsPath) return [src];
  const given = src.slice(0, src.indexOf("/ipfs/"));
  const bases = [resolvedGateways.get(ipfsPath), ...getIPFSFallbackGateways(), given].filter(
    (base): base is string => Boolean(base)
  );
  return [...new Set(bases)].map((base) => displayImageUrl(`${base}/ipfs/${ipfsPath}`));
}

export interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Image loading strategy. Defaults to "lazy" for performance. */
  loading?: "lazy" | "eager";
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  fallbackClassName?: string;
  onErrorCallback?: () => void;
  /**
   * Background element rendered behind the image during loading and on error.
   * When provided, replaces the default loading placeholder and error icon.
   * Pulses during loading; displays static on error or when src is empty.
   */
  backgroundFallback?: React.ReactNode;
}

/**
 * Image component with automatic fallback to placeholder on load error.
 * IPFS images request one gateway at a time: the next gateway is tried only when
 * the current one fails or stalls while visible, so a list of cards never opens
 * several downloads per photo. An image that failed while the device was offline
 * tries again when the connection returns.
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className,
  loading = "lazy",
  fallbackIcon: FallbackIcon = RiImageLine,
  fallbackClassName,
  onErrorCallback,
  backgroundFallback,
  ...props
}) => {
  // Sanitize src to prevent javascript: XSS
  const safeSrc = /^(https?:|data:image\/|\/|blob:)/i.test(src) ? src : "";
  const ipfsPath = safeSrc ? extractIpfsPath(safeSrc) : null;

  // When an IPFS gateway has already served this path in this session, the bytes
  // are also in the browser cache — paint the <img> at full opacity from the first
  // frame instead of cycling through opacity-0 → image-reveal. The opacity-0 frame
  // would otherwise be captured by View Transitions snapshots (e.g. Garden card →
  // dialog morph), making the wrapper background show through the photograph.
  const hasResolvedCache = Boolean(ipfsPath && resolvedGateways.has(ipfsPath));

  const [candidates, setCandidates] = useState(() => gatewayCandidates(safeSrc, ipfsPath));
  const [attempt, setAttempt] = useState(0);
  const [hasError, setHasError] = useState(!safeSrc);
  const [isLoading, setIsLoading] = useState(!!safeSrc && !hasResolvedCache);
  const [isLoaded, setIsLoaded] = useState(hasResolvedCache);
  const [cacheHitForCurrentSrc, setCacheHitForCurrentSrc] = useState(hasResolvedCache);
  const [shouldAnimateReveal, setShouldAnimateReveal] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const online = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot
  );
  const failedOffline = useRef(false);

  // Re-sync state when the `src` prop changes. `useState` only consumes its
  // initializer on first mount, so without this effect a single component
  // instance pointed at a sequence of images (e.g. ImagePreviewDialog) keeps
  // rendering the first URL even though the prop changes.
  useEffect(() => {
    setCandidates(gatewayCandidates(safeSrc, ipfsPath));
    setAttempt(0);
    setHasError(!safeSrc);
    setIsLoading(!!safeSrc && !hasResolvedCache);
    setIsLoaded(hasResolvedCache);
    setCacheHitForCurrentSrc(hasResolvedCache);
    setShouldAnimateReveal(false);
    // hasResolvedCache is fully derived from safeSrc/ipfsPath at mount of this src.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSrc, ipfsPath]);

  // Stable ref for onErrorCallback so a new callback identity never restarts loading.
  const onErrorRef = useRef(onErrorCallback);
  useEffect(() => {
    onErrorRef.current = onErrorCallback;
  });

  const currentSrc = candidates[attempt] ?? "";
  const hasNextGateway = attempt + 1 < candidates.length;

  const advanceOrFail = () => {
    if (hasNextGateway) {
      setCacheHitForCurrentSrc(false);
      setAttempt((value) => value + 1);
      return;
    }
    failedOffline.current = !connectivityStore.getSnapshot();
    setHasError(true);
    setIsLoading(false);
    onErrorRef.current?.();
  };

  // Move past a gateway that stalls, but only once the image is actually visible;
  // a lazy image below the fold has not started loading yet.
  useEffect(() => {
    if (!ipfsPath || !isLoading || hasError || !hasNextGateway) return;
    const element = imageRef.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (timer === undefined)
        timer = setTimeout(() => setAttempt((value) => value + 1), STALLED_GATEWAY_MS);
    };
    if (loading === "eager" || typeof IntersectionObserver === "undefined" || !element) {
      start();
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ipfsPath, isLoading, hasError, hasNextGateway, attempt, loading]);

  // An image that failed only because the device was offline tries again on reconnect.
  useEffect(() => {
    if (!hasError || !online || !failedOffline.current || !safeSrc) return;
    failedOffline.current = false;
    setCandidates(gatewayCandidates(safeSrc, ipfsPath));
    setAttempt(0);
    setHasError(false);
    setIsLoading(true);
  }, [hasError, online, safeSrc, ipfsPath]);

  const handleLoad = () => {
    setIsLoading(false);
    setIsLoaded(true);
    setShouldAnimateReveal(!cacheHitForCurrentSrc);
    if (ipfsPath && currentSrc) resolvedGateways.set(ipfsPath, currentSrc.split("/ipfs/")[0]);
  };

  const handleError = () => {
    if (ipfsPath) resolvedGateways.delete(ipfsPath);
    advanceOrFail();
  };

  if (hasError) {
    if (backgroundFallback) {
      return <>{backgroundFallback}</>;
    }
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-bg-weak-50 text-text-soft-400",
          fallbackClassName,
          className
        )}
        aria-label={alt || "Image not available"}
      >
        <FallbackIcon className="w-6 h-6" />
      </div>
    );
  }

  return (
    <>
      {backgroundFallback
        ? !isLoaded && (
            <div className={cn("absolute inset-0", isLoading && "animate-pulse")}>
              {backgroundFallback}
            </div>
          )
        : isLoading && (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-bg-weak-50 animate-pulse",
                className
              )}
            />
          )}
      {currentSrc && (
        <img
          ref={imageRef}
          src={currentSrc}
          alt={alt}
          loading={loading}
          className={cn(
            className,
            isLoading && "opacity-0",
            isLoaded && shouldAnimateReveal && "image-reveal"
          )}
          onError={handleError}
          onLoad={handleLoad}
          {...props}
        />
      )}
    </>
  );
};
