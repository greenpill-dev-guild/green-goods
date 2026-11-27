import type {
  CommitmentDerivedState,
  ServiceAccessSnapshot,
  ServiceVoucherSetup,
  VoucherIssuer,
  VoucherIssuerApproval,
} from "@green-goods/shared/commitment-pooling";

/**
 * Which of the pilot's services a booking is. The working terms name a Tech and Sun hub day and
 * Green Goods' Claude access; their copy says so. A member's session counted in minutes, such as
 * a lesson, returns by minutes delivered, and any other service reads in general words. The
 * offer's unit label decides until service terms carry a kind.
 */
export type ServiceProfile = "hubDay" | "access" | "minutes" | "generic";

/** Where one booking stands, from the reader's seat: the lab's states for an offer and a booking. */
export type ServiceBookingStage =
  | "open"
  | "notEnough"
  | "requestNotSent"
  | "requestInTransit"
  | "waitingApproval"
  | "readyToDeposit"
  | "confirmingDeposit"
  | "waitingAcceptance"
  | "stewardStarting"
  | "starting"
  | "activationInTransit"
  | "inProgress"
  | "readyToClose"
  | "returnProposed"
  | "returnDue"
  | "transfersPending"
  | "returnFailed"
  | "closed"
  | "canceling"
  | "canceled"
  | "acceptedFirst"
  | "termsChanged"
  | "problemReported";

export type ServiceBandTone = "neutral" | "waiting" | "attention" | "kept";
export interface ServicePill {
  labelId: string;
  tone: "success" | "warning" | "error" | "info" | "neutral";
}
export type ServiceStepState = "done" | "now" | "todo" | "warn" | "fail";
/**
 * `send` runs a transfer the split fixed that nobody sent yet; `retryConfirm` sends a deposit's
 * confirmation to the source again when it didn't go.
 */
export type ServiceActKind =
  | "redeem"
  | "deposit"
  | "activate"
  | "cancel"
  | "close"
  | "review"
  | "retry"
  | "report"
  | "cancelChanged"
  | "exchange"
  | "send"
  | "retryConfirm";

export interface ServiceAct {
  kind: ServiceActKind;
  label: string;
}

export interface ServiceFact {
  id: "get" | "takes" | "by" | "held" | "next" | "back" | "vouchers" | "deadline" | "reported";
  label: string;
  value: string;
  detail: string | null;
}

export interface ServiceStep {
  id: string;
  text: string;
  state: ServiceStepState;
  stateLabel: string;
}

export interface ServicePhase {
  id: "booked" | "canceled" | "accepted" | "delivery" | "close";
  title: string;
  who: string;
  state: ServiceStepState;
  steps: ServiceStep[];
}

export interface ServiceTransfer {
  id: "refund" | "release";
  label: string;
  detail: string;
  state: "pending" | "failed" | "succeeded";
  stateLabel: string;
}

/**
 * A booking's place in the PWA's own tracker (`FormProgress`): the same four markers on every
 * service, the current one, and who it waits on when the step isn't the reader's.
 */
export interface BookingTracker {
  /** Book, Deposit, Service, Done, in the reader's language. */
  markers: string[];
  /** The current marker, 1 to 4; 5 once every marker is done. */
  at: 1 | 2 | 3 | 4 | 5;
  /** Who or what the current marker waits on, in words; null when the step is the reader's. */
  waiting: string | null;
}

/** Promise kept? after a booking's split: the tracker, the split already approved, and its note. */
export interface ServiceConfirmExtras {
  tracker: BookingTracker;
  split: { label: string; value: string; detail: string };
  note: string;
  passkey: string;
}

export interface ServiceBookingView {
  stage: ServiceBookingStage;
  profile: ServiceProfile;
  setup: ServiceVoucherSetup | null;
  /** The one status message the page says, from the reader's seat. */
  band: {
    tone: ServiceBandTone;
    sentence: string;
    needsYou: boolean;
    /**
     * The one pill: where the booking stands, in place of the promise's own state, which reads
     * "Offered" through the whole deposit. Null where the promise's own pill says it ("Kept").
     */
    pill: ServicePill | null;
  };
  /** Where the booking sits on Book, Deposit, Service and Done; null once it was canceled. */
  tracker: BookingTracker | null;
  /** The facts that matter now: what you get, your voucher, Accept by, what was reported. */
  facts: ServiceFact[];
  /** What the page no longer says up front, kept under How booking works or Booking details. */
  howItWorks: ServiceFact[];
  termsVersion: string | null;
  phases: ServicePhase[];
  transfers: ServiceTransfer[];
  /** Chains, Safes and record numbers, only under Transaction details (D2). */
  details: string[];
  messageLinks: { label: string; href: string }[];
  /**
   * Delivery for Progress and proof: a count once reported. Until then it is pending, and the
   * booking's page leaves Progress and proof out: its card says what comes next.
   */
  delivery: { label: string; done: number; of: number } | "pending" | null;
  primary: ServiceAct | null;
  secondary: ServiceAct | null;
  /**
   * One sentence for a reader who can't act here, and its one door (JoinToAct's anatomy); a
   * paused issuer's offer has no door, since no booking can start.
   */
  door: { title: string; body: string; act: ServiceAct | null } | null;
  /**
   * The issuer paused new bookings: whatever the reader holds, no booking can start on the offer,
   * so its act stays disabled with the reason beside it. A booking already under way goes ahead.
   */
  issuerPaused: boolean;
  /** The split this booking can freeze now: what was reported, within the issuer's return limit. */
  split: { delivered: bigint; release: bigint; refund: bigint } | null;
  /** Set once the split is final, for the promise's own Confirm It Was Kept. */
  confirm: ServiceConfirmExtras | null;
  /** Amounts and names the sheets reuse, in this page's words. */
  words: {
    issuer: string;
    count: (value: bigint) => string;
    unit: (value: bigint) => string;
    /** The vouchers the booking takes, and the same with its unit ("1 Tech and Sun voucher"). */
    units: bigint;
    one: boolean;
    n: string;
    vouchers: string;
    /** "You get", for the review sheet. */
    get: string;
    /** The terms revision the reader is looking at: a booking's own, frozen when it was set up. */
    revision: bigint | null;
    /** The service units the booking authorizes, the whole a partial delivery counts against. */
    serviceUnits: bigint;
    accessDays: number;
    deadline: string | null;
    sigs: string | null;
    /** A member's own service: the member approves, then the garden's stewards accept. */
    member: boolean;
  };
}

/** What a voucher offer's creator reads about it, beside the promise's own sentences and act. */
export interface OwnServiceOfferView {
  /** What a booking takes, in words ("1 Tech and Sun voucher"), for What was promised. */
  takes: string;
  /** Said only while the promise's own sentence would be false: nobody can book right now. */
  band: { tone: ServiceBandTone; sentence: string; needsYou: boolean } | null;
}

export interface ServiceBookingInput {
  snapshot: ServiceAccessSnapshot;
  coreState: CommitmentDerivedState;
  issuer: Pick<VoucherIssuer, "name" | "gender" | "kind" | "standing"> | null;
  approval: VoucherIssuerApproval | null;
  /** The offer's vouchers in the reader's account, from the voucher wallet; null while unknown. */
  held: bigint | null;
  /**
   * Booking data the app has no read for yet: the visit and the access window. Stories pass
   * them; the page passes none, and every sentence that needs one falls back to its title.
   */
  schedule?: {
    visitAt?: number;
    from?: string;
    to?: string;
    accessDay?: number;
    accessUntil?: number;
  } | null;
  /** The member's own words when they reported a problem, and when. */
  problem?: { at: number; text: string } | null;
  /**
   * The promise holds the issuer's proof. A dispute keeps the promise's state from saying whether
   * the delivery was reported; its proof does, so a problem raised after delivery keeps it.
   */
  proofRecorded?: boolean;
  /**
   * When the booking was accepted (the promise's `acceptanceAt`), in seconds; null or absent while
   * unread. The member's Start the Booking waits fifteen minutes from it for the steward's start.
   */
  acceptedAt?: number | null;
}

/** What the page's copy and steps read from one booking, worked out once. */
export interface BookingContext {
  input: ServiceBookingInput;
  stage: ServiceBookingStage;
  profile: ServiceProfile;
  /**
   * A member's own service. The member approves each booking from their own account, and the
   * garden's stewards accept it, so no step names the member as the one who accepts.
   */
  member: boolean;
  setup: ServiceVoucherSetup | null;
  /** A voucher string with the issuer's name and grammatical gender already in it. */
  t: (id: string, values?: Record<string, string | number>) => string;
  count: (value: bigint) => string;
  unit: (value: bigint) => string;
  isOne: (value: bigint) => boolean;
  date: (seconds: number | bigint) => string;
  units: bigint;
  one: boolean;
  n: string;
  serviceUnits: bigint;
  accessDays: number;
  /** The split the booking ends on: reported, proposed or frozen. */
  refund: bigint;
  release: bigint;
  delivered: bigint;
  reported: boolean;
  daysDone: number | null;
  deadline: bigint | null;
  sigs: string | null;
  kept: boolean;
  endedEarly: boolean;
  /** Where the stage sits on the booking's way, for done and now. */
  pos: number;
  values: Record<string, string | number>;
}
