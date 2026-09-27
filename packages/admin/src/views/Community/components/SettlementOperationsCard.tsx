import { Alert } from "@green-goods/shared/components/Alert";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { SettlementOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useSettlementOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/useSettlementOperationsController";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminSettingRow } from "@/components/AdminSettingRow";

/** The protocol pool's mount point: reads through the shared controller, renders the card. */
export function SettlementOperationsPanel({ chainId }: { chainId: number }) {
  const operations = useSettlementOperationsController({ chainId });
  return <SettlementOperationsCard operations={operations} />;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Operations-only switches of the settlement module, shown on the protocol
 * pool. The card shows what the chain says right now; the one write it offers,
 * gardener delivery, is owner-only on chain, asks for an explicit confirmation,
 * and never flips its display before the requested value is read back.
 */
export function SettlementOperationsCard({
  operations,
}: {
  operations: SettlementOperationsController;
}) {
  const { formatMessage } = useIntl();
  const [confirming, setConfirming] = useState<boolean | null>(null);
  if (!operations.showControl) return null;
  const enabled = operations.gardenerDeliveryEnabled;
  const deliveryLabel =
    enabled === null
      ? formatMessage({
          id: "cockpit.community.settlementOps.delivery.unread",
          defaultMessage: "Not read",
        })
      : enabled
        ? formatMessage({ id: "cockpit.community.settlementOps.delivery.on", defaultMessage: "On" })
        : formatMessage({
            id: "cockpit.community.settlementOps.delivery.off",
            defaultMessage: "Off",
          });

  const flip = async (next: boolean) => {
    await operations.setGardenerDelivery(next);
    // What happens next, not a hash fragment: the card reads the switch back.
    toastService.success({
      title: formatMessage({
        id: "cockpit.community.settlementOps.status.submittedTitle",
        defaultMessage: "Transaction submitted",
      }),
      message: formatMessage({
        id: "cockpit.community.settlementOps.status.submittedMessage",
        defaultMessage: "The switch reads back from the chain once it confirms.",
      }),
    });
  };

  return (
    <AdminCard
      variant="outlined"
      className="space-y-3"
      data-component="SettlementOperationsCard"
      data-delivery={enabled === null ? "unread" : enabled ? "on" : "off"}
    >
      <div>
        <AdminCardTitle>
          {formatMessage({
            id: "cockpit.community.settlementOps.title",
            defaultMessage: "Settlement Operations",
          })}
        </AdminCardTitle>
        <p className="mt-1 body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.community.settlementOps.description",
            defaultMessage:
              "Module-level switches for G$ settlement. Only the module owner can change them; deployers can see them.",
          })}
        </p>
      </div>

      {operations.isError ? (
        <Alert variant="error">
          {formatMessage({
            id: "cockpit.community.settlementOps.readError",
            defaultMessage: "Couldn't read the settlement module",
          })}
        </Alert>
      ) : null}

      <AdminSettingRow
        label={formatMessage({
          id: "cockpit.community.settlementOps.paused.label",
          defaultMessage: "Settlement source",
        })}
      >
        <StatusBadge variant={operations.sourcePaused ? "warning" : "success"} size="sm">
          {operations.sourcePaused
            ? formatMessage({
                id: "cockpit.community.settlementOps.paused.on",
                defaultMessage: "Paused",
              })
            : formatMessage({
                id: "cockpit.community.settlementOps.paused.off",
                defaultMessage: "Running",
              })}
        </StatusBadge>
      </AdminSettingRow>

      <AdminSettingRow
        labelId="settlement-ops-delivery"
        label={formatMessage({
          id: "cockpit.community.settlementOps.delivery.label",
          defaultMessage: "Gardener delivery",
        })}
        description={formatMessage({
          id: "cockpit.community.settlementOps.delivery.description",
          defaultMessage:
            "When on, contributor payouts can be prepared and delivered to individual members on Celo. When off, only garden Safe payouts run.",
        })}
      >
        <div className="flex flex-col items-end gap-2">
          <StatusBadge
            variant={enabled ? "success" : "neutral"}
            size="sm"
            data-testid="gardener-delivery-state"
          >
            {deliveryLabel}
          </StatusBadge>
          {operations.canConfigureDelivery && enabled !== null ? (
            <AdminButton
              type="button"
              variant={enabled ? "outlined" : "filled"}
              size="sm"
              disabled={operations.isPending || operations.lastAct?.phase === "submitted"}
              loading={operations.isPending}
              onClick={() => setConfirming(!enabled)}
            >
              {enabled
                ? formatMessage({
                    id: "cockpit.community.settlementOps.delivery.disable",
                    defaultMessage: "Disable Gardener Delivery…",
                  })
                : formatMessage({
                    id: "cockpit.community.settlementOps.delivery.enable",
                    defaultMessage: "Enable Gardener Delivery…",
                  })}
            </AdminButton>
          ) : null}
        </div>
      </AdminSettingRow>

      {!operations.canConfigureDelivery ? (
        <p className="body-xs text-text-soft" data-testid="gardener-delivery-owner-only">
          {formatMessage(
            {
              id: "cockpit.community.settlementOps.delivery.ownerOnly",
              defaultMessage: "Only the settlement module owner ({owner}) can change this.",
            },
            { owner: operations.owner ? shortAddress(operations.owner) : "—" }
          )}
        </p>
      ) : null}

      {operations.lastAct ? (
        <p
          className={
            operations.lastAct.phase === "failed"
              ? "body-xs text-error-dark"
              : "body-xs text-text-soft"
          }
          role="status"
          data-testid="gardener-delivery-status"
          data-phase={operations.lastAct.phase}
        >
          {operations.lastAct.phase === "signing"
            ? formatMessage({
                id: "cockpit.community.settlementOps.status.signing",
                defaultMessage: "Waiting for the wallet or Safe to accept the transaction…",
              })
            : operations.lastAct.phase === "submitted"
              ? formatMessage({
                  id: "cockpit.community.settlementOps.status.submitted",
                  defaultMessage: "Submitted. Awaiting Safe execution and on-chain confirmation.",
                })
              : operations.lastAct.phase === "confirmed"
                ? formatMessage(
                    {
                      id: "cockpit.community.settlementOps.status.confirmed",
                      defaultMessage: "Confirmed on chain: gardener delivery is {state}.",
                    },
                    { state: deliveryLabel.toLowerCase() }
                  )
                : formatMessage({
                    id: "cockpit.community.settlementOps.status.failed",
                    defaultMessage:
                      "The transaction failed or was rejected. The switch is unchanged.",
                  })}
        </p>
      ) : null}

      {operations.lastAct?.phase === "submitted" ? (
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          onClick={() => void operations.checkDeliveryStatus()}
        >
          {formatMessage({
            id: "cockpit.community.settlementOps.status.check",
            defaultMessage: "Check on Chain",
          })}
        </AdminButton>
      ) : null}

      <AdminConfirmDialog
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        tone="community"
        variant="warning"
        title={
          confirming
            ? formatMessage({
                id: "cockpit.community.settlementOps.delivery.confirmTitle",
                defaultMessage: "Enable Gardener Delivery?",
              })
            : formatMessage({
                id: "cockpit.community.settlementOps.delivery.confirmDisableTitle",
                defaultMessage: "Disable Gardener Delivery?",
              })
        }
        description={
          confirming
            ? formatMessage({
                id: "cockpit.community.settlementOps.delivery.confirmBody",
                defaultMessage:
                  "Enabling lets stewards in every garden prepare and dispatch G$ payouts to individual members on Celo. It does not move funds by itself. The switch is read back from the chain after the transaction confirms.",
              })
            : formatMessage({
                id: "cockpit.community.settlementOps.delivery.confirmDisableBody",
                defaultMessage:
                  "Disabling blocks new contributor payout preparation and member delivery in every garden. Garden Safe payouts keep running.",
              })
        }
        confirmLabel={
          confirming
            ? formatMessage({
                id: "cockpit.community.settlementOps.delivery.confirmEnable",
                defaultMessage: "Enable Gardener Delivery",
              })
            : formatMessage({
                id: "cockpit.community.settlementOps.delivery.confirmDisable",
                defaultMessage: "Disable Gardener Delivery",
              })
        }
        cancelLabel={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        isLoading={operations.isPending}
        onConfirm={async () => {
          if (confirming === null) return;
          await flip(confirming);
          setConfirming(null);
        }}
        onError={() => setConfirming(null)}
      />
    </AdminCard>
  );
}
