import { Alert } from "@green-goods/shared/components/Alert";
import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import type { PublishedWorkDocument } from "@green-goods/shared/modules/work/media-processing";
import { RiImageLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { EvidenceDocumentList, EvidencePhotoGrid } from "@/components/Evidence/EvidenceMedia";

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
  const { formatMessage } = useIntl();

  const resolvedMedia = media.map((cid) => resolveIPFSUrl(cid));

  return (
    <div className="space-y-4">
      <h3 className="type-body font-semibold text-text-strong">
        {formatMessage({ id: "admin.work.mediaEvidence", defaultMessage: "Media Evidence" })}
      </h3>

      {/* Photo grid */}
      {resolvedMedia.length > 0 ? (
        <EvidencePhotoGrid
          sources={resolvedMedia}
          photoLabel={(index) =>
            `View ${actionTitle ? `${actionTitle} ` : ""}photo ${index + 1} of ${resolvedMedia.length}`
          }
          photoAlt={(index) => `${actionTitle ?? "Work"} evidence ${index + 1}`}
        />
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
          <EvidenceDocumentList documents={documents} />
        </div>
      )}
    </div>
  );
}
