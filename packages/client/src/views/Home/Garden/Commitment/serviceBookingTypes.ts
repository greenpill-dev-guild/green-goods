import type {
  CommitmentDerivedState,
  ServiceAccessSnapshot,
  ServiceVoucherSetup,
  VoucherIssuer,
  VoucherIssuerApproval,
} from "@green-goods/shared/commitment-pooling";
import type { ServiceStripStep } from "./ServiceStepStrip";

/**
 * Which of the pilot's services a booking is. The working terms name a Tech and Sun hub day and
 * Green Goods' Claude access; their copy says so, and any other service reads in general words.
 * The offer's unit label decides until service terms carry a kind.
 */
export type ServiceProfile = "hubDay" | "access" | "generic";

/** Where one booking stands, from the reader's seat: the lab's states for an offer and a booking. */
export type ServiceBookingStage =
  | "open"
  | "notEnough"
  | "waitingApproval"
  | "readyToDeposit"
  | "confirmingDeposit"
  | "waitingAcceptance"
  | "starting"
  | "inProgress"
  | "readyToClose"
  | "returnProposed"
  | "transfersPending"
  | "returnFailed"
  | "closed"
  | "canceling"
  | "canceled"
  | "acceptedFirst"
  | "termsChanged"
  | "problemReported";

export type ServiceBandTone = "neutral" | "waiting" | "attention" | "kept";
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
  id: "get" | "give" | "held" | "next" | "back" | "vouchers" | "deadline";
  label: string;
  value: string;
  detail: string | null;
}

/** The promise's own event a booking step is the same act as, which dates it in History. */
export type BookingHistoryAnchor =
  | "CLAIM_REQUESTED"
  | "ACCEPTED"
  | "READY_FOR_CONFIRMATION"
  | "FULFILLED"
  | "CANCELLED";

export interface ServiceStep {
  id: string;
  text: string;
  state: ServiceStepState;
  stateLabel: string;
  anchor?: BookingHistoryAnchor;
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

/** Promise kept? after a booking's split: the strip, the split already approved, and its note. */
export interface ServiceConfirmExtras {
  steps: ServiceStripStep[];
  stepsLabel: string;
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
    /** Set only where the promise's own state words say too little ("Ended early"). */
    pillId: string | null;
  };
  facts: ServiceFact[];
  termsVersion: string | null;
  phases: ServicePhase[];
  transfers: ServiceTransfer[];
  /** Chains, Safes and record numbers, only under Transaction details (D2). */
  details: string[];
  /** Delivery for Progress and proof: a count once reported, else what comes next. */
  delivery: { label: string; done: number; of: number } | { none: string } | null;
  primary: ServiceAct | null;
  secondary: ServiceAct | null;
  /** One sentence for a reader who can't act here, and its one door (JoinToAct's anatomy). */
  door: { title: string; body: string; act: ServiceAct } | null;
  /** Booking events that happened, for History, newest first. */
  events: ServiceStep[];
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
  };
}

export interface ServiceBookingInput {
  snapshot: ServiceAccessSnapshot;
  coreState: CommitmentDerivedState;
  issuer: Pick<VoucherIssuer, "name" | "gender"> | null;
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
}

/** What the page's copy and steps read from one booking, worked out once. */
export interface BookingContext {
  input: ServiceBookingInput;
  stage: ServiceBookingStage;
  profile: ServiceProfile;
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
