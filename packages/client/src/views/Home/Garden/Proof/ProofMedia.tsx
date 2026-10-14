import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { mediaResourceManager } from "@green-goods/shared/modules/job-queue/media-resource-manager";
import { getWorkMediaId, isVideoFile } from "@green-goods/shared/modules/work/media-processing";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiLoader4Line } from "@remixicon/react";
import { type ReactNode, useMemo, useState } from "react";
import { useIntl } from "react-intl";

import { Books } from "@/components/Features";
import {
  type PendingPhotoState,
  WorkMediaPhotoCard,
  WorkMediaVideoCard,
} from "@/components/Features/Work";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

export interface ProofMediaProps {
  media: File[];
  audioNotes: File[];
  /** The pill saying whether the proof holds anything yet, and what. */
  rule: ReactNode;
  isProcessing: boolean;
  isRecording: boolean;
  recordingElapsed: number;
  onPick: (files: FileList | null) => void;
  onRemoveMedia: (index: number) => void;
  onRemoveAudio: (index: number) => void;
  onPreview: (index: number) => void;
  /** A HEIC photo's conversion while it waits for the decoder; `undefined` otherwise. */
  heicStateOf?: (file: File) => PendingPhotoState | undefined;
  onRetryHeicConversion?: (file: File) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The proof's media step, Submit Work's Media step element for element (O1):
 * no tap box, since the bar's photo, camera and voice tools add media; the
 * rule's pill; the media cards with their remove buttons; the empty
 * illustration until something is added.
 */
export function ProofMedia({
  media,
  audioNotes,
  rule,
  isProcessing,
  isRecording,
  recordingElapsed,
  onPick,
  onRemoveMedia,
  onRemoveAudio,
  onPreview,
  heicStateOf,
  onRetryHeicConversion,
}: ProofMediaProps) {
  const { formatMessage } = useIntl();
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [brokenIds, setBrokenIds] = useState<ReadonlySet<string>>(() => new Set());

  // The composer owns these URLs and revokes them when the proof leaves this
  // phone's screen, so each step can show the same files without a second copy.
  const urls = useMemo(
    () => media.map((file) => mediaResourceManager.getOrCreateUrl(file, "proof")),
    [media]
  );
  const markBroken = (file: File) =>
    setBrokenIds((current) => new Set(current).add(getWorkMediaId(file)));

  return (
    <>
      {rule}

      <div className="hidden">
        <input
          id="proof-media-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,video/*"
          multiple
          disabled={isProcessing}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          id="proof-media-camera"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          capture="environment"
          disabled={isProcessing}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {isProcessing ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-lg)] border p-4",
            pwaStatusStyles.information.surface,
            pwaStatusStyles.information.border
          )}
          role="status"
        >
          <RiLoader4Line
            className={cn("h-5 w-5 animate-spin", pwaStatusStyles.information.icon)}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-text-strong-950">
            {formatMessage({ id: "app.proof.media.processing" })}
          </p>
        </div>
      ) : null}

      {isRecording ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-lg)] border p-3",
            pwaStatusStyles.error.surface,
            pwaStatusStyles.error.border
          )}
          role="status"
        >
          <span className={cn("h-3 w-3 animate-pulse rounded-full", pwaStatusStyles.error.dot)} />
          <span className={cn("text-sm font-medium", pwaStatusStyles.error.text)}>
            {formatMessage({ id: "app.garden.upload.recordingPrefix" })}{" "}
            {formatTime(recordingElapsed)}
          </span>
        </div>
      ) : null}

      {media.length > 0 || audioNotes.length > 0 ? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-2">
          {media.map((file, index) => {
            const mediaId = getWorkMediaId(file);
            const isBroken = brokenIds.has(mediaId);
            return isVideoFile(file) ? (
              <WorkMediaVideoCard
                key={mediaId}
                index={index}
                url={urls[index]}
                isBroken={isBroken}
                isPlaying={playingVideoId === mediaId}
                onPlay={() => setPlayingVideoId(mediaId)}
                onPreviewFailed={() => markBroken(file)}
                onRemove={() => onRemoveMedia(index)}
              />
            ) : (
              <WorkMediaPhotoCard
                key={mediaId}
                file={file}
                index={index}
                url={urls[index]}
                isBroken={isBroken}
                heicState={heicStateOf?.(file)}
                onPreview={() => onPreview(index)}
                onPreviewFailed={() => markBroken(file)}
                onRemove={() => onRemoveMedia(index)}
                onRetryConversion={
                  onRetryHeicConversion ? () => onRetryHeicConversion(file) : undefined
                }
              />
            );
          })}
          {audioNotes.map((file, index) => (
            <div key={`audio-${file.name}-${index}`} className="md:col-span-2">
              <AudioPlayer file={file} onDelete={() => onRemoveAudio(index)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="pt-8 px-4 grid place-items-center">
          <Books />
        </div>
      )}
    </>
  );
}
