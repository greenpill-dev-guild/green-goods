import { useCallback, useEffect, useRef, useState } from "react";

interface UseOptimizedImageOptions {
  src: string;
  placeholder?: string;
  lazy?: boolean;
  webpFallback?: boolean;
  quality?: number;
  sizes?: string;
}

interface UseOptimizedImageReturn {
  src: string;
  isLoading: boolean;
  hasError: boolean;
  imgRef: React.RefObject<HTMLImageElement>;
  retry: () => void;
}

// Check if browser supports WebP
const supportsWebP = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").indexOf("image/webp") === 5;
})();

export function useOptimizedImage({
  src,
  placeholder = "",
  lazy = true,
  webpFallback = true,
  quality = 80,
  sizes,
}: UseOptimizedImageOptions): UseOptimizedImageReturn {
  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Optimize image URL (this would typically integrate with your image service)
  const getOptimizedSrc = useCallback(
    (originalSrc: string) => {
      if (!originalSrc) return originalSrc;

      // Convert to WebP if supported and requested
      if (webpFallback && supportsWebP && !originalSrc.includes(".webp")) {
        // This is a placeholder - you'd typically have an image service
        // that handles format conversion and optimization
        const url = new URL(originalSrc, window.location.origin);
        url.searchParams.set("format", "webp");
        url.searchParams.set("quality", quality.toString());
        if (sizes) {
          url.searchParams.set("w", sizes);
        }
        return url.toString();
      }

      return originalSrc;
    },
    [webpFallback, quality, sizes]
  );

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      {
        rootMargin: "50px", // Start loading 50px before the image enters viewport
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy]);

  // Load image when in view
  useEffect(() => {
    if (!isInView || !src) return;

    const optimizedSrc = getOptimizedSrc(src);
    const img = new Image();

    setIsLoading(true);
    setHasError(false);

    img.onload = () => {
      setCurrentSrc(optimizedSrc);
      setIsLoading(false);
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      // Fallback to original src if optimized version fails
      if (optimizedSrc !== src) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          setCurrentSrc(src);
          setHasError(false);
        };
        fallbackImg.src = src;
      }
    };

    img.src = optimizedSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src, getOptimizedSrc]);

  const retry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setIsInView(true);
  }, []);

  return {
    src: currentSrc,
    isLoading,
    hasError,
    imgRef,
    retry,
  };
}
