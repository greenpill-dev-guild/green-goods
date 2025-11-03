import { cn } from "@green-goods/shared/utils";
import { RiImageLine } from "@remixicon/react";
import React, { useState } from "react";

export interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackIcon?: React.ComponentType<{ className?: string }>;
  fallbackClassName?: string;
  onErrorCallback?: () => void;
}

/**
 * Image component with automatic fallback to placeholder on load error.
 * Handles missing images gracefully by showing an icon placeholder.
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className,
  fallbackIcon: FallbackIcon = RiImageLine,
  fallbackClassName,
  onErrorCallback,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = () => {
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
          "flex items-center justify-center bg-slate-100 text-slate-400",
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
            "absolute inset-0 flex items-center justify-center bg-slate-100 animate-pulse",
            className
          )}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(className, isLoading && "opacity-0", isLoaded && "image-reveal")}
        onError={handleError}
        onLoad={handleLoad}
        {...props}
      />
    </>
  );
};
