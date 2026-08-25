import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import {
  type CommitmentContributorRecord,
  type CommitmentReadModel,
  type CommitmentSeat,
} from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";

export interface CommitmentPeopleProps {
  commitment: CommitmentReadModel;
  contributors: CommitmentContributorRecord[];
  seat: CommitmentSeat | null;
}

/**
 * Who is on this commitment, and in what part.
 *
 * One accountable lead is named, then everyone else. Presence is never
 * presented as equal credit: a contributor's approved work and proof are what
 * count for them, and the lead is the only person who can send the commitment
 * for confirmation.
 */
export function CommitmentPeople({ commitment, contributors, seat }: CommitmentPeopleProps) {
  const { formatMessage } = useIntl();
  const active = contributors.filter((entry) => entry.active);
  const lead = active.find((entry) => entry.isLead);
  const helpers = active.filter((entry) => !entry.isLead);

  return (
    <dl className="mt-3 space-y-2 border-t border-stroke-soft-200 pt-3">
      {commitment.leadProvider ? (
        <Row
          label={formatMessage({ id: "app.commitment.people.provider" })}
          value={<AddressDisplay address={commitment.leadProvider} />}
          you={seat === "provider"}
          youLabel={formatMessage({ id: "app.commitment.people.you" })}
        />
      ) : null}

      {commitment.counterparty && commitment.counterparty !== commitment.leadProvider ? (
        <Row
          label={formatMessage({ id: "app.commitment.people.confirmer" })}
          value={<AddressDisplay address={commitment.counterparty} />}
          you={seat === "confirmer"}
          youLabel={formatMessage({ id: "app.commitment.people.you" })}
        />
      ) : null}

      {helpers.length > 0 ? (
        <Row
          label={formatMessage({ id: "app.commitment.people.team" })}
          value={
            <span className="text-sm text-text-strong-950">
              {formatMessage({ id: "app.commitment.people.teamCount" }, { count: helpers.length })}
            </span>
          }
          you={seat === "contributor"}
          youLabel={formatMessage({ id: "app.commitment.people.youHelping" })}
        />
      ) : null}

      {lead === undefined && commitment.contributorsFrozen ? (
        <p className="text-xs text-text-soft-400">
          {formatMessage({ id: "app.commitment.people.frozen" })}
        </p>
      ) : null}
    </dl>
  );
}

function Row({
  label,
  value,
  you,
  youLabel,
}: {
  label: string;
  value: React.ReactNode;
  you: boolean;
  youLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-soft-400">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-sm text-text-strong-950">
        {value}
        {you ? (
          <span className="shrink-0 rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
            {youLabel}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
