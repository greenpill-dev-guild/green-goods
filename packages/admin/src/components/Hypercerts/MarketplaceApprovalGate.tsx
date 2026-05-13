import { Alert, getMarketplaceReadiness, useMarketplaceApprovals } from "@green-goods/shared";
import { RiAlertLine, RiCheckLine, RiLoader4Line, RiShieldCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminButton } from "../AdminButton";

interface MarketplaceApprovalGateProps {
  /** Active chain id; readiness is derived from deployment artifacts. */
  chainId: number;
  children: React.ReactNode;
}

/**
 * Gates marketplace features behind deployment-artifact readiness AND
 * one-time operator approvals. State matrix:
 *
 * - unavailable: deployment-artifact marketplace addresses are missing/zero
 *                on the active chain. Renders a warning alert and refuses
 *                to read approvals or render children, preventing any
 *                unsafe write paths from being exposed.
 * - checking:    readiness available, approvals query is loading.
 * - needs-approval: readiness available, one or both approvals missing.
 * - ready:       readiness available, both approvals granted. Renders children.
 * - pending:     grantApprovals mutation in flight.
 * - failure:     approval mutation surfaced a recoverable error.
 */
export function MarketplaceApprovalGate({ chainId, children }: MarketplaceApprovalGateProps) {
  const { formatMessage } = useIntl();
  const readiness = getMarketplaceReadiness(chainId);

  if (!readiness.available) {
    return (
      <Alert
        variant="warning"
        title={formatMessage({
          id: "app.marketplace.unavailable.title",
          defaultMessage: "Marketplace not available on this network",
        })}
      >
        <p>
          {formatMessage(
            {
              id: "app.marketplace.unavailable.description",
              defaultMessage:
                "Marketplace addresses are not configured for chain {chainId}. Listing actions stay disabled until configuration is broadcast.",
            },
            { chainId: readiness.chainId }
          )}
        </p>
        {readiness.missingFields.length > 0 && (
          <p className="mt-2 text-xs">
            {formatMessage(
              {
                id: "app.marketplace.unavailable.missingFields",
                defaultMessage: "Missing addresses: {fields}",
              },
              { fields: readiness.missingFields.join(", ") }
            )}
          </p>
        )}
      </Alert>
    );
  }

  return <ApprovalGateInner>{children}</ApprovalGateInner>;
}

function ApprovalGateInner({ children }: { children: React.ReactNode }) {
  const { formatMessage } = useIntl();
  const { approvals, isFullyApproved, isLoading, grantApprovals, isGranting, error } =
    useMarketplaceApprovals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-stroke-soft bg-bg-white p-8">
        <RiLoader4Line className="h-5 w-5 animate-spin text-text-soft" />
        <span className="text-sm text-text-soft">
          {formatMessage({
            id: "app.marketplace.checkingApprovals",
            defaultMessage: "Checking marketplace approvals...",
          })}
        </span>
      </div>
    );
  }

  if (isFullyApproved) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-lg border border-warning-base/30 bg-warning-lighter p-6">
      <div className="flex items-start gap-3">
        <RiAlertLine className="mt-0.5 h-5 w-5 shrink-0 text-warning-dark" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-strong">
            {formatMessage({
              id: "app.marketplace.setupRequired",
              defaultMessage: "Marketplace Setup Required",
            })}
          </h3>
          <p className="mt-1 text-sm text-text-sub">
            {formatMessage({
              id: "app.marketplace.setupDescription",
              defaultMessage:
                "Two one-time approvals are needed before you can list hypercerts for yield:",
            })}
          </p>

          <div className="mt-4 space-y-2">
            <ApprovalStep
              label={formatMessage({
                id: "app.marketplace.grantExchange",
                defaultMessage: "Grant exchange approval",
              })}
              description={formatMessage({
                id: "app.marketplace.grantExchangeDesc",
                defaultMessage: "Allows the exchange to use the transfer manager",
              })}
              approved={approvals?.exchangeApproved ?? false}
            />
            <ApprovalStep
              label={formatMessage({
                id: "app.marketplace.approveTransfer",
                defaultMessage: "Approve transfer manager",
              })}
              description={formatMessage({
                id: "app.marketplace.approveTransferDesc",
                defaultMessage: "Allows the transfer manager to move your hypercert fractions",
              })}
              approved={approvals?.minterApproved ?? false}
            />
          </div>

          {error && <p className="mt-3 text-xs text-error-base">{error.message}</p>}

          <AdminButton
            type="button"
            onClick={() => grantApprovals()}
            disabled={isGranting}
            className="mt-4"
          >
            {isGranting ? (
              <>
                <RiLoader4Line className="h-4 w-4 animate-spin" />
                {formatMessage({ id: "app.marketplace.approving", defaultMessage: "Approving..." })}
              </>
            ) : (
              <>
                <RiShieldCheckLine className="h-4 w-4" />
                {formatMessage({ id: "app.marketplace.approveAll", defaultMessage: "Approve All" })}
              </>
            )}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

function ApprovalStep({
  label,
  description,
  approved,
}: {
  label: string;
  description: string;
  approved: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-bg-white/60 px-3 py-2">
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
          approved ? "border-success-base bg-success-lighter" : "border-stroke-soft bg-bg-white"
        }`}
      >
        {approved && <RiCheckLine className="h-3 w-3 text-success-base" aria-hidden />}
      </div>
      <div className="min-w-0">
        <span
          className={`text-sm font-medium ${approved ? "text-text-soft line-through" : "text-text-strong"}`}
        >
          {label}
        </span>
        <p className="text-xs text-text-soft">{description}</p>
      </div>
    </div>
  );
}
