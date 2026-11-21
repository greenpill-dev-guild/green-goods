import type { Address } from "../../types/domain";

/**
 * A garden's passport: what it promised, what support reached it, what it delivered and what is
 * still open, joined from indexed receipts. Every figure is an aggregate over one garden. Nothing
 * here names a person, ranks one or scores one.
 *
 * A section whose read failed is unavailable, never empty, and a group about individual people
 * is withheld until enough people are in it that a figure cannot point at one of them.
 */
export type PassportSection<T> =
  | {
      status: "available";
      /** Newest indexed change among the rows this section read, in seconds. Null with no rows. */
      asOf: number | null;
      value: T;
    }
  | { status: "unavailable" };

/** Figures about what individual people received, published only above the people floor. */
export type PassportPeopleGroup<T> = ({ withheld: false } & T) | { withheld: true };

/** Distinct people a group needs before its figures are published. */
export const PUBLIC_PASSPORT_MIN_PEOPLE = 3;

/** One exact unit label. Units under different labels are never added together. */
export interface PassportUnitLine {
  unitLabel: string;
  /** Units in promises that were taken up and not released by both sides. */
  promised: bigint;
  /** Units approved against those promises. A kept promise counts in full. */
  delivered: bigint;
  /** `promised - delivered`, whatever the reason. */
  undelivered: bigint;
  /** Undelivered units in promises still open. Null below the display floor. */
  stillToDeliver: bigint | null;
  /** Undelivered units in promises whose term ended unkept. Null below the display floor. */
  notDelivered: bigint | null;
  /** Units in offers nobody has taken up yet: capacity on offer, not an obligation. */
  onOffer: bigint;
}

export interface PassportPromises {
  /** When the first counted promise was written, in seconds: the window opens here. */
  since: number | null;
  /** Offers and requests written. */
  made: number;
  /** Promises someone took up. */
  takenUp: number;
  /** Taken up and not released by both sides: what the garden answers for. */
  due: number;
  /** Confirmed kept. */
  kept: number;
  /** `due - kept`. */
  unresolved: number;
  /**
   * How the unresolved promises divide. Null below the display floor the garden page already
   * uses for its kept rate, so a small record cannot single out one person's lapsed promise.
   */
  breakdown: {
    stillOpen: number;
    /** Open promises whose work is shown and waiting for confirmation. */
    awaitingConfirmation: number;
    /** Taken up, term ended, not kept. */
    notKept: number;
    /** Unresolved promises with some units approved and some not. */
    partlyDelivered: number;
  } | null;
  /** Offers still open for someone to take up. */
  standingOffers: number;
  units: PassportUnitLine[];
}

/** One voucher asset. Units of different vouchers are never added together. */
export interface PassportVoucherLine {
  token: Address;
  /** The voucher's symbol and decimals from the reviewed issuer list. Null for any other asset. */
  symbol: string | null;
  decimals: number | null;
  /** Voucher units a holder placed in escrow against a booking. */
  presented: bigint;
  /** Units that went back to the issuer's reserve for a delivery the holder approved. */
  returnedToIssuer: bigint;
  /** Units that went back to the holder. */
  refundedToHolder: bigint;
  /** Units a final split assigned whose transfer has not succeeded yet. */
  awaitingTransfer: bigint;
}

/** Service units under one exact label, booked with vouchers. */
export interface PassportServiceLine {
  /** Null when the booking's promise is outside this garden's indexed pool. */
  unitLabel: string | null;
  booked: bigint;
  /** Units the holder approved as delivered. Only this proves a service was delivered. */
  confirmedDelivered: bigint;
}

export interface PassportVouchers {
  /** Open offers that take a voucher as payment. */
  offersBookable: number;
  /** Units those offers hold, by exact label. */
  capacityOnOffer: { unitLabel: string; units: bigint }[];
  /** Vouchers awarded for kept promises. Award amounts are not indexed, so these are counts. */
  earned: PassportPeopleGroup<{
    /** Promises whose voucher reward the issuer approved. */
    promisesWithApprovedTerms: number;
    recorded: number;
    /** Arrival acknowledged by the issuing chain. */
    issued: number;
    failed: number;
    awaiting: number;
    /** Issued awards whose promise is on record as kept. */
    tracedToKeptPromise: number;
    /** Of those, kept through the promise's own confirmers. */
    confirmedByOwnConfirmers: number;
    /** Of those, kept through a pool or protocol fallback. */
    confirmedByFallback: number;
  }>;
  /** Services booked with vouchers: presentment, confirmation and discharge kept apart. */
  bookings: PassportPeopleGroup<{
    requested: number;
    accepted: number;
    declined: number;
    /** Bookings with a final split on record. */
    settled: number;
    /** Transfers of a final split that failed and wait for recovery. */
    transfersFailed: number;
    services: PassportServiceLine[];
    vouchers: PassportVoucherLine[];
  }>;
}

/** Amounts in one token. Amounts in different tokens are never added together. */
export interface PassportMoneyLine {
  token: Address;
  /** Arrival acknowledged by the paying chain. Only this is money received. */
  confirmed: bigint;
  /** Queued or sent, not yet acknowledged. */
  awaiting: bigint;
  failed: bigint;
  cancelled: bigint;
}

export interface PassportSettlement {
  /**
   * Kept promises that declare a payment to members and have no payment plan on record yet.
   * A declared payment is intent: until a plan and its payments exist, nothing was paid.
   */
  keptAwaitingPaymentPlan: number;
  /** Money sent to the garden itself. */
  support: {
    payments: { confirmed: number; awaiting: number; failed: number; cancelled: number };
    lines: PassportMoneyLine[];
  };
  /** Money sent to members for kept promises, against what each payment plan declared. */
  memberPayments: PassportPeopleGroup<{
    plans: number;
    /** Plans whose recognition and payment snapshots are final and hash-bound. */
    plansFinalized: number;
    /** Plans changed after their first snapshot, each change with its recorded reason. */
    plansRevised: number;
    payments: { confirmed: number; awaiting: number; failed: number; cancelled: number };
    /** What the plans declare for members, by token. A declared amount is intent, not a payment. */
    declared: { token: Address; amount: bigint }[];
    lines: PassportMoneyLine[];
  }>;
}

export interface PassportUnavailableSources {
  promises: boolean;
  vouchers: boolean;
  settlement: boolean;
}

export interface PublicGardenPassportRecord {
  chainId: number;
  garden: Address;
  /** Null when the garden has no registered pool: there is no promise record to read. */
  poolId: bigint | null;
  /** The moment this read was taken at, in seconds. */
  readAt: number;
  promises: PassportSection<PassportPromises>;
  vouchers: PassportSection<PassportVouchers>;
  settlement: PassportSection<PassportSettlement>;
  partialData: boolean;
  unavailableSources: PassportUnavailableSources;
}
