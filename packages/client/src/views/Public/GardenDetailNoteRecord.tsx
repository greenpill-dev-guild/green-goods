import { cn } from "@green-goods/shared/utils/styles/cn";
import { Button } from "@green-goods/shared/components/Button";
import { getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import { ImagePreviewDialog } from "@green-goods/shared/components/Dialog/ImagePreviewDialog";
import type { PublicFieldNote } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import { useWorkMetadata } from "@green-goods/shared/hooks/work/useWorkMetadata";
import type { WorkMetadataV1 } from "@green-goods/shared/types/domain";
import { formatTimeSpent } from "@green-goods/shared/utils/form/normalizers";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display/Image/ImageWithFallback";
import { PublicRecordDrawer } from "@/components/Public/PublicRecordDrawer";
import { formatNoteDate, NoteAuthor, NotePlaceholderTile } from "./GardenDetailAtoms";

/**
 * Compact media mosaic for a field note — the same 1 / 2 / 3-up grammar the
 * evidence cards use on `/impact`, so a note with photos reads as one framed
 * block rather than a column of full-height images.
 *
 * Tiles are buttons: the mosaic is a summary, and the full frame (with zoom
 * and paging across every photo, not just the three shown) lives in the image
 * viewer behind a tap.
 *
 * A photo whose URL fails drops out and the layout reflows (3 → 2 → 1), so a
 * dead IPFS link never leaves a tile-shaped hole beside working photos.
 */
function NoteMediaMosaic({
  media,
  alt,
  onOpen,
}: {
  media: readonly string[];
  alt: string;
  onOpen: (index: number) => void;
}) {
  const { formatMessage } = useIntl();
  const [failed, setFailed] = useState<readonly string[]>([]);
  const valid = useMemo(() => media.filter((url) => !failed.includes(url)), [media, failed]);
  const handleError = useCallback((url: string) => {
    setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  const shown = valid.slice(0, 3);
  const overflow = valid.length - shown.length;

  if (valid.length === 0) return null;

  const tile = (src: string, index: number, className?: string) => (
    <button
      key={src}
      type="button"
      data-pressable="media"
      onClick={() => onOpen(media.indexOf(src))}
      aria-label={formatMessage(
        { id: "public.gardenDetail.notes.viewPhoto", defaultMessage: "View photo {n}" },
        { n: index + 1 }
      )}
      className={cn(
        "group relative overflow-hidden bg-editorial-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2",
        className
      )}
    >
      <ImageWithFallback
        src={src}
        alt={index === 0 ? alt : ""}
        loading="lazy"
        backgroundFallback={<NotePlaceholderTile />}
        onErrorCallback={() => handleError(src)}
        className="h-full w-full object-cover"
      />
      {overflow > 0 && index === shown.length - 1 ? (
        <span className="absolute inset-0 flex items-center justify-center bg-static-black/50 font-mono text-sm text-static-white">
          {formatMessage(
            { id: "public.gardenDetail.notes.morePhotos", defaultMessage: "+{count} more" },
            { count: overflow }
          )}
        </span>
      ) : null}
    </button>
  );

  return (
    // Square corners and a hairline gutter: the editorial dialect frames photos
    // with whitespace, not rounding.
    <div className="mt-8 aspect-[4/3] w-full">
      {shown.length === 1 ? (
        tile(shown[0], 0, "h-full w-full")
      ) : shown.length === 2 ? (
        <div className="grid h-full w-full grid-cols-2 gap-2">
          {shown.map((src, i) => tile(src, i, "h-full w-full"))}
        </div>
      ) : (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
          {tile(shown[0], 0, "row-span-2 h-full w-full")}
          {tile(shown[1], 1, "h-full w-full")}
          {tile(shown[2], 2, "h-full w-full")}
        </div>
      )}
    </div>
  );
}

function formatDetailValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    const items = value.map(formatDetailValue).filter((item): item is string => Boolean(item));
    return items.length ? items.join(", ") : null;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function FieldNoteDialog({
  chainId,
  note,
  onClose,
}: {
  chainId: number;
  note: PublicFieldNote | null;
  onClose: () => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const titleId = "public-garden-detail-note-title";
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { metadata, status: metadataStatus, retryFetch } = useWorkMetadata(note?.metadata);
  // The viewer ships English defaults for every string it renders or announces.
  // The public site is translated, so it gets the whole set, not just the two
  // that happen to be visible.
  const viewerLabels = useMemo(
    () => ({
      dialogLabel: formatMessage({ id: "public.gardenDetail.notes.photo.viewer" }),
      title: formatMessage({ id: "public.gardenDetail.notes.photo.viewer" }),
      description: formatMessage({ id: "public.gardenDetail.notes.photo.viewerHelp" }),
      close: formatMessage({ id: "public.source.close" }),
      closePreview: formatMessage({ id: "public.gardenDetail.notes.closePhoto" }),
      previousImage: formatMessage({ id: "public.gardenDetail.notes.previousPhoto" }),
      nextImage: formatMessage({ id: "public.gardenDetail.notes.nextPhoto" }),
      zoomIn: formatMessage({ id: "public.gardenDetail.notes.photo.zoomIn" }),
      zoomOut: formatMessage({ id: "public.gardenDetail.notes.photo.zoomOut" }),
      resetZoom: formatMessage({ id: "public.gardenDetail.notes.photo.resetZoom" }),
      downloadImage: formatMessage({ id: "public.gardenDetail.notes.photo.download" }),
      previewAlt: (n: number) =>
        formatMessage({ id: "public.gardenDetail.notes.photo.alt" }, { n }),
      thumbnailAlt: (n: number) =>
        formatMessage({ id: "public.gardenDetail.notes.photo.thumbAlt" }, { n }),
      goToImage: (n: number) =>
        formatMessage({ id: "public.gardenDetail.notes.photo.goTo" }, { n }),
    }),
    [formatMessage]
  );

  if (!note) return null;

  const title =
    note.title ||
    formatMessage({ id: "public.gardenDetail.notes.untitled", defaultMessage: "Untitled entry" });

  const legacy = metadata as WorkMetadataV1 | null;
  const details =
    metadata?.details && typeof metadata.details === "object" && !Array.isArray(metadata.details)
      ? metadata.details
      : {};
  const timeSpent = formatTimeSpent(metadata?.timeSpentMinutes);
  const metadataRows: Array<{ label: string; value: string }> = [];
  if (timeSpent) {
    metadataRows.push({
      label: formatMessage({ id: "public.gardenDetail.notes.timeSpent" }),
      value: timeSpent,
    });
  }
  for (const [key, value] of Object.entries(details)) {
    const display = formatDetailValue(value);
    if (display) {
      metadataRows.push({
        label: key
          .replace(/([A-Z])/g, " $1")
          .replace(/[_-]/g, " ")
          .replace(/^./, (letter) => letter.toUpperCase()),
        value: display,
      });
    }
  }
  if (Array.isArray(metadata?.tags) && metadata.tags.length) {
    metadataRows.push({
      label: formatMessage({ id: "public.gardenDetail.notes.tags" }),
      value: metadata.tags.join(", "),
    });
  }
  if (Array.isArray(legacy?.plantSelection) && legacy.plantSelection.length) {
    metadataRows.push({
      label: formatMessage({ id: "public.gardenDetail.notes.plantTypes" }),
      value: legacy.plantSelection.join(", "),
    });
  }
  if (typeof legacy?.plantCount === "number") {
    metadataRows.push({
      label: formatMessage({ id: "public.gardenDetail.notes.plantCount" }),
      value: String(legacy.plantCount),
    });
  }

  return (
    <PublicRecordDrawer
      open
      onClose={onClose}
      titleId={titleId}
      dismissOnEscape={viewerIndex === null}
      eyebrow={formatMessage({
        id: "public.gardenDetail.notes.recordHeader",
        defaultMessage: "Field note",
      })}
    >
      <h2
        id={titleId}
        className="font-serif text-2xl leading-[1.12] font-bold text-text-strong-950 md:text-3xl"
      >
        {title}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-[0.02em] text-text-soft-400">
        <NoteAuthor address={note.gardenerAddress} />
        <span aria-hidden="true">·</span>
        <span>{formatNoteDate(intl, note.createdAt)}</span>
      </div>

      <NoteMediaMosaic
        media={note.media}
        alt={formatMessage(
          { id: "public.gardenDetail.notes.mediaAlt", defaultMessage: "Photo logged with {title}" },
          { title }
        )}
        onOpen={setViewerIndex}
      />

      <p
        className={cn(
          "mt-8 text-sm leading-relaxed text-text-sub-600 md:text-base",
          note.feedback ? "" : "italic text-text-soft-400"
        )}
      >
        {note.feedback ||
          formatMessage({
            id: "public.gardenDetail.notes.noDescription",
            defaultMessage: "No description was logged with this entry.",
          })}
      </p>

      {note.metadata &&
      (metadataRows.length > 0 ||
        metadataStatus === "loading" ||
        metadataStatus === "error" ||
        metadataStatus === "unavailable") ? (
        <section
          className="mt-8 border-t border-stroke-soft-200 pt-6"
          aria-labelledby="public-garden-detail-note-details"
        >
          <h3
            id="public-garden-detail-note-details"
            className="font-serif text-lg font-semibold text-text-strong-950"
          >
            {formatMessage({ id: "public.gardenDetail.notes.details" })}
          </h3>
          {metadataRows.length > 0 ? (
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {metadataRows.map(({ label, value }, index) => (
                <div key={`${label}:${index}`} className="min-w-0">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-soft-400">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-text-sub-600">{value}</dd>
                </div>
              ))}
            </dl>
          ) : metadataStatus === "loading" ? (
            <p role="status" className="mt-4 text-sm text-text-sub-600">
              {formatMessage({ id: "public.gardenDetail.notes.detailsLoading" })}
            </p>
          ) : (
            <div className="mt-4 text-sm text-text-sub-600">
              <p>{formatMessage({ id: "public.gardenDetail.notes.detailsUnavailable" })}</p>
              {metadataStatus === "error" ? (
                <Button type="button" emphasis="tertiary" onClick={retryFetch}>
                  {formatMessage({ id: "public.gardenDetail.retry" })}
                </Button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <p className="mt-8 border-t border-stroke-soft-200 pt-6 text-xs">
        <a
          href={getEASExplorerUrl(chainId, note.id)}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary-base hover:underline"
        >
          {formatMessage({
            id: "public.gardenDetail.notes.sourceLabel",
            defaultMessage: "View attestation",
          })}
        </a>
      </p>

      <ImagePreviewDialog
        isOpen={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        images={[...note.media]}
        initialIndex={viewerIndex ?? 0}
        // Its scrim defaults to `z-overlay` (40), which sits under the drawer
        // at `z-modal` (50), so the drawer showed through beside the photo.
        // `cn` here does not merge conflicting z utilities — both land on the
        // element and `z-overlay` wins the cascade — so this has to be
        // important. The viewer mounts second, so at equal layers it paints on
        // top of the drawer.
        className="!z-modal"
        variant="editorial"
        labels={viewerLabels}
      />
    </PublicRecordDrawer>
  );
}
