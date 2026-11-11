import type {
  CommitmentDerivedState,
  CommitmentReadModel,
  ServiceAccessKey,
  ServiceAccessSnapshot,
} from "@green-goods/shared/commitment-pooling";
import type { ReactNode } from "react";
import type { CommitmentIdentityProps } from "./CommitmentIdentity";
import type { ServiceBookingView } from "./serviceBookingTypes";
/** What a voucher booking or a request's rewards hand the promise page. */
export interface ServicePromiseParts {
  band: CommitmentIdentityProps["serviceBand"];
  /** What a booking of the reader's own voucher offer takes, for What was promised. */
  takes: string | null;
  /** The door under the band and the service's section card, in the page's order. */
  body: ReactNode;
  /** The service's own bar, or null when the promise's act leads. */
  bar: ReactNode | null;
  delivery: ServiceBookingView["delivery"];
  bookingLines: ServiceBookingView["events"];
  /** Promise kept? after a booking's split: the strip, the split and its note. */
  confirm: ServiceBookingView["confirm"];
  /** A request's rewards draw in their own section, which leads with the vouchers. */
  rewards: boolean;
  sheets: ReactNode;
}

export interface ServicePromiseProps {
  serviceKey: ServiceAccessKey | null;
  /** The page's read of the service, which also settles its own acts. */
  access: {
    data?: ServiceAccessSnapshot | null;
    refetch: () => unknown;
    isFetching?: boolean;
    isError?: boolean;
    dataUpdatedAt?: number;
  };
  coreState: CommitmentDerivedState;
  /** Who made the promise: the chain refuses their own take-up, so they read no buyer's path. */
  creator: CommitmentReadModel["creator"];
  /** The request's garden, whose pool pays any G$. */
  gardenName: string;
  heading: string;
  /** The promise has its own act (Confirm It Was Kept), which leads where the booking has none. */
  hasCoreAct: boolean;
  isOnline: boolean;
  /** Report a Problem raises a dispute, which the chain takes only from some readers. */
  onReport: (() => void) | null;
  /**
   * The reader's take-up of a request, when the page offers one: at once (open) or by asking its
   * stewards. A request's voucher reward is agreed to first, from the reward's own bar.
   */
  takeUp: { mode: "open" | "reviewed"; run: () => void } | null;
  children: (parts: ServicePromiseParts) => ReactNode;
}
