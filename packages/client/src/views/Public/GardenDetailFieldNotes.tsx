import {
  cn,
  getEASExplorerUrl,
  ImagePreviewDialog,
  type PublicFieldNote,
} from "@green-goods/shared";
import { useCallback, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";
import { PublicRecordDrawer } from "@/components/Public/PublicRecordDrawer";
import {
  formatNoteDate,
  NoteAuthor,
  NotePlaceholderTile,
  SectionEmpty,
  SectionNotice,
  TileSkeletonGrid,
} from "./GardenDetailAtoms";
import { Section } from "./GardenDetailSections";

/** Initial field-note window. The hook returns every note; the page pages locally. */
const NOTES_PAGE_SIZE = 12;

export function FieldNotesSection({
  notes,
  total,
  loading,
  unavailable,
  chainId,
}: {
  notes: readonly PublicFieldNote[];
  total: number;
  loading: boolean;
  unavailable: boolean;
  /** Same chain the notes were read from, so the explorer link cannot drift. */
  chainId: number;
}) {
  const { formatMessage } = useIntl();
  const [visibleCount, setVisibleCount] = useState(NOTES_PAGE_SIZE);
  const [openNote, setOpenNote] = useState<PublicFieldNote | null>(null);
  // PublicRecordDrawer moves focus to its close button but does not put it
  // back, so the tile that opened it holds the return target.
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const visible = notes.slice(0, visibleCount);

  return (
    <Section
      id="public-garden-detail-notes"
      kicker={formatMessage({
        id: "public.gardenDetail.section.notes",
        defaultMessage: "§ 01: Field notes",
      })}
      heading={formatMessage({
        id: "public.gardenDetail.notes.heading",
        defaultMessage: "Latest field notes",
      })}
      helper={formatMessage({
        id: "public.gardenDetail.notes.helper",
        defaultMessage: "What gardeners have logged from the field, most recent first.",
      })}
    >
      {loading ? (
        <TileSkeletonGrid />
      ) : unavailable ? (
        <SectionNotice
          message={formatMessage({
            id: "public.gardenDetail.notes.unavailable",
            defaultMessage: "Field notes could not be loaded right now.",
          })}
        />
      ) : notes.length === 0 ? (
        <SectionEmpty
          message={formatMessage({
            id: "public.gardenDetail.notes.empty",
            defaultMessage: "No field notes yet. They appear when Work is submitted.",
          })}
        />
      ) : (
        <>
          <ul className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((note) => (
              <FieldNoteTile
                key={note.id}
                note={note}
                onOpen={(element) => {
                  triggerRef.current = element;
                  setOpenNote(note);
                }}
              />
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <p
              role="status"
              aria-live="polite"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400"
            >
              {formatMessage(
                {
                  id: "public.gardenDetail.notes.showing",
                  defaultMessage: "Showing {shown} of {total}",
                },
                { shown: visible.length, total }
              )}
            </p>
            {visible.length < notes.length ? (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + NOTES_PAGE_SIZE)}
                className="border-b border-primary-action/35 pb-0.5 text-sm font-medium text-primary-action transition-colors hover:border-primary-action-hover hover:text-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
              >
                {formatMessage({
                  id: "public.gardenDetail.notes.loadMore",
                  defaultMessage: "Show more entries",
                })}
              </button>
            ) : null}
          </div>
        </>
      )}

      <FieldNoteDialog
        chainId={chainId}
        note={openNote}
        onClose={() => {
          setOpenNote(null);
          triggerRef.current?.focus();
        }}
      />
    </Section>
  );
}

function FieldNoteTile({
  note,
  onOpen,
}: {
  note: PublicFieldNote;
  onOpen: (element: HTMLButtonElement) => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const title =
    note.title ||
    formatMessage({
      id: "public.gardenDetail.notes.untitled",
      defaultMessage: "Untitled entry",
    });
  const cover = note.media[0];

  return (
    <li>
      <button
        type="button"
        onClick={(event) => onOpen(event.currentTarget)}
        className="group flex h-full w-full flex-col gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-editorial-warm">
          {cover ? (
            <ImageWithFallback
              src={cover}
              alt={formatMessage(
                {
                  id: "public.gardenDetail.notes.mediaAlt",
                  defaultMessage: "Photo logged with {title}",
                },
                { title }
              )}
              loading="lazy"
              backgroundFallback={<NotePlaceholderTile />}
              className="h-full w-full object-cover transition-transform duration-[var(--spring-effects-slow-duration)] ease-[var(--spring-effects-slow-easing)] group-hover:scale-[1.03]"
            />
          ) : (
            <NotePlaceholderTile />
          )}
        </div>

        <h3
          className="font-serif text-xl font-normal leading-[1.1] tracking-[-0.012em] text-text-strong-950 transition-[color,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] group-hover:text-primary-action motion-safe:group-hover:-translate-y-px"
          title={title}
        >
          <span className="line-clamp-2">{title}</span>
        </h3>

        {note.feedback ? (
          <p className="line-clamp-2 text-sm font-medium leading-[1.55] text-text-sub-600">
            {note.feedback}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-[0.02em] text-text-soft-400">
          <NoteAuthor address={note.gardenerAddress} />
          <span aria-hidden="true">·</span>
          <span>{formatNoteDate(intl, note.createdAt)}</span>
        </div>
      </button>
    </li>
  );
}

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

function FieldNoteDialog({
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
  // The viewer ships English defaults; the public site is translated.
  const viewerLabels = useMemo(
    () => ({
      close: formatMessage({ id: "public.source.close", defaultMessage: "Close" }),
      closePreview: formatMessage({
        id: "public.gardenDetail.notes.closePhoto",
        defaultMessage: "Close photo",
      }),
      previousImage: formatMessage({
        id: "public.gardenDetail.notes.previousPhoto",
        defaultMessage: "Previous photo",
      }),
      nextImage: formatMessage({
        id: "public.gardenDetail.notes.nextPhoto",
        defaultMessage: "Next photo",
      }),
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
