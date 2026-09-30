import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  type EvidenceAttributionRow,
  type ResolvedEvidence,
  useCommitmentEvidence,
} from "@green-goods/shared/commitment-pooling";
import { RiMicLine, RiPauseFill } from "@remixicon/react";
import { useRef, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";

import { ImagePreviewDialog } from "@/components/Display";

export interface CommitmentEvidenceProps {
  attributions: readonly EvidenceAttributionRow[];
  /** The chain's own count, so a gap in readable rows is said out loud. */
  recordedCount: number;
}

const TILE = "aspect-square w-full rounded-[var(--radius-md)]";

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, "0")}`;
}

/** "Added today, 10:24 AM, by Amara · 1 link" */
function caption(intl: IntlShape, item: ResolvedEvidence) {
  const at = new Date(item.createdAt * 1000);
  const who = item.attacher ?? item.contributor;
  const added = intl.formatMessage(
    { id: "app.commitment.evidence.added" },
    {
      day: at.toDateString() === new Date().toDateString() ? "today" : "other",
      date: intl.formatDate(at, { month: "short", day: "numeric" }),
      time: intl.formatTime(at, { hour: "numeric", minute: "2-digit" }),
      by: who ? "yes" : "no",
      who: who ? (
        <AddressDisplay address={who} interactive={false} className="inline text-[1em]" />
      ) : null,
    }
  );
  const links = item.document?.links?.length ?? 0;
  return links > 0 ? (
    <>
      {added}
      {" · "}
      {intl.formatMessage({ id: "app.proof.contents.links" }, { count: links })}
    </>
  ) : (
    added
  );
}

/**
 * A voice note on the strip: its length, from the proof when it says, else
 * from the file once its header loads, and a tap to hear it.
 */
function VoiceTile({ url, index, seconds }: { url: string; index: number; seconds?: number }) {
  const { formatMessage } = useIntl();
  const audio = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(seconds ?? null);
  const [playing, setPlaying] = useState(false);
  return (
    <button
      type="button"
      data-pressable="media"
      aria-label={formatMessage(
        {
          id: playing
            ? "app.commitment.evidence.pauseVoiceNote"
            : "app.commitment.evidence.playVoiceNote",
        },
        { index: index + 1 }
      )}
      onClick={() => {
        const element = audio.current;
        if (!element) return;
        if (element.paused) void element.play().catch(() => undefined);
        else element.pause();
      }}
      className={`${TILE} flex flex-col items-center justify-center gap-1 bg-bg-weak-50 text-xs text-text-sub-600`}
    >
      {playing ? (
        <RiPauseFill className="h-5 w-5" aria-hidden="true" />
      ) : (
        <RiMicLine className="h-5 w-5" aria-hidden="true" />
      )}
      {duration !== null && Number.isFinite(duration) ? clock(duration) : null}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a member's own voice note has no caption track */}
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const length = event.currentTarget.duration;
          if (Number.isFinite(length) && length > 0) setDuration(length);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </button>
  );
}

/**
 * The proof on the promise, under its progress: for each proof, its photos,
 * videos and voice notes as squares, then who added it and when. A photo opens
 * large; a voice note plays where it is. Absent proof renders nothing, since
 * the progress line above already says none was added.
 */
export function CommitmentEvidence({ attributions, recordedCount }: CommitmentEvidenceProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { evidence, isLoading } = useCommitmentEvidence(attributions);
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null);

  if (recordedCount === 0 && attributions.length === 0) return null;
  const unreadable = Math.max(0, recordedCount - evidence.length);

  return (
    <div className="mt-3 space-y-3" data-component="CommitmentEvidence">
      {evidence.map((item) => {
        const photos = item.mediaUrls.filter(
          (_, index) => item.document?.media?.[index]?.kind !== "video"
        );
        const loading = item.isLoading || isLoading;
        const showTiles =
          !loading && item.document && item.mediaUrls.length + item.audioUrls.length > 0;
        return (
          <div key={item.cid} data-component="EvidenceStrip">
            {showTiles ? (
              <ul
                className="grid grid-cols-3 gap-2"
                aria-label={formatMessage({ id: "app.confirm.evidence.list" })}
              >
                {item.mediaUrls.map((url, index) =>
                  item.document?.media?.[index]?.kind === "video" ? (
                    <li key={url}>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-generated content */}
                      <video
                        src={url}
                        controls
                        playsInline
                        preload="metadata"
                        className={`${TILE} bg-bg-weak-50 object-cover`}
                      />
                    </li>
                  ) : (
                    <li key={url}>
                      <button
                        type="button"
                        data-pressable="media"
                        className="block w-full"
                        onClick={() => setPreview({ images: photos, index: photos.indexOf(url) })}
                      >
                        <img
                          src={url}
                          alt={formatMessage(
                            { id: "app.confirm.evidence.photo" },
                            { index: index + 1 }
                          )}
                          className={`${TILE} object-cover`}
                        />
                      </button>
                    </li>
                  )
                )}
                {item.audioUrls.map((url, index) => (
                  <li key={url}>
                    <VoiceTile
                      url={url}
                      index={index}
                      seconds={item.document?.audio?.[index]?.durationSeconds}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={cn("text-xs text-text-sub-600", showTiles && "mt-2")}>
              {caption(intl, item)}
            </p>
            {loading ? (
              <p className="mt-1 text-xs text-text-soft-400" role="status">
                {formatMessage({ id: "app.confirm.evidence.loading" })}
              </p>
            ) : !item.document ? (
              <p className="mt-1 text-xs text-text-sub-600">
                {formatMessage({ id: "app.confirm.evidence.unreadable" })}
              </p>
            ) : null}
          </div>
        );
      })}
      {unreadable > 0 ? (
        <p className="text-xs text-text-sub-600">
          {formatMessage({ id: "app.confirm.evidence.missing" }, { count: unreadable })}
        </p>
      ) : null}
      <ImagePreviewDialog
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        images={preview?.images ?? []}
        initialIndex={Math.max(0, preview?.index ?? 0)}
      />
    </div>
  );
}
