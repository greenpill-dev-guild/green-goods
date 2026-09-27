import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { ClaimantName } from "../ClaimantName";
import type { OpenDialog } from "./commitmentDialogPresentation";

/**
 * Who has asked to take the commitment up, named the way the steward knows
 * them, and the steward's answer. Accept stays one click and its row then says
 * where it stands, held closed until the index moves the request on. Declining
 * closes one request only: the rest stay pending and the record stays claimable.
 */
export function CommitmentClaims({
  claims,
  chainId,
  can,
  acts,
  phaseFor,
  actDisabled,
  onOpenDialog,
}: {
  /** The pending requests only; answered ones live in the timeline. */
  claims: CommitmentClaimRequestRecord[];
  chainId: number;
  can: CommitmentDialogController["can"];
  acts: CommitmentDialogController["acts"];
  /** Where an Accept started from a claimant's row stands. */
  phaseFor: CommitmentDialogController["claimPhase"];
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
      <AdminCardTitle as="h4">
        {formatMessage({ id: "cockpit.garden.pool.claims.title", defaultMessage: "Claims" })}
      </AdminCardTitle>
      <ul className="divide-y divide-stroke-soft">
        {claims.map((claim) => {
          const phase = phaseFor(claim.claimant);
          const inFlight = phase.status !== "idle" && phase.status !== "failed";
          return (
            <li
              key={claim.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              data-testid={`commitment-claim-${claim.claimant.toLowerCase()}`}
            >
              <div className="min-w-0 space-y-0.5">
                <span className="body-sm text-text-strong">
                  <ClaimantName claim={claim} chainId={chainId} /> ·{" "}
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
                <ActPhaseLine
                  phase={phase}
                  chainId={chainId}
                  confirmed={formatMessage({
                    id: "cockpit.garden.pool.claims.accepted",
                    defaultMessage:
                      "Accepted. The request leaves this list once the index shows it.",
                  })}
                />
              </div>
              {can.acceptClaim ? (
                <span className="flex gap-2">
                  <AdminButton
                    type="button"
                    variant="outlined"
                    size="sm"
                    onClick={() =>
                      onOpenDialog({ kind: "decline-claim", claimant: claim.claimant })
                    }
                    disabled={actDisabled || inFlight}
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
                    onClick={() => void acts.acceptClaim(claim.claimant).catch(() => undefined)}
                    disabled={actDisabled || inFlight}
                  >
                    {formatMessage({
                      id: "cockpit.garden.pool.claims.act.accept",
                      defaultMessage: "Accept",
                    })}
                  </AdminButton>
                </span>
              ) : null}
            </li>
          );
        })}
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
      <AdminCardTitle as="h4">
        {formatMessage({ id: "cockpit.garden.pool.commitment.team", defaultMessage: "Team" })}
      </AdminCardTitle>
      <ul className="body-sm text-text-sub">
        {contributors.map((row) => (
          <li key={row.id} className="flex justify-between gap-2">
            <AddressDisplay address={row.contributor} showCopyButton={false} />
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
