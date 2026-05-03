import {
  type PublicFieldNote,
  publicGardenHelpers,
  useHypercerts,
  usePublicGardenDetail,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ImageWithFallback } from "@/components/Display";

/**
 * GardenDialog — public Garden detail surface as a modal that morphs from the
 * clicked Garden card. Rendered as a nested route under `/gardens` so the
 * Gardens index stays in the background and the URL stays linkable.
 *
 * Hero image carries `view-transition-name: garden-card-{id}` matching the
 * card's image; PublicGardenCard suppresses that name on the active card so
 * the View Transitions API can pair card → dialog hero into a single morph.
 */
export default function GardenDialog() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { data: detail, isLoading: detailLoading } = usePublicGardenDetail(id);
  const garden = detail?.garden ?? null;
  const { hypercerts = [], isLoading: hypercertsLoading } = useHypercerts({
    gardenId: garden?.id,
  });

  const close = () => navigate("/gardens", { viewTransition: true });

  if (!garden) {
    return (
      <Dialog.Root open onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Overlay className="public-garden-dialog-overlay" />
          <Dialog.Content
            className="public-garden-dialog"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <Dialog.Title className="sr-only">
              {detailLoading
                ? formatMessage({
                    id: "public.gardenDialog.loading",
                    defaultMessage: "Loading Garden",
                  })
                : formatMessage({
                    id: "public.gardenDetail.notFound",
                    defaultMessage: "Garden not found",
                  })}
            </Dialog.Title>
            {detailLoading ? (
              <GardenDialogSkeleton />
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="font-serif text-2xl text-text-strong-950">
                  {formatMessage({
                    id: "public.gardenDetail.notFound",
                    defaultMessage: "Garden not found",
                  })}
                </p>
                <p className="mt-3 text-sm text-text-sub-600">
                  {formatMessage({
                    id: "public.gardenDetail.notFoundHelp",
                    defaultMessage:
                      "The link may be stale. Browse all Gardens to find what you're looking for.",
                  })}
                </p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  const slug = publicGardenHelpers.deriveSlug(garden.name ?? "", garden.id);
  const fundHref = `/fund?garden=${encodeURIComponent(slug)}`;
  const heroVtName = `garden-card-${garden.id}`;
  const totalEntries = detail?.totalFieldNotes ?? garden.works.length;
  const handsAtWork = detail?.contributors.length ?? 0;
  const assessmentCount = detail?.assessmentCount ?? 0;
  const fieldNotes = detail?.fieldNotes ?? [];
  const operators = garden.operators ?? [];

  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="public-garden-dialog-overlay" />
        <Dialog.Content
          className="public-garden-dialog"
          aria-describedby="public-garden-dialog-description"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-static-black/45 text-static-white backdrop-blur-md transition-colors hover:bg-static-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-static-white/80 focus-visible:ring-offset-2"
            aria-label={formatMessage({
              id: "public.gardenDialog.close",
              defaultMessage: "Close",
            })}
          >
            <RiCloseLine className="h-5 w-5" />
          </button>

          <div
            className="aspect-[16/9] w-full overflow-hidden bg-bg-weak-50 sm:aspect-[3/1]"
            style={{ viewTransitionName: heroVtName }}
          >
            <ImageWithFallback
              src={garden.bannerImage || "/images/no-image-placeholder.png"}
              alt={garden.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="public-garden-dialog-body px-6 py-8 sm:px-10 sm:py-10">
            <div className="public-garden-dialog-stagger flex flex-col gap-8">
              <header>
                <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
                  {garden.location}
                </p>
                <Dialog.Title
                  className="mt-2 font-serif text-3xl text-text-strong-950 md:text-4xl"
                  title={garden.name}
                >
                  {garden.name}
                </Dialog.Title>
                <p
                  id="public-garden-dialog-description"
                  className="mt-4 max-w-2xl text-sm text-text-sub-600 md:text-base"
                >
                  {garden.description ||
                    formatMessage({
                      id: "public.gardenDetail.place.empty",
                      defaultMessage: "Garden narrative will appear here as it is published.",
                    })}
                </p>
              </header>

              <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-y border-stroke-soft-200 py-6 sm:grid-cols-4">
                <StatCell
                  label={formatMessage({
                    id: "public.gardenDialog.entries",
                    defaultMessage: "Entries",
                  })}
                  value={totalEntries}
                />
                <StatCell
                  label={formatMessage({
                    id: "public.gardenDialog.handsAtWork",
                    defaultMessage: "Hands at work",
                  })}
                  value={handsAtWork}
                />
                <StatCell
                  label={formatMessage({
                    id: "public.gardenDialog.assessments",
                    defaultMessage: "Assessments",
                  })}
                  value={assessmentCount}
                />
                <StatCell
                  label={formatMessage({
                    id: "public.gardenDialog.certificates",
                    defaultMessage: "Certificates",
                  })}
                  value={hypercertsLoading ? "…" : hypercerts.length}
                />
              </dl>

              <FieldNotesSection notes={fieldNotes} />

              {hypercerts.length > 0 ? (
                <section aria-labelledby="public-garden-dialog-certs">
                  <SectionHeading
                    id="public-garden-dialog-certs"
                    label={formatMessage({
                      id: "public.gardenDialog.certificates.heading",
                      defaultMessage: "Impact Certificates",
                    })}
                    helper={formatMessage({
                      id: "public.gardenDialog.certificates.helper",
                      defaultMessage: "Bundles of approved Work, evaluator-verified and on-chain.",
                    })}
                  />
                  <ul className="mt-4 flex flex-col divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
                    {hypercerts.map((cert) => (
                      <li key={cert.id} className="flex items-start justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p
                            className="truncate font-serif text-base text-text-strong-950"
                            title={cert.title ?? cert.id}
                          >
                            {cert.title ||
                              formatMessage({
                                id: "public.gardenDialog.certificates.untitled",
                                defaultMessage: "Untitled certificate",
                              })}
                          </p>
                          {cert.workScopes && cert.workScopes.length > 0 ? (
                            <p
                              className="mt-1 truncate text-xs uppercase tracking-wide text-text-soft-400"
                              title={cert.workScopes.join(" · ")}
                            >
                              {cert.workScopes.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
                          {formatMessage(
                            {
                              id: "public.gardenDialog.certificates.attestations",
                              defaultMessage:
                                "{count, plural, one {# attestation} other {# attestations}}",
                            },
                            { count: cert.attestationCount }
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {operators.length > 0 ? (
                <section aria-labelledby="public-garden-dialog-operators">
                  <SectionHeading
                    id="public-garden-dialog-operators"
                    label={formatMessage({
                      id: "public.gardenDialog.operators.heading",
                      defaultMessage: "Operators",
                    })}
                    helper={formatMessage({
                      id: "public.gardenDialog.operators.helper",
                      defaultMessage:
                        "Trusted coordinators who approve Work and steward the Garden.",
                    })}
                  />
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {operators.map((address) => (
                      <li
                        key={address}
                        className="rounded-full border border-stroke-soft-200 bg-bg-weak-50 px-3 py-1 font-mono text-[11px] tracking-[0.04em] text-text-sub-600"
                        title={address}
                      >
                        {shortenAddress(address)}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 border-t border-stroke-soft-200 pt-6">
                <Link
                  to={fundHref}
                  viewTransition
                  className="inline-flex items-center rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                >
                  {formatMessage({
                    id: "public.gardenDialog.support",
                    defaultMessage: "Support this Garden",
                  })}
                </Link>
                <Link
                  to="/impact"
                  viewTransition
                  className="inline-flex items-center rounded-full border border-stroke-soft-200 bg-bg-white-0 px-5 py-2.5 text-sm font-medium text-text-strong-950 transition-colors hover:bg-bg-weak-50"
                >
                  {formatMessage({
                    id: "public.gardenDialog.evidence",
                    defaultMessage: "View public evidence",
                  })}
                </Link>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-2xl text-text-strong-950">{value}</dd>
    </div>
  );
}

function SectionHeading({ id, label, helper }: { id: string; label: string; helper?: string }) {
  return (
    <div>
      <h3 id={id} className="font-serif text-xl text-text-strong-950 md:text-2xl">
        {label}
      </h3>
      {helper ? <p className="mt-1 text-sm text-text-sub-600">{helper}</p> : null}
    </div>
  );
}

function FieldNotesSection({ notes }: { notes: readonly PublicFieldNote[] }) {
  const { formatMessage } = useIntl();

  return (
    <section className="mt-10" aria-labelledby="public-garden-dialog-notes">
      <SectionHeading
        id="public-garden-dialog-notes"
        label={formatMessage({
          id: "public.gardenDialog.notes.heading",
          defaultMessage: "Latest field notes",
        })}
        helper={formatMessage({
          id: "public.gardenDialog.notes.helper",
          defaultMessage: "What gardeners have logged from the field — most recent first.",
        })}
      />
      {notes.length === 0 ? (
        <p className="mt-4 text-sm italic text-text-soft-400">
          {formatMessage({
            id: "public.gardenDialog.notes.empty",
            defaultMessage: "No field notes yet — they appear as Work is approved.",
          })}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-stroke-soft-200 border-y border-stroke-soft-200">
          {notes.map((note) => (
            <li key={note.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <p className="font-serif text-base text-text-strong-950" title={note.title}>
                  {note.title ||
                    formatMessage({
                      id: "public.gardenDialog.notes.untitled",
                      defaultMessage: "Untitled entry",
                    })}
                </p>
                <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
                  {formatRelativeDate(note.createdAt)}
                </p>
              </div>
              {note.feedback ? (
                <p className="mt-1 line-clamp-2 text-sm text-text-sub-600">{note.feedback}</p>
              ) : null}
              <p className="mt-2 font-mono text-[10px] tracking-[0.04em] text-text-soft-400">
                {shortenAddress(note.gardenerAddress)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function shortenAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatRelativeDate(secondsSinceEpoch: number): string {
  const date = new Date(secondsSinceEpoch * 1000);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const day = 1000 * 60 * 60 * 24;
  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    return `${hours}h ago`;
  }
  const days = Math.round(diffMs / day);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * GardenDialogSkeleton — quiet placeholder shown while `usePublicGardenDetail`
 * resolves. Mimics the dialog's hero + body shape so the morph from a card
 * lands on something with structure (no blank flash).
 */
function GardenDialogSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="aspect-[16/9] w-full animate-pulse bg-editorial-warm sm:aspect-[3/1]" />
      <div className="space-y-6 px-6 py-8 sm:px-10 sm:py-10">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-stroke-soft-200" />
          <div className="h-9 w-3/4 animate-pulse rounded-sm bg-stroke-soft-200" />
          <div className="space-y-2 pt-1">
            <div className="h-3 w-full animate-pulse rounded-sm bg-stroke-soft-200" />
            <div className="h-3 w-5/6 animate-pulse rounded-sm bg-stroke-soft-200" />
            <div className="h-3 w-2/3 animate-pulse rounded-sm bg-stroke-soft-200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-stroke-soft-200 py-6 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 animate-pulse rounded-sm bg-stroke-soft-200" />
              <div className="h-7 w-10 animate-pulse rounded-sm bg-stroke-soft-200" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-4 w-40 animate-pulse rounded-sm bg-stroke-soft-200" />
          <div className="h-3 w-full animate-pulse rounded-sm bg-stroke-soft-200" />
          <div className="h-3 w-3/4 animate-pulse rounded-sm bg-stroke-soft-200" />
        </div>
      </div>
    </div>
  );
}
