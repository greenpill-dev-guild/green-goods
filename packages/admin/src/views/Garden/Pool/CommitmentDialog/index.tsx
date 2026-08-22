import {
  type Address,
  Alert,
  adminRoutes,
  type CommitmentEventRecord,
  type DisputeResolutionKey,
  StatusBadge,
  useCommitmentDialogController,
} from "@green-goods/shared";
import { RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import {
  commitmentStateChip,
  directionLabel,
  formatUnixDate,
  shortAddress,
} from "../poolPresentation";

export interface CommitmentDialogPanelProps {
  chainId: number;
  /** The pool's garden: the authority a garden fallback uses. */
  garden: Address;
  commitmentId: string;
  tone: "garden" | "hub" | "community";
}

type OpenDialog =
  | "cancel"
  | "mark-ready"
  | "raise-dispute"
  | "resolve-dispute"
  | "fallback-confirm"
  | "attach-assessment"
  | { kind: "decline-claim"; claimant: Address }
  | null;

const STAGES = ["open", "accepted", "proof", "ready", "kept"] as const;

function stageIndex(state: string, evidenceCount: number): number {
  switch (state) {
    case "OFFERED":
    case "REQUESTED":
      return 0;
    case "ACCEPTED":
      return evidenceCount > 0 ? 2 : 1;
    case "READY_FOR_CONFIRMATION":
    case "DISPUTED":
      return 3;
    case "FULFILLED":
      return 4;
    default:
      return -1;
  }
}

/**
 * W10, one commitment in the steward's dialect (uiux-spec §6.7, follow-up
 * item 2: sectioned anatomy). Rendered inside the Garden workspace's left
 * inspector or the Hub's Confirm stage; every act goes through the shared
 * controller, every reasoned act through AdminReasonDialog, and a fallback
 * confirmation appears only when the ordinary path is unreachable, naming
 * the garden whose authority it uses.
 */
export function CommitmentDialogPanel({
  chainId,
  garden,
  commitmentId,
  tone,
}: CommitmentDialogPanelProps) {
  const { formatMessage, locale } = useIntl();
  const navigate = useNavigate();
  const dialog = useCommitmentDialogController({
    chainId,
    garden,
    commitmentId: BigInt(commitmentId),
  });
  const [open, setOpen] = useState<OpenDialog>(null);
  const [resolution, setResolution] = useState<DisputeResolutionKey>("RESTORE_PREVIOUS");
  const [assessmentUID, setAssessmentUID] = useState<string | null>(null);
  const offlineNote = formatMessage({
    id: "cockpit.garden.pool.offline",
    defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
  });

  if (dialog.isLoading) {
    return (
      <div
        className="space-y-3 p-4"
        role="status"
        aria-label={formatMessage({
          id: "cockpit.garden.pool.commitment.loading",
          defaultMessage: "Loading the commitment",
        })}
      >
        <div className="h-8 w-2/3 rounded-[var(--m3-shape-sm)] skeleton-shimmer" aria-hidden />
        <div className="h-24 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
        <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
      </div>
    );
  }

  if (dialog.isError || dialog.notFound || !dialog.commitment) {
    return (
      <div
        className="flex min-h-56 flex-col items-center justify-center gap-3 p-4 text-center"
        data-component="CommitmentDialogPanel"
        data-state="not-found"
      >
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.notFound.title",
            defaultMessage: "This commitment couldn’t be loaded",
          })}
        </p>
        <p className="max-w-sm text-sm text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.notFound.body",
            defaultMessage:
              "It may be mid-sync, or the link is stale. Retry, or return to the pool to pick it again.",
          })}
        </p>
        <div className="flex gap-2">
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            leadingIcon={<RiRefreshLine className="h-4 w-4" />}
            onClick={() => void dialog.refetch()}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.notFound.retry",
              defaultMessage: "Retry",
            })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            onClick={() => navigate(adminRoutes.gardenPool({ gardenId: garden }))}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.notFound.back",
              defaultMessage: "Back to pool",
            })}
          </AdminButton>
        </div>
      </div>
    );
  }

  const { commitment, detail, can, acts, confirmation } = dialog;
  const chip = commitmentStateChip(commitment, formatMessage);
  const title =
    dialog.title ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
      { id: commitment.commitmentId.toString() }
    );
  const actDisabled = !dialog.isOnline || dialog.isActing;
  const stage = stageIndex(commitment.onchainState, commitment.evidenceCount);
  const pendingClaims = (detail?.claimRequests ?? []).filter((claim) => claim.state === "PENDING");
  const fallbackPath =
    confirmation.allowed && confirmation.path !== "ORDINARY" ? confirmation.path : null;
  const evidenceOnly =
    (detail?.requirements.length ?? 0) === 0 && commitment.commitmentType !== "DOMAIN_IMPACT";

  const stageLabels: Record<(typeof STAGES)[number], string> = {
    open:
      commitment.direction === "REQUEST"
        ? formatMessage({
            id: "cockpit.garden.pool.commitment.stage.requested",
            defaultMessage: "Requested",
          })
        : formatMessage({
            id: "cockpit.garden.pool.commitment.stage.offered",
            defaultMessage: "Offered",
          }),
    accepted: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.accepted",
      defaultMessage: "Accepted",
    }),
    proof: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.proof",
      defaultMessage: "Proof in",
    }),
    ready: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.ready",
      defaultMessage: "Ready",
    }),
    kept: formatMessage({
      id: "cockpit.garden.pool.commitment.stage.kept",
      defaultMessage: "Kept",
    }),
  };

  const eventLabel = (event: CommitmentEventRecord): string => {
    const labels: Record<string, { id: string; defaultMessage: string }> = {
      CREATED: { id: "cockpit.garden.pool.commitment.event.created", defaultMessage: "Created" },
      CLAIM_REQUESTED: {
        id: "cockpit.garden.pool.commitment.event.claimRequested",
        defaultMessage: "Asked to take it up",
      },
      CLAIM_DECLINED: {
        id: "cockpit.garden.pool.commitment.event.claimDeclined",
        defaultMessage: "Request declined",
      },
      ACCEPTED: { id: "cockpit.garden.pool.commitment.event.accepted", defaultMessage: "Taken up" },
      CONTRIBUTOR_ADDED: {
        id: "cockpit.garden.pool.commitment.event.contributorAdded",
        defaultMessage: "Joined the team",
      },
      CONTRIBUTOR_REMOVED: {
        id: "cockpit.garden.pool.commitment.event.contributorRemoved",
        defaultMessage: "Left the team",
      },
      CONTRIBUTOR_ROSTER_FROZEN: {
        id: "cockpit.garden.pool.commitment.event.rosterFrozen",
        defaultMessage: "Team settled",
      },
      WORK_LINKED: {
        id: "cockpit.garden.pool.commitment.event.workLinked",
        defaultMessage: "Work linked",
      },
      WORK_UNLINKED: {
        id: "cockpit.garden.pool.commitment.event.workUnlinked",
        defaultMessage: "Work unlinked",
      },
      APPROVED_WORK_COUNTED: {
        id: "cockpit.garden.pool.commitment.event.workApproved",
        defaultMessage: "Work approved",
      },
      EVIDENCE_ATTACHED: {
        id: "cockpit.garden.pool.commitment.event.evidence",
        defaultMessage: "Proof added",
      },
      ASSESSMENT_ATTACHED: {
        id: "cockpit.garden.pool.commitment.event.assessment",
        defaultMessage: "Assessment attached",
      },
      READY_FOR_CONFIRMATION: {
        id: "cockpit.garden.pool.commitment.event.ready",
        defaultMessage: "Sent for confirmation",
      },
      CONFIRMATION_RECORDED: {
        id: "cockpit.garden.pool.commitment.event.confirmation",
        defaultMessage: "Confirmation recorded",
      },
      FULFILLED: { id: "cockpit.garden.pool.commitment.event.fulfilled", defaultMessage: "Kept" },
      CANCELLED: {
        id: "cockpit.garden.pool.commitment.event.cancelled",
        defaultMessage: "Cancelled",
      },
      EXPIRED: { id: "cockpit.garden.pool.commitment.event.expired", defaultMessage: "Expired" },
      DISPUTED: {
        id: "cockpit.garden.pool.commitment.event.disputed",
        defaultMessage: "Under review by stewards",
      },
      DISPUTE_RESOLVED: {
        id: "cockpit.garden.pool.commitment.event.disputeResolved",
        defaultMessage: "Review resolved",
      },
      CONSIDERATION_DECLARED: {
        id: "cockpit.garden.pool.commitment.event.consideration",
        defaultMessage: "Reward declared",
      },
      CONSIDERATION_PAID: {
        id: "cockpit.garden.pool.commitment.event.considerationPaid",
        defaultMessage: "Payout recorded",
      },
      CONFIRMER_RULE_SET: {
        id: "cockpit.garden.pool.commitment.event.confirmerRule",
        defaultMessage: "Confirmers set",
      },
    };
    const descriptor = labels[event.eventType];
    return descriptor
      ? formatMessage(descriptor)
      : event.eventType.toLowerCase().replace(/_/g, " ");
  };

  const railLabel =
    commitment.considerationRail === "ARBITRUM_EXTERNAL"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.rail.external",
          defaultMessage: "External payout record",
        })
      : commitment.considerationRail === "CELO_SETTLEMENT"
        ? formatMessage({
            id: "cockpit.garden.pool.seed.rail.celo",
            defaultMessage: "Celo G$ settlement",
          })
        : formatMessage({ id: "cockpit.garden.pool.seed.rail.none", defaultMessage: "None" });

  const fact = (label: string, value: string) => (
    <div key={label} className="flex justify-between gap-3 text-body-md">
      <dt className="shrink-0 text-text-soft">{label}</dt>
      <dd className="truncate text-right text-text-strong" title={value}>
        {value}
      </dd>
    </div>
  );

  return (
    <div
      className="space-y-5 p-4"
      data-component="CommitmentDialogPanel"
      data-state={commitment.onchainState.toLowerCase()}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="info" size="sm">
            {directionLabel(commitment.direction, formatMessage)}
          </StatusBadge>
          <StatusBadge variant={chip.variant} size="sm">
            {chip.label}
          </StatusBadge>
          {dialog.isDue ? (
            <StatusBadge variant="error" size="sm">
              {formatMessage({ id: "cockpit.garden.pool.row.pastDue", defaultMessage: "Past due" })}
            </StatusBadge>
          ) : null}
          {fallbackPath ? (
            <StatusBadge variant="warning" size="sm">
              {formatMessage({
                id: "cockpit.garden.pool.commitment.fallbackEligible",
                defaultMessage: "Ordinary confirmation unreachable",
              })}
            </StatusBadge>
          ) : null}
        </div>
        <h3 className="text-base font-semibold text-text-strong" title={title}>
          {title}
        </h3>
        <p className="text-sm text-text-soft">
          {[
            commitment.counterparty
              ? `${shortAddress(commitment.creator)} → ${shortAddress(commitment.counterparty)}`
              : shortAddress(commitment.creator),
            `${commitment.targetUnits.toString()} ${commitment.unitLabel ?? ""}`.trim(),
            commitment.dueDate
              ? formatMessage(
                  { id: "cockpit.garden.pool.row.due", defaultMessage: "due {date}" },
                  { date: formatUnixDate(commitment.dueDate, locale, "—") }
                )
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {dialog.note ? <p className="text-sm text-text-sub">{dialog.note}</p> : null}
      </header>

      {stage >= 0 ? (
        <ol
          className="flex flex-wrap gap-1 text-xs"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.commitment.stages",
            defaultMessage: "Lifecycle",
          })}
        >
          {STAGES.map((key, index) => (
            <li
              key={key}
              aria-current={index === stage ? "step" : undefined}
              className={
                index <= stage
                  ? "rounded-full bg-[rgb(var(--m3-secondary-container))] px-2 py-0.5 text-[rgb(var(--m3-on-secondary-container))]"
                  : "rounded-full bg-[rgb(var(--m3-surface-container-highest))] px-2 py-0.5 text-text-soft"
              }
            >
              {stageLabels[key]}
            </li>
          ))}
        </ol>
      ) : null}

      {commitment.onchainState === "DISPUTED" ? (
        <Alert variant="warning">
          {dialog.disputeReason.reason
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.commitment.disputed.withReason",
                  defaultMessage:
                    "Under review by stewards: “{reason}”. Members see only that it is under review.",
                },
                { reason: dialog.disputeReason.reason.reason }
              )
            : formatMessage({
                id: "cockpit.garden.pool.commitment.disputed.noReason",
                defaultMessage:
                  "Under review by stewards. Members see only that it is under review.",
              })}
        </Alert>
      ) : null}
      {commitment.onchainState === "CANCELLED" && dialog.cancelReason.reason ? (
        <Alert variant="info">
          {formatMessage(
            {
              id: "cockpit.garden.pool.commitment.cancelled.withReason",
              defaultMessage: "Cancelled: “{reason}”.",
            },
            { reason: dialog.cancelReason.reason.reason }
          )}
        </Alert>
      ) : null}
      {fallbackPath ? (
        <div data-testid="commitment-fallback-eligible">
          <Alert variant="warning">
            {fallbackPath === "POOL_FALLBACK"
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.garden",
                  defaultMessage:
                    "Nobody on the ordinary path can still confirm this. As a steward of this garden you may confirm it with a recorded reason; every contributor is excluded.",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.protocol",
                  defaultMessage:
                    "Nobody on the ordinary path can still confirm this, and the commitment lets the Green Goods team step in. As a protocol steward you may confirm it with a recorded reason; every contributor is excluded.",
                })}
          </Alert>
        </div>
      ) : null}
      {dialog.poolPaused ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.poolPaused",
            defaultMessage:
              "The pool is paused: accepting, readying and confirming wait; proof, wind-down and recovery stay open.",
          })}
        </Alert>
      ) : null}

      <section
        aria-label={formatMessage({
          id: "cockpit.garden.pool.commitment.facts",
          defaultMessage: "Facts",
        })}
      >
        <dl className="space-y-1">
          {fact(
            formatMessage({
              id: "cockpit.garden.pool.commitment.fact.kind",
              defaultMessage: "Kind",
            }),
            commitment.commitmentType === "DOMAIN_IMPACT"
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.kind.gardenWork",
                  defaultMessage: "Garden work (impact)",
                })
              : commitment.commitmentType === "SEASON_CAMPAIGN"
                ? formatMessage({
                    id: "cockpit.garden.pool.seed.kind.seasonCampaign",
                    defaultMessage: "Season / campaign commitment",
                  })
                : commitment.commitmentType === "STEWARD_CAPTURED"
                  ? formatMessage({
                      id: "cockpit.garden.pool.commitment.fact.captured",
                      defaultMessage: "Recorded for a member",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.seed.kind.service",
                      defaultMessage: "Support / service",
                    })
          )}
          {fact(
            formatMessage({
              id: "cockpit.garden.pool.commitment.fact.proof",
              defaultMessage: "Proof",
            }),
            formatMessage(
              {
                id: "cockpit.garden.pool.commitment.fact.proofCount",
                defaultMessage: "{count, plural, =0 {none yet} one {# item} other {# items}}",
              },
              { count: commitment.evidenceCount }
            )
          )}
          {(detail?.requirements.length ?? 0) > 0
            ? fact(
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fact.work",
                  defaultMessage: "Work",
                }),
                detail!.requirements
                  .map((row) => `${row.approvedCount}/${row.requiredCount}`)
                  .join(" · ")
              )
            : null}
          {fact(
            formatMessage({
              id: "cockpit.garden.pool.commitment.fact.provider",
              defaultMessage: "Provider",
            }),
            commitment.leadProvider
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.commitment.fact.providerCannotConfirm",
                    defaultMessage: "{who}, cannot confirm",
                  },
                  { who: shortAddress(commitment.leadProvider) }
                )
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.fact.providerNone",
                  defaultMessage: "Nobody yet",
                })
          )}
          {fact(
            formatMessage({
              id: "cockpit.garden.pool.seed.confirmers",
              defaultMessage: "Confirmers",
            }),
            commitment.confirmers.length === 0
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.review.ordinary",
                  defaultMessage: "Ordinary rule",
                })
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.review.named",
                    defaultMessage: "Named group · {threshold} of {count}",
                  },
                  {
                    threshold: commitment.confirmationThreshold ?? 1,
                    count: commitment.confirmers.length,
                  }
                )
          )}
          {fact(
            formatMessage({
              id: "cockpit.garden.pool.seed.review.fallback",
              defaultMessage: "Green Goods team fallback",
            }),
            commitment.protocolFallbackEnabled
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.review.fallbackOn",
                  defaultMessage: "On · reason required if used",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.review.fallbackOff",
                  defaultMessage: "Off",
                })
          )}
          {commitment.readyOverridden
            ? fact(
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fact.override",
                  defaultMessage: "Ready by",
                }),
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fact.overrideValue",
                  defaultMessage: "Steward override, reason recorded",
                })
              )
            : null}
          {fact(
            formatMessage({ id: "cockpit.garden.pool.seed.rail", defaultMessage: "Reward rail" }),
            railLabel
          )}
          {commitment.onchainState === "FULFILLED" && commitment.confirmationPath
            ? fact(
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fact.confirmedBy",
                  defaultMessage: "Confirmed by",
                }),
                commitment.confirmationPath === "POOL_FALLBACK"
                  ? formatMessage({
                      id: "cockpit.garden.pool.commitment.path.garden",
                      defaultMessage: "your garden steward — fallback",
                    })
                  : commitment.confirmationPath === "PROTOCOL_FALLBACK"
                    ? formatMessage({
                        id: "cockpit.garden.pool.commitment.path.protocol",
                        defaultMessage: "Green Goods team — fallback",
                      })
                    : `${shortAddress(commitment.fulfilledBy)} · ${formatMessage({ id: "cockpit.garden.pool.commitment.path.ordinary", defaultMessage: "ordinary" })}`
              )
            : null}
          {commitment.fallbackReason
            ? fact(
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fact.fallbackReason",
                  defaultMessage: "Fallback reason",
                }),
                commitment.fallbackReason
              )
            : null}
        </dl>
      </section>

      {commitment.onchainState === "ACCEPTED" && dialog.isLocalSteward ? (
        <section
          className="space-y-2"
          data-testid="commitment-accepted-acts"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.commitment.accepted.label",
            defaultMessage: "Recovery",
          })}
        >
          {evidenceOnly ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2">
              <p className="min-w-0 text-sm">
                <span className="font-medium text-text-strong">
                  {formatMessage({
                    id: "cockpit.garden.pool.commitment.accepted.cannotConfirm",
                    defaultMessage: "Recipient can’t confirm?",
                  })}
                </span>{" "}
                <span className="text-text-soft">
                  {formatMessage({
                    id: "cockpit.garden.pool.commitment.accepted.cannotConfirmHint",
                    defaultMessage: "A steward can mark it ready with a recorded reason.",
                  })}
                </span>
              </p>
              <AdminButton
                type="button"
                variant="outlined"
                size="sm"
                onClick={() => setOpen("mark-ready")}
                disabled={actDisabled || !can.markReady}
              >
                {formatMessage({
                  id: "cockpit.garden.pool.commitment.act.markReady",
                  defaultMessage: "Mark ready…",
                })}
              </AdminButton>
            </div>
          ) : null}
          {can.attachAssessment ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2">
              <p className="min-w-0 text-sm">
                <span className="font-medium text-text-strong">
                  {formatMessage({
                    id: "cockpit.garden.pool.commitment.accepted.assessment",
                    defaultMessage: "Assessment required",
                  })}
                </span>{" "}
                <span className="text-text-soft">
                  {formatMessage({
                    id: "cockpit.garden.pool.commitment.accepted.assessmentHint",
                    defaultMessage:
                      "Only assessments recorded for the provider garden can be attached.",
                  })}
                </span>
              </p>
              <AdminButton
                type="button"
                variant="outlined"
                size="sm"
                onClick={() => setOpen("attach-assessment")}
                disabled={actDisabled}
              >
                {formatMessage({
                  id: "cockpit.garden.pool.commitment.act.attachAssessment",
                  defaultMessage: "Attach assessment…",
                })}
              </AdminButton>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2">
            <p className="min-w-0 text-sm">
              <span className="font-medium text-text-strong">
                {formatMessage({
                  id: "cockpit.garden.pool.commitment.accepted.calledOff",
                  defaultMessage: "Called off?",
                })}
              </span>{" "}
              <span className="text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.commitment.accepted.calledOffHint",
                  defaultMessage: "Cancelling releases the committed units and records why.",
                })}
              </span>
            </p>
            <AdminButton
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setOpen("cancel")}
              disabled={actDisabled || !can.cancel}
            >
              {formatMessage({
                id: "cockpit.garden.pool.commitment.act.cancel",
                defaultMessage: "Cancel commitment…",
              })}
            </AdminButton>
          </div>
        </section>
      ) : null}

      {pendingClaims.length > 0 ? (
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
            {pendingClaims.map((claim) => (
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
                      onClick={() => setOpen({ kind: "decline-claim", claimant: claim.claimant })}
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
      ) : null}

      {(detail?.contributors.length ?? 0) > 0 ? (
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
            {detail!.contributors.map((row) => (
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
      ) : null}

      <section
        className="space-y-1"
        aria-label={formatMessage({
          id: "cockpit.garden.pool.commitment.timeline",
          defaultMessage: "Timeline",
        })}
      >
        <p className="label-md text-text-strong">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.timeline",
            defaultMessage: "Timeline",
          })}
        </p>
        {dialog.events.length === 0 ? (
          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.commitment.timelineEmpty",
              defaultMessage: "Nothing recorded yet.",
            })}
          </p>
        ) : (
          <ol className="divide-y divide-[rgb(var(--m3-outline-variant))] text-sm">
            {dialog.events.map((event) => (
              <li key={event.id} className="flex justify-between gap-2 py-1.5">
                <span className="text-text-strong">{eventLabel(event)}</span>
                <span className="shrink-0 text-xs text-text-soft" title={event.actor ?? undefined}>
                  {[
                    event.actor ? shortAddress(event.actor) : null,
                    formatUnixDate(event.timestamp, locale, ""),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!dialog.isOnline ? (
        <p className="text-xs text-warning-dark" role="status">
          {offlineNote}
        </p>
      ) : null}

      <div
        className="flex flex-wrap justify-end gap-2 border-t border-[rgb(var(--m3-outline-variant))] pt-3"
        data-testid="commitment-acts"
      >
        {can.expire ? (
          <AdminButton
            type="button"
            variant="danger"
            size="sm"
            onClick={() => void acts.expire()}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.row.act.expire",
              defaultMessage: "Expire now",
            })}
          </AdminButton>
        ) : null}
        {can.raiseDispute ? (
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => setOpen("raise-dispute")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.raiseDispute",
              defaultMessage: "Raise dispute…",
            })}
          </AdminButton>
        ) : null}
        {can.resolveDispute ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => setOpen("resolve-dispute")}
            disabled={actDisabled}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.resolve",
              defaultMessage: "Resolve…",
            })}
          </AdminButton>
        ) : null}
        {can.confirmFallback ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => setOpen("fallback-confirm")}
            disabled={actDisabled}
          >
            {fallbackPath === "PROTOCOL_FALLBACK"
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.act.confirmProtocol",
                  defaultMessage: "Confirm for Green Goods team…",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.act.confirmGarden",
                  defaultMessage: "Confirm as garden fallback…",
                })}
          </AdminButton>
        ) : null}
        {can.confirmOrdinary ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => void acts.confirmOrdinary()}
            disabled={dialog.isActing}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.confirm",
              defaultMessage: "Confirm, commitment kept",
            })}
          </AdminButton>
        ) : null}
        {can.sendForConfirmation ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            onClick={() => void acts.sendForConfirmation()}
            disabled={dialog.isActing}
          >
            {formatMessage({
              id: "cockpit.garden.pool.commitment.act.send",
              defaultMessage: "Send for confirmation",
            })}
          </AdminButton>
        ) : null}
      </div>

      <AdminReasonDialog
        isOpen={open === "cancel"}
        onClose={() => setOpen(null)}
        tone={tone}
        variant="danger"
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.title",
          defaultMessage: "Cancel this commitment",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.description",
          defaultMessage:
            "Accepted becomes Cancelled with a recorded reason. Committed units release; the member sees the reason, never “cancelled” alone.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.confirm",
          defaultMessage: "Cancel commitment",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.cancel.keep",
          defaultMessage: "Keep commitment",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.cancel.suggestion.agreement",
            defaultMessage: "Withdrawn by agreement",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.cancel.suggestion.notNeeded",
            defaultMessage: "No longer needed",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.cancel.suggestion.duplicate",
            defaultMessage: "Duplicate commitment",
          }),
        ]}
        blockedReason={dialog.isOnline ? undefined : offlineNote}
        onConfirm={async (reason) => {
          await acts.cancel(reason);
          setOpen(null);
        }}
      />
      <AdminReasonDialog
        isOpen={open === "mark-ready"}
        onClose={() => setOpen(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.markReady.title",
          defaultMessage: "Mark ready with override",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.markReady.description",
          defaultMessage:
            "A steward override, separate from sending for confirmation. Moves the commitment to Ready without the recipient’s send; the reason is stored and shows in the member timeline.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.markReady.confirm",
          defaultMessage: "Mark ready",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.markReady.suggestion.field",
            defaultMessage: "Checked in the field",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.markReady.suggestion.device",
            defaultMessage: "Recipient has no device",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.markReady.suggestion.gathering",
            defaultMessage: "Agreed at the gathering",
          }),
        ]}
        blockedReason={dialog.isOnline ? undefined : offlineNote}
        onConfirm={async (reason) => {
          await acts.markReady(reason);
          setOpen(null);
        }}
      />
      <AdminReasonDialog
        isOpen={open === "raise-dispute"}
        onClose={() => setOpen(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.title",
          defaultMessage: "Raise a dispute",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.description",
          defaultMessage:
            "Freezes the commitment for review. Members see “under review by stewards”, never dispute language.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.confirm",
          defaultMessage: "Raise dispute",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.contested",
            defaultMessage: "Delivery contested",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.details",
            defaultMessage: "Details look wrong",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.secondLook",
            defaultMessage: "Needs a second look",
          }),
        ]}
        blockedReason={dialog.isOnline ? undefined : offlineNote}
        onConfirm={async (reason) => {
          await acts.raiseDispute(reason);
          setOpen(null);
        }}
      />
      <AdminReasonDialog
        isOpen={open === "resolve-dispute"}
        onClose={() => setOpen(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.resolve.title",
          defaultMessage: "Resolve the dispute",
        })}
        description={
          can.resolveFulfilled
            ? formatMessage({
                id: "cockpit.garden.pool.commitment.resolve.description",
                defaultMessage: "Every outcome records its reason in the member’s timeline.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.commitment.resolve.descriptionNoFulfilled",
                defaultMessage:
                  "You can’t mark this kept: nobody confirms their own work, and a record that had expired can’t be kept. A steward who isn’t on it may. Every outcome records its reason.",
              })
        }
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.resolve.confirm",
          defaultMessage: "Resolve",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.resolve.suggestion.gathering",
            defaultMessage: "Resolved at the gathering",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.resolve.suggestion.completed",
            defaultMessage: "Work completed since",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.resolve.suggestion.release",
            defaultMessage: "Agreed to release it",
          }),
        ]}
        blockedReason={dialog.isOnline ? undefined : offlineNote}
        onConfirm={async (reason) => {
          await acts.resolveDispute(resolution, reason);
          setOpen(null);
        }}
      >
        <AdminChoiceGroup
          ariaLabel={formatMessage({
            id: "cockpit.garden.pool.commitment.resolve.outcome",
            defaultMessage: "Outcome",
          })}
          value={resolution}
          onChange={(value) => setResolution(value as DisputeResolutionKey)}
          options={[
            {
              value: "RESTORE_PREVIOUS",
              label: formatMessage({
                id: "cockpit.garden.pool.commitment.resolve.restore",
                defaultMessage: "Restore previous state",
              }),
              description: formatMessage({
                id: "cockpit.garden.pool.commitment.resolve.restoreHint",
                defaultMessage: "Returns the exact stored state, no unit movement",
              }),
            },
            ...(can.resolveFulfilled
              ? [
                  {
                    value: "FULFILLED",
                    label: formatMessage({
                      id: "cockpit.garden.pool.commitment.resolve.fulfilled",
                      defaultMessage: "Kept",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.commitment.resolve.fulfilledHint",
                      defaultMessage: "Counts as confirmed; the team is frozen",
                    }),
                  },
                ]
              : []),
            {
              value: "CANCELLED",
              label: formatMessage({
                id: "cockpit.garden.pool.commitment.resolve.cancelled",
                defaultMessage: "Cancelled",
              }),
            },
            {
              value: "EXPIRED",
              label: formatMessage({
                id: "cockpit.garden.pool.commitment.resolve.expired",
                defaultMessage: "Expired",
              }),
            },
          ]}
        />
      </AdminReasonDialog>
      <AdminReasonDialog
        isOpen={open === "fallback-confirm"}
        onClose={() => setOpen(null)}
        tone={tone}
        title={
          fallbackPath === "PROTOCOL_FALLBACK"
            ? formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.protocolTitle",
                defaultMessage: "Confirm for the Green Goods team",
              })
            : formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.gardenTitle",
                defaultMessage: "Confirm as garden fallback",
              })
        }
        description={
          fallbackPath === "PROTOCOL_FALLBACK"
            ? formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.protocolDescription",
                defaultMessage:
                  "Uses the Green Goods protocol garden’s authority, checked at signing. Every contributor is blocked, and module ownership alone grants nothing. The member timeline will say “confirmed by Green Goods team, fallback” with this reason.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.commitment.fallback.gardenDescription",
                defaultMessage:
                  "Uses this garden’s steward authority. Every frozen team address is blocked. The member timeline will say “confirmed by garden steward, fallback” with this reason.",
              })
        }
        confirmLabel={
          fallbackPath === "PROTOCOL_FALLBACK"
            ? formatMessage({
                id: "cockpit.garden.pool.commitment.act.confirmProtocolConfirm",
                defaultMessage: "Confirm for Green Goods team",
              })
            : formatMessage({
                id: "cockpit.garden.pool.commitment.act.confirmGardenConfirm",
                defaultMessage: "Confirm as garden fallback",
              })
        }
        suggestions={
          fallbackPath === "PROTOCOL_FALLBACK"
            ? [
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.suggestion.noLocal",
                  defaultMessage: "No eligible local confirmer",
                }),
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.suggestion.unreachable",
                  defaultMessage: "Named group unreachable",
                }),
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.suggestion.leftGarden",
                  defaultMessage: "Recipient left the garden",
                }),
              ]
            : [
                formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.suggestion.siteVisit",
                  defaultMessage: "Confirmed on a site visit",
                }),
                formatMessage({
                  id: "cockpit.garden.pool.commitment.markReady.suggestion.device",
                  defaultMessage: "Recipient has no device",
                }),
                formatMessage({
                  id: "cockpit.garden.pool.commitment.markReady.suggestion.gathering",
                  defaultMessage: "Agreed at the gathering",
                }),
              ]
        }
        blockedReason={dialog.isOnline ? undefined : offlineNote}
        onConfirm={async (reason) => {
          await acts.confirmFallback(reason);
          setOpen(null);
        }}
      />
      <AdminReasonDialog
        isOpen={typeof open === "object" && open?.kind === "decline-claim"}
        onClose={() => setOpen(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.declineClaim.title",
          defaultMessage: "Decline this request",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.declineClaim.description",
          defaultMessage:
            "Only this request is declined; others stay pending and the commitment stays claimable. The person sees your reason and may ask again.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.declineClaim.confirm",
          defaultMessage: "Decline request",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.declineClaim.keep",
          defaultMessage: "Keep pending",
        })}
        blockedReason={dialog.isOnline ? undefined : offlineNote}
        onConfirm={async (reason) => {
          if (typeof open !== "object" || open?.kind !== "decline-claim") return;
          await acts.declineClaim(open.claimant, reason);
          setOpen(null);
        }}
      />
      <AdminDialog
        open={open === "attach-assessment"}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        size="md"
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.attach.title",
          defaultMessage: "Attach an assessment",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.commitment.attach.description",
          defaultMessage:
            "Only current assessments recorded for the provider garden appear here. Attaching one vouches that it applies.",
        })}
        bodyClassName="space-y-3"
        actions={
          <>
            <AdminButton type="button" variant="text" onClick={() => setOpen(null)}>
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="filled"
              disabled={!assessmentUID || actDisabled}
              loading={dialog.isActing}
              onClick={async () => {
                if (!assessmentUID) return;
                await acts.attachAssessment(assessmentUID as `0x${string}`);
                setOpen(null);
              }}
            >
              {formatMessage({
                id: "cockpit.garden.pool.commitment.attach.confirm",
                defaultMessage: "Attach",
              })}
            </AdminButton>
          </>
        }
      >
        {dialog.assessmentsLoading ? (
          <div
            className="h-16 rounded-[var(--m3-shape-md)] skeleton-shimmer"
            role="status"
            aria-label={formatMessage({
              id: "cockpit.garden.pool.commitment.attach.loading",
              defaultMessage: "Loading assessments",
            })}
          />
        ) : dialog.assessments.length === 0 ? (
          <p className="text-sm text-text-soft" data-testid="attach-assessment-empty">
            {formatMessage({
              id: "cockpit.garden.pool.commitment.attach.empty",
              defaultMessage:
                "No current assessment is recorded for the provider garden yet. An evaluator records one from the Hub; this commitment cannot be sent for confirmation until then.",
            })}
          </p>
        ) : (
          <AdminChoiceGroup
            ariaLabel={formatMessage({
              id: "cockpit.garden.pool.commitment.attach.pick",
              defaultMessage: "Assessment",
            })}
            value={assessmentUID}
            onChange={setAssessmentUID}
            options={dialog.assessments.map((assessment) => ({
              value: assessment.id,
              label: assessment.title,
              description: `${assessment.domain} · ${formatUnixDate(assessment.createdAt, locale, "")}`,
            }))}
          />
        )}
      </AdminDialog>
    </div>
  );
}
