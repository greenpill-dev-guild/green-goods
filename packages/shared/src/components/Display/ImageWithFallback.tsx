import { RiImageLine } from "@remixicon/react";
import React, { useEffect, useRef, useState } from "react";
import { getIPFSFallbackGateways } from "../../modules/data/ipfs";
import { cn } from "../../utils/styles/cn";

/**
 * Extract the IPFS path (/ipfs/CID...) from a gateway URL.
 */
function extractIpfsPath(url: string): string | null {
  const match = url.match(/\/ipfs\/(.+)/);
  return match ? match[1] : null;
}

/**
 * Module-level cache: maps IPFS path (e.g. "bafkrei...") to the
 * gateway base URL that successfully loaded it. Shared across all
 * ImageWithFallback instances so a CID resolved once is instant everywhere.
 */
const resolvedUrlCache = new Map<string, string>();

/**
 * Append Pinata image optimization query params for faster, smaller delivery.
 * Only applies to Pinata dedicated gateway URLs (*.mypinata.cloud).
 * Requests width=800 (good for 2x retina at typical banner sizes) and auto format
 * (Pinata serves WebP/AVIF based on browser Accept header).
 */
function optimizeForDisplay(url: string): string {
  if (!url.includes("mypinata.cloud/")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}img-width=800&img-format=auto`;
}

interface ImageRace {
  promise: Promise<string>;
  cancel: () => void;
}

/**
 * Race multiple image URLs in parallel using hidden Image objects.
 * Returns the first URL that loads successfully. The winning image is
 * already in the browser cache, so the visible <img> loads instantly.
 */
function raceImageLoad(urls: string[], timeoutMs = 15_000): ImageRace {
  const images: HTMLImageElement[] = [];
  let settled = false;

  const cancel = () => {
    if (settled) return;
    settled = true;
    for (const img of images) {
      img.onload = null;
      img.onerror = null;
      img.src = "";
    }
  };

  const promise = new Promise<string>((resolve, reject) => {
    if (urls.length === 0) {
      reject(new Error("No URLs to race"));
      return;
    }

    let errorCount = 0;
    const timeout = setTimeout(() => {
      if (settled) return;
      cancel();
      reject(new Error("Gateway race timed out"));
    }, timeoutMs);

    for (const url of urls) {
      const img = new Image();
      images.push(img);

      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        for (const other of images) {
          if (other !== img) {
            other.onload = null;
            other.onerror = null;
            other.src = "";
          }
        }
        resolve(url);
      };

      img.onerror = () => {
        errorCount++;
        if (errorCount === urls.length && !settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error("All gateways failed"));
        }
      };

      img.src = url;
    }
  });

  return { promise, cancel };
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
 * For IPFS images, races all configured gateways in parallel — the first
 * to respond wins and subsequent instances reuse the cached gateway.
 * Applies Pinata image optimization (resize + auto format) when available.
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

  // Check in-memory cache for a previously resolved URL
  const ipfsPath = safeSrc ? extractIpfsPath(safeSrc) : null;
  const cachedUrl = ipfsPath ? resolvedUrlCache.get(ipfsPath) : null;

  // For uncached IPFS URLs, don't set an initial src — race will find the fastest gateway
  const needsRace = Boolean(ipfsPath && !cachedUrl);
  const initialSrc = needsRace ? "" : cachedUrl ? optimizeForDisplay(cachedUrl) : safeSrc;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(!safeSrc);
  const [isLoading, setIsLoading] = useState(!!safeSrc);
  const [isLoaded, setIsLoaded] = useState(false);

  // Stable ref for onErrorCallback to avoid re-triggering the race effect
  const onErrorRef = useRef(onErrorCallback);
  useEffect(() => {
    onErrorRef.current = onErrorCallback;
  });

  // Race IPFS gateways in parallel for uncached CIDs
  useEffect(() => {
    if (!needsRace || !ipfsPath) return;

    const gateways = getIPFSFallbackGateways();
    const urls = gateways.map((gw) => optimizeForDisplay(`${gw}/ipfs/${ipfsPath}`));
    const race = raceImageLoad(urls);

    let cancelled = false;

    race.promise
      .then((winnerUrl) => {
        if (cancelled) return;
        // Cache the base URL (without optimization params) for future instances
        const baseUrl = winnerUrl.split("?")[0];
        resolvedUrlCache.set(ipfsPath, baseUrl);
        setCurrentSrc(winnerUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
        setIsLoading(false);
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      race.cancel();
    };
  }, [ipfsPath, needsRace]);

  const handleLoad = () => {
    setIsLoading(false);
    setIsLoaded(true);
    // Update cache with the URL that actually worked
    if (ipfsPath && currentSrc) {
      const baseUrl = currentSrc.split("?")[0];
      resolvedUrlCache.set(ipfsPath, baseUrl);
    }
  };

  const handleError = () => {
    // For IPFS URLs, the parallel race handles gateway fallback
    if (ipfsPath) return;
    setHasError(true);
    setIsLoading(false);
    onErrorCallback?.();
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
          src={currentSrc}
          alt={alt}
          loading={loading}
          className={cn(className, isLoading && "opacity-0", isLoaded && "image-reveal")}
          onError={handleError}
          onLoad={handleLoad}
          {...props}
        />
      )}
    </>
  );
};
