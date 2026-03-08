import { RiImageLine } from "@remixicon/react";
import React, { useRef, useState } from "react";
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
 * Rewrite an IPFS gateway URL to use an alternate gateway.
 */
function rewriteGateway(url: string, newGateway: string): string | null {
  const ipfsPath = extractIpfsPath(url);
  if (ipfsPath) {
    return `${newGateway}/ipfs/${ipfsPath}`;
  }
  return null;
}

/**
 * Module-level cache: maps IPFS path (e.g. "bafkrei.../file.json") to the
 * gateway URL that successfully loaded it. Shared across all ImageWithFallback
 * instances so a CID resolved once is instant everywhere.
 */
const resolvedUrlCache = new Map<string, string>();

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
 * For IPFS images, tries alternate gateways before giving up.
 * Caches successful gateway URLs in memory so repeat loads are instant.
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
  const initialSrc = cachedUrl || safeSrc;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(!initialSrc);
  const [isLoading, setIsLoading] = useState(!!initialSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const triedGateways = useRef<Set<string>>(new Set());

  const handleError = () => {
    const gateways = getIPFSFallbackGateways();
    for (const gateway of gateways) {
      if (triedGateways.current.has(gateway)) continue;
      triedGateways.current.add(gateway);

      const alternate = rewriteGateway(currentSrc, gateway);
      if (alternate && alternate !== currentSrc) {
        setCurrentSrc(alternate);
        setIsLoading(true);
        return;
      }
    }

    // All gateways exhausted — show fallback
    setHasError(true);
    setIsLoading(false);
    onErrorCallback?.();
  };

  const handleLoad = () => {
    setIsLoading(false);
    setIsLoaded(true);

    // Cache the working URL so other instances skip straight to it
    if (ipfsPath && currentSrc) {
      resolvedUrlCache.set(ipfsPath, currentSrc);
    }
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
      {backgroundFallback ? (
        <div className={cn("absolute inset-0", isLoading && "animate-pulse")}>
          {backgroundFallback}
        </div>
      ) : (
        isLoading && (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-bg-weak-50 animate-pulse",
              className
            )}
          />
        )
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        className={cn(className, isLoading && "opacity-0", isLoaded && "image-reveal")}
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </>
  );
};
