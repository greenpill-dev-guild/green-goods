import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  type CommitmentContributorRecord,
  type CommitmentMetadataV1,
  type CommitmentReadModel,
  type CommitmentSeat,
} from "@green-goods/shared/commitment-pooling";
import { RiGroupLine } from "@remixicon/react";
import { useIntl } from "react-intl";

import { presentState } from "@/components/Features/Commitments";
import { CommitmentPeople } from "./CommitmentPeople";
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
  /** Whether the reader could join the team; the card only hints at it. */
  joinable: boolean;
}

/**
 * Status first, then identity.
 *
 * A status message read after the people and the progress bars is a status
 * message nobody reads, so the band leads. The identity card carries no title:
 * the screen header already names the commitment, and the card says where it
 * stands and what it is measured in. Name, then state, then facts, each once.
 */
export function CommitmentIdentity({
  commitment,
  contributors,
  seat,
  band,
  metadata,
  units,
  joinable,
}: CommitmentIdentityProps) {
  const { formatMessage } = useIntl();
  const state = presentState(commitment.derivedState);
  return (
    <>
      {band ? (
        <section
          className={`rounded-[var(--radius-lg)] border p-4 ${BAND_TONE_CLASS[band.tone]}`}
          data-component="CommitmentStatusBand"
          data-tone={band.tone}
        >
          <h2 className="text-sm font-medium text-text-strong-950">
            {formatMessage({ id: band.titleId })}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-text-sub-600">
            {formatMessage({ id: band.bodyId })}
          </p>
          {/* Once kept, who confirmed it and by which path. A fallback's news
          is the path and its reason, which a halo cannot carry. */}
          {commitment.derivedState === "FULFILLED" || commitment.derivedState === "RECONCILED" ? (
            <div className="mt-2">
              <Provenance commitment={commitment} />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* The identity card carries no title: the screen header already names
      the commitment, and the card says where it stands and what it is
      measured in. Name, then state, then facts, each said once. */}
      <section className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {metadata?.title && units ? <p className="text-sm text-text-sub-600">{units}</p> : null}
            <p className="mt-0.5 text-xs text-text-soft-400">
              {formatMessage({
                id:
                  commitment.direction === "REQUEST"
                    ? "app.commitments.direction.request"
                    : "app.commitments.direction.offer",
              })}
            </p>
          </div>
          <StatusBadge size="sm" variant={state.tone}>
            {formatMessage({ id: state.labelId })}
          </StatusBadge>
        </div>

        {metadata?.note ? (
          <p className="mt-3 text-sm leading-relaxed text-text-sub-600">{metadata.note}</p>
        ) : null}
        {metadata?.links && metadata.links.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {metadata.links.map((link) => (
              <li key={link.url} className="truncate">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline-offset-2 hover:underline"
                  title={link.url}
                >
                  {link.label ?? link.url}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <CommitmentPeople commitment={commitment} contributors={contributors} seat={seat} />

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
