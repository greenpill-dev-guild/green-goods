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

// Chapters cluster a group's flow cards under lifecycle-ordered headings.
// Deliberately loose data, not a calcified constant (decision 2026-08-10):
// labels are expected to keep evolving as real garden vocabulary lands, so the
// build checks only referential integrity — a flow must name a chapter that
// exists in its group — and never asserts names or counts. Rename freely here.
export const CHAPTERS: Record<ReviewGroup, readonly { id: string; label: string; collapsed?: boolean }[]> = {
  // Lifecycle order after iteration 2 (2026-08-11): make → requests → take up
  // → prove → confirm → team → money → change. The separate Ongoing chapter is
  // gone — ongoing lives inside Make an offer (Afo decision, iteration 2).
  client: [
    { id: "make", label: "Make an offer" },
    // "Requests" was the odd one out: every other chapter names the act, so the
    // two creation doors now read as the matched pair they are (Afo, D3).
    { id: "ask", label: "Make a request" },
    { id: "take-up", label: "Take up a promise" },
    { id: "keep", label: "Prove it" },
    { id: "confirm", label: "Confirm & resolve" },
    { id: "team", label: "The team behind a promise" },
    { id: "money", label: "Money & wallet" },
    { id: "change", label: "Change of plans" },
  ],
  admin: [
    { id: "season", label: "Run the season" },
    { id: "promises", label: "Decide on promises" },
    { id: "work", label: "Work review" },
    { id: "assess", label: "Assessments" },
    { id: "behalf", label: "On a member's behalf" },
    { id: "recognition", label: "Recognition & rewards" },
    { id: "settlement", label: "Settlement" },
    // Protocol-team-only operations stay out of a community review session's
    // way: rendered collapsed, expandable on demand.
    { id: "ggops", label: "Green Goods operations", collapsed: true },
  ],
  editorial: [{ id: "public-story", label: "The public story" }],
};

// Acting-role tags shown on flow cards (replaces the redundant surface badge).
// Closed vocabulary matching the spec's hat-based personas (UX §1); order on a
// flow is primary actor first. A flow needing three role chips is a smell that
// it should split.
export const ROLES = [
  { id: "gardener", label: "Gardener" },
  { id: "steward", label: "Steward" },
  { id: "evaluator", label: "Evaluator" },
  { id: "member", label: "Member (no device)" },
  { id: "public", label: "Public" },
  { id: "green-goods-team", label: "Green Goods team" },
] as const;
export type RoleId = (typeof ROLES)[number]["id"];

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
export type PoolLiveCommitments = "Zero" | "NonZero";
export type PoolNonTerminalCycles = "Zero" | "One" | "Many";
export type CommitmentLifecycle =
  | "Offered" | "Requested" | "Accepted" | "Active" | "EvidenceSubmitted"
  | "PartiallyApproved" | "ReadyForConfirmation" | "Fulfilled" | "Cancelled"
  | "Expired" | "Disputed" | "Reconciled";
export type CommitmentKind = "DomainImpact" | "SupportService" | "SeasonCampaign" | "StewardCaptured";
// Ongoing Offer (`CommitmentSeries`) on-chain lifecycle. `None` is the
// storage sentinel and never renders. Pending/queued creation is not a series
// state — it is the ordinary pre-sync overlay carried by HotMeta.pendingSync.
export type CommitmentSeriesLifecycle = "Active" | "Resting" | "Retired";
export type SettlementAccountState = "Unregistered" | "Registered" | "Active";
export type BeneficiarySettlementAccountState = "NotRequired" | "Unregistered" | "Registered" | "Active";
// Exact settlement-spec DisbursementState spelling. `None` is a sentinel and
// never renders as product copy, but keeping it here prevents account readiness
// or another local concept from being folded into the contract lifecycle.
export type DisbursementLifecycle = "None" | "Queued" | "Dispatched" | "Confirmed" | "Failed" | "Cancelled";
export type DisbursementKind =
  | "ContributorConsideration"
  | "Funding"
  | "LoanPrincipal"
  | "GardenBeneficiary"
  | "Refund";
// Mirrors Solidity `FundingRoute { None, ProtocolToGarden }` exactly
// (ISettlementModule.sol). The 2026-08-10 contracts audit found the earlier
// union had conflated two orthogonal on-chain axes by also listing
// ContributorConsideration/GardenBeneficiary — those are DisbursementKind
// members, never routes; no call site ever used them as routes.
export type DisbursementRoute = "None" | "ProtocolToGarden";
// Onchain queueFunding capability, not deployer status: route visibility never
// implies submit authority (register #69).
export type QueueFundingAuthority = "None" | "ProtocolSteward" | "ModuleOwner";
export type PayoutPlanLifecycle = "Draft" | "Pending" | "Partial" | "Complete" | "Failed";
export type FundingLifecycle =
  | "None" | "Pledged" | "DepositRecorded" | "Consumed"
  | "Closed" | "RefundQueued" | "Refunded" | "Withdrawn";

// Explicit facts make lifecycle legality reviewable by the build. A state need
// only declare the entities that its controls act on.
export type StateFacts = {
  pool?: PoolLifecycle;
  cycle?: CycleLifecycle;
  series?: CommitmentSeriesLifecycle;
  cycleLiveCommitments?: CycleLiveCommitments;
  poolLiveCommitments?: PoolLiveCommitments;
  poolNonTerminalCycles?: PoolNonTerminalCycles;
  commitment?: CommitmentLifecycle;
  kind?: CommitmentKind;
  settlementAccount?: SettlementAccountState;
  beneficiarySettlementAccount?: BeneficiarySettlementAccountState;
  disbursement?: DisbursementLifecycle;
  disbursementKind?: DisbursementKind;
  disbursementRoute?: DisbursementRoute;
  queueFundingAuthority?: QueueFundingAuthority;
  payoutPlan?: PayoutPlanLifecycle;
  funding?: FundingLifecycle;
};

export type ContractCall =
  // Ongoing Offer (CommitmentSeries) — initial ABI is create/metadata/rest/resume/
  // retire only. Co-holder, apprenticeship, handover, fork, and community-held
  // stewardship are follow-on consent events and deliberately absent here, so a
  // drawn succession control cannot compile into a call that does not exist.
  // acceptExchange joined 2026-08-10 (register #97) — shipped and tested
  // on-chain per the same-day contracts audit.
  | "createCommitmentSeries" | "updateCommitmentSeriesMetadata"
  | "restCommitmentSeries" | "resumeCommitmentSeries" | "retireCommitmentSeries"
  | "createCommitment" | "setDeclaredValue" | "claimCommitment" | "acceptClaim" | "declineClaim"
  | "acceptExchange"
  | "joinCommitment" | "leaveCommitment" | "addContributor" | "removeContributor"
  | "setContributorRequirement" | "attachEvidence" | "linkWork" | "attachAssessment" | "submitForConfirmation"
  | "markReadyForConfirmation" | "confirmFulfillment" | "confirmFulfillmentAsFallback" | "cancelCommitment" | "expireCommitment"
  | "raiseDispute" | "resolveDispute" | "recordConsiderationPaid"
  | "setPoolCharter" | "setProviderOpenCommitmentCap"
  | "markPoolReady" | "openPool" | "pausePool" | "resumePool" | "closePool"
  | "compostPool" | "reopenPool" | "seedCycle" | "openCycle" | "closeCycle"
  | "compostCycle" | "cancelCycle" | "registerSettlementAccount" | "requeue"
  | "createCommitmentPayoutPlan" | "setContributorPayouts" | "finalizeCommitmentPayoutPlan"
  | "prepareContributorPayout" | "prepareGardenBeneficiaryPayout" | "queueFunding"
  | "recordFunding" | "recordFundingDeposit" | "consumeFunding" | "queueFundingRefund"
  | "createBatch" | "dispatchDisbursement" | "dispatchBatch" | "retryCommand" | "retryBatchCommand"
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
  /** One plain sentence under the card title: what this walk covers. */
  desc: string;
  persona: string;
  reviewVisible: boolean;
  reviewGroup: ReviewGroup;
  chapter: string; // must exist in CHAPTERS[reviewGroup]; names stay renameable data
  roles: RoleId[]; // primary actor first; validated against ROLES
  steps: ShippedStep[];
};
