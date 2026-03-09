import {
  AudioPlayer,
  ImagePreviewDialog,
  ImageWithFallback,
  resolveIPFSUrl,
} from "@green-goods/shared";
import { RiImageLine, RiZoomInLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const { formatMessage } = useIntl();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const resolvedMedia = media.map((cid) => resolveIPFSUrl(cid));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-strong">
        {formatMessage({ id: "admin.work.mediaEvidence", defaultMessage: "Media Evidence" })}
      </h3>

      {/* Photo grid */}
      {resolvedMedia.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resolvedMedia.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setPreviewIndex(index)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-stroke-soft bg-bg-weak focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
              aria-label={`View ${actionTitle ? `${actionTitle} ` : ""}photo ${index + 1} of ${resolvedMedia.length}`}
            >
              <ImageWithFallback
                src={src}
                alt={`${actionTitle ?? "Work"} evidence ${index + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                fallbackClassName="h-full w-full"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-static-black/0 transition-colors group-hover:bg-static-black/20">
                <RiZoomInLine className="h-6 w-6 text-static-white opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<RiImageLine className="h-6 w-6" />}
          title={formatMessage({
            id: "admin.work.media.empty",
            defaultMessage: "No media attached",
          })}
        />
      )}

      {/* Audio notes from gardener */}
      {audioNoteCids && audioNoteCids.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-sub">
            {formatMessage({ id: "admin.work.audioNotes", defaultMessage: "Audio Notes" })}
          </h4>
          {audioNoteCids.map((cid) => (
            <AudioPlayer key={cid} src={resolveIPFSUrl(cid)} compact={false} className="w-full" />
          ))}
        </div>
      )}

      {/* Full-featured image preview dialog */}
      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={resolvedMedia}
        initialIndex={previewIndex ?? 0}
      />
    </div>
  );
}
