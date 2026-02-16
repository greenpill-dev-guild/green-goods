import { AudioPlayer } from "@green-goods/shared/components";
import { resolveIPFSUrl } from "@green-goods/shared";
import { RiCloseLine, RiImageLine, RiZoomInLine } from "@remixicon/react";
import { useCallback, useState } from "react";

interface MediaEvidenceProps {
  /** IPFS CIDs for photo/video media */
  media: string[];
  /** IPFS CIDs for gardener audio notes (from work metadata) */
  audioNoteCids?: string[];
  /** Action title for alt text context */
  actionTitle?: string;
}

/**
 * Displays media evidence for a work submission — photo grid with lightbox
 * and AudioPlayer for gardener audio notes.
 */
export function MediaEvidence({ media, audioNoteCids, actionTitle }: MediaEvidenceProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const resolvedMedia = media.map((cid) => resolveIPFSUrl(cid));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev !== null ? Math.min(prev + 1, resolvedMedia.length - 1) : 0
        );
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null ? Math.max(prev - 1, 0) : 0));
      }
    },
    [lightboxIndex, resolvedMedia.length]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-strong">Media Evidence</h3>

      {/* Photo grid */}
      {resolvedMedia.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resolvedMedia.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-stroke-soft bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
              aria-label={`View ${actionTitle ? `${actionTitle} ` : ""}photo ${index + 1} of ${resolvedMedia.length}`}
            >
              <img
                src={src}
                alt={`${actionTitle ?? "Work"} evidence ${index + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-static-black/0 transition-colors group-hover:bg-static-black/20">
                <RiZoomInLine className="h-6 w-6 text-static-white opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stroke-soft bg-bg-weak py-8">
          <RiImageLine className="h-8 w-8 text-text-soft" />
          <p className="mt-2 text-sm text-text-soft">No media attached</p>
        </div>
      )}

      {/* Audio notes from gardener */}
      {audioNoteCids && audioNoteCids.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-sub">Audio Notes</h4>
          {audioNoteCids.map((cid) => (
            <AudioPlayer key={cid} src={resolveIPFSUrl(cid)} compact={false} className="w-full" />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-static-black/80 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-label="Image lightbox"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-static-white/10 text-static-white transition hover:bg-static-white/20"
            aria-label="Close lightbox"
          >
            <RiCloseLine className="h-6 w-6" />
          </button>

          {/* Navigation hint */}
          {resolvedMedia.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-static-white/60">
              {lightboxIndex + 1} / {resolvedMedia.length} — use arrow keys to navigate
            </p>
          )}

          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src={resolvedMedia[lightboxIndex]}
            alt={`${actionTitle ?? "Work"} evidence ${lightboxIndex + 1} (full size)`}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
