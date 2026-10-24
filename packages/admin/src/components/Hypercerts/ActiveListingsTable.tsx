import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { useCancelListing } from "@green-goods/shared/hooks/hypercerts/useCancelListing";
import { useHypercertListings } from "@green-goods/shared/hooks/hypercerts/useHypercertListings";
import type { Address } from "@green-goods/shared/types/domain";
import type { RegisteredOrderView } from "@green-goods/shared/types/hypercerts";
import {
  RiCloseLine,
  RiErrorWarningLine,
  RiExchangeDollarLine,
  RiLoader4Line,
  RiTimeLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatEther } from "viem";
import { AdminConfirmDialog } from "@/components/AdminDialog";

interface ActiveListingsTableProps {
  gardenAddress: Address;
  onCreateListing?: (hypercertId: bigint) => void;
}

function getListingStatus(order: RegisteredOrderView): "active" | "expired" {
  if (!order.active) return "expired";
  const now = Math.floor(Date.now() / 1000);
  return order.endTime > now ? "active" : "expired";
}

function formatTimeRemaining(
  endTime: number,
  intl: {
    formatMessage: (
      descriptor: { id: string; defaultMessage: string },
      values?: Record<string, string | number>
    ) => string;
  }
): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0)
    return intl.formatMessage({ id: "app.admin.listings.expired", defaultMessage: "Expired" });
  const days = Math.floor(diff / 86400);
  if (days > 0)
    return intl.formatMessage(
      { id: "app.admin.listings.daysRemaining", defaultMessage: "{days}d remaining" },
      { days }
    );
  const hours = Math.floor(diff / 3600);
  return intl.formatMessage(
    { id: "app.admin.listings.hoursRemaining", defaultMessage: "{hours}h remaining" },
    { hours }
  );
}

/**
 * Table displaying active marketplace listings for a garden's hypercerts.
 * Supports cancellation of active listings.
 */
export function ActiveListingsTable({ gardenAddress, onCreateListing }: ActiveListingsTableProps) {
  const intl = useIntl();
  const { listings, isLoading, error } = useHypercertListings(gardenAddress);
  const {
    cancelListing,
    isCancelling,
    pendingCancellation,
    isCheckingConfirmation,
    checkConfirmation,
    confirmWalletCancellation,
    error: cancellationError,
  } = useCancelListing(gardenAddress);

  const [reviewCancellation, setReviewCancellation] = useState<typeof pendingCancellation>();
  const [isClearing, setIsClearing] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  const recoveryBusy = isCheckingConfirmation || isClearing;

  const recoveryControls = pendingCancellation ? (
    <>
      <Alert variant="info">
        <Button
          type="button"
          size="compact"
          disabled={recoveryBusy}
          onClick={() => void checkConfirmation()}
        >
          {intl.formatMessage({
            id: "app.account.checkConfirmation",
            defaultMessage: "Check confirmation",
          })}
        </Button>
        <Button
          type="button"
          emphasis="tertiary"
          size="compact"
          disabled={recoveryBusy}
          onClick={() => {
            setRecoveryError(false);
            setReviewCancellation(pendingCancellation);
          }}
        >
          {intl.formatMessage({ id: "app.account.reviewCancellation" })}
        </Button>
      </Alert>
      {recoveryError && (
        <Alert variant="error">
          {intl.formatMessage({ id: "app.account.pendingRecoveryUnavailable" })}
        </Alert>
      )}
      <AdminConfirmDialog
        isOpen={Boolean(reviewCancellation && reviewCancellation === pendingCancellation)}
        onClose={() => setReviewCancellation(undefined)}
        title={intl.formatMessage({ id: "app.account.confirmCancellationTitle" })}
        description={intl.formatMessage({ id: "app.account.confirmCancellationDescription" })}
        confirmLabel={intl.formatMessage({ id: "app.account.confirmCancellation" })}
        variant="warning"
        tone="garden"
        isLoading={isClearing}
        confirmDisabled={recoveryBusy}
        onError={() => setRecoveryError(true)}
        onConfirm={async () => {
          setIsClearing(true);
          try {
            await confirmWalletCancellation(true);
            setReviewCancellation(undefined);
          } finally {
            setIsClearing(false);
          }
        }}
      />
    </>
  ) : null;

  const confirmationControl = (
    <>
      {recoveryControls}
      {cancellationError && <Alert variant="error">{cancellationError.message}</Alert>}
    </>
  );

  if (isLoading) {
    return (
      <>
        {confirmationControl}
        <EmptyState
          busy
          icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
          title={intl.formatMessage({
            id: "app.admin.listings.loading",
            defaultMessage: "Loading listings...",
          })}
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        {confirmationControl}
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={intl.formatMessage({
            id: "app.admin.listings.loadError",
            defaultMessage: "Failed to load listings",
          })}
        />
      </>
    );
  }

  if (listings.length === 0) {
    return (
      <>
        {confirmationControl}
        <EmptyState
          icon={<RiExchangeDollarLine />}
          title={intl.formatMessage({
            id: "app.admin.listings.empty",
            defaultMessage: "No active listings",
          })}
          description={intl.formatMessage({
            id: "app.admin.listings.emptyHint",
            defaultMessage:
              "List your hypercerts for yield to allow supporters to purchase fractions",
          })}
        />
      </>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stroke-soft">
      {confirmationControl}
      <table className="w-full text-left type-body">
        <thead>
          <tr className="border-b border-stroke-soft bg-bg-soft">
            <th className="px-4 py-3 type-label-sm uppercase text-text-soft">
              {intl.formatMessage({
                id: "app.admin.listings.columnHypercert",
                defaultMessage: "Hypercert",
              })}
            </th>
            <th className="px-4 py-3 type-label-sm uppercase text-text-soft">
              {intl.formatMessage({
                id: "app.admin.listings.columnPricePerUnit",
                defaultMessage: "Price/Unit",
              })}
            </th>
            <th className="px-4 py-3 type-label-sm uppercase text-text-soft">
              {intl.formatMessage({
                id: "app.admin.listings.columnStatus",
                defaultMessage: "Status",
              })}
            </th>
            <th className="px-4 py-3 type-label-sm uppercase text-text-soft">
              {intl.formatMessage({
                id: "app.admin.listings.columnExpires",
                defaultMessage: "Expires",
              })}
            </th>
            <th className="px-4 py-3 type-label-sm uppercase text-text-soft text-right">
              {intl.formatMessage({
                id: "app.admin.listings.columnActions",
                defaultMessage: "Actions",
              })}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stroke-soft">
          {listings.map((listing) => {
            const status = getListingStatus(listing);
            return (
              <tr key={listing.orderId} className="hover:bg-bg-soft/50 transition">
                <td className="px-4 py-3 font-medium text-text-strong">
                  #{listing.orderId}
                  <span className="ml-1 type-label-sm text-text-soft">
                    (HC #{listing.hypercertId.toString().slice(0, 8)}...)
                  </span>
                </td>
                <td className="px-4 py-3 text-text-sub">{formatEther(listing.pricePerUnit)} ETH</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 type-label-sm ${
                      status === "active"
                        ? "bg-success-lighter text-success-dark"
                        : "bg-warning-lighter text-warning-dark"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === "active" ? "bg-success-base" : "bg-warning-base"
                      }`}
                    />
                    {status === "active"
                      ? intl.formatMessage({
                          id: "app.admin.listings.statusActive",
                          defaultMessage: "Active",
                        })
                      : intl.formatMessage({
                          id: "app.admin.listings.statusExpired",
                          defaultMessage: "Expired",
                        })}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-sub">
                  <span className="flex items-center gap-1">
                    <RiTimeLine className="h-3.5 w-3.5" />
                    {formatTimeRemaining(listing.endTime, intl)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {status === "active" ? (
                    <Button
                      type="button"
                      emphasis="primary"
                      tone="danger"
                      size="compact"
                      onClick={() =>
                        pendingCancellation ? checkConfirmation() : cancelListing(listing.orderId)
                      }
                      loading={!pendingCancellation && isCancelling}
                      disabled={
                        recoveryBusy ||
                        (Boolean(pendingCancellation) &&
                          pendingCancellation?.orderId !== listing.orderId)
                      }
                      leadingIcon={<RiCloseLine className="h-4 w-4" aria-hidden="true" />}
                    >
                      {intl.formatMessage({
                        id:
                          pendingCancellation?.orderId === listing.orderId
                            ? "app.account.checkConfirmation"
                            : "app.admin.listings.cancel",
                        defaultMessage:
                          pendingCancellation?.orderId === listing.orderId
                            ? "Check confirmation"
                            : "Cancel",
                      })}
                    </Button>
                  ) : (
                    onCreateListing && (
                      <Button
                        type="button"
                        emphasis="tertiary"
                        size="compact"
                        onClick={() => onCreateListing(listing.hypercertId)}
                        leadingIcon={
                          <RiExchangeDollarLine className="h-4 w-4" aria-hidden="true" />
                        }
                      >
                        {intl.formatMessage({
                          id: "app.admin.listings.renew",
                          defaultMessage: "Renew",
                        })}
                      </Button>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
