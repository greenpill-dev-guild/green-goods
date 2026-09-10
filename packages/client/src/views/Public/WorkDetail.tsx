import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { usePublicGardenDetail } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import { useIntl } from "react-intl";
import { Link, useParams } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display/Image/ImageWithFallback";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicInstallCta } from "@/components/Public/PublicInstallCta";
import { formatNoteDate, NoteAuthor } from "./GardenDetailAtoms";

/** Public preview uses the same curated reads as the garden's field-note list. */
export default function WorkDetail() {
  const { id, workId } = useParams<{ id: string; workId: string }>();
  const intl = useIntl();
  const { formatMessage } = intl;
  const { data, isLoading, isError, refetch } = usePublicGardenDetail(id, {
    chainId: DEFAULT_CHAIN_ID,
  });
  const unavailable = isError || data?.unavailableSources.works;
  const note =
    data?.garden && !unavailable
      ? data.fieldNotes.find((entry) => entry.id.toLowerCase() === workId?.toLowerCase())
      : undefined;
  const destination = `/home/${id}/work/${workId}`;
  const title =
    note?.title ||
    formatMessage({ id: "public.gardenDetail.notes.untitled", defaultMessage: "Untitled entry" });

  return (
    <>
      <article className="mx-auto max-w-3xl px-6 pb-16 pt-32 sm:px-10" aria-busy={isLoading}>
        <Link
          to={`/gardens/${encodeURIComponent(id ?? "")}`}
          className="inline-flex min-h-11 items-center text-sm text-primary-action underline underline-offset-4"
        >
          {data?.garden?.name ||
            formatMessage({ id: "public.sharedLink.garden", defaultMessage: "View Garden" })}
        </Link>
        <h1 className="mt-6 font-serif text-3xl text-text-strong-950 md:text-4xl">
          {isLoading
            ? formatMessage({
                id: "public.sharedLink.loading",
                defaultMessage: "Loading shared work…",
              })
            : note
              ? title
              : formatMessage({
                  id: "public.sharedLink.unavailable",
                  defaultMessage: "This record is not available in the public view",
                })}
        </h1>
        {isLoading ? (
          <p role="status" className="mt-4 text-text-sub-600">
            {formatMessage({
              id: "public.sharedLink.loading",
              defaultMessage: "Loading shared work…",
            })}
          </p>
        ) : note ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-sub-600">
              <NoteAuthor address={note.gardenerAddress} />
              <time dateTime={new Date(note.createdAt * 1000).toISOString()}>
                {formatNoteDate(intl, note.createdAt)}
              </time>
            </div>
            <p className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-text-sub-600">
              {note.feedback ||
                formatMessage({
                  id: "public.gardenDetail.notes.noDescription",
                  defaultMessage: "No description was logged with this entry.",
                })}
            </p>
            <div className="mt-8 space-y-6">
              {note.media.map((src, index) => (
                <ImageWithFallback
                  key={`${src}:${index}`}
                  src={src}
                  alt={formatMessage(
                    {
                      id: "public.gardenDetail.notes.mediaAlt",
                      defaultMessage: "Photo logged with {title}",
                    },
                    { title }
                  )}
                  loading="lazy"
                  className="h-auto w-full object-contain"
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4 text-text-sub-600">
            <p>
              {formatMessage({
                id: unavailable
                  ? "public.gardenDetail.notes.unavailable"
                  : "public.sharedLink.unavailableHelp",
                defaultMessage: unavailable
                  ? "Field notes could not be loaded right now."
                  : "This record may require sign-in or may no longer be available. Open it in the app and sign in to check access.",
              })}
            </p>
            {unavailable ? (
              <button
                type="button"
                onClick={() => void refetch()}
                className="inline-flex min-h-11 items-center text-primary-action underline underline-offset-4"
              >
                {formatMessage({ id: "public.gardenDetail.retry", defaultMessage: "Try Again" })}
              </button>
            ) : null}
          </div>
        )}
        <div className="mt-10 border-t border-stroke-soft-200 pt-8">
          <PublicInstallCta variant="compact" destination={destination} />
        </div>
      </article>
      <PublicFooter variant="soil" />
    </>
  );
}
