import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { getWorkMediaId, isVideoFile } from "@green-goods/shared/modules/work/media-processing";
import { useState } from "react";

import { Books } from "@/components/Features/Garden/BooksIcon";
import type { PendingPhotoState } from "./PendingPhotoTile";
import { WorkMediaPhotoCard } from "./WorkMediaPhotoCard";
import { WorkMediaVideoCard } from "./WorkMediaVideoCard";

export interface SubmissionMediaListProps {
  media: File[];
  /** One preview URL per file, in the files' order; a file without one yet shows its fallback. */
  urls: ReadonlyArray<string | undefined>;
  audioNotes: File[];
  isBroken: (file: File) => boolean;
  /** A HEIC photo's conversion while it waits for the decoder; `undefined` otherwise. */
  heicStateOf?: (file: File) => PendingPhotoState | undefined;
  onPreview: (file: File, index: number) => void;
  onPreviewFailed: (file: File) => void;
  onRemoveMedia: (file: File, index: number) => void;
  onRemoveAudio: (index: number) => void;
  onRetryHeicConversion?: (file: File) => void;
}

/**
 * What the Media stage holds, for both kinds of submission (DL-131): the photo and video cards
 * with their remove buttons, the voice notes, and the empty illustration until something is added.
 * Each kind owns its files, their preview URLs and what removing one records; this only draws them.
 */
export function SubmissionMediaList({
  media,
  urls,
  audioNotes,
  isBroken,
  heicStateOf,
  onPreview,
  onPreviewFailed,
  onRemoveMedia,
  onRemoveAudio,
  onRetryHeicConversion,
}: SubmissionMediaListProps) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  if (media.length === 0 && audioNotes.length === 0) {
    return (
      <div className="pt-8 px-4 grid place-items-center">
        <Books />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-2">
      {media.map((file, index) => {
        const mediaId = getWorkMediaId(file);
        const remove = () => {
          if (playingVideoId === mediaId) setPlayingVideoId(null);
          onRemoveMedia(file, index);
        };
        return isVideoFile(file) ? (
          <WorkMediaVideoCard
            key={mediaId}
            index={index}
            url={urls[index]}
            isBroken={isBroken(file)}
            isPlaying={playingVideoId === mediaId}
            onPlay={() => setPlayingVideoId(mediaId)}
            onPreviewFailed={() => onPreviewFailed(file)}
            onRemove={remove}
          />
        ) : (
          <WorkMediaPhotoCard
            key={mediaId}
            file={file}
            index={index}
            url={urls[index]}
            isBroken={isBroken(file)}
            heicState={heicStateOf?.(file)}
            onPreview={() => onPreview(file, index)}
            onPreviewFailed={() => onPreviewFailed(file)}
            onRemove={remove}
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
  );
}
