// Shared types for the hi-fi prototype artifact modules.

export type Surface = "client" | "admin" | "editorial" | "community";
export type FrameKind = "phone" | "desktop" | "browser" | "ascii";

// The guided-flow tabs. Single source of truth: the build generates the tablist
// from this, the player switches panels by the id attribute, and ReviewGroup is
// derived — so a group cannot exist as a tab without a type, or vice versa.
// A flow homes to the surface where its actor acts; consequences landing on
// another surface stay inline as `echo` scenes rather than splitting hairs.
export const FLOW_GROUPS = [
  { id: "client", label: "Client PWA" },
  { id: "admin", label: "Admin console" },
  { id: "editorial", label: "Editorial website" },
] as const;
export type ReviewGroup = (typeof FLOW_GROUPS)[number]["id"];

// Scene surface tokens (what the stagebar pill renders). `pwa` is the client
// dialect's own word for itself and predates the group ids; keeping it avoids
// churning every journey for no reviewer-visible gain.
export const SCENE_SURFACES = ["pwa", "admin", "editorial", "community", "safe"] as const;
export type SceneSurface = (typeof SCENE_SURFACES)[number];

// Which scene surface a flow is "at home" on, by group.
export const HOME_SURFACE: Record<ReviewGroup, SceneSurface> = {
  client: "pwa",
  admin: "admin",
  editorial: "editorial",
};

export type PoolLifecycle = "NotReady" | "Ready" | "Open" | "Paused" | "Closed" | "Composted";
// Contract-call validation records the cycle's canonical on-chain state here.
// Draft/InProgress/Reviewing remain UI overlays, matching the ontology sidecar.
export type CycleLifecycle = "Seeded" | "Open" | "Reconciled" | "Composted" | "Cancelled";
export type CycleLiveCommitments = "Zero" | "NonZero";
export type CommitmentLifecycle =
  | "Offered" | "Requested" | "Accepted" | "Active" | "EvidenceSubmitted"
  | "PartiallyApproved" | "ReadyForConfirmation" | "Fulfilled" | "Cancelled"
  | "Expired" | "Disputed" | "Reconciled";
export type CommitmentKind = "DomainImpact" | "SupportService" | "SeasonCampaign" | "StewardCaptured";
export type SettlementAccountState = "Unregistered" | "Registered" | "Active";
export type BeneficiarySettlementAccountState = "NotRequired" | "Unregistered" | "Registered" | "Active";
// Exact settlement-spec DisbursementState spelling. `None` is a sentinel and
// never renders as product copy, but keeping it here prevents account readiness
// or another local concept from being folded into the contract lifecycle.
export type DisbursementLifecycle = "None" | "Queued" | "Dispatched" | "Confirmed" | "Failed" | "Cancelled";
export type PayoutPlanLifecycle = "Draft" | "Pending" | "Partial" | "Complete" | "Failed";

// Explicit facts make lifecycle legality reviewable by the build. A state need
// only declare the entities that its controls act on.
export type StateFacts = {
  pool?: PoolLifecycle;
  cycle?: CycleLifecycle;
  cycleLiveCommitments?: CycleLiveCommitments;
  commitment?: CommitmentLifecycle;
  kind?: CommitmentKind;
  settlementAccount?: SettlementAccountState;
  beneficiarySettlementAccount?: BeneficiarySettlementAccountState;
  disbursement?: DisbursementLifecycle;
  payoutPlan?: PayoutPlanLifecycle;
};

export type ContractCall =
  | "createCommitment" | "claimCommitment" | "acceptClaim" | "declineClaim"
  | "joinCommitment" | "leaveCommitment" | "addContributor" | "removeContributor"
  | "setContributorRequirement" | "attachEvidence" | "linkWork" | "attachAssessment" | "submitForConfirmation"
  | "markReadyForConfirmation" | "confirmFulfillment" | "confirmFulfillmentAsFallback" | "cancelCommitment"
  | "raiseDispute" | "resolveDispute" | "recordRewardPaid"
  | "markPoolReady" | "openPool" | "pausePool" | "resumePool" | "closePool"
  | "compostPool" | "reopenPool" | "seedCycle" | "openCycle" | "closeCycle"
  | "compostCycle" | "cancelCycle" | "registerSettlementAccount" | "requeue"
  | "createCommitmentPayoutPlan" | "setContributorPayouts" | "finalizeCommitmentPayoutPlan"
  | "prepareContributorPayout" | "createBatch" | "dispatchDisbursement" | "dispatchBatch" | "retryBatchCommand"
  | "retryAcknowledgment" | "cancelBatch" | "cancelDisbursement";

// Metadata for one registered hotspot (a tappable control on a screen).
// `to` targets: "screen:W2" | "screen:W2@disputed" | "sb5:0".
// `calls` is ordered: a Ready-pool open-cycle control must declare
// openPool → openCycle so the validator can apply the intermediate state.
export type HotMeta = {
  l: string;
  to?: string;
  info?: string;
  calls?: ContractCall[];
  // Page-level facts describe the containing screen. A list-row action may
  // act on a more specific entity (for example, an Offered commitment inside
  // an Open pool), so hotspot facts refine that source before validation.
  facts?: StateFacts;
  // The control queues the named call but lands on a pre-sync state. Source
  // legality still validates; target lifecycle effects apply only after sync.
  pendingSync?: boolean;
  // Selected final facts for a call with multiple legal outcomes. For example,
  // RestorePrevious must name the stored pre-dispute state instead of letting
  // the validator guess one universal resolveDispute result.
  resultFacts?: StateFacts;
};

export type ScreenState = {
  id: string; // kebab id, e.g. "disputed"; first state in the list is the default
  label: string; // chip label in the state switcher
  proposed?: boolean; // amber tag reserved for genuinely unlocked review states
  facts?: StateFacts;
  html: string; // pre-rendered screen body (device inner HTML)
};

export type Screen = {
  id: string; // "W2"
  title: string;
  surface: Surface;
  frame: FrameKind;
  group: string; // Screens-tab group heading
  reviewVisible: boolean; // shown in the presentation catalog; direct hashes stay valid either way
  states: ScreenState[];
};

// The flat hotspot registry: id → meta. Ids are namespaced by screen
// ("w2.confirm" for hi-fi, "W2.h0" for legacy-derived ascii hotspots).
export type HotRegistry = Record<string, HotMeta>;

// Per-screen resolution tables for legacy match-string journey steps.
export type ResolveTables = {
  hotByString: Record<string, Record<string, string>>; // screen → matchString → hid
  markByString: Record<string, Record<string, string>>; // screen → matchString → mark id (or hid when identical)
};

// Normalized (shipped) journey shapes — what PLAYER_DATA carries.
export type ShippedStep = {
  f: string; // screen id
  v: string; // state id
  hot?: { h: string; l: string } | null;
  alts?: { h: string; l: string; to: string }[];
  marks?: string[]; // registered mark/hotspot ids
  who?: string;
  surface?: string;
  // The same moment landing on another surface — drawn in "Meanwhile" chrome so
  // a reviewer never mistakes a consequence for part of the flow they are in.
  echo?: boolean;
  st?: string;
  ev: string;
  cite?: string;
  note?: string;
  skipTargetReason?: string; // audited exception when a canonical hotspot destination is not the next scene
  br?: { l: string; to: string }[];
  mf?: boolean;
};
// `scen` (internal scenario codes) and the flow-level `surface` prose stay in
// the authoring data only: the first must never reach rendered copy, and the
// second is now derived from reviewGroup via HOME_SURFACE.
export type ShippedSB = {
  id: string;
  n: number;
  title: string;
  persona: string;
  reviewVisible: boolean;
  reviewGroup: ReviewGroup;
  steps: ShippedStep[];
};
