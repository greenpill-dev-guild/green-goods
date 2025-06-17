import React from "react";
import { useOptimizedImage } from "@/hooks/useOptimizedImage";
import { cn } from "@/utils/cn";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  lazy?: boolean;
  webpFallback?: boolean;
  quality?: number;
  sizes?: string;
  containerClassName?: string;
  loadingClassName?: string;
  errorClassName?: string;
  onLoadingStateChange?: (isLoading: boolean) => void;
  fallbackComponent?: React.ReactNode;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  placeholder,
  lazy = true,
  webpFallback = true,
  quality = 80,
  sizes,
  className,
  containerClassName,
  loadingClassName,
  errorClassName,
  onLoadingStateChange,
  fallbackComponent,
  ...props
}) => {
  const {
    src: optimizedSrc,
    isLoading,
    hasError,
    imgRef,
    retry,
  } = useOptimizedImage({
    src,
    placeholder,
    lazy,
    webpFallback,
    quality,
    sizes,
  });

  React.useEffect(() => {
    onLoadingStateChange?.(isLoading);
  }, [isLoading, onLoadingStateChange]);

  if (hasError && fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      <img
        ref={imgRef}
        src={optimizedSrc}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoading && "opacity-0",
          !isLoading && "opacity-100",
          hasError && errorClassName,
          className
        )}
        loading={lazy ? "lazy" : "eager"}
        decoding="async"
        {...props}
      />

      {/* Loading state */}
      {isLoading && (
        <div className={cn("absolute inset-0 bg-gray-200 animate-pulse", loadingClassName)} />
      )}

      {/* Error state */}
      {hasError && !fallbackComponent && (
        <div
          className={cn(
            "absolute inset-0 bg-gray-100 flex items-center justify-center",
            errorClassName
          )}
        >
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-2">Failed to load image</p>
            <button onClick={retry} className="text-primary-base text-sm hover:underline">
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
