import { RiCloseLine, RiFocus3Line, RiZoomInLine, RiZoomOutLine } from "@remixicon/react";
import React, { TouchEvent, useEffect, useRef, useState, WheelEvent } from "react";
import { cn } from "@/utils/cn";

export interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  className?: string;
}

export const ImagePreviewDialog: React.FC<ImagePreviewDialogProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  className,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch pinch-to-zoom state
  const [touchState, setTouchState] = useState<{
    initialDistance: number | null;
    initialScale: number;
  }>({
    initialDistance: null,
    initialScale: 1,
  });

  // Reset transform when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

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
  }, [isOpen, currentIndex, images.length, onClose, resetZoom]);

  const navigatePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const navigateNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 4));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.5, Math.min(4, prev + delta)));
  };

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches as unknown as TouchList);
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
      const distance = getTouchDistance(e.touches as unknown as TouchList);
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

  const getTouchDistance = (touches: TouchList | ReadonlyArray<Touch> | unknown): number => {
    // Normalize to array-like for React.TouchList compatibility
    const t0 = touches[0];
    const t1 = touches[1];
    if (!t0 || !t1) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
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
    <div
      className={cn(
        "fixed inset-0 z-[10002] flex items-center justify-center bg-black/90 backdrop-blur-sm",
        "animate-in fade-in duration-200",
        className
      )}
      onClick={onClose}
      data-testid="image-preview-dialog"
    >
      <div
        ref={containerRef}
        className="relative w-full h-full max-w-4xl max-h-4xl m-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
          }
        }}
        role="group"
        tabIndex={0}
      >
        {/* Header Controls */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium">
              {currentIndex + 1} / {images.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <button
              onClick={zoomOut}
              className="btn-icon bg-white/10 hover:bg-white/20 text-white rounded-full"
              aria-label="Zoom out"
            >
              <RiZoomOutLine className="w-5 h-5" />
            </button>
            <button
              onClick={resetZoom}
              className="btn-icon bg-white/10 hover:bg-white/20 text-white rounded-full"
              aria-label="Reset zoom"
            >
              <RiFocus3Line className="w-5 h-5" />
            </button>
            <button
              onClick={zoomIn}
              className="btn-icon bg-white/10 hover:bg-white/20 text-white rounded-full"
              aria-label="Zoom in"
            >
              <RiZoomInLine className="w-5 h-5" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="btn-icon bg-white/10 hover:bg-white/20 text-white rounded-full ml-4"
              aria-label="Close preview"
            >
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div
          ref={imageRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg"
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
          <img
            src={images[currentIndex]}
            alt={`Preview ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain select-none"
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
                className="absolute left-4 top-1/2 -translate-y-1/2 btn-icon bg-white/10 hover:bg-white/20 text-white rounded-full"
                aria-label="Previous image"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 btn-icon bg-white/10 hover:bg-white/20 text-white rounded-full"
                aria-label="Next image"
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
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    index === currentIndex
                      ? "border-white shadow-lg scale-110"
                      : "border-white/30 hover:border-white/60"
                  )}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
