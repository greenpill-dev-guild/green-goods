import { Alert } from "@green-goods/shared/components/Alert";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { CELO_G_DOLLAR_TOKEN } from "@green-goods/shared/config/tokens";
import type {
  ProtocolFundingOperationsController,
  ProtocolFundingRow,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  type PoolFundingTransferLimit,
  selectExceededTransferLimit,
} from "@green-goods/shared/modules/commitment-pooling/pool-funding";
import type { Address } from "@green-goods/shared/types/domain";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { AdminSelect, AdminTextField } from "@/components/AdminTextField";
import { formatGdollar, shortAddress } from "@/views/Garden/Pool/poolFundingPresentation";
import { type TransferAct, TransferReviewDialog } from "@/views/Garden/Pool/TransferReviewDialog";
import { ProtocolFundingRows } from "./ProtocolFundingRows";

type GardenOption = { id: Address; name: string };

/** What the amount field says for each limit, in the words of the facts listed under it. */
const OVER_LIMIT_MESSAGES: Record<
  PoolFundingTransferLimit,
  { id: string; defaultMessage: string }
> = {
  transfer_cap: {
    id: "cockpit.community.protocolFunding.amount.overTransferCap",
    defaultMessage: "More than the per-transfer cap.",
  },
  period_allowance: {
    id: "cockpit.community.protocolFunding.amount.overPeriodAllowance",
    defaultMessage: "More than the period allowance left.",
  },
  roles_allowance: {
    id: "cockpit.community.protocolFunding.amount.overSafeAllowance",
    defaultMessage: "More than the Safe allowance left.",
  },
  balance: {
    id: "cockpit.community.protocolFunding.amount.overBalance",
    defaultMessage: "More than the protocol Safe holds.",
  },
};

export function ProtocolFundingOperationsCard({
  operations,
  gardens,
  targetGarden,
  onTargetGardenChange,
  renderLayout,
}: {
  operations: ProtocolFundingOperationsController;
  gardens: GardenOption[];
  targetGarden: Address | null;
  onTargetGardenChange: (garden: Address | null) => void;
  /** CommunityPools places these existing regions while their review state stays here. */
  renderLayout?: (funding: ReactNode, transfers: ReactNode) => ReactNode;
}) {
  const { formatMessage, locale } = useIntl();
  const [amount, setAmount] = useState("2");
  const [confirmQueue, setConfirmQueue] = useState(false);
  const [cancelId, setCancelId] = useState<bigint | null>(null);
  const [review, setReview] = useState<{ act: TransferAct; row: ProtocolFundingRow } | null>(null);
  if (!operations.showOperations) return renderLayout?.(null, null) ?? null;

  let amountValue: bigint | null = null;
  try {
    const parsed = parseUnits(amount, CELO_G_DOLLAR_TOKEN.decimals);
    amountValue = parsed > 0n ? parsed : null;
  } catch {
    amountValue = null;
  }
  const selectedGarden = gardens.find(
    (garden) => garden.id.toLowerCase() === targetGarden?.toLowerCase()
  );
  const source = operations.sourceFunding.snapshot;
  const target = operations.targetFunding.snapshot;
  // The Arbitrum queue takes any amount; these limits are enforced only on Celo,
  // after the CCIP fee is spent. The review and its confirm both refuse on this.
  const exceededLimit = amountValue
    ? selectExceededTransferLimit(operations.sourceFunding, amountValue)
    : null;
  const amountError =
    amount.length > 0 && amountValue === null
      ? formatMessage({
          id: "cockpit.community.protocolFunding.amount.invalid",
          defaultMessage: "Enter an amount greater than zero.",
        })
      : exceededLimit
        ? formatMessage(OVER_LIMIT_MESSAGES[exceededLimit])
        : undefined;
  const canReview = Boolean(targetGarden && amountValue && !exceededLimit);

  const gardenName = (garden: Address | null | undefined) =>
    garden
      ? (gardens.find((entry) => entry.id.toLowerCase() === garden.toLowerCase())?.name ?? null)
      : null;

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

  const funding = (
    <AdminCard
      variant="elevated"
      className="@container space-y-4"
      data-component="ProtocolFundingOperationsCard"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <AdminCardTitle>
            {formatMessage({
              id: "cockpit.community.protocolFunding.title",
              defaultMessage: "Fund a Garden",
            })}
          </AdminCardTitle>
          <p className="mt-1 max-w-2xl type-meta text-text-soft">
            {formatMessage({
              id: "cockpit.community.protocolFunding.description",
              defaultMessage:
                "Queue a discretionary protocol Safe top-up to a registered garden Safe. This does not fulfill or alter a promise.",
            })}
          </p>
        </div>
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
          <div className="grid gap-3 @[560px]:grid-cols-2">
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
              error={amountError}
            />
          </div>
          <dl className="divide-y divide-stroke-soft type-body">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <dt className="type-meta text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.source",
                  defaultMessage: "Protocol Safe",
                })}
              </dt>
              <dd className="ml-auto text-right font-medium tabular-nums text-text-strong">
                {source?.safe ? shortAddress(source.safe) : "—"} ·{" "}
                {formatGdollar(source?.balance?.value ?? null, locale)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <dt className="type-meta text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.recipient",
                  defaultMessage: "Receiving Safe",
                })}
              </dt>
              <dd className="ml-auto text-right font-medium tabular-nums text-text-strong">
                {target?.safe ? shortAddress(target.safe) : "—"}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <dt className="type-meta text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.allowance",
                  defaultMessage: "Safe allowance remaining",
                })}
              </dt>
              <dd className="ml-auto text-right font-medium tabular-nums text-text-strong">
                {formatGdollar(source?.limits.rolesAllowanceRemaining ?? null, locale)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <dt className="type-meta text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.periodAllowance",
                  defaultMessage: "Period allowance remaining",
                })}
              </dt>
              <dd className="ml-auto text-right font-medium tabular-nums text-text-strong">
                {formatGdollar(source?.limits.periodAllowanceRemaining ?? null, locale)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <dt className="type-meta text-text-soft">
                {formatMessage({
                  id: "cockpit.community.protocolFunding.cap",
                  defaultMessage: "Per-transfer cap",
                })}
              </dt>
              <dd className="ml-auto text-right font-medium tabular-nums text-text-strong">
                {formatGdollar(source?.limits.maxTransferAmount ?? null, locale)}
              </dd>
            </div>
          </dl>
          <div className="flex justify-end [&>button]:w-full">
            <AdminButton
              type="button"
              variant="filled"
              disabled={!canReview || operations.isActing}
              onClick={() => setConfirmQueue(true)}
            >
              {formatMessage({
                id: "cockpit.community.protocolFunding.review",
                defaultMessage: "Review Seed or Top-Up…",
              })}
            </AdminButton>
          </div>
        </div>
      ) : (
        <p className="type-meta text-text-soft" data-testid="protocol-funding-unavailable">
          {formatMessage({
            id: "cockpit.community.protocolFunding.unavailable",
            defaultMessage:
              "Only a protocol steward or the settlement module owner can queue garden funding.",
          })}
        </p>
      )}

      {operations.lastAct ? (
        <p
          className={
            operations.lastAct.phase === "failed"
              ? "type-meta text-error-dark"
              : "type-meta text-text-soft"
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
          defaultMessage: "Queue Protocol Funding?",
        })}
        description={formatMessage(
          {
            id: "cockpit.community.protocolFunding.confirm.body",
            defaultMessage:
              "Queue {amount} from the protocol Safe to {garden}. The module derives the registered recipient Safe and canonical G$.",
          },
          {
            amount: formatGdollar(amountValue, locale),
            garden: selectedGarden?.name ?? "—",
          }
        )}
        confirmLabel={formatMessage({
          id: "cockpit.community.protocolFunding.confirm.action",
          defaultMessage: "Queue Seed or Top-Up",
        })}
        cancelLabel={formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        confirmDisabled={!canReview || !operations.canQueueFunding}
        isLoading={operations.isActing}
        onConfirm={async () => {
          if (!targetGarden || !amountValue || exceededLimit) return;
          await submit(() => operations.queueFunding(targetGarden, amountValue));
          setConfirmQueue(false);
        }}
      >
        {/* A refresh can lower a limit while the review is open. */}
        {exceededLimit ? <Alert variant="error">{amountError}</Alert> : null}
      </AdminConfirmDialog>

      <TransferReviewDialog
        review={review ? { act: review.act, disbursementId: review.row.disbursementId } : null}
        amount={review?.row.amount ?? null}
        recipient={
          review ? (gardenName(review.row.garden) ?? shortAddress(review.row.recipient)) : "—"
        }
        tone="community"
        isLoading={operations.isActing}
        onClose={() => setReview(null)}
        onConfirm={async () => {
          if (!review) return;
          const { act, row } = review;
          await submit(() =>
            act === "dispatch"
              ? operations.dispatch(row.disbursementId)
              : act === "retry"
                ? operations.retry(row.disbursementId)
                : operations.requeue(row.disbursementId)
          );
        }}
      />

      <AdminReasonDialog
        isOpen={cancelId !== null}
        onClose={() => setCancelId(null)}
        tone="community"
        variant="danger"
        title={formatMessage({
          id: "cockpit.community.protocolFunding.cancel.title",
          defaultMessage: "Cancel This Funding Transfer?",
        })}
        description={formatMessage({
          id: "cockpit.community.protocolFunding.cancel.body",
          defaultMessage:
            "Cancellation closes this queued or failed transfer. No G$ is delivered to the garden.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.community.protocolFunding.cancel.action",
          defaultMessage: "Cancel Transfer",
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

  const transfers = (
    <AdminCard className="flex flex-col">
      <ProtocolFundingRows
        operations={operations}
        gardenName={gardenName}
        onReview={(act, row) => setReview({ act, row })}
        onCancel={setCancelId}
        onRefresh={() => void operations.refetch()}
      />
    </AdminCard>
  );
  return renderLayout ? (
    renderLayout(funding, transfers)
  ) : (
    <div className="garden-tab-layout">
      <div className="garden-tab-main">{transfers}</div>
      <aside className="garden-tab-rail">{funding}</aside>
    </div>
  );
}
