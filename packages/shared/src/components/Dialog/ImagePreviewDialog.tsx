import * as Dialog from "@radix-ui/react-dialog";
import {
  RiCloseLine,
  RiDownloadLine,
  RiFocus3Line,
  RiZoomInLine,
  RiZoomOutLine,
} from "@remixicon/react";
import React, {
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import { cn } from "../../utils/styles/cn";
import { ImageWithFallback } from "../Display/ImageWithFallback";
import { defaultLabels, type ImagePreviewDialogLabels } from "./ImagePreviewDialog.labels";

export type { ImagePreviewDialogLabels };

export interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  className?: string;
  labels?: Partial<ImagePreviewDialogLabels>;
  /**
   * Control chrome. `app` (default) is the installed-PWA dialect: filled round
   * icon buttons. `editorial` matches the public website's record drawer —
   * hairline pills with mono uppercase labels. The two surface identities are
   * deliberately not mixed.
   */
  variant?: "app" | "editorial";
}

export const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  className,
  labels,
  variant = "app",
}) => {
  const resolvedLabels = { ...defaultLabels, ...labels };
  // The editorial variant's chrome is styled from `[data-variant="editorial"]`
  // rules in shared/src/styles/utilities.css, not from utilities here: Tailwind
  // does not scan packages/shared/src from the client build, so classes written
  // in this file never generate there.
  const editorial = variant === "editorial";
  const iconBtn = editorial ? "" : "btn-icon bg-bg-white-0/10 tap-feedback text-white rounded-full";
  const headerBar = editorial
    ? "shrink-0"
    : "absolute top-0 left-0 right-0 z-raised flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent";
  const counter = editorial ? "" : "text-sm text-white font-medium";
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLDivElement>(null);

  // Touch pinch-to-zoom state
  const [touchState, setTouchState] = useState<{
    initialDistance: number | null;
    initialScale: number;
  }>({
    initialDistance: null,
    initialScale: 1,
  });

  // Navigation functions
  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const navigateNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, images.length]);

  // Reset transform when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          navigatePrev();
          break;
        case "ArrowRight":
          navigateNext();
          break;
        case "+":
        case "=":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
        case "0":
          resetZoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, navigateNext, navigatePrev, zoomIn, zoomOut, resetZoom]);

  const handleDownload = () => {
    try {
      const url = images[currentIndex];
      if (!url) return;
      const link = document.createElement("a");
      link.href = url;
      const urlPath = (() => {
        try {
          return new URL(url, window.location.href).pathname;
        } catch {
          return url;
        }
      })();
      const lastSegment = urlPath.split("/").filter(Boolean).pop() || "download-image";
      link.download = lastSegment;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // noop
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.5, Math.min(4, prev + delta)));
  };

  // Touch handlers for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList): number => {
    const t0 = touches[0];
    const t1 = touches[1];
    if (!t0 || !t1) return 0;
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      setTouchState({
        initialDistance: distance,
        initialScale: scale,
      });
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchState.initialDistance) {
      const distance = getTouchDistance(e.touches);
      const scaleFactor = distance / touchState.initialDistance;
      const newScale = Math.max(0.5, Math.min(4, touchState.initialScale * scaleFactor));
      setScale(newScale);
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setTouchState({ initialDistance: null, initialScale: 1 });
    setIsDragging(false);
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="ImagePreviewDialog"
          data-slot="overlay"
          className={cn("fixed inset-0 z-overlay", className)}
          style={{ backgroundColor: "var(--color-scrim-obscure)" }}
          data-testid="image-preview-dialog"
        />
        <Dialog.Content
          data-component="ImagePreviewDialog"
          data-slot="content"
          data-variant={variant}
          className="fixed inset-0 z-modal flex items-center justify-center focus:outline-none"
          aria-label={resolvedLabels.dialogLabel}
        >
          <div
            className={cn(
              "relative w-full h-full max-w-4xl",
              // Editorial stacks bar / photo / filmstrip so the photo always
              // fits. The app variant keeps its floating chrome.
              editorial ? "flex flex-col gap-4 p-4 sm:p-6" : "max-h-4xl m-4"
            )}
          >
            {/* Header Controls */}
            <div data-slot="bar" className={headerBar}>
              <div className="flex items-center gap-2">
                <span data-slot="counter" className={counter}>
                  {currentIndex + 1} / {images.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom Controls — hidden on mobile (pinch-to-zoom is native) so close button
                    stays on-screen at narrow widths. */}
                <button
                  onClick={zoomOut}
                  data-slot="control"
                  data-optional="desktop"
                  className={cn("hidden sm:flex", iconBtn)}
                  aria-label={resolvedLabels.zoomOut}
                  type="button"
                >
                  <RiZoomOutLine className="w-5 h-5" />
                </button>
                <button
                  onClick={resetZoom}
                  data-slot="control"
                  data-optional="desktop"
                  className={cn("hidden sm:flex", iconBtn)}
                  aria-label={resolvedLabels.resetZoom}
                  type="button"
                >
                  <RiFocus3Line className="w-5 h-5" />
                </button>
                <button
                  onClick={zoomIn}
                  data-slot="control"
                  data-optional="desktop"
                  className={cn("hidden sm:flex", iconBtn)}
                  aria-label={resolvedLabels.zoomIn}
                  type="button"
                >
                  <RiZoomInLine className="w-5 h-5" />
                </button>

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  data-slot="control"
                  className={cn(iconBtn, "sm:ml-2")}
                  aria-label={resolvedLabels.downloadImage}
                  type="button"
                  data-testid="image-preview-download"
                >
                  <RiDownloadLine className="w-5 h-5" />
                </button>

                {/* Close Button — separated visually from zoom/download cluster */}
                <span
                  className={cn(
                    "ml-3 flex items-center",
                    editorial ? "" : "border-l border-white/20 pl-3"
                  )}
                >
                  <Dialog.Close asChild>
                    <button
                      data-slot="control"
                      data-shape={editorial ? "pill" : undefined}
                      className={
                        editorial
                          ? ""
                          : "btn-icon bg-bg-white-0/20 hover:bg-bg-white-0/30 tap-feedback text-white rounded-full"
                      }
                      aria-label={resolvedLabels.closePreview}
                      data-testid="image-preview-close"
                      type="button"
                    >
                      <RiCloseLine className={editorial ? "h-3.5 w-3.5" : "w-6 h-6"} />
                      {editorial ? resolvedLabels.close : null}
                    </button>
                  </Dialog.Close>
                </span>
              </div>
            </div>
            {/* Visually hidden title for accessibility */}
            <Dialog.Title className="sr-only">{resolvedLabels.title}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {resolvedLabels.description}
            </Dialog.Description>

            {/* Image Container */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- pan/zoom gesture surface; zoom, nav and close are real buttons in the toolbar */}
            <div
              ref={imageRef}
              role="application"
              data-slot="frame"
              className={cn(
                "relative flex w-full items-center justify-center overflow-hidden",
                editorial ? "min-h-0 flex-1" : "h-full rounded-xl border border-white/10"
              )}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ touchAction: "none" }}
            >
              <ImageWithFallback
                src={images[currentIndex]}
                alt={resolvedLabels.previewAlt(currentIndex + 1)}
                className="max-w-full max-h-full object-contain select-none"
                fallbackClassName="w-64 h-64"
                decoding="async"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                  cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                }}
                draggable={false}
              />
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <button
                    onClick={navigatePrev}
                    data-slot="control"
                    data-direction="prev"
                    className={iconBtn}
                    aria-label={resolvedLabels.previousImage}
                    type="button"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}

                {currentIndex < images.length - 1 && (
                  <button
                    onClick={navigateNext}
                    data-slot="control"
                    data-direction="next"
                    className={iconBtn}
                    aria-label={resolvedLabels.nextImage}
                    type="button"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
              </>
            )}

            {/* Thumbnail Navigation */}
            {images.length > 1 && (
              <div
                data-slot="filmstrip"
                className={cn(
                  editorial
                    ? "shrink-0"
                    : "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent"
                )}
              >
                <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      data-slot="thumb"
                      data-active={index === currentIndex}
                      className={cn(
                        "flex-shrink-0 w-16 h-16 overflow-hidden relative",
                        !editorial && "rounded-lg border-2 transition-all",
                        !editorial &&
                          (index === currentIndex
                            ? "border-white shadow-lg scale-110"
                            : "border-white/30 tap-feedback")
                      )}
                      type="button"
                      aria-label={resolvedLabels.goToImage(index + 1)}
                    >
                      <ImageWithFallback
                        src={image}
                        alt={resolvedLabels.thumbnailAlt(index + 1)}
                        className="w-full h-full object-cover"
                        fallbackClassName="w-16 h-16"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
