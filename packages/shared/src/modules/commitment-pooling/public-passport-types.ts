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
  /** Undelivered units in promises still open. Null wherever the breakdown is. */
  stillToDeliver: bigint | null;
  /** Undelivered units in promises whose term ended unkept. Null wherever the breakdown is. */
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
   * uses for its kept rate, and while any unit with something unresolved is promised by fewer
   * than three people, so no record can single out one person's lapsed promise.
   */
  breakdown: {
    stillOpen: number;
    /** Open promises whose work is shown and waiting for confirmation. */
    awaitingConfirmation: number;
    /** Taken up, term ended, not kept. */
    notKept: number;
    /** Unresolved promises with some units approved and some not. */
    partlyDelivered: number;
    /**
     * Open promises whose due date has passed and that nobody has confirmed or closed yet. They
     * still count as open: a promise lapses only when its term is closed on the record.
     */
    pastDue: number;
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
    /** Bookings that ended before the service started, whoever ended them. */
    notStarted: number;
    /** Bookings with a final split on record. */
    settled: number;
    /** Transfers of a final split that failed and wait for recovery. */
    transfersFailed: number;
    /**
     * Unit figures by service and by voucher. Null while any one line has fewer than three
     * holders behind it, so no line can be one person's booking.
     */
    amounts: { services: PassportServiceLine[]; vouchers: PassportVoucherLine[] } | null;
  }>;
}

/** How many payments in one token ended in each state. */
export interface PassportPaymentCounts {
  token: Address;
  /** Arrival acknowledged by the paying chain. Only this is money received. */
  confirmed: number;
  /** Sent to the paying chain, arrival not yet acknowledged. */
  sent: number;
  /** Recorded and not yet sent. */
  queued: number;
  failed: number;
  cancelled: number;
}

/** Amounts in one token, by the same states. Different tokens are never added together. */
export interface PassportMoneyLine {
  token: Address;
  confirmed: bigint;
  sent: bigint;
  queued: bigint;
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
    /** One entry per token: a count never mixes tokens, any more than an amount does. */
    payments: PassportPaymentCounts[];
    lines: PassportMoneyLine[];
  };
  /** Money sent to members for kept promises, against what each payment plan declared. */
  memberPayments: PassportPeopleGroup<{
    plans: number;
    /** Plans whose recognition and payment snapshots are final and hash-bound. */
    plansFinalized: number;
    /** Plans changed after their first snapshot, each change with its recorded reason. */
    plansRevised: number;
    payments: PassportPaymentCounts[];
    /**
     * What the plans assign to members, by token. A declared amount is intent, not a payment.
     * Null while fewer than three members share it, or while a plan has not assigned its
     * members' amounts yet.
     */
    declared: { token: Address; amount: bigint }[] | null;
    /**
     * The part of `declared` whose payment is not confirmed. Null while fewer than three members
     * share it, so it cannot be one member's unpaid amount.
     */
    declaredUnpaid: { token: Address; amount: bigint }[] | null;
    /**
     * Amounts by state. Null while any one amount has fewer than three recipients behind it, so
     * no amount can be one member's pay. The counts above stay.
     */
    lines: PassportMoneyLine[] | null;
  }>;
}

/** One reviewed exchange pool's place for a voucher. */
export interface PassportPoolHolding {
  /** The pool's public name. */
  name: string;
  /** Whether the pool's registry admits the voucher today. */
  listed: boolean;
  holding: bigint;
  /** The most the pool may hold of this voucher. Zero before a limit is set, and once delisted. */
  holdingLimit: bigint;
}

/**
 * One voucher a garden issues, as its token and its exchange pools hold it on the voucher chain.
 * Pool inventory, the holding limit and what is outstanding are three different facts.
 */
export interface PassportVoucherSupply {
  token: Address;
  symbol: string;
  decimals: number;
  pools: PassportPoolHolding[];
  /**
   * Vouchers out of the issuer's reserve. Null while some of them are outside the pools: that
   * remainder is what holders have, and the page cannot count the people behind it.
   */
  outstanding: bigint | null;
  /** Some outstanding vouchers are outside the pools: with holders, or in a booking. */
  outsidePools: boolean;
}

interface PassportUnavailableSources {
  promises: boolean;
  vouchers: boolean;
  settlement: boolean;
  supply: boolean;
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
  /**
   * The vouchers this garden issues, read from the voucher chain itself. `asOf` is the time of
   * the block the reading was taken at, not a last change. Empty when the garden issues none.
   */
  supply: PassportSection<PassportVoucherSupply[]>;
  partialData: boolean;
  unavailableSources: PassportUnavailableSources;
}
