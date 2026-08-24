import { type Action, type Address, AddressDisplay } from "@green-goods/shared";
import {
  type CommitmentContributorRecord,
  type CommitmentReadModel,
  type CommitmentRequirementRecord,
  type CommitmentSeat,
} from "@green-goods/shared/commitment-pooling";
import { RiGroupLine, RiLockLine, RiUserAddLine, RiWifiOffLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface CommitmentTeamProps {
  commitment: CommitmentReadModel;
  contributors: CommitmentContributorRecord[];
  requirements: CommitmentRequirementRecord[];
  actions: Action[];
  chainId: number;
  seat: CommitmentSeat | null;
  viewer: Address | null;
  /** Whether this reader may join: open team, still moving, not on it. */
  canJoin: boolean;
  isOnline: boolean;
  isJoining: boolean;
  onJoin: () => void;
}

/**
 * The team, read from the record.
 *
 * One accountable lead, then everyone else, each with the requirement rows
 * they were assigned where the lead assigned any, and what they have actually
 * put in: approved work and proof. Presence is never presented as equal credit;
 * the record is what counts, and the section says so once.
 *
 * Joining is the one act here, and only for a reader who is not on the team
 * while the team is open and the commitment still moving. It is an online
 * contract call, so offline it says it needs a connection rather than
 * pretending to queue. Adding, removing and assigning people are the lead's
 * and the stewards' online acts and are not drawn here.
 */
export function CommitmentTeam({
  commitment,
  contributors,
  requirements,
  actions,
  chainId,
  seat,
  viewer,
  canJoin,
  isOnline,
  isJoining,
  onJoin,
}: CommitmentTeamProps) {
  const { formatMessage } = useIntl();
  const active = contributors.filter((entry) => entry.active);
  const lead = active.find((entry) => entry.isLead) ?? null;
  const others = active.filter((entry) => !entry.isLead);
  const ordered = lead ? [lead, ...others] : others;
  if (ordered.length === 0 && !canJoin) return null;

  const actionTitle = (requirementIndex: number) => {
    const row = requirements.find((entry) => entry.requirementIndex === requirementIndex);
    if (!row) {
      return formatMessage({ id: "app.commitment.progress.row" }, { index: requirementIndex + 1 });
    }
    return (
      actions.find((action) => action.id === `${chainId}-${row.actionUID.toString()}`)?.title ??
      formatMessage({ id: "app.commitment.progress.row" }, { index: requirementIndex + 1 })
    );
  };
  const isYou = (address: Address) => viewer?.toLowerCase() === address.toLowerCase();

  return (
    <section
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-component="CommitmentTeam"
      data-frozen={commitment.contributorsFrozen ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.commitment.team.title" })}
        </h3>
        {commitment.contributorsFrozen ? (
          <span className="flex items-center gap-1 text-xs text-text-sub-600">
            <RiLockLine className="h-3.5 w-3.5" aria-hidden="true" />
            {formatMessage({ id: "app.commitment.team.frozen" })}
          </span>
        ) : commitment.contributorPolicy === "OPEN" ? (
          <span className="flex items-center gap-1 text-xs text-text-sub-600">
            <RiGroupLine className="h-3.5 w-3.5" aria-hidden="true" />
            {formatMessage({ id: "app.commitment.team.open" })}
          </span>
        ) : (
          <span className="text-xs text-text-sub-600">
            {formatMessage({ id: "app.commitment.team.led" })}
          </span>
        )}
      </div>

      {ordered.length > 0 ? (
        <ul
          className="mt-3 space-y-2"
          aria-label={formatMessage({ id: "app.commitment.team.roster" })}
        >
          {ordered.map((entry) => (
            <li
              key={entry.id}
              className="rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3"
              data-lead={entry.isLead ? "true" : "false"}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <AddressDisplay address={entry.contributor} showCopyButton={false} />
                {entry.isLead ? (
                  <span className="rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
                    {formatMessage({ id: "app.commitment.team.lead" })}
                  </span>
                ) : null}
                {isYou(entry.contributor) ? (
                  <span className="rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
                    {formatMessage({ id: "app.commitment.people.you" })}
                  </span>
                ) : null}
              </div>
              {entry.requirementIndexes.length > 0 ? (
                <p className="mt-1 text-xs text-text-sub-600">
                  {formatMessage(
                    { id: "app.commitment.team.assigned" },
                    { rows: entry.requirementIndexes.map(actionTitle).join(" · ") }
                  )}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-text-soft-400">
                {formatMessage(
                  { id: "app.commitment.team.credits" },
                  { work: entry.approvedWorkCredits, proof: entry.evidenceCredits }
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-xs text-text-soft-400">
        {formatMessage({ id: "app.commitment.team.recognition" })}
      </p>

      {canJoin && seat === "bystander" ? (
        <div className="mt-3">
          {!isOnline ? (
            <p className="mb-2 flex items-center gap-2 text-xs text-text-sub-600" role="status">
              <RiWifiOffLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              {formatMessage({ id: "app.commitment.team.joinOffline" })}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onJoin}
            disabled={!isOnline || isJoining}
            aria-busy={isJoining}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 py-3 text-sm font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
          >
            <RiUserAddLine className="h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "app.commitment.team.join" })}
          </button>
          <p className="mt-2 text-xs text-text-soft-400">
            {formatMessage({ id: "app.commitment.team.joinNote" })}
          </p>
        </div>
      ) : null}
    </section>
  );
}
