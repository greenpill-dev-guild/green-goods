import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { isVideoFile } from "@green-goods/shared/modules/work/media-processing";
import { mediaResourceManager } from "@green-goods/shared/modules/job-queue/media-resource-manager";
import { RiCloseLine, RiImageAddLine, RiLoader4Line, RiPlayFill } from "@remixicon/react";
import { useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

export interface ProofMediaProps {
  media: File[];
  audioNotes: File[];
  isProcessing: boolean;
  isRecording: boolean;
  recordingElapsed: number;
  onPick: (files: FileList | null) => void;
  onRemoveMedia: (index: number) => void;
  onRemoveAudio: (index: number) => void;
  onPreview: (index: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The media beat of proof, drawn the way the Submit Work media step is: a
 * tap-to-add surface, then the list of what has been attached, every photo as
 * the picture itself. Camera, gallery and the voice note are one tap each from
 * the fixed bar; this surface is the tap target for the gallery.
 */
export function ProofMedia({
  media,
  audioNotes,
  isProcessing,
  isRecording,
  recordingElapsed,
  onPick,
  onRemoveMedia,
  onRemoveAudio,
  onPreview,
}: ProofMediaProps) {
  const { formatMessage } = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Object URLs are owned by the shared media manager, which revokes them when
  // the scope is released; rebuilding them per render would leak one per file.
  const urls = useMemo(
    () => media.map((file) => mediaResourceManager.getOrCreateUrl(file, "proof")),
    [media]
  );
  useEffect(() => () => mediaResourceManager.cleanupUrls("proof"), []);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.proof.media.legend" })}
      </h1>
      <p className="text-sm text-text-sub-600">{formatMessage({ id: "app.proof.media.help" })}</p>

      <div className="hidden">
        <input
          ref={inputRef}
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
          ref={cameraRef}
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

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isProcessing}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-stroke-soft-200 bg-bg-weak-50 p-6 text-sm text-text-sub-600 tap-target-lg disabled:opacity-60"
      >
        <RiImageAddLine className="h-6 w-6" aria-hidden="true" />
        {formatMessage({ id: "app.proof.media.tapToAdd" })}
      </button>

      {isProcessing ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-lg)] border p-3",
            pwaStatusStyles.information.surface,
            pwaStatusStyles.information.border
          )}
          role="status"
        >
          <RiLoader4Line className={cn("h-5 w-5 animate-spin", pwaStatusStyles.information.icon)} />
          <span className="text-sm text-text-strong-950">
            {formatMessage({ id: "app.proof.media.processing" })}
          </span>
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
            {formatMessage({ id: "app.proof.media.recording" })} {formatTime(recordingElapsed)}
          </span>
        </div>
      ) : null}

      {media.length > 0 || audioNotes.length > 0 ? (
        <ul className="space-y-3" aria-label={formatMessage({ id: "app.proof.media.list" })}>
          {media.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="relative overflow-hidden rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0"
            >
              {isVideoFile(file) ? (
                <div className="flex aspect-[4/3] items-center justify-center bg-bg-weak-50">
                  <RiPlayFill className="h-8 w-8 text-text-sub-600" aria-hidden="true" />
                  <span className="sr-only">{file.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onPreview(index)}
                  className="block w-full"
                  aria-label={formatMessage({ id: "app.proof.media.preview" }, { name: file.name })}
                >
                  <img src={urls[index]} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveMedia(index)}
                aria-label={formatMessage({ id: "app.proof.media.remove" }, { name: file.name })}
                className="absolute right-2 top-2 rounded-full bg-bg-white-0/90 p-1.5 text-text-strong-950 shadow-sm tap-target-lg"
              >
                <RiCloseLine className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
          {audioNotes.map((file, index) => (
            <li key={`audio-${file.name}-${index}`}>
              <AudioPlayer file={file} onDelete={() => onRemoveAudio(index)} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
