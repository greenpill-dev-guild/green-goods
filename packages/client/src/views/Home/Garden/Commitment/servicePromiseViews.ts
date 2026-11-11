import {
  type CommitmentDerivedState,
  type CommitmentReadModel,
  isCommitmentCreator,
  type ServiceAccessSnapshot,
  type VoucherIssuer,
  type VoucherIssuerApproval,
  type VoucherWalletScope,
  type VoucherWalletSnapshot,
} from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import type { IntlShape } from "react-intl";
import {
  bookingVoucherIssuer,
  bookingVoucherPair,
  catalogVoucherIssuer,
  formatVoucherMessage,
  ownServiceOfferView,
  serviceBookingView,
} from "./serviceBooking";
import type {
  OwnServiceOfferView,
  ServiceBookingInput,
  ServiceBookingView,
} from "./serviceBookingTypes";
import { type ServiceRewardsView, serviceRewardsView } from "./serviceRewards";

/**
 * The booking's issuer: the wallet's match when it has one, else the catalog's name for the same
 * token and account, so the page never calls one issuer by a token symbol while the read lands.
 * Only the match knows the issuer's asset and standing; the name is the same either way.
 */
export function promiseVoucherIssuer(
  snapshot: ServiceAccessSnapshot | null,
  wallet: VoucherWalletSnapshot | undefined
): { matched: VoucherIssuer | null; issuer: ServiceBookingInput["issuer"] } {
  const matched = bookingVoucherIssuer(snapshot, wallet?.issuers);
  return { matched, issuer: matched ?? catalogVoucherIssuer(bookingVoucherPair(snapshot)) };
}

/** The wallet kept from the last read that answered, with the route it answered for. */
export interface RetainedVoucherWallet {
  scope: VoucherWalletScope;
  wallet: VoucherWalletSnapshot;
}

/**
 * The retained wallet stands in for a read that hasn't answered only on the exact route it was
 * read for: the same account, source chain and core module. Another commitment's route reads its
 * own wallet, so holdings read elsewhere never make this one look bookable.
 */
export function retainedVoucherWallet(
  retained: RetainedVoucherWallet | null,
  scope: VoucherWalletScope | null
): VoucherWalletSnapshot | undefined {
  if (!retained || !scope) return undefined;
  const sameRoute =
    retained.scope.sourceChainId === scope.sourceChainId &&
    retained.scope.coreModule.toLowerCase() === scope.coreModule.toLowerCase() &&
    retained.scope.account.toLowerCase() === scope.account.toLowerCase();
  return sameRoute ? retained.wallet : undefined;
}

export interface ServicePromiseViewsInput {
  snapshot: ServiceAccessSnapshot;
  coreState: CommitmentDerivedState;
  /** Who made the promise: the chain refuses their own take-up, so they read no buyer's path. */
  creator: CommitmentReadModel["creator"];
  viewer: Address | undefined;
  issuer: ServiceBookingInput["issuer"];
  /** The wallet's own entry for the issuer, which alone knows what the reader holds of it. */
  matched: VoucherIssuer | null;
  wallet: VoucherWalletSnapshot | undefined;
  approval: VoucherIssuerApproval | null;
  /** The request's garden, whose pool pays any G$. */
  garden: string;
  takeUp: "open" | "reviewed" | null;
}

export interface ServicePromiseViews {
  /** The offer's vouchers in the reader's account; null while the wallet hasn't said. */
  held: bigint | null;
  ownOffer: OwnServiceOfferView | null;
  booking: ServiceBookingView | null;
  rewards: ServiceRewardsView | null;
  /** Why an open offer's act can't run right now, in words, or null. */
  blocked: string | null;
}

/**
 * What the promise page draws for this reader, worked out once: their own voucher offer, their
 * booking of someone else's, or a request's rewards, with the reason an open offer is blocked.
 */
export function servicePromiseViews(
  input: ServicePromiseViewsInput,
  intl: Pick<IntlShape, "formatMessage" | "formatDate" | "locale">
): ServicePromiseViews {
  const { snapshot, coreState, issuer, matched, wallet } = input;
  // What the reader holds is the wallet's to say: unknown until it matches the booking's issuer.
  const held = matched
    ? (wallet?.holdings.find(
        (entry) =>
          entry.issuer.asset.chainId === matched.asset.chainId &&
          entry.issuer.asset.token.toLowerCase() === matched.asset.token.toLowerCase()
      )?.available ?? null)
    : null;
  // A paused contract stops every new booking; a paused issuer, its own.
  const paused =
    Object.values(snapshot.pause).some((p) => p === true) || issuer?.standing.bookings === "paused";
  const ownOffer = isCommitmentCreator({
    commitment: { creator: input.creator },
    viewer: input.viewer,
  })
    ? ownServiceOfferView({ snapshot, coreState, issuer, paused }, intl)
    : null;
  const booking = ownOffer
    ? null
    : serviceBookingView({ snapshot, coreState, issuer, approval: input.approval, held }, intl);
  // A reward's issuer: the wallet's match, else the catalog's name, else the booking's issuer on
  // a page with neither a booking nor an own offer.
  const terms = snapshot.acceptancePolicy.earned.terms;
  const rewardIssuer =
    wallet?.issuers.find(
      (entry) =>
        terms !== null &&
        entry.asset.token.toLowerCase() === terms.asset.token.toLowerCase() &&
        entry.account.toLowerCase() === terms.issuer.toLowerCase()
    ) ??
    catalogVoucherIssuer(terms ? { token: terms.asset.token, account: terms.issuer } : null) ??
    (booking || ownOffer ? null : issuer);
  const rewards = serviceRewardsView(
    {
      snapshot,
      coreState,
      issuer: rewardIssuer,
      garden: input.garden,
      takeUp: ownOffer ? null : snapshot.knownService ? "service" : input.takeUp,
    },
    intl
  );
  const text = (id: string) =>
    formatVoucherMessage(intl, id, { issuer: booking?.words.issuer ?? "" });
  const offline = snapshot.capabilities.reasons.includes("offline");
  const blocked =
    booking?.stage === "open"
      ? paused
        ? text("of.r.paused.b")
        : offline
          ? text("pp.reason.offline")
          : null
      : null;
  return { held, ownOffer, booking, rewards, blocked };
}
