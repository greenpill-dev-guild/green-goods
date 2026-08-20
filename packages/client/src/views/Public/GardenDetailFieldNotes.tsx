import { AddressDisplay, cn, getEASExplorerUrl, type PublicFieldNote } from "@green-goods/shared";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ImageWithFallback } from "@/components/Display";
import { PublicSourceDialog } from "@/components/Public/PublicSourceDialog";
import {
  NoteAuthor,
  NotePlaceholderTile,
  SectionEmpty,
  SectionNotice,
  TileSkeletonGrid,
  useNoteDate,
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
  // PublicSourceDialog moves focus to its close button but does not put it
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
  const { formatMessage } = useIntl();
  const noteDate = useNoteDate();
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
          <span>{noteDate(note.createdAt)}</span>
        </div>
      </button>
    </li>
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
  const { formatMessage } = useIntl();
  const noteDate = useNoteDate();
  if (!note) return null;

  const title =
    note.title ||
    formatMessage({ id: "public.gardenDetail.notes.untitled", defaultMessage: "Untitled entry" });

  return (
    <PublicSourceDialog
      open
      onClose={onClose}
      title={title}
      subtitle={noteDate(note.createdAt)}
      sourceHref={getEASExplorerUrl(chainId, note.id)}
      sourceLabel={formatMessage({
        id: "public.gardenDetail.notes.sourceLabel",
        defaultMessage: "View attestation",
      })}
    >
      {note.media.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {note.media.map((src) => (
            <li key={src} className="overflow-hidden bg-editorial-warm">
              <ImageWithFallback
                src={src}
                alt={formatMessage(
                  {
                    id: "public.gardenDetail.notes.mediaAlt",
                    defaultMessage: "Photo logged with {title}",
                  },
                  { title }
                )}
                loading="lazy"
                backgroundFallback={<NotePlaceholderTile />}
                className="h-full w-full object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <p className={cn(note.feedback ? "" : "italic text-text-soft-400")}>
        {note.feedback ||
          formatMessage({
            id: "public.gardenDetail.notes.noDescription",
            defaultMessage: "No description was logged with this entry.",
          })}
      </p>

      <AddressDisplay address={note.gardenerAddress} showCopyButton={false} />
    </PublicSourceDialog>
  );
}
