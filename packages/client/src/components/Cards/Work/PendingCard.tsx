import { IconButton } from "@green-goods/shared/components/IconButton";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiDeleteBinLine, RiDraftLine, RiHandHeartLine, RiLockLine } from "@remixicon/react";
import React from "react";
import { ImageWithFallback } from "@/components/Display";

/** Where the row stands; the pill, its tone and the status edge follow from it. */
export type PendingCardKind = "needs" | "needsReview" | "upload" | "draft" | "checking" | "review";

const PILL_TONE: Record<PendingCardKind, "error" | "warning" | "info" | "neutral"> = {
  needs: "error",
  needsReview: "warning",
  upload: "info",
  draft: "warning",
  checking: "info",
  review: "neutral",
};

/** The status edge: blocked in error, to upload and checking in information, in review in stroke. */
const EDGE: Record<PendingCardKind, string | null> = {
  needs: "border-l-2 border-l-error-base",
  needsReview: null,
  upload: "border-l-2 border-l-information-base",
  draft: null,
  checking: "border-l-2 border-l-information-base",
  review: "border-l-2 border-l-stroke-sub-300",
};

export interface PendingCardProps {
  kind: PendingCardKind;
  /** The pill's words: Draft, To upload, Can't upload, Checking, In review. */
  pill: string;
  title: string;
  /** When it was saved, edited or submitted. */
  meta: string;
  /** Proof, or work that keeps a promise, carries the hand-heart marker before its meta. */
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
 * One row of Your Work › Pending (D12, D13, D20): the draft card's 88px frame
 * for every kind. A square photo, the title, a meta line, a status line, the
 * 12px pill top right and the guarded Discard bottom right, so labels line up
 * on every row. Titles keep clear of the widest pill.
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
  const edge = EDGE[kind];

  return (
    <div
      ref={thumbnailRef}
      data-component="PendingCard"
      data-kind={kind}
      className={cn(
        "relative flex h-22 w-full items-stretch overflow-hidden rounded-lg border border-stroke-soft-200 bg-bg-white text-left transition-all duration-[var(--spring-spatial-duration)] ease-[var(--spring-spatial-easing)] hover:shadow-md active:brightness-98",
        edge,
        className
      )}
    >
      <button
        onClick={onOpen}
        type="button"
        data-pressable="card"
        className="flex min-w-0 flex-1 cursor-pointer items-stretch gap-0 text-left focus:outline-none focus-visible:shadow-button-primary-focus"
      >
        {/* A fixed square the photo can't resize, same as work cards (DL-019). */}
        <div className="relative h-full aspect-square flex-shrink-0 overflow-hidden bg-bg-weak-50">
          {thumbnailUrl ? (
            <ImageWithFallback
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              fallbackClassName="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-soft-400">
              <RiDraftLine className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden px-3 py-2 pr-27">
          <h4 className="truncate text-label-md font-medium text-text-strong-950" title={title}>
            {title}
          </h4>
          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-text-sub-600">
            {marker ? (
              <>
                <RiHandHeartLine
                  className="h-3.5 w-3.5 shrink-0 text-primary-on-surface"
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "shrink-0",
                    marker.kind === "proof" && "font-medium text-text-strong-950"
                  )}
                >
                  {marker.label}
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span className="min-w-0 truncate" title={meta}>
              {meta}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1 whitespace-nowrap text-xs">
            {locked ? (
              <RiLockLine className="h-3.5 w-3.5 shrink-0 text-text-soft-400" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                "min-w-0 truncate",
                statusTone === "error" ? "text-error-dark" : "text-text-sub-600"
              )}
              title={status}
            >
              {status}
            </span>
          </div>
        </div>
      </button>

      {/* Drawn over the row, not part of it: a tap on the pill opens the row. */}
      <StatusBadge
        size="xs"
        variant={PILL_TONE[kind]}
        showIcon={false}
        className="pointer-events-none absolute right-2 top-2 whitespace-nowrap"
      >
        {pill}
      </StatusBadge>

      {onDiscard ? (
        <IconButton
          onClick={(event) => {
            event.stopPropagation();
            onDiscard();
          }}
          className="absolute bottom-1 right-2"
          aria-label={discardLabel}
          icon={<RiDeleteBinLine aria-hidden="true" />}
        />
      ) : null}
    </div>
  );
};
