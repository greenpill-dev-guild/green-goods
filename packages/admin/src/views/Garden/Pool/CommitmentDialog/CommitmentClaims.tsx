import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  askState,
  isStillWaiting,
  type WaitingRowState,
} from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiCheckLine, RiTimeLine } from "@remixicon/react";
import { Fragment, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { PersonName } from "@/components/PersonName";
import { ClaimantName } from "../ClaimantName";
import { timelineTime } from "../poolTime";
import type { OpenDialog } from "./commitmentDialogPresentation";

/**
 * Who asked to take the promise up (PRD-1025 D4), where a row on the Pool
 * tab's Waiting for approval card opens: each ask named the way the steward
 * knows the person, when they asked and for whom, and, on a request, what they
 * already hold in this pool and have kept. Approve stays one click and its row
 * then says where it stands; Decline… asks for a reason and closes that ask
 * only. Decided asks stay listed with their outcome, from this visit or the
 * index, the same way the card shows them.
 */
export function CommitmentClaims({
  claims,
  direction,
  chainId,
  can,
  acts,
  phaseFor,
  decisions,
  standingOf,
  actDisabled,
  onOpenDialog,
}: {
  /** Every ask on the promise, answered or not. */
  claims: CommitmentClaimRequestRecord[];
  direction: CommitmentReadModel["direction"];
  chainId: number;
  can: CommitmentDialogController["can"];
  acts: CommitmentDialogController["acts"];
  /** Where an Approve started from a claimant's row stands. */
  phaseFor: CommitmentDialogController["claimPhase"];
  decisions: CommitmentDialogController["claimDecisions"];
  standingOf: CommitmentDialogController["claimantStanding"];
  actDisabled: boolean;
  onOpenDialog: (open: OpenDialog) => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const now = Date.now();
  const rows = claims
    .map((claim) => {
      const phase = phaseFor(claim.claimant);
      return { claim, phase, state: askState(claim, { decisions, phase }) };
    })
    // Still waiting first, oldest ask first; then the answers, newest first.
    .sort((a, b) => {
      const open = Number(isStillWaiting(b.state)) - Number(isStillWaiting(a.state));
      if (open !== 0) return open;
      return isStillWaiting(a.state)
        ? a.claim.requestedAt - b.claim.requestedAt
        : (b.claim.resolvedAt ?? 0) - (a.claim.resolvedAt ?? 0);
    });

  const standing = (claim: CommitmentClaimRequestRecord): string[] => {
    const known = direction === "REQUEST" ? standingOf(claim.claimant) : null;
    if (!known) return [];
    return [
      known.holding === 0
        ? formatMessage({
            id: "cockpit.garden.pool.asks.holdsNone",
            defaultMessage: "No open promises here",
          })
        : known.cap > 0
          ? formatMessage(
              {
                id: "cockpit.garden.pool.asks.holdsOfCap",
                defaultMessage: "Holds {holding} of {cap} open promises here",
              },
              { holding: known.holding, cap: known.cap }
            )
          : formatMessage(
              {
                id: "cockpit.garden.pool.asks.holds",
                defaultMessage: "Holds {holding} open promises here",
              },
              { holding: known.holding }
            ),
      known.kept === 0
        ? formatMessage({
            id: "cockpit.garden.pool.asks.keptNone",
            defaultMessage: "None kept here yet",
          })
        : formatMessage(
            { id: "cockpit.garden.pool.asks.kept", defaultMessage: "Kept {kept} here before" },
            { kept: known.kept }
          ),
    ];
  };

  return (
    <section
      className="space-y-2"
      data-testid="commitment-claims"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.asks.title",
        defaultMessage: "Who asked",
      })}
    >
      <AdminCardTitle as="h4">
        {formatMessage({ id: "cockpit.garden.pool.asks.title", defaultMessage: "Who asked" })}
      </AdminCardTitle>
      <ul className="divide-y divide-stroke-soft">
        {rows.map(({ claim, phase, state }) => {
          const waiting = isStillWaiting(state);
          const facts: ReactNode[] =
            state.status === "approved" || state.status === "declined"
              ? [
                  formatMessage(
                    {
                      id:
                        state.status === "approved"
                          ? "cockpit.garden.pool.asks.approvedAt"
                          : "cockpit.garden.pool.asks.declinedAt",
                      defaultMessage:
                        state.status === "approved" ? "approved {when}" : "declined {when}",
                    },
                    { when: timelineTime(intl, state.at, now) }
                  ),
                ]
              : state.status === "not-chosen"
                ? [
                    formatMessage({
                      id: "cockpit.garden.pool.asks.otherApproved",
                      defaultMessage: "another ask was approved",
                    }),
                  ]
                : [
                    formatMessage(
                      { id: "cockpit.garden.pool.asks.askedAt", defaultMessage: "Asked {when}" },
                      { when: timelineTime(intl, claim.requestedAt * 1000, now) }
                    ),
                    ...(claim.requestedBy.toLowerCase() !== claim.claimant.toLowerCase()
                      ? [
                          formatMessage(
                            {
                              id: "cockpit.garden.pool.claims.requestedBy",
                              defaultMessage: "asked by {who}",
                            },
                            {
                              who: (
                                <PersonName
                                  key="by"
                                  address={claim.requestedBy}
                                  className="body-xs font-normal text-text-sub"
                                />
                              ),
                            }
                          ),
                        ]
                      : []),
                    ...standing(claim),
                  ];
          return (
            <li
              key={claim.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              data-testid={`commitment-claim-${claim.claimant.toLowerCase()}`}
              data-state={state.status}
            >
              <div className="min-w-0 space-y-0.5">
                <span className="flex flex-wrap items-baseline gap-x-1 body-sm">
                  <ClaimantName
                    claim={claim}
                    chainId={chainId}
                    className={waiting ? undefined : "font-medium text-text-sub"}
                  />
                  <span className="text-text-soft">
                    ·{" "}
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
                </span>
                <p className="body-xs text-text-sub">
                  {facts.map((fact, index) => (
                    <Fragment key={index}>
                      {index > 0 ? <span aria-hidden="true"> · </span> : null}
                      {fact}
                    </Fragment>
                  ))}
                </p>
                {/* A failure says nothing changed, and the pair comes back as Try Again. */}
                {state.status === "failed" ? (
                  <ActPhaseLine phase={phase} chainId={chainId} confirmed="" />
                ) : null}
              </div>
              <span className="flex items-center gap-2">
                <AskOutcome state={state} />
                {state.status === "signing" || state.status === "confirming" ? (
                  <ActPhaseLine phase={phase} chainId={chainId} confirmed="" />
                ) : waiting && can.acceptClaim ? (
                  <>
                    <AdminButton
                      type="button"
                      variant="outlined"
                      size="sm"
                      onClick={() =>
                        onOpenDialog({ kind: "decline-claim", claimant: claim.claimant })
                      }
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
                      onClick={() => void acts.acceptClaim(claim.claimant).catch(() => undefined)}
                      disabled={actDisabled}
                    >
                      {state.status === "failed"
                        ? formatMessage({
                            id: "cockpit.garden.pool.approvals.retry",
                            defaultMessage: "Try Again",
                          })
                        : formatMessage({
                            id: "cockpit.garden.pool.approvals.approve",
                            defaultMessage: "Approve",
                          })}
                    </AdminButton>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The chip an ask carries: waiting, or the outcome it came to. */
function AskOutcome({ state }: { state: WaitingRowState }) {
  const { formatMessage } = useIntl();
  if (state.status === "approved") {
    return (
      <StatusBadge variant="success" size="sm" icon={<RiCheckLine className="h-3 w-3" />}>
        {formatMessage({
          id: "cockpit.garden.pool.approvals.approved",
          defaultMessage: "Approved",
        })}
      </StatusBadge>
    );
  }
  if (state.status === "declined" || state.status === "not-chosen") {
    return (
      <StatusBadge variant="neutral" size="sm" showIcon={false}>
        {state.status === "declined"
          ? formatMessage({
              id: "cockpit.garden.pool.approvals.declined",
              defaultMessage: "Declined",
            })
          : formatMessage({
              id: "cockpit.garden.pool.approvals.notChosen",
              defaultMessage: "Not chosen",
            })}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge variant="warning" size="sm" icon={<RiTimeLine className="h-3 w-3" />}>
      {formatMessage({ id: "cockpit.garden.pool.claims.waiting", defaultMessage: "Waiting" })}
    </StatusBadge>
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
