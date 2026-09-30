import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { ClaimantName } from "./ClaimantName";
import { directionLabel, formatUnixDate } from "./poolPresentation";

export interface PoolClaimsCardProps {
  console: PoolConsoleController;
  onDecline: (row: PoolClaimRequestRow) => void;
}

/**
 * The claims queue (uiux-spec §6.2 section 4), rendered only while
 * steward-reviewed requests are waiting. Every row names the stored claimant
 * the way the steward knows them (a garden by name, a person by resolved
 * name), who asked on their behalf when that differs, the claim type and when;
 * accept and decline are paired opposites keyed to that claimant. Accept stays
 * one click (hub decision 31) and its row then says where it stands, holding
 * the act closed until the index moves the request on. Accepting supersedes the
 * other pending rows on the same commitment, an indexer fact the note states.
 * While the pool is paused the acts are absent, not disabled: the contract
 * refuses them, so the row only waits.
 */
export function PoolClaimsCard({ console: pool, onDecline }: PoolClaimsCardProps) {
  const { formatMessage, locale } = useIntl();
  const { claims, titles, model, isOnline, isActing, acts, chainId } = pool;
  if (claims.length === 0) return null;
  const actDisabled = !isOnline || isActing;

  return (
    <AdminCard
      variant="elevated"
      data-component="PoolClaimsCard"
      data-testid="pool-claims"
      id="pool-claims"
      className="space-y-3"
    >
      <div>
        <AdminCardTitle>
          {formatMessage({ id: "cockpit.garden.pool.claims.title", defaultMessage: "Claims" })}
        </AdminCardTitle>
        <p className="mt-1 body-xs text-text-soft">
          {model.isPaused
            ? formatMessage({
                id: "cockpit.garden.pool.claims.paused",
                defaultMessage: "Requests wait while the pool is paused.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.claims.description",
                defaultMessage:
                  "Requests waiting for a steward decision. Accepting one supersedes the others on the same commitment.",
              })}
        </p>
      </div>
      <ul className="divide-y divide-stroke-soft">
        {claims.map((row) => {
          const title =
            (row.commitment.metadataCID && titles.get(row.commitment.metadataCID.trim())?.title) ??
            formatMessage(
              { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
              { id: row.commitment.commitmentId.toString() }
            );
          const onBehalf = row.claim.requestedBy.toLowerCase() !== row.claim.claimant.toLowerCase();
          const phase = pool.claimPhase(row.claim.commitmentId, row.claim.claimant);
          // Held closed from the wallet until the index moves the request on.
          const inFlight = phase.status !== "idle" && phase.status !== "failed";
          return (
            <li
              key={row.claim.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
              data-testid={`pool-claim-${row.claim.commitmentId.toString()}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="whitespace-nowrap body-xs text-text-soft">
                    {directionLabel(row.commitment.direction, formatMessage)}
                  </span>
                  <span className="truncate text-body-md text-text-strong" title={title}>
                    {title}
                  </span>
                  <StatusBadge variant="warning" size="sm">
                    {formatMessage({
                      id: "cockpit.garden.pool.claims.waiting",
                      defaultMessage: "Waiting",
                    })}
                  </StatusBadge>
                </div>
                <p className="body-xs text-text-soft">
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.claims.meta",
                      defaultMessage: "{claimant} · {type} · asked {when}",
                    },
                    {
                      claimant: <ClaimantName claim={row.claim} chainId={chainId} />,
                      type:
                        row.claim.claimType === "GARDEN"
                          ? formatMessage({
                              id: "cockpit.garden.pool.claims.type.garden",
                              defaultMessage: "garden",
                            })
                          : formatMessage({
                              id: "cockpit.garden.pool.claims.type.individual",
                              defaultMessage: "individual",
                            }),
                      when: formatUnixDate(row.claim.requestedAt, locale, "—"),
                    }
                  )}
                  {onBehalf ? (
                    <>
                      {" · "}
                      {formatMessage(
                        {
                          id: "cockpit.garden.pool.claims.requestedBy",
                          defaultMessage: "asked by {who}",
                        },
                        {
                          who: (
                            <AddressDisplay address={row.claim.requestedBy} interactive={false} />
                          ),
                        }
                      )}
                    </>
                  ) : null}
                </p>
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
              {model.isPaused ? null : (
                <div className="flex items-center gap-2">
                  <AdminButton
                    type="button"
                    variant="outlined"
                    size="sm"
                    onClick={() => onDecline(row)}
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
                    onClick={() =>
                      void acts
                        .acceptClaim(row.claim.commitmentId, row.claim.claimant)
                        .catch(() => undefined)
                    }
                    disabled={actDisabled || inFlight}
                  >
                    {formatMessage({
                      id: "cockpit.garden.pool.claims.act.accept",
                      defaultMessage: "Accept",
                    })}
                  </AdminButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </AdminCard>
  );
}
