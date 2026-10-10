import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  type CommitmentContributorRecord,
  type CommitmentMetadataV1,
  type CommitmentReadModel,
  type CommitmentSeat,
  commitmentNeedsSeat,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { RiGroupLine } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";

import { presentState } from "@/components/Features/Commitments";
import { CommitmentPeople, confirmerOf } from "./CommitmentPeople";
import { Provenance } from "./ConfirmOutcome";
import type { StatusBand } from "./statusBand";

const BAND_TONE_CLASS = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50",
  waiting: "border-stroke-soft-200 bg-bg-weak-50",
  attention: "border-warning-light bg-warning-lighter",
  kept: "border-success-light bg-success-lighter",
} as const;

export interface CommitmentIdentityProps {
  commitment: CommitmentReadModel;
  contributors: CommitmentContributorRecord[];
  seat: CommitmentSeat | null;
  band: StatusBand | null;
  metadata: CommitmentMetadataV1 | null;
  /** The count and unit, already in words, or null when the record has none. */
  units: string | null;
  /** Whether the reader could join the team; the section only hints at it. */
  joinable: boolean;
  viewer: Address | null;
  /** The stewards of the promise's garden, when the page knows them. */
  stewards: readonly Address[];
}

/**
 * Status first, then what was promised.
 *
 * A status read after the people and the progress is a status nobody reads, so
 * the block leads: the state's pill, a marker when it needs the reader, and one
 * sentence, written from the reader's seat, about who acts next. The pill is
 * said once; the facts below carry no second copy of it.
 */
export function CommitmentIdentity({
  commitment,
  contributors,
  seat,
  band,
  metadata,
  units,
  joinable,
  viewer,
  stewards,
}: CommitmentIdentityProps) {
  const { formatMessage } = useIntl();
  const headingId = useId();
  const state = presentState(commitment.derivedState);
  const needsYou = commitmentNeedsSeat({ commitment, seat });
  const kept = commitment.derivedState === "FULFILLED" || commitment.derivedState === "RECONCILED";
  // The sentence names who acts next when one person does: whoever confirms it,
  // or, once kept, whoever confirmed it. Otherwise it says the same thing unnamed.
  const person =
    band?.named?.who === "keptBy"
      ? (commitment.fulfilledBy ?? null)
      : band?.named?.who === "confirmer"
        ? confirmerOf(commitment, contributors)
        : null;
  const sentenceId = band?.named && person ? band.named.bodyId : band?.bodyId;
  // The sentence already says who confirmed it on the ordinary path; a fallback's
  // news is its path and reason, which the provenance line carries.
  const fallbackKept =
    kept && Boolean(commitment.confirmationPath) && commitment.confirmationPath !== "ORDINARY";
  return (
    <>
      <section
        className={`rounded-[var(--radius-lg)] border p-4 ${BAND_TONE_CLASS[band?.tone ?? "neutral"]}`}
        data-component="CommitmentStatusBand"
        data-tone={band?.tone ?? "neutral"}
        aria-label={formatMessage({ id: "app.commitment.status.label" })}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge size="sm" variant={state.tone} showIcon={false}>
            {formatMessage({ id: state.labelId })}
          </StatusBadge>
          {needsYou ? (
            <span className="text-xs font-medium text-warning-dark">
              {formatMessage({ id: "app.commitments.row.needsYou" })}
            </span>
          ) : null}
        </div>
        {sentenceId ? (
          <p className="mt-2 text-sm leading-relaxed text-text-strong-950">
            {formatMessage(
              { id: sentenceId },
              {
                name: person ? (
                  <AddressDisplay
                    key="person"
                    address={person}
                    interactive={false}
                    className="inline"
                  />
                ) : null,
              }
            )}
          </p>
        ) : null}
        {fallbackKept ? (
          <div className="mt-2">
            <Provenance commitment={commitment} />
          </div>
        ) : null}
      </section>

      <section
        className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
        aria-labelledby={headingId}
      >
        <h2 id={headingId} className="text-sm font-semibold leading-5 text-text-strong-950">
          {formatMessage({ id: "app.commitment.promised.title" })}
        </h2>
        <CommitmentPeople
          commitment={commitment}
          contributors={contributors}
          seat={seat}
          units={units}
          viewer={viewer}
          stewards={stewards}
        />
        {metadata?.note ? (
          <p className="mt-2 text-sm leading-relaxed text-text-sub-600">{metadata.note}</p>
        ) : null}
        {metadata?.links && metadata.links.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {metadata.links.map((link) => (
              <li key={link.url} className="truncate">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary-on-surface underline-offset-2 hover:underline"
                  title={link.url}
                >
                  {link.label ?? link.url}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {joinable ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-text-sub-600">
            <RiGroupLine className="h-4 w-4 shrink-0" aria-hidden="true" />
            {formatMessage({ id: "app.commitment.team.openInvite" })}
          </p>
        ) : null}
      </section>
    </>
  );
}
