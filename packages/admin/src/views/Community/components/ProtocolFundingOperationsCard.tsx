import { Alert } from "@green-goods/shared/components/Alert";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { ProtocolFundingOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { Address } from "@green-goods/shared/types/domain";
import { RiRefreshLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { AdminSelect, AdminTextField } from "@/components/AdminTextField";
import { formatGdollar, shortAddress } from "@/views/Garden/Pool/poolFundingPresentation";
import { ProtocolFundingRows } from "./ProtocolFundingRows";

type GardenOption = { id: Address; name: string };

export function ProtocolFundingOperationsCard({
  operations,
  gardens,
  targetGarden,
  onTargetGardenChange,
}: {
  operations: ProtocolFundingOperationsController;
  gardens: GardenOption[];
  targetGarden: Address | null;
  onTargetGardenChange: (garden: Address | null) => void;
}) {
  const { formatMessage, locale } = useIntl();
  const [amount, setAmount] = useState("2");
  const [confirmQueue, setConfirmQueue] = useState(false);
  const [cancelId, setCancelId] = useState<bigint | null>(null);
  if (!operations.showOperations) return null;

  let amountValue: bigint | null = null;
  try {
    const parsed = parseUnits(amount, 18);
    amountValue = parsed > 0n ? parsed : null;
  } catch {
    amountValue = null;
  }
  const selectedGarden = gardens.find(
    (garden) => garden.id.toLowerCase() === targetGarden?.toLowerCase()
  );
  const source = operations.sourceFunding.snapshot;
  const target = operations.targetFunding.snapshot;
  const canReview = Boolean(targetGarden && amountValue);

  const submit = async (act: () => Promise<string>) => {
    const identifier = await act();
    toastService.success({
      title: formatMessage({
        id: "cockpit.community.protocolFunding.submitted",
        defaultMessage: "Transaction submitted",
      }),
      message: `${identifier.slice(0, 10)}…`,
    });
  };

  return (
    <AdminCard
      variant="outlined"
      className="space-y-4"
      data-component="ProtocolFundingOperationsCard"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="label-md text-text-strong">
            {formatMessage({
              id: "cockpit.community.protocolFunding.title",
              defaultMessage: "Protocol funding",
            })}
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.community.protocolFunding.description",
              defaultMessage:
                "Queue a discretionary protocol Safe top-up to a registered garden Safe. This does not fulfill or alter a commitment.",
            })}
          </p>
        </div>
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          leadingIcon={<RiRefreshLine />}
          onClick={() => void operations.refetch()}
        >
          {formatMessage({
            id: "cockpit.community.protocolFunding.refresh",
            defaultMessage: "Refresh funding",
          })}
        </AdminButton>
      </div>

      {operations.sourceFunding.isError ? (
        <Alert variant="error">
          {formatMessage({
            id: "cockpit.community.protocolFunding.readError",
            defaultMessage: "Couldn't read protocol funding",
          })}
        </Alert>
      ) : null}

      {operations.canQueueFunding ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminSelect
              label={formatMessage({
                id: "cockpit.community.protocolFunding.garden",
                defaultMessage: "Receiving garden",
              })}
              value={targetGarden ?? ""}
              onChange={(event) =>
                onTargetGardenChange(event.target.value ? (event.target.value as Address) : null)
              }
            >
              <option value="">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.garden.placeholder",
                  defaultMessage: "Select a garden",
                })}
              </option>
              {gardens.map((garden) => (
                <option key={garden.id} value={garden.id}>
                  {garden.name}
                </option>
              ))}
            </AdminSelect>
            <AdminTextField
              label={formatMessage({
                id: "cockpit.community.protocolFunding.amount",
                defaultMessage: "Amount (G$)",
              })}
              value={amount}
              type="number"
              onChange={(event) => setAmount(event.target.value)}
              inputProps={{ min: "0.000000000000000001", step: "any", inputMode: "decimal" }}
              error={
                amount.length > 0 && amountValue === null
                  ? formatMessage({
                      id: "cockpit.community.protocolFunding.amount.invalid",
                      defaultMessage: "Enter an amount greater than zero.",
                    })
                  : undefined
              }
            />
          </div>
          <dl className="grid gap-3 rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.source",
                  defaultMessage: "Protocol Safe",
                })}
              </dt>
              <dd className="mt-1 font-medium text-text-strong">
                {source?.safe ? shortAddress(source.safe) : "—"} ·{" "}
                {formatGdollar(source?.balance?.value ?? null, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.recipient",
                  defaultMessage: "Receiving Safe",
                })}
              </dt>
              <dd className="mt-1 font-medium text-text-strong">
                {target?.safe ? shortAddress(target.safe) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.allowance",
                  defaultMessage: "Safe allowance remaining",
                })}
              </dt>
              <dd className="mt-1 font-medium text-text-strong">
                {formatGdollar(source?.limits.rolesAllowanceRemaining ?? null, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.cap",
                  defaultMessage: "Per-transfer cap",
                })}
              </dt>
              <dd className="mt-1 font-medium text-text-strong">
                {formatGdollar(source?.limits.maxTransferAmount ?? null, locale)}
              </dd>
            </div>
          </dl>
          <AdminButton
            type="button"
            variant="filled"
            disabled={!canReview || operations.isActing}
            onClick={() => setConfirmQueue(true)}
          >
            {formatMessage({
              id: "cockpit.community.protocolFunding.review",
              defaultMessage: "Review seed or top-up…",
            })}
          </AdminButton>
        </div>
      ) : (
        <p className="text-xs text-text-soft" data-testid="protocol-funding-unavailable">
          {formatMessage({
            id: "cockpit.community.protocolFunding.unavailable",
            defaultMessage:
              "Only a protocol steward or the settlement module owner can queue garden funding.",
          })}
        </p>
      )}

      <ProtocolFundingRows operations={operations} onSubmit={submit} onCancel={setCancelId} />

      {operations.lastAct ? (
        <p
          className={
            operations.lastAct.phase === "failed"
              ? "text-xs text-error-dark"
              : "text-xs text-text-soft"
          }
          role="status"
          data-testid="protocol-funding-status"
          data-phase={operations.lastAct.phase}
        >
          {operations.lastAct.phase === "signing"
            ? formatMessage({
                id: "cockpit.community.protocolFunding.status.signing",
                defaultMessage: "Waiting for wallet approval…",
              })
            : operations.lastAct.phase === "failed"
              ? formatMessage({
                  id: "cockpit.community.protocolFunding.status.failed",
                  defaultMessage:
                    "The transaction failed or was rejected. Nothing changed on chain.",
                })
              : formatMessage({
                  id: "cockpit.community.protocolFunding.status.submitted",
                  defaultMessage: "Submitted. Refresh to follow the indexed settlement state.",
                })}
        </p>
      ) : null}

      <AdminConfirmDialog
        isOpen={confirmQueue}
        onClose={() => setConfirmQueue(false)}
        tone="community"
        variant="warning"
        title={formatMessage({
          id: "cockpit.community.protocolFunding.confirm.title",
          defaultMessage: "Queue protocol funding?",
        })}
        description={formatMessage(
          {
            id: "cockpit.community.protocolFunding.confirm.body",
            defaultMessage:
              "Queue {amount} from the protocol Safe to {garden}. The module derives the registered recipient Safe and canonical G$. This creates Funding / ProtocolToGarden with no commitment ID.",
          },
          {
            amount: formatGdollar(amountValue, locale),
            garden: selectedGarden?.name ?? "—",
          }
        )}
        confirmLabel={formatMessage({
          id: "cockpit.community.protocolFunding.confirm.action",
          defaultMessage: "Queue seed or top-up",
        })}
        cancelLabel={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        confirmDisabled={!targetGarden || !amountValue || !operations.canQueueFunding}
        isLoading={operations.isActing}
        onConfirm={async () => {
          if (!targetGarden || !amountValue) return;
          await submit(() => operations.queueFunding(targetGarden, amountValue));
          setConfirmQueue(false);
        }}
      />

      <AdminReasonDialog
        isOpen={cancelId !== null}
        onClose={() => setCancelId(null)}
        tone="community"
        variant="danger"
        title={formatMessage({
          id: "cockpit.community.protocolFunding.cancel.title",
          defaultMessage: "Cancel this funding transfer?",
        })}
        description={formatMessage({
          id: "cockpit.community.protocolFunding.cancel.body",
          defaultMessage:
            "Cancellation closes this queued or failed transfer. No G$ is delivered to the garden.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.community.protocolFunding.cancel.action",
          defaultMessage: "Cancel transfer",
        })}
        isLoading={operations.isActing}
        onConfirm={async (reason) => {
          if (cancelId === null) return;
          await submit(() => operations.cancel(cancelId, reason));
          setCancelId(null);
        }}
      />
    </AdminCard>
  );
}
