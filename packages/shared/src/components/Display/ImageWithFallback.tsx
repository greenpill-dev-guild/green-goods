import { RiImageLine } from "@remixicon/react";
import React, { useRef, useState } from "react";
import { cn } from "../../utils/styles/cn";

/** Ordered list of IPFS gateways to try when image loading fails */
const FALLBACK_GATEWAYS = ["https://w3s.link", "https://storacha.link", "https://dweb.link"];

/**
 * Attempt to rewrite an IPFS gateway URL to use an alternate gateway.
 * Returns null if the URL is not an IPFS gateway URL.
 */
function rewriteGateway(url: string, newGateway: string): string | null {
  const match = url.match(/https?:\/\/[^/]+\/ipfs\/(.+)/);
  if (match) {
    return `${newGateway}/ipfs/${match[1]}`;
  }
  return null;
}

export interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Image loading strategy. Defaults to "lazy" for performance. */
  loading?: "lazy" | "eager";
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  fallbackClassName?: string;
  onErrorCallback?: () => void;
}

/**
 * Image component with automatic fallback to placeholder on load error.
 * For IPFS images, tries alternate gateways before giving up.
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className,
  loading = "lazy",
  fallbackIcon: FallbackIcon = RiImageLine,
  fallbackClassName,
  onErrorCallback,
  ...props
}) => {
  // Sanitize src to prevent javascript: XSS
  const safeSrc = /^(https?:|data:image\/|\/|blob:)/i.test(src) ? src : "";

  const [currentSrc, setCurrentSrc] = useState(safeSrc);
  const [hasError, setHasError] = useState(!safeSrc);
  const [isLoading, setIsLoading] = useState(!!safeSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const triedGateways = useRef<Set<string>>(new Set());

  const handleError = () => {
    // Try alternate IPFS gateways before showing fallback
    for (const gateway of FALLBACK_GATEWAYS) {
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
  };

  if (hasError) {
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
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-bg-weak-50 animate-pulse",
            className
          )}
        />
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
