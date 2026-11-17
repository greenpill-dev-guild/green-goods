import { Alert } from "@green-goods/shared/components/Alert";
import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { Button } from "@green-goods/shared/components/Button";
import { ImagePreviewDialog } from "@green-goods/shared/components/Dialog/ImagePreviewDialog";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { PublishedWorkDocument } from "@green-goods/shared/modules/work/media-processing";
import { RiExternalLinkLine, RiFileTextLine, RiImageLine, RiZoomInLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { imagePreviewLabels } from "@/components/imagePreviewLabels";

interface MediaEvidenceProps {
  /** IPFS CIDs for photo/video media */
  media: string[];
  /** IPFS CIDs for gardener audio notes (from work metadata) */
  audioNoteCids?: string[];
  /** Documents the work's metadata lists, such as a certificate; each opens in a new tab */
  documents?: PublishedWorkDocument[];
  /**
   * The metadata file, which names the voice notes and documents, is still being read, waits
   * for the device to come back online, or could not be read. The photos show either way;
   * the rest waits, or offers another try once a try can run.
   */
  evidenceState?: "loading" | "offline" | "failed";
  onRetryEvidence?: () => void;
  /** Action title for alt text context */
  actionTitle?: string;
}

/**
 * Displays media evidence for a work submission — photo grid with lightbox,
 * AudioPlayer for gardener audio notes, and a link for each document.
 */
export function MediaEvidence({
  media,
  audioNoteCids,
  documents,
  evidenceState,
  onRetryEvidence,
  actionTitle,
}: MediaEvidenceProps) {
  const { formatMessage, formatNumber } = useIntl();
  const sizeOf = (bytes: number) =>
    bytes >= 1024 * 1024
      ? formatNumber(bytes / (1024 * 1024), {
          style: "unit",
          unit: "megabyte",
          maximumFractionDigits: 1,
        })
      : formatNumber(Math.max(1, Math.round(bytes / 1024)), { style: "unit", unit: "kilobyte" });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const resolvedMedia = media.map((cid) => resolveIPFSUrl(cid));

  return (
    <div className="space-y-4">
      <h3 className="type-body font-semibold text-text-strong">
        {formatMessage({ id: "admin.work.mediaEvidence", defaultMessage: "Media Evidence" })}
      </h3>

      {/* Photo grid */}
      {resolvedMedia.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resolvedMedia.map((src, index) => (
            <Button
              key={src}
              type="button"
              emphasis="tertiary"
              size="compact"
              onClick={() => setPreviewIndex(index)}
              className="group relative aspect-square h-auto max-h-none min-w-0 overflow-hidden rounded-lg border border-stroke-soft bg-bg-weak p-0"
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
            </Button>
          ))}
        </div>
      ) : !documents?.length && !audioNoteCids?.length && !evidenceState ? (
        // Only when the work holds nothing at all: documents and voice notes are evidence too.
        <EmptyState
          icon={<RiImageLine className="h-6 w-6" />}
          title={formatMessage({
            id: "admin.work.media.empty",
            defaultMessage: "No media attached",
          })}
        />
      ) : null}

      {evidenceState === "loading" ? (
        <p role="status" className="type-meta text-text-sub">
          {formatMessage({
            id: "admin.work.evidence.loading",
            defaultMessage: "Loading voice notes and documents…",
          })}
        </p>
      ) : evidenceState === "offline" ? (
        // The read resumes by itself on reconnect, so there is nothing to try yet.
        <p role="status" className="type-meta text-text-sub">
          {formatMessage({
            id: "admin.work.evidence.offline",
            defaultMessage: "Voice notes and documents will load when you're back online.",
          })}
        </p>
      ) : evidenceState === "failed" ? (
        <Alert
          variant="warning"
          action={
            onRetryEvidence ? (
              <Button type="button" emphasis="secondary" size="sm" onClick={onRetryEvidence}>
                {formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })}
              </Button>
            ) : undefined
          }
        >
          {formatMessage({
            id: "admin.work.evidence.failed",
            defaultMessage: "Voice notes and documents couldn't load.",
          })}
        </Alert>
      ) : null}

      {/* Audio notes from gardener */}
      {audioNoteCids && audioNoteCids.length > 0 && (
        <div className="space-y-2">
          <h4 className="type-label-sm text-text-sub">
            {formatMessage({ id: "admin.work.audioNotes", defaultMessage: "Audio notes" })}
          </h4>
          {audioNoteCids.map((cid) => (
            <AudioPlayer key={cid} src={resolveIPFSUrl(cid)} compact={false} className="w-full" />
          ))}
        </div>
      )}

      {/* Documents from the gardener, such as a certificate */}
      {documents && documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="type-label-sm text-text-sub">
            {formatMessage({ id: "admin.work.documents", defaultMessage: "Documents" })}
          </h4>
          <ul className="space-y-2">
            {documents.map((document, index) => (
              <li
                key={`${index}:${document.cid}`}
                className="flex items-center gap-3 rounded-lg border border-stroke-soft p-3"
              >
                <RiFileTextLine className="h-5 w-5 shrink-0 text-text-sub" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <a
                    href={resolveIPFSUrl(document.cid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={document.name}
                    className="flex items-center gap-1 type-label-sm text-primary-dark underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{document.name}</span>
                    <RiExternalLinkLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                  {document.size > 0 ? (
                    <p className="type-meta text-text-sub">{sizeOf(document.size)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Full-featured image preview dialog */}
      <ImagePreviewDialog
        labels={imagePreviewLabels(formatMessage)}
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={resolvedMedia}
        initialIndex={previewIndex ?? 0}
      />
    </div>
  );
}
