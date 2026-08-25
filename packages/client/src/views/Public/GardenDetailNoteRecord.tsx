import { cn } from "@green-goods/shared/utils/styles/cn";
import { getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import { ImagePreviewDialog } from "@green-goods/shared/components/Dialog/ImagePreviewDialog";
import type { PublicFieldNote } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";
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
        className="h-full w-full object-cover transition-transform duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)] group-hover:scale-[1.03]"
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
        className="font-serif text-2xl leading-[1.12] text-text-strong-950 md:text-3xl"
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
