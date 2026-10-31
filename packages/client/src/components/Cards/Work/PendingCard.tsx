import {
  ItemRow,
  type ItemRowProps,
  type ItemRowTone,
} from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { RiDeleteBinLine, RiDraftLine, RiHandHeartLine, RiLockLine } from "@remixicon/react";
import React from "react";

/** Where the row stands; the pill, its tone and the status edge follow from it. */
export type PendingCardKind = "needs" | "needsReview" | "upload" | "draft" | "checking" | "review";

const PILL_TONE: Record<PendingCardKind, ItemRowTone> = {
  needs: "error",
  needsReview: "warning",
  upload: "info",
  draft: "warning",
  checking: "info",
  review: "neutral",
};

/** The status edge: blocked in error, to upload and checking in information, in review in stroke. */
const EDGE: Record<PendingCardKind, ItemRowTone | undefined> = {
  needs: "error",
  needsReview: undefined,
  upload: "info",
  draft: undefined,
  checking: "info",
  review: "neutral",
};

/**
 * Work waiting on a review says so in its pill; a status line would only repeat it, unless it
 * says what stopped (a sent work's link to its promise).
 */
const STATUS_REPEATS_PILL: ReadonlySet<PendingCardKind> = new Set(["review", "needsReview"]);

export interface PendingCardProps {
  kind: PendingCardKind;
  /** The pill's words: Draft, To upload, Can't upload, Checking, In review. */
  pill: string;
  title: string;
  /** When it was saved, edited or submitted. */
  meta: string;
  /** Proof, or work that keeps a promise, carries the hand-heart mark on its photo. */
  marker?: { kind: "proof" | "linked"; label: string };
  /** Where it stands, in a few words. */
  status: string;
  /** A blocked row's reason reads in the error colour. */
  statusTone?: "error";
  /** Nothing can be done to it while a send may be on its way. */
  locked?: boolean;
  thumbnailUrl?: string | null;
  /** Lets a list load a photo only once its row scrolls into view. */
  thumbnailRef?: React.Ref<HTMLDivElement>;
  onOpen?: () => void;
  /** Offered only when throwing it away is safe; the list confirms first. */
  onDiscard?: () => void;
  discardLabel: string;
  className?: string;
}

/**
 * One row of Your Work › Pending (D12, D13, D20) on the shared item row (F7): the
 * photo, the title, the kind's pill under it, then where it stands and when on one
 * detail line, with the guarded Discard in the right slot. A blocked row's reason
 * reads in the error colour; a row a send may be on its way for shows the lock.
 */
export const PendingCard: React.FC<PendingCardProps> = ({
  kind,
  pill,
  title,
  meta,
  marker,
  status,
  statusTone,
  locked = false,
  thumbnailUrl,
  thumbnailRef,
  onOpen,
  onDiscard,
  discardLabel,
  className,
}) => {
  const where = {
    text: status,
    tone: statusTone,
    icon: locked ? <RiLockLine className="text-text-soft-400" aria-hidden="true" /> : undefined,
  };
  // Where it stands, then when: what the reader acts on comes first.
  const details: ItemRowProps["details"] =
    STATUS_REPEATS_PILL.has(kind) && statusTone !== "error" ? [meta] : [where, meta];

  return (
    <ItemRow
      ref={thumbnailRef as React.Ref<HTMLElement>}
      data-component="PendingCard"
      data-kind={kind}
      className={className}
      lead={{
        kind: "photo",
        src: thumbnailUrl,
        fallbackIcon: RiDraftLine,
        mark: marker ? (
          <>
            <RiHandHeartLine aria-hidden="true" />
            <span className="sr-only">{marker.label}</span>
          </>
        ) : undefined,
      }}
      title={title}
      status={{ label: pill, tone: PILL_TONE[kind] }}
      details={details}
      edge={EDGE[kind]}
      onOpen={onOpen}
      action={
        onDiscard ? (
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              onDiscard();
            }}
            aria-label={discardLabel}
            icon={<RiDeleteBinLine aria-hidden="true" />}
          />
        ) : undefined
      }
    />
  );
};
