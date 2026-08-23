import type { CommitmentDialogController } from "@green-goods/shared";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
} from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { shortAddress } from "../poolPresentation";
import type { OpenDialog } from "./commitmentDialogPresentation";

/**
 * Who has asked to take the commitment up, and the steward's answer. Declining
 * closes one request only: the rest stay pending and the record stays claimable.
 */
export function CommitmentClaims({
  claims,
  can,
  acts,
  actDisabled,
  onOpenDialog,
}: {
  /** The pending requests only; answered ones live in the timeline. */
  claims: CommitmentClaimRequestRecord[];
  can: CommitmentDialogController["can"];
  acts: CommitmentDialogController["acts"];
  actDisabled: boolean;
  onOpenDialog: (open: OpenDialog) => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="space-y-2"
      data-testid="commitment-claims"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.claims.title",
        defaultMessage: "Claims",
      })}
    >
      <p className="label-md text-text-strong">
        {formatMessage({ id: "cockpit.garden.pool.claims.title", defaultMessage: "Claims" })}
      </p>
      <ul className="divide-y divide-[rgb(var(--m3-outline-variant))]">
        {claims.map((claim) => (
          <li key={claim.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm text-text-strong" title={claim.claimant}>
              {shortAddress(claim.claimant)} ·{" "}
              {claim.claimType === "GARDEN"
                ? formatMessage({
                    id: "cockpit.garden.pool.claims.type.garden",
                    defaultMessage: "garden",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.claims.type.individual",
                    defaultMessage: "individual",
                  })}
            </span>
            {can.acceptClaim ? (
              <span className="flex gap-2">
                <AdminButton
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() => onOpenDialog({ kind: "decline-claim", claimant: claim.claimant })}
                  disabled={actDisabled}
                >
                  {formatMessage({
                    id: "cockpit.garden.pool.claims.act.decline",
                    defaultMessage: "Decline…",
                  })}
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="filled"
                  size="sm"
                  onClick={() => void acts.acceptClaim(claim.claimant)}
                  disabled={actDisabled}
                >
                  {formatMessage({
                    id: "cockpit.garden.pool.claims.act.accept",
                    defaultMessage: "Accept",
                  })}
                </AdminButton>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Who is on the record, and the standing each of them holds. */
export function CommitmentRoster({
  contributors,
}: {
  contributors: CommitmentContributorRecord[];
}) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="space-y-1"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.commitment.team",
        defaultMessage: "Team",
      })}
    >
      <p className="label-md text-text-strong">
        {formatMessage({ id: "cockpit.garden.pool.commitment.team", defaultMessage: "Team" })}
      </p>
      <ul className="text-sm text-text-sub">
        {contributors.map((row) => (
          <li key={row.id} className="flex justify-between gap-2" title={row.contributor}>
            <span>{shortAddress(row.contributor)}</span>
            <span className="text-text-soft">
              {row.isLead
                ? formatMessage({
                    id: "cockpit.garden.pool.commitment.team.lead",
                    defaultMessage: "lead",
                  })
                : row.active
                  ? formatMessage({
                      id: "cockpit.garden.pool.commitment.team.contributor",
                      defaultMessage: "contributor",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.commitment.team.left",
                      defaultMessage: "left",
                    })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
