import type { Address } from "@green-goods/shared/types/domain";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { AudioPlayer } from "@green-goods/shared/components/Audio/AudioPlayer";
import { Switch } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { ProofRosterMember } from "@green-goods/shared/hooks/client-ui/commitment/proof-controller.types";
import { mediaResourceManager } from "@green-goods/shared/modules/job-queue/media-resource-manager";
import {
  getWorkMediaId,
  isHeicFile,
  isVideoFile,
} from "@green-goods/shared/modules/work/media-processing";
import { RiFileTextLine, RiGroupLine, RiLinksLine } from "@remixicon/react";
import { type ReactNode, useId, useMemo } from "react";
import { useIntl } from "react-intl";

import { FormCard } from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem, ImageWithFallback } from "@/components/Display";
import { PendingPhotoTile, type PendingPhotoState } from "@/components/Features/Work";

export interface ProofReviewProps {
  media: File[];
  audioNotes: File[];
  note: string;
  links: string[];
  credited: Address[];
  roster: ProofRosterMember[];
  viewer: Address | null;
  /** The reader leads, so sending it is theirs; a teammate only adds proof. */
  leads: boolean;
  /** Whoever ordinarily confirms it, when one person does. */
  confirmer: Address | null;
  isOnline: boolean;
  /** "Send for confirmation too" (D19), offered only when this reader may send and the chain would take it. */
  canSendToo: boolean;
  sendToo: boolean;
  onSendToo: (on: boolean) => void;
  heicStateOf?: (file: File) => PendingPhotoState | undefined;
}

function sameAddress(left: Address, right: Address | null): boolean {
  return Boolean(right) && left.toLowerCase() === right?.toLowerCase();
}

/** A person's name inside a sentence: read, never a link. */
function nameOf(address: Address): ReactNode {
  return (
    <AddressDisplay
      key={address}
      address={address}
      interactive={false}
      className="inline text-[1em]"
    />
  );
}

/**
 * Review, built from Submit Work's Review (D16): Media, Audio notes and Details
 * as the same sections and cards, then one line on what happens next. The
 * pinned Proof for card already names the promise, so no section repeats it.
 * "Send for confirmation too" appears only when it is safe (D19): on by default
 * for someone working alone, off with a team, because sending settles the team
 * and its credit, so nobody can add proof after it.
 */
export function ProofReview({
  media,
  audioNotes,
  note,
  links,
  credited,
  roster,
  viewer,
  leads,
  confirmer,
  isOnline,
  canSendToo,
  sendToo,
  onSendToo,
  heicStateOf,
}: ProofReviewProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const switchTitleId = useId();
  const switchBodyId = useId();

  const { shown, pending } = useMemo(
    () => ({
      // Photos and videos in the order they were added; a HEIC photo still
      // waiting to convert has no preview yet, so it waits below as a tile.
      shown: media.filter((file) => isVideoFile(file) || !isHeicFile(file)),
      pending: media.filter((file) => !isVideoFile(file) && isHeicFile(file)),
    }),
    [media]
  );
  // The composer owns these URLs and revokes them once the proof is queued.
  const urls = useMemo(
    () => shown.map((file) => mediaResourceManager.getOrCreateUrl(file, "proof")),
    [shown]
  );
  const hasVideo = shown.some((file) => isVideoFile(file));

  const teammates = roster.filter((member) => !sameAddress(member.address, viewer));
  const teammate = teammates.length === 1 ? nameOf(teammates[0].address) : null;
  const lead = roster.find((member) => member.isLead)?.address ?? null;
  const confirmsNext = formatMessage(
    { id: "app.proof.review.sendToo.confirmsNext" },
    { who: confirmer ? "named" : "other", name: confirmer ? nameOf(confirmer) : null }
  );
  const sendTooBody = sendToo ? (
    <>
      {confirmsNext}
      {teammates.length > 0 ? (
        <>
          {" "}
          {formatMessage(
            { id: "app.proof.review.sendToo.freezesTeam" },
            { count: teammates.length, teammate }
          )}
        </>
      ) : null}
    </>
  ) : teammates.length > 0 ? (
    formatMessage({ id: "app.proof.review.sendToo.offTeam" }, { count: teammates.length, teammate })
  ) : (
    formatMessage({ id: "app.proof.review.sendToo.offAlone" })
  );
  const nextStep =
    !leads && lead
      ? formatMessage(
          { id: "app.proof.review.next.teammate" },
          {
            who: confirmer ? "named" : "other",
            lead: nameOf(lead),
            name: confirmer ? nameOf(confirmer) : null,
          }
        )
      : canSendToo && sendToo
        ? formatMessage({ id: "app.proof.review.next.signTwice" })
        : formatMessage({ id: "app.proof.review.next.stays" });

  const heading = (text: string) => (
    <h3 className="text-base font-semibold text-text-strong-950">{text}</h3>
  );

  return (
    <>
      {!isOnline ? (
        <Alert variant="warning">{formatMessage({ id: "app.proof.review.offline" })}</Alert>
      ) : null}

      {shown.length > 0 ? (
        <>
          {heading(formatMessage({ id: "app.home.workApproval.media" }))}
          <Carousel enablePreview={!hasVideo} previewImages={urls}>
            <CarouselContent>
              {shown.map((file, index) => (
                <CarouselItem
                  key={getWorkMediaId(file)}
                  index={index}
                  className="max-w-40 aspect-3/4 rounded-2xl relative overflow-hidden"
                >
                  {isVideoFile(file) ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption -- the member's own recording has no caption track
                    <video
                      src={urls[index]}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageWithFallback
                      src={urls[index]}
                      alt={formatMessage(
                        { id: "app.confirm.evidence.photo" },
                        { index: index + 1 }
                      )}
                      className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                      fallbackClassName="w-full h-full aspect-3/4 rounded-2xl"
                    />
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </>
      ) : null}
      {pending.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pending.map((file) => (
            <PendingPhotoTile
              key={getWorkMediaId(file)}
              state={heicStateOf?.(file) ?? "waiting"}
              name={file.name}
            />
          ))}
        </div>
      ) : null}

      {audioNotes.length > 0 ? (
        <>
          {heading(formatMessage({ id: "app.home.work.audioNotes" }))}
          <div className="flex flex-col gap-2">
            {audioNotes.map((file, index) => (
              <AudioPlayer key={`review-audio-${file.name}-${index}`} file={file} />
            ))}
          </div>
        </>
      ) : null}

      {heading(formatMessage({ id: "app.home.workApproval.details" }))}
      {note.trim() ? (
        <FormCard
          label={formatMessage({ id: "app.proof.details.noteLabel" })}
          value={<span className="whitespace-pre-wrap">{note.trim()}</span>}
          Icon={RiFileTextLine}
        />
      ) : null}
      {links.length > 0 ? (
        <FormCard
          label={formatMessage({ id: "app.compose.details.links" })}
          value={links.map((url, index) => (
            <span key={`${url}-${index}`} className="block truncate" title={url}>
              {url.replace(/^https?:\/\//i, "")}
            </span>
          ))}
          Icon={RiLinksLine}
        />
      ) : null}
      <FormCard
        label={formatMessage({ id: "app.proof.details.credit" })}
        value={intl.formatList(credited.map(nameOf), { type: "unit" })}
        Icon={RiGroupLine}
      />

      {canSendToo ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-3"
          data-component="SendWithProof"
        >
          <div className="min-w-0 flex-1">
            <p id={switchTitleId} className="text-label-md font-medium text-text-strong-950">
              {formatMessage({ id: "app.proof.review.sendToo.title" })}
            </p>
            <p id={switchBodyId} className="mt-0.5 text-xs leading-snug text-text-sub-600">
              {sendTooBody}
            </p>
          </div>
          <Switch
            checked={sendToo}
            onCheckedChange={onSendToo}
            aria-labelledby={switchTitleId}
            aria-describedby={switchBodyId}
            className="mt-0.5 shrink-0"
          />
        </div>
      ) : null}

      <p className="text-xs text-text-sub-600">{nextStep}</p>
    </>
  );
}
