import {
  useHypercertListings,
  useCancelListing,
  type RegisteredOrderView,
  DEFAULT_CHAIN_ID,
  getNetworkConfig,
} from "@green-goods/shared";
import {
  RiLoader4Line,
  RiCloseLine,
  RiExchangeDollarLine,
  RiTimeLine,
  RiAlertLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import type { Address } from "viem";
import { formatEther } from "viem";

interface ActiveListingsTableProps {
  gardenAddress: Address;
  onCreateListing?: (hypercertId: bigint) => void;
}

function getListingStatus(order: RegisteredOrderView): "active" | "expired" {
  if (!order.active) return "expired";
  const now = Math.floor(Date.now() / 1000);
  return order.endTime > now ? "active" : "expired";
}

function formatTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  if (days > 0) return `${days}d remaining`;
  const hours = Math.floor(diff / 3600);
  return `${hours}h remaining`;
}

/**
 * Table displaying active marketplace listings for a garden's hypercerts.
 * Supports cancellation of active listings.
 */
export function ActiveListingsTable({ gardenAddress, onCreateListing }: ActiveListingsTableProps) {
  const { formatMessage } = useIntl();
  const { listings, isLoading, error } = useHypercertListings(gardenAddress);
  const { cancelListing, isCancelling } = useCancelListing(gardenAddress);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <RiLoader4Line className="h-5 w-5 animate-spin text-text-soft" />
        <span className="text-sm text-text-soft">Loading listings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-error-lighter p-4">
        <RiAlertLine className="h-4 w-4 text-error-base" />
        <span className="text-sm text-error-dark">Failed to load listings</span>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stroke-soft p-8 text-center">
        <RiExchangeDollarLine className="mx-auto h-8 w-8 text-text-disabled" />
        <p className="mt-2 text-sm text-text-soft">No active listings</p>
        <p className="mt-1 text-xs text-text-disabled">
          List your hypercerts for yield to allow supporters to purchase fractions
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stroke-soft">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stroke-soft bg-bg-soft">
            <th className="px-4 py-3 text-xs font-medium uppercase text-text-soft">Hypercert</th>
            <th className="px-4 py-3 text-xs font-medium uppercase text-text-soft">Price/Unit</th>
            <th className="px-4 py-3 text-xs font-medium uppercase text-text-soft">Status</th>
            <th className="px-4 py-3 text-xs font-medium uppercase text-text-soft">Expires</th>
            <th className="px-4 py-3 text-xs font-medium uppercase text-text-soft text-right">
              Actions
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
                  <span className="ml-1 text-xs text-text-soft">
                    (HC #{listing.hypercertId.toString().slice(0, 8)}...)
                  </span>
                </td>
                <td className="px-4 py-3 text-text-sub">{formatEther(listing.pricePerUnit)} ETH</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
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
                    {status === "active" ? "Active" : "Expired"}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-sub">
                  <span className="flex items-center gap-1">
                    <RiTimeLine className="h-3.5 w-3.5" />
                    {formatTimeRemaining(listing.endTime)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {status === "active" ? (
                    <button
                      type="button"
                      onClick={() => cancelListing(listing.orderId)}
                      disabled={isCancelling}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-error-base transition hover:bg-error-lighter disabled:opacity-50"
                    >
                      {isCancelling ? (
                        <RiLoader4Line className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RiCloseLine className="h-3.5 w-3.5" />
                      )}
                      Cancel
                    </button>
                  ) : (
                    onCreateListing && (
                      <button
                        type="button"
                        onClick={() => onCreateListing(listing.hypercertId)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary-base transition hover:bg-primary-lighter"
                      >
                        <RiExchangeDollarLine className="h-3.5 w-3.5" />
                        Renew
                      </button>
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
