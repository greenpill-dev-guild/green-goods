// Validation v2 + journey normalization. Same contract as the lo-fi build:
// print every error, exit non-zero, write nothing. Guarantees (state-aware,
// strictly stronger than the frame-wide checks it replaces):
//   1. every step's screen@state exists; every to-target valid
//   2. step hot/alts/marks resolve to registered ids present in that state's html
//   3. bidirectional hotspot integrity (no orphan registration, no unregistered emission)
//   4. per-state non-empty render, no `undefined`/`[object`/`NaN` artifacts
//   5. copy scans on rendered visible text — banned vocabulary, steward rule,
//      admin quiet-checkmark, chain-phrasing placement (September lo-fi stays
//      exempt only from dialect-specific phrasing checks)
// Hotspot `info` strings are spec commentary (may cite enum names like
// StewardCaptured) — they are not screen copy and are never scanned.

import { SB_ROUTE_ALIASES } from "./journeys";
import type { SB as RawSB, Scene } from "./journeys";
import { PHONE_VIEWPORT_HEIGHT, PHONE_VIEWPORT_WIDTH } from "./tokens";
import { CHAPTERS, HOME_SURFACE, ROLES, SCENE_SURFACES } from "./types";
import type {
  ContractCall, HotRegistry, ResolveTables, Screen, ShippedSB, ShippedStep, StateFacts,
} from "./types";

export type Ctx = {
  screens: Screen[];
  hots: HotRegistry;
  tables: ResolveTables;
  screenHots: Record<string, Set<string>>;
  screenMarks: Record<string, Set<string>>;
  aliases: Record<string, string>;
};

const err: string[] = [];
const warn: string[] = [];

const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ");

type FactKey =
  | "pool" | "cycle" | "series" | "cycleLiveCommitments" | "poolLiveCommitments"
  | "poolNonTerminalCycles" | "commitment"
  | "settlementAccount" | "beneficiarySettlementAccount" | "disbursement"
  | "disbursementKind" | "disbursementRoute" | "queueFundingAuthority" | "payoutPlan" | "funding";
const FACT_KEYS = [
  "pool", "cycle", "series", "cycleLiveCommitments", "poolLiveCommitments", "poolNonTerminalCycles",
  "commitment", "kind", "settlementAccount", "beneficiarySettlementAccount",
  "disbursement", "disbursementKind", "disbursementRoute", "queueFundingAuthority", "payoutPlan",
  "funding",
] as const satisfies readonly (keyof StateFacts)[];
type ConditionalRequirement = {
  when: Partial<Record<FactKey, string>>;
  requires: Partial<Record<FactKey, readonly string[]>>;
};
type CallRule = {
  key: FactKey;
  allowed: readonly string[];
  next?: string;
  effects?: Partial<Record<FactKey, string>>;
  kinds?: readonly string[];
  requires?: Partial<Record<FactKey, readonly string[]>>;
  requiresWhen?: readonly ConditionalRequirement[];
  resultAllowed?: readonly string[];
};

// Contract-spec lifecycle gates, expressed once and applied to every emitted
// hotspot that names a call. Calls run in order, so compound controls cannot
// hide an illegal second act behind legal first-act copy.
const CALL_RULES: Record<ContractCall, CallRule> = {
  // Ongoing Offers — CommitmentSeries (standing-commitments-spec §3.2). Creation is
  // direct-holder only into a Ready or Open pool; Retired is terminal.
  // A series-linked place is still an ordinary `createCommitment`, so no rule
  // here may require a series fact — screens that add places declare
  // `series: "Active"` themselves, and Resting/Retired states simply draw no
  // Add-places control, which is the product rule the spec states.
  createCommitmentSeries: { key: "pool", allowed: ["Ready", "Open"], effects: { series: "Active" } },
  updateCommitmentSeriesMetadata: { key: "series", allowed: ["Active", "Resting"] },
  restCommitmentSeries: { key: "series", allowed: ["Active"], next: "Resting" },
  resumeCommitmentSeries: { key: "series", allowed: ["Resting"], next: "Active" },
  retireCommitmentSeries: { key: "series", allowed: ["Active", "Resting"], next: "Retired" },
  createCommitment: { key: "pool", allowed: ["Open"] },
  setDeclaredValue: { key: "commitment", allowed: ["Offered", "Requested"] },
  claimCommitment: { key: "commitment", allowed: ["Offered", "Requested"] },
  acceptClaim: { key: "commitment", allowed: ["Offered", "Requested"], next: "Accepted" },
  // Atomic Offer×Offer acceptance: acts on B while both sides are Offered;
  // both emerge Accepted as ordinary independent commitments (CS §5.3).
  // StewardCaptured is excluded to mirror ExchangeCreatorConsentRequired.
  acceptExchange: { key: "commitment", allowed: ["Offered"], next: "Accepted", kinds: ["DomainImpact", "SupportService", "SeasonCampaign"] },
  declineClaim: { key: "commitment", allowed: ["Offered", "Requested"] },
  joinCommitment: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"] },
  leaveCommitment: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"] },
  addContributor: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"] },
  removeContributor: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"] },
  setContributorRequirement: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"], kinds: ["DomainImpact"] },
  attachEvidence: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"], next: "EvidenceSubmitted" },
  linkWork: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"], kinds: ["DomainImpact"] },
  attachAssessment: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"], next: "ReadyForConfirmation", kinds: ["DomainImpact"] },
  submitForConfirmation: { key: "commitment", allowed: ["EvidenceSubmitted"], next: "ReadyForConfirmation", kinds: ["SupportService", "SeasonCampaign", "StewardCaptured"] },
  markReadyForConfirmation: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"], next: "ReadyForConfirmation" },
  confirmFulfillment: { key: "commitment", allowed: ["ReadyForConfirmation"], next: "Fulfilled" },
  confirmFulfillmentAsFallback: { key: "commitment", allowed: ["ReadyForConfirmation"], next: "Fulfilled" },
  cancelCommitment: { key: "commitment", allowed: ["Offered", "Requested", "Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved"], next: "Cancelled" },
  expireCommitment: {
    key: "commitment",
    allowed: ["Offered", "Requested", "Accepted", "ReadyForConfirmation"],
    next: "Expired",
  },
  raiseDispute: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved", "ReadyForConfirmation", "Expired"], next: "Disputed" },
  resolveDispute: {
    key: "commitment",
    allowed: ["Disputed"],
    resultAllowed: ["Accepted", "ReadyForConfirmation", "Fulfilled", "Cancelled", "Expired"],
  },
  recordConsiderationPaid: { key: "commitment", allowed: ["Fulfilled"] },
  setPoolCharter: {
    key: "pool",
    allowed: ["NotReady", "Ready", "Open", "Paused", "Closed", "Composted"],
  },
  setProviderOpenCommitmentCap: {
    key: "pool",
    allowed: ["NotReady", "Ready", "Open", "Paused", "Closed", "Composted"],
  },
  markPoolReady: { key: "pool", allowed: ["NotReady"], next: "Ready" },
  openPool: { key: "pool", allowed: ["Ready"], next: "Open" },
  pausePool: { key: "pool", allowed: ["Open"], next: "Paused" },
  resumePool: { key: "pool", allowed: ["Paused"], next: "Open" },
  closePool: {
    key: "pool",
    allowed: ["Open", "Paused"],
    next: "Closed",
    requires: {
      poolLiveCommitments: ["Zero"],
      poolNonTerminalCycles: ["Zero"],
    },
  },
  compostPool: { key: "pool", allowed: ["Closed"], next: "Composted" },
  reopenPool: { key: "pool", allowed: ["Composted"], next: "Ready" },
  seedCycle: { key: "pool", allowed: ["Ready", "Open"], effects: { cycle: "Seeded" } },
  openCycle: { key: "cycle", allowed: ["Seeded"], next: "Open", requires: { pool: ["Open"] } },
  closeCycle: { key: "cycle", allowed: ["Open"], next: "Reconciled", requires: { cycleLiveCommitments: ["Zero"] } },
  compostCycle: {
    key: "cycle",
    allowed: ["Reconciled"],
    next: "Composted",
    requires: { poolNonTerminalCycles: ["One"] },
    effects: { poolNonTerminalCycles: "Zero" },
  },
  cancelCycle: { key: "cycle", allowed: ["Seeded", "Open"], next: "Cancelled", requires: { cycleLiveCommitments: ["Zero"] } },
  registerSettlementAccount: { key: "settlementAccount", allowed: ["Unregistered"], next: "Registered" },
  createCommitmentPayoutPlan: {
    key: "commitment",
    allowed: ["Fulfilled"],
    effects: { payoutPlan: "Draft" },
    requires: { settlementAccount: ["Active"] },
  },
  setContributorPayouts: {
    key: "payoutPlan",
    allowed: ["Draft"],
    requires: { settlementAccount: ["Active"] },
  },
  finalizeCommitmentPayoutPlan: {
    key: "payoutPlan",
    allowed: ["Draft"],
    resultAllowed: ["Pending", "Complete"],
    requires: { settlementAccount: ["Active"] },
  },
  prepareContributorPayout: {
    key: "payoutPlan",
    allowed: ["Pending", "Partial"],
    effects: { disbursement: "Queued" },
    requires: { settlementAccount: ["Active"] },
  },
  prepareGardenBeneficiaryPayout: {
    key: "payoutPlan",
    allowed: ["Pending"],
    effects: { disbursement: "Queued", disbursementKind: "GardenBeneficiary" },
    requires: {
      settlementAccount: ["Active"],
      beneficiarySettlementAccount: ["Active"],
    },
  },
  queueFunding: {
    key: "settlementAccount",
    allowed: ["Active"],
    effects: {
      disbursement: "Queued",
      disbursementKind: "Funding",
      disbursementRoute: "ProtocolToGarden",
    },
    requires: {
      beneficiarySettlementAccount: ["Active"],
      // Deployer status can never satisfy this: the submit control is gated on
      // onchain queueFunding authority, not on Operations route visibility.
      queueFundingAuthority: ["ProtocolSteward", "ModuleOwner"],
    },
  },
  recordFunding: {
    key: "funding",
    allowed: ["None", "Pledged"],
    next: "Pledged",
    requires: {
      pool: ["Open"],
      commitment: ["Offered"],
      settlementAccount: ["Active"],
    },
  },
  recordFundingDeposit: {
    key: "funding",
    allowed: ["Pledged"],
    next: "DepositRecorded",
    requires: { settlementAccount: ["Active"] },
  },
  consumeFunding: {
    key: "funding",
    allowed: ["DepositRecorded"],
    next: "Consumed",
    requires: {
      commitment: ["Accepted"],
      settlementAccount: ["Active"],
    },
  },
  queueFundingRefund: {
    key: "funding",
    allowed: ["Pledged", "DepositRecorded", "Consumed"],
    resultAllowed: ["Withdrawn", "RefundQueued"],
    effects: {
      disbursement: "Queued",
      disbursementKind: "Refund",
    },
    requires: { settlementAccount: ["Active"] },
  },
  createBatch: {
    key: "disbursement",
    allowed: ["Queued"],
    requires: { settlementAccount: ["Active"] },
    requiresWhen: [{
      when: { disbursementKind: "Funding", disbursementRoute: "ProtocolToGarden" },
      requires: { beneficiarySettlementAccount: ["Active"] },
    }],
  },
  dispatchDisbursement: {
    key: "disbursement",
    allowed: ["Queued"],
    next: "Dispatched",
    requires: { settlementAccount: ["Active"] },
    requiresWhen: [{
      when: { disbursementKind: "Funding", disbursementRoute: "ProtocolToGarden" },
      requires: { beneficiarySettlementAccount: ["Active"] },
    }],
  },
  dispatchBatch: {
    key: "disbursement",
    allowed: ["Queued"],
    next: "Dispatched",
    requires: { settlementAccount: ["Active"] },
    requiresWhen: [{
      when: { disbursementKind: "Funding", disbursementRoute: "ProtocolToGarden" },
      requires: { beneficiarySettlementAccount: ["Active"] },
    }],
  },
  retryCommand: { key: "disbursement", allowed: ["Dispatched"] },
  retryBatchCommand: { key: "disbursement", allowed: ["Dispatched"] },
  retryAcknowledgment: { key: "disbursement", allowed: ["Dispatched"] },
  cancelBatch: { key: "disbursement", allowed: ["Queued"], next: "Cancelled" },
  requeue: { key: "disbursement", allowed: ["Failed"], next: "Queued" },
  cancelDisbursement: { key: "disbursement", allowed: ["Queued", "Failed"], next: "Cancelled" },
};

function validateCalls(
  screen: Screen,
  stateId: string,
  facts: StateFacts | undefined,
  hid: string,
  calls: ContractCall[],
  targetFacts?: StateFacts,
  targetIsPending = false,
  resultFacts?: StateFacts,
) {
  const source: StateFacts = { ...facts };
  const current: StateFacts = { ...source };
  const touched = new Set<keyof StateFacts>();
  const changed = new Set<keyof StateFacts>();
  const consumedResults = new Set<keyof StateFacts>();
  for (const call of calls) {
    const rule = CALL_RULES[call];
    touched.add(rule.key);
    const value = current[rule.key];
    if (!value) {
      err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} lacks drawn ${rule.key} state metadata`);
      continue;
    }
    if (!rule.allowed.includes(value))
      err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} forbidden from ${rule.key} ${value} (allowed: ${rule.allowed.join(", ")})`);
    if (rule.kinds && (!current.kind || !rule.kinds.includes(current.kind)))
      err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} forbidden for kind ${current.kind ?? "<missing>"} (allowed: ${rule.kinds.join(", ")})`);
    for (const [requiredKey, allowed] of Object.entries(rule.requires ?? {}) as [FactKey, readonly string[]][]) {
      const requiredValue = current[requiredKey];
      if (!requiredValue || !allowed.includes(requiredValue))
        err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} requires ${requiredKey} ${allowed.join(" or ")}, drew ${requiredValue ?? "<missing>"}`);
    }
    for (const conditional of rule.requiresWhen ?? []) {
      const matches = Object.entries(conditional.when).every(
        ([factKey, expected]) => current[factKey as FactKey] === expected,
      );
      if (!matches) continue;
      for (const [requiredKey, allowed] of Object.entries(conditional.requires) as [FactKey, readonly string[]][]) {
        const requiredValue = current[requiredKey];
        if (!requiredValue || !allowed.includes(requiredValue))
          err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} requires ${requiredKey} ${allowed.join(" or ")} for ${Object.entries(conditional.when).map(([key, expected]) => `${key} ${expected}`).join(" and ")}, drew ${requiredValue ?? "<missing>"}`);
      }
    }
    if (rule.next) {
      (current as Record<string, string>)[rule.key] = rule.next;
      changed.add(rule.key);
    }
    for (const [effectKey, effectValue] of Object.entries(rule.effects ?? {}) as [FactKey, string][]) {
      (current as Record<string, string>)[effectKey] = effectValue;
      touched.add(effectKey);
      changed.add(effectKey);
    }
    if (rule.resultAllowed) {
      const result = resultFacts?.[rule.key];
      if (!result)
        err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} must declare resultFacts.${rule.key}`);
      else if (!rule.resultAllowed.includes(result))
        err.push(`CALL ${screen.id}@${stateId} ${hid}: ${call} cannot produce ${rule.key} ${result} (allowed: ${rule.resultAllowed.join(", ")})`);
      else {
        (current as Record<string, string>)[rule.key] = result;
        changed.add(rule.key);
      }
      consumedResults.add(rule.key);
    }
  }
  for (const resultKey of Object.keys(resultFacts ?? {}) as (keyof StateFacts)[])
    if (!consumedResults.has(resultKey))
      err.push(`CALL ${screen.id}@${stateId} ${hid}: resultFacts.${resultKey} does not belong to an outcome-dependent call`);
  // Compare the complete overlapping fact set, not only the entity a call
  // mutates. closeCycle/cancelCycle, for example, must preserve a Paused pool.
  // Queued targets compare against the pre-call source because the contract
  // effect has not landed yet. The explicit Paused confirmation/wizard variants
  // are regression fixtures for this preservation rule.
  const expected = targetIsPending ? source : current;
  for (const key of FACT_KEYS) {
    // A call can touch an entity without declaring a deterministic `next`
    // state (claimCommitment is derived by claim mode). In that case source
    // legality is validated, but the target value is intentionally not guessed.
    const comparable = targetIsPending || changed.has(key) || !touched.has(key);
    const targetValue = targetFacts?.[key];
    const expectedValue = expected[key];
    if (!comparable || !targetValue) continue;
    if (!expectedValue)
      err.push(
        `CALL ${screen.id}@${stateId} ${hid}: target introduces ${key} ${targetValue}, but no call produces it`,
      );
    else if (targetValue !== expectedValue)
      err.push(
        `CALL ${screen.id}@${stateId} ${hid}: target draws ${key} ${targetValue}, but ${
          targetIsPending ? "the queued transition preserves" : "calls produce"
        } ${expectedValue}`,
      );
  }
}

// One-row action-bar rule (2026-08-11 D7, uiux Appendix B addendum): a fixed
// flow bar carries at most ONE full-width button — an icon/short secondary may
// sit beside it, but two stacked full buttons are the exact regression the
// correction pass removed. Depth-aware so nested divs cannot truncate the scan.
function fbarBlocks(html: string): string[] {
  const blocks: string[] = [];
  const open = /<div class="fbar">/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(html))) {
    const tagRe = /<(\/?)div\b[^>]*>/g;
    tagRe.lastIndex = open.lastIndex;
    let depth = 1;
    let end = html.length;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(html))) {
      depth += t[1] === "/" ? -1 : 1;
      if (depth === 0) { end = t.index; break; }
    }
    blocks.push(html.slice(m.index + m[0].length, end));
  }
  return blocks;
}

function scanActionBars(screenId: string, stateId: string, html: string) {
  for (const block of fbarBlocks(html)) {
    const fulls = (block.match(/class="b [^"]*\bfull\b/g) ?? []).length;
    if (fulls > 1)
      err.push(`BAR ${screenId}@${stateId}: ${fulls} full-width buttons stacked in one action bar — one-row rule (2026-08-11 D7): one full-width primary, optional icon/short secondary; detours move into page content`);
  }
}

// data-hot / data-mark tokens actually present in one state's html
function domTokens(html: string) {
  const hots = new Set<string>();
  const marks = new Set<string>();
  for (const m of html.matchAll(/data-hot="([^"]*)"/g)) hots.add(m[1]);
  for (const m of html.matchAll(/data-mark="([^"]*)"/g)) for (const t of m[1].split(" ")) if (t) marks.add(t);
  return { hots, marks };
}

// Enabled buttons are commitments of interaction. A button is valid when it owns
// a hotspot or sits inside one; preview-only chrome must be honestly disabled.
// This small stack parser keeps the artifact build dependency-free.
function scanEnabledButtons(screenId: string, stateId: string, html: string, sink = err) {
  const stack: { tag: string; hot: boolean }[] = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)([^>]*)>/gi)) {
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attrs = match[3];
    if (closing) {
      while (stack.length) if (stack.pop()!.tag === tag) break;
      continue;
    }
    const ownsHot = /\bdata-hot\s*=/.test(attrs);
    if (tag === "button" && !/\bdisabled(?:\s|=|$)/.test(attrs) && !ownsHot && !stack.some((node) => node.hot)) {
      const label = stripTags(match.input.slice(match.index! + match[0].length).split("</button>", 1)[0]).trim().replace(/\s+/g, " ").slice(0, 48) || "icon button";
      sink.push(`CONTROL ${screenId}@${stateId}: enabled button "${label}" lacks data-hot`);
    }
    if (!voidTags.has(tag) && !/\/\s*$/.test(attrs)) stack.push({ tag, hot: ownsHot });
  }
}

function scanFormNames(screenId: string, stateId: string, html: string, sink = err) {
  for (const match of html.matchAll(/<(input|select)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    const labelledBy = attrs.match(/\baria-labelledby="([^"]+)"/)?.[1];
    const ariaLabel = attrs.match(/\baria-label="([^"]+)"/)?.[1];
    const hasFor = id ? html.includes(`for="${id}"`) : false;
    const hasLabelledBy = labelledBy ? labelledBy.split(/\s+/).every((labelId) => html.includes(`id="${labelId}"`)) : false;
    if (!ariaLabel && !hasFor && !hasLabelledBy) sink.push(`FORM ${screenId}@${stateId}: ${tag} lacks a visible programmatic label`);
  }
}

// ---- components-tab gallery scan (2026-08-14) -------------------------------
// The Components tab renders kit specimens outside the screen registry, so the
// per-state pipeline below never sees them. Same rules, new call site: the
// copy scans, the spec-citation guard, and the control/label discipline.
// Specimens draw their controls disabled and carry no hotspots — an enabled
// button here is a build error exactly as it is on a screen. `chromeText` is
// the tab's own annotation copy (entry titles, rules, drift notes): it shares
// the vocabulary/citation ceiling but hosts the tab's live copy-link buttons,
// so the control scan covers specimens only.
export function scanGalleryHtml(surface: "client" | "admin" | "editorial", html: string, chromeText = ""): string[] {
  const sink: string[] = [];
  const where = `COMPONENTS ${surface}`;
  const text = `${stripTags(html)} ${chromeText}`;
  scanEverywhere(where, text, sink);
  const cite = text.match(/\b(?:CS|UX|AM|SS|WF|DG|LAP|CI-WF|CI-SPEC):\s?\d+|register #\d+|\bMF-\d+\b/);
  if (cite) sink.push(`META ${where}: spec citation "${cite[0]}" rendered as gallery copy`);
  // The invariant is Appendix D.1 — never aggregate incommensurable unit bases.
  // The tripwire guards its two RENDERED shapes: a percentage over units
  // ("62% of committed units") and a bare cross-commitment total ("18 units
  // committed"). A single commitment's own reserved units are one basis, so
  // "cancelling releases the committed units" is legitimate and must not trip —
  // it did, once the 2026-08-17 vocabulary sweep made the guarded phrasing real.
  // Before that sweep this rule was BLIND: it looked for "promised units", which
  // no surface had ever rendered. Historical spellings stay in the pattern so a
  // reintroduced old phrasing is still caught.
  const pct = text.match(/%\s*of\s+(?:committed|promised)|\d+\s+units\s+(?:committed|promised)/i);
  if (pct) sink.push(`AGGREGATE ${where}: "${pct[0]}" is a mixed-unit percentage`);
  if (surface === "client" || surface === "editorial") {
    for (const [re, name] of BANNED_CLIENT_PUBLIC) if (re.test(text)) sink.push(`VOCAB ${where}: "${name}"`);
  }
  if (surface === "admin") {
    for (const [re, name] of ADMIN_HERO) if (re.test(text)) sink.push(`VOCAB ${where}: ${name}`);
  }
  if (/data-hot=/.test(html)) sink.push(`GALLERY ${where}: specimens must not carry data-hot`);
  scanEnabledButtons("COMPONENTS", surface, html, sink);
  scanFormNames("COMPONENTS", surface, html, sink);
  return sink;
}

// ---- copy scans -------------------------------------------------------------
const BANNED_EVERYWHERE: [RegExp, string][] = [
  [/\bstreaks?\b/i, "streak"],
  [/\bcountdowns?\b/i, "countdown"],
  [/\bleaderboards?\b/i, "leaderboard"],
  [/\bFOMO\b/i, "FOMO"],
  [/\burgent(ly)?\b/i, "urgent"],
  [/\blimited[- ]time\b/i, "limited time"],
  [/\bre-?engagement\b/i, "re-engagement"],
  [/\bretention hooks?\b/i, "retention hook"],
  [/\bdebts?\b/i, "debt"],
  [/\bowes?d?\b/i, "owe/owed"],
  [/\boperators?\b/i, "operator (steward rule, Decision Log #28c)"],
];
// RETIRED VOCABULARY — words a decision took out of the product, guarded so a
// later edit cannot quietly bring one back.
//
// This exists because every vocabulary decision in this feature leaked a
// dialect. The promise→commitment rename was recorded as done and left "nobody
// can commitment yet" standing in the console for three weeks. "Places" was
// retired in the client and survived in W7's ongoing rows. "neighbour" was
// fixed in the client while `poolHoldings` kept defaulting to the American
// spelling, so BOTH dialects rendered it. The build gates catch structure well
// and copy not at all; this closes that.
//
// Each entry names the decision that retired it, so whoever trips the gate can
// read why rather than guess. Patterns are deliberately narrow: they guard the
// RETIRED SENSE, not the word. "in place", "takes place" and "an open request"
// are all legitimate and must not trip.
const RETIRED_VOCABULARY: [RegExp, string][] = [
  // C.14 (round 14): the record is a Commitment everywhere.
  [/\bpromis(?:e|es|ed|ing)\b/i, 'promise — the record is a "commitment" (C.14)'],
  // …and the verb is "commit". This exact breakage shipped twice, from a noun
  // sweep that rewrote verbs it should have left alone.
  [/\b(?:can|cannot|could|would|will|must|may|to)\s+commitment\b/i, 'commitment used as a VERB — say "commit" (C.14)'],
  [/\bcommitmentd\b|\bcommitmenting\b/i, 'a verb mangled into "commitment" (C.14)'],
  // C.23 (round 30) + C.35: a "place" was a second name for a commitment, and
  // the act of making another is OFFERING, not opening.
  [/\b\d+\s+places?\b|\bplaces?\s+(?:made|available|to start|left)\b|\b(?:open|add|each|new|existing|available)\s+places?\b/i,
    'place — each one is a "commitment" (C.23)'],
  [/\bopen (?:more|another)\b/i, 'open as the ACT — say "offer another" (C.35)'],
  // C.36: the client says neighbour; poolHoldings defaulted to the other.
  [/\bneighbor(?!u)/i, 'neighbor — the client spells it "neighbour" (C.36)'],
  // C.27: rest and retire collapsed into one act.
  [/\b(?:rest it|resting|retire it|retired)\b(?=[^.]*\boffer\b)/i,
    'rest/retire — an ongoing offer is "stopped" (C.27)'],
  // The same word survived on the admin cycle-close wizard, where step 4 was
  // "Rest the cycle" (round 46). The C.27 rule missed it because that pattern
  // requires "offer" nearby. This one guards rest as a LIFECYCLE VERB against
  // the four things that have one, so "the rest of the list" stays legal.
  [/\brest(?:ing)?\s+(?:the\s+|this\s+)?(?:cycle|season|campaign|pool)\b/i,
    'rest — a cycle is composted (compostCycle, CS:206); an ongoing offer is stopped (C.27 · C.48)'],
];
// Retired only in PRODUCT copy. `attachEvidence` and `EvidenceAttached` are
// contract identifiers and belong in hotspot notes, the same way leadProvider
// does; it is the gardener-facing noun that changed (C.38).
const RETIRED_IN_UI: [RegExp, string][] = [
  [/\bevidence\b/i, 'evidence — gardeners see "proof" (C.38)'],
];

const BANNED_CLIENT_PUBLIC: [RegExp, string][] = [
  [/\bdisputes?d?\b/i, 'dispute ("under review by stewards" is the ceiling)'],
  [/\blegal\b/i, "legal"],
];
/** Card descriptions stay one scannable sentence — see the DESC check below. */
const DESC_MAX = 190;
const ADMIN_HERO: [RegExp, string][] = [
  [/congratulations|celebrat|amazing|awesome|🎉/i, "admin hero language (quiet checkmark rule)"],
];

// The contract's reason-taking confirmable acts (CS:795 + pausePool CS:725,
// cancelCycle CS:104, cancelDisbursement/cancelBatch SS:297-298). Enforced in
// BOTH directions: a confirm for one of these must show the reason field, and a
// confirm for anything else must NOT invent one — a required reason on
// closePool (which takes none, CS:556) is how the artifact once taught a
// signature that does not exist. Extend this set from the contract spec when a
// new reason-taking confirmation is drawn.
const REASON_CONFIRMS = new Set([
  "pause-confirm", "cancel-cycle-confirm", "paused-cancel-cycle-confirm", "decline-claim-confirm",
  "fallback-confirm", "protocol-fallback-confirm", "cancel-batch-confirm", "close-delivery-confirm",
  "cancel-queued-confirm",
  "withdraw-confirm", // cancelCommitment(commitmentId, reasonCID) — creator path
]);

function scanEverywhere(where: string, text: string, sink = err, opts: { docs?: boolean } = {}) {
  for (const [re, name] of BANNED_EVERYWHERE) if (re.test(text)) sink.push(`VOCAB ${where}: "${name}"`);
  // Retired vocabulary is an error on every surface, including the ascii
  // frames: a word a decision removed is removed everywhere or it is not
  // removed. The match is quoted back so the fix is obvious from the message.
  for (const [re, why] of RETIRED_VOCABULARY) {
    const hit = text.match(re);
    if (hit) sink.push(`RETIRED ${where}: "${hit[0].trim()}" — ${why}`);
  }
  // Em-dashes leave PRODUCT copy: plainer punctuation translates (C.32, C.36).
  // Hotspot notes and journey prose are exempt by that same decision — they are
  // written for whoever is reading the artifact, a different register from the
  // UI — so `docs` skips this while still enforcing retired vocabulary above.
  // A dash that NAMES a variant is not punctuation, so those are listed rather
  // than pattern-matched: adding one is a deliberate act.
  if (opts.docs) return;
  for (const [re, why] of RETIRED_IN_UI) {
    const hit = text.match(re);
    if (hit) sink.push(`RETIRED ${where}: "${hit[0].trim()}" — ${why}`);
  }
  // Every occurrence, not the first: one-at-a-time reporting turns a copy sweep
  // into a dozen rebuild cycles.
  const cleaned = text.replace(/North beds — (?:before|after)/g, "");
  for (const d of new Set([...cleaned.matchAll(/[^\n]{0,30}—[^\n]{0,30}/g)].map((m) => m[0].trim())))
    sink.push(`DASH ${where}: "${d}" needs a full stop or a comma (C.32)`);
}

function scanState(screen: Screen, stateId: string, html: string, sept: boolean) {
  const sink = screen.frame === "ascii" ? warn : err;
  const where = `${screen.id}@${stateId}`;
  if (html.length < (screen.frame === "ascii" ? 40 : 200)) err.push(`RENDER ${where}: suspiciously empty (${html.length} chars)`);
  for (const bad of ["undefined", "[object ", "NaN"]) {
    if (stripTags(html).includes(bad)) err.push(`RENDER ${where}: contains "${bad}"`);
  }
  if (screen.frame === "phone") {
    const viewportContract = `class="scr" data-viewport-width="${PHONE_VIEWPORT_WIDTH}" data-viewport-height="${PHONE_VIEWPORT_HEIGHT}"`;
    if (!html.includes('class="phonefit"'))
      err.push(`FRAME ${where}: phone is missing its uniform-fit wrapper`);
    if (!html.includes(viewportContract))
      err.push(`FRAME ${where}: phone must declare a ${PHONE_VIEWPORT_WIDTH}×${PHONE_VIEWPORT_HEIGHT} logical viewport`);
  }
  const text = stripTags(html);
  // Core vocabulary is never warn-only: ASCII and September previews are still
  // rendered copy and must use the same mutual-aid language.
  scanEverywhere(where, text);

  // Spec citations, register numbers, and MF ids are review metadata. The
  // artifact already has a home for them — the per-scene implementation notes
  // below the stage — and rendering them inside a device frame at the same
  // hierarchy as UI copy is why reviewers cannot tell design from commentary.
  const cite = text.match(/\b(?:CS|UX|AM|SS|WF|DG|LAP|CI-WF|CI-SPEC):\s?\d+|register #\d+|\bMF-\d+\b/);
  if (cite) err.push(`META ${where}: spec citation "${cite[0]}" rendered as product copy`);

  // Tripwire for the removed synthetic cross-commitment percentage sites
  // (uiux-spec §5.2/§12) — it guards these exact phrasings, not the invariant;
  // a rephrased mixed-unit rate ("62% of units") still needs a reviewer's eye.
  // promiseKeptRate is the one sanctioned rate and reads as "N of M kept".
  // The invariant is Appendix D.1 — never aggregate incommensurable unit bases.
  // The tripwire guards its two RENDERED shapes: a percentage over units
  // ("62% of committed units") and a bare cross-commitment total ("18 units
  // committed"). A single commitment's own reserved units are one basis, so
  // "cancelling releases the committed units" is legitimate and must not trip —
  // it did, once the 2026-08-17 vocabulary sweep made the guarded phrasing real.
  // Before that sweep this rule was BLIND: it looked for "promised units", which
  // no surface had ever rendered. Historical spellings stay in the pattern so a
  // reintroduced old phrasing is still caught.
  const pct = text.match(/%\s*of\s+(?:committed|promised)|\d+\s+units\s+(?:committed|promised)/i);
  if (pct) err.push(`AGGREGATE ${where}: "${pct[0]}" is a mixed-unit percentage`);

  if (sept) return; // another spec owns the remaining dialect-specific copy
  // Member-facing surfaces (the PWA and the public website) share one ceiling:
  // never "dispute", never "legal". Renaming the editorial surface without this
  // line is silent — the scan would simply stop covering W15/W16.
  if (screen.surface === "client" || screen.surface === "editorial") {
    for (const [re, name] of BANNED_CLIENT_PUBLIC) if (re.test(text)) sink.push(`VOCAB ${where}: "${name}"`);
  }
  if (screen.surface === "admin") {
    for (const [re, name] of ADMIN_HERO) if (re.test(text)) sink.push(`VOCAB ${where}: ${name}`);
  }
  // Chain phrasing placement: detail engage layer only (W2), plus the consoles
  // that legitimately surface refs behind their Details disclosures.
  if (screen.surface === "client" && !["W2", "W22", "W24"].includes(screen.id)) {
    if (/recorded on arbitrum/i.test(text)) sink.push(`CHAIN ${where}: "recorded on Arbitrum" outside W2`);
    if (/\b(arbitrum|celo)\b/i.test(text) && !["W23", "W23G", "W21"].includes(screen.id))
      sink.push(`CHAIN ${where}: chain name outside detail/settlement surfaces`);
  }
}

// ---- normalization ----------------------------------------------------------
export function normalizeAndValidate(raw: RawSB[], ctx: Ctx): { sbs: ShippedSB[]; errors: string[]; warnings: string[] } {
  const byId = new Map(ctx.screens.map((s) => [s.id, s]));

  const stateTokens = new Map<string, ReturnType<typeof domTokens>>();
  for (const s of ctx.screens) {
    for (const st of s.states) stateTokens.set(`${s.id}@${st.id}`, domTokens(st.html));
  }

  const resolveScreen = (ref: string, where: string): { screen: Screen; state: string } | null => {
    const [sid0, v0] = ref.split("@");
    const target = ctx.aliases[sid0] ?? sid0;
    const [sid, vAlias] = target.split("@");
    const screen = byId.get(sid);
    if (!screen) {
      err.push(`SCREEN ${ref} missing (${where})`);
      return null;
    }
    const v = v0 || vAlias || screen.states[0].id;
    if (!screen.states.some((s) => s.id === v)) {
      err.push(`STATE ${sid}@${v} missing (${where})`);
      return null;
    }
    return { screen, state: v };
  };

  const validTo = (to: string | undefined, where: string): string | undefined => {
    if (!to) return undefined;
    let t = to;
    if (t.startsWith("frame:")) t = `screen:${t.slice(6)}`; // legacy prefix
    if (t.startsWith("screen:")) {
      const r = resolveScreen(t.slice(7), where);
      return r ? `screen:${r.screen.id}${r.state !== r.screen.states[0].id ? "@" + r.state : ""}` : t;
    }
    const [tid, tix] = t.split(":");
    const sb = raw.find((x) => x.id === tid);
    if (!sb || +tix >= sb.steps.length) err.push(`TARGET ${to} invalid (${where})`);
    return t;
  };

  const resolveHot = (sc: Scene, h: { m: string; l: string } | { h: string; l?: string }, where: string, sid: string): { h: string; l: string } | null => {
    if ("h" in h) {
      if (!ctx.screenHots[sid]?.has(h.h)) {
        err.push(`HOT ID ${h.h} not registered on ${sid} (${where})`);
        return null;
      }
      return { h: h.h, l: h.l ?? ctx.hots[h.h]?.l ?? h.h };
    }
    const hid = ctx.tables.hotByString[sid]?.[h.m];
    if (!hid) {
      const screen = byId.get(sid);
      const hint = screen && screen.frame !== "ascii" ? " — screen is hi-fi; rewire this step to hotspot ids" : "";
      err.push(`HOT MISS "${h.m}" ∉ ${sid}${hint} (${where})`);
      return null;
    }
    return { h: hid, l: h.l };
  };

  const sbs: ShippedSB[] = raw.map((sb) => ({
    id: sb.id,
    n: sb.n,
    title: sb.title,
    desc: sb.desc,
    persona: sb.persona,
    reviewVisible: sb.reviewVisible,
    reviewGroup: sb.reviewGroup,
    chapter: sb.chapter,
    roles: sb.roles,
    steps: sb.steps.map((sc, ix): ShippedStep => {
      const where = `${sb.id}:${ix}`;
      const r = resolveScreen(sc.f, where);
      const sid = r?.screen.id ?? sc.f.split("@")[0];
      const v = r?.state ?? "default";
      const tokens = stateTokens.get(`${sid}@${v}`);

      const hot = sc.hot ? resolveHot(sc, sc.hot, where, sid) : null;
      if (hot && tokens && !tokens.hots.has(hot.h)) err.push(`HOT ${hot.h} ∉ render ${sid}@${v} (${where})`);

      const alts = (sc.alts ?? []).flatMap((a) => {
        const ah = resolveHot(sc, a, where, sid);
        const to = validTo(a.to, where);
        if (!ah || !to) return [];
        if (tokens && !tokens.hots.has(ah.h)) err.push(`ALT ${ah.h} ∉ render ${sid}@${v} (${where})`);
        return [{ h: ah.h, l: ah.l ?? ctx.hots[ah.h]?.l ?? ah.h, to }];
      });

      const marks = (sc.marks ?? []).flatMap((mk) => {
        const mid = ctx.tables.markByString[sid]?.[mk] ?? (ctx.screenHots[sid]?.has(mk) || ctx.screenMarks[sid]?.has(mk) ? mk : undefined);
        if (!mid) {
          err.push(`MARK MISS "${mk}" ∉ ${sid} (${where})`);
          return [];
        }
        if (tokens && !tokens.hots.has(mid) && !tokens.marks.has(mid)) err.push(`MARK ${mid} ∉ render ${sid}@${v} (${where})`);
        return [mid];
      });

      const br = (sc.br ?? []).flatMap((b) => {
        const to = validTo(b.to, where);
        if (!to) {
          err.push(`BRANCH "${b.l}" lacks a target (${where})`);
          return [];
        }
        return [{ l: b.l, to }];
      });
      return { f: sid, v, hot, alts, marks, who: sc.who, surface: sc.surface, echo: sc.echo, st: sc.st, ev: sc.ev, cite: sc.cite, note: sc.note, skipTargetReason: sc.skipTargetReason, br, mf: sc.mf };
    }),
  }));

  // Journey chrome, step annotations, branch labels, and hotspot inspector copy
  // are all rendered UI too; scan them rather than limiting vocabulary checks
  // to the screen-state HTML.
  for (const sb of raw) {
    const text = [sb.title, sb.desc, sb.persona, sb.scen, ...sb.steps.flatMap((sc) => [
      sc.who, sc.surface, sc.st, sc.ev, sc.note, sc.hot?.l,
      ...(sc.alts ?? []).map((a) => a.l),
      ...(sc.br ?? []).map((b) => b.l),
    ])].filter(Boolean).join(" ");
    scanEverywhere(`JOURNEY ${sb.id}`, text, err, { docs: true });
  }
  for (const [hid, meta] of Object.entries(ctx.hots))
    scanEverywhere(`HOT ${hid}`, [meta.l, meta.info].filter(Boolean).join(" "), err, { docs: true });

  // hotspot meta targets
  for (const [hid, meta] of Object.entries(ctx.hots)) {
    const fixed = validTo(meta.to, `hot ${hid}`);
    if (fixed) meta.to = fixed;
  }

  // A primary journey hotspot with a screen destination must show that state
  // immediately next. This prevents the player from concealing consequential
  // UI just because it can intercept the click. Deliberate exceptions require
  // a specific, reviewable reason on the source scene.
  for (const sb of sbs) {
    const rawSb = raw.find((candidate) => candidate.id === sb.id)!;
    for (let ix = 0; ix < sb.steps.length; ix++) {
      const step = sb.steps[ix];
      if (!step.hot) continue;
      const target = ctx.hots[step.hot.h]?.to;
      if (!target?.startsWith("screen:")) continue;
      const next = sb.steps[ix + 1];
      const targetRef = target.slice(7);
      const actualRef = next
        ? `${next.f}${next.v !== byId.get(next.f)?.states[0].id ? "@" + next.v : ""}`
        : "<journey end>";
      if (actualRef === targetRef) continue;
      const reason = rawSb.steps[ix].skipTargetReason?.trim();
      if (!reason) err.push(`DESTINATION ${sb.id}:${ix} ${step.hot.h} → ${targetRef}, next is ${actualRef}; add the destination scene or skipTargetReason`);
    }
  }
  // Scene surfaces were free text, so a typo ("pwa " / "Admin") silently fell
  // back to the flow's home and the stagebar pill quietly lied. The echo pair
  // is checked BOTH ways: a marked echo must actually be off-home, and any
  // off-home scene must be marked — the second direction is what retro-catches
  // a flow that silently shows another surface without saying so.
  for (const sb of sbs) {
    sb.steps.forEach((step, ix) => {
      if (step.surface && !(SCENE_SURFACES as readonly string[]).includes(step.surface))
        err.push(`SURFACE ${sb.id}:${ix} unknown surface token "${step.surface}"`);
      if (!sb.reviewVisible) return; // hidden previews own their own dialect
      const home = HOME_SURFACE[sb.reviewGroup];
      const eff = step.surface ?? home;
      if (step.echo && eff === home)
        err.push(`ECHO ${sb.id}:${ix} marked echo but sits on the flow's home surface (${home})`);
      if (!step.echo && eff !== home)
        err.push(`SURFACE ${sb.id}:${ix} off-home scene (${eff}) must be marked echo`);
      // Echoes are read-only consequences (decision 2026-08-10): the moment
      // another role must ACT on another surface, the flow ends at a waiting
      // state and hands off via a branch link — it never drives the other seat.
      if (step.echo && (step.hot || step.alts.length))
        err.push(`ECHO ${sb.id}:${ix} carries an advancing control — echoes are read-only; end the flow and hand off instead`);
    });
  }

  // Chapter and role integrity. Chapters/roles are renameable data arrays in
  // types.ts — the build checks references, never names or counts (2026-08-10).
  for (const sb of raw) {
    const chapters = CHAPTERS[sb.reviewGroup] ?? [];
    if (!chapters.some((chapter) => chapter.id === sb.chapter))
      err.push(`CHAPTER ${sb.id}: "${sb.chapter}" is not a chapter of group "${sb.reviewGroup}"`);
    // Every card is title → description → tags (Afo, D3). The description is
    // the part a reviewer reads to choose a flow, so an empty one is a broken
    // card, and an essay is one that stops being scannable in a two-column grid.
    const desc = sb.desc?.trim() ?? "";
    if (!desc) err.push(`DESC ${sb.id}: flow cards need a description line`);
    else if (desc.length > DESC_MAX) err.push(`DESC ${sb.id}: ${desc.length} chars — keep card descriptions under ${DESC_MAX}`);
    if (!sb.roles.length)
      err.push(`ROLES ${sb.id}: at least one acting role is required`);
    for (const role of sb.roles)
      if (!ROLES.some((known) => known.id === role))
        err.push(`ROLES ${sb.id}: unknown role "${role}"`);
  }

  // Retired journey routes (2026-08-11 D3). The redirect map is only worth
  // shipping if it cannot lie: a source that shadows a live scene would hide
  // real content behind a redirect, and a target that no longer resolves sends
  // a reviewer somewhere worse than the clamp it was meant to fix.
  const sceneCount = (id: string) => raw.find((sb) => sb.id === id)?.steps.length;
  const parseRoute = (route: string) => {
    const m = route.match(/^(sb[\w-]+)\/(\d+)$/);
    return m ? { id: m[1], ix: Number(m[2]) } : null;
  };
  for (const [from, to] of Object.entries(SB_ROUTE_ALIASES)) {
    const src = parseRoute(from);
    const dst = parseRoute(to);
    if (!src) err.push(`ROUTE alias "${from}" is not an sbID/index route`);
    else if (src.ix < (sceneCount(src.id) ?? 0))
      err.push(`ROUTE alias "${from}" shadows a live scene — a real route must win over a redirect`);
    if (!dst) err.push(`ROUTE alias "${from}" → "${to}" is not an sbID/index route`);
    else if (dst.ix >= (sceneCount(dst.id) ?? 0))
      err.push(`ROUTE alias "${from}" → "${to}" does not resolve (flow missing or scene index out of range)`);
  }

  // Entry-surface rule (2026-08-11 D1): every review-visible flow's FIRST scene
  // is the surface its actor actually enters from — never a mid-app state. The
  // allowed sets are the drawn home surfaces per group: the client enters via
  // the pool tab, the wallet drawer, or the Garden-tab work flow; admin flows
  // enter at their consoles; editorial at its public pages.
  // Admin tightened 2026-08-16 (interaction-patterns §3): flows enter at TRUE
  // console homes — workspace routes — never inside a dialog or wizard (W8, W9,
  // W10, and W14 are flow/dialog surfaces and left the set).
  const ALLOWED_ENTRY: Record<string, readonly string[]> = {
    client: ["W1", "W5", "WFLOW"],
    admin: ["W7", "W7M", "W12", "W13", "W21", "W22", "W24", "HUBWORK"],
    editorial: ["W15", "W16"],
  };
  for (const sb of sbs) {
    if (!sb.reviewVisible) continue;
    const first = sb.steps[0];
    const allowed = ALLOWED_ENTRY[sb.reviewGroup] ?? [];
    if (first && !allowed.includes(first.f))
      err.push(`ENTRY ${sb.id}: first scene ${first.f}@${first.v} is not a drawn home surface for ${sb.reviewGroup} (allowed: ${allowed.join(", ")})`);
  }

  // alias targets
  for (const [from, to] of Object.entries(ctx.aliases)) resolveScreen(to, `alias ${from}`);

  // per-state renders + bidirectional integrity + copy scans
  const emitted = new Set<string>();
  for (const s of ctx.screens) {
    const sept = s.group.includes("September");
    for (const st of s.states) {
      scanState(s, st.id, st.html, sept);
      scanEnabledButtons(s.id, st.id, st.html);
      scanFormNames(s.id, st.id, st.html);
      scanActionBars(s.id, st.id, st.html);
      const t = domTokens(st.html);
      for (const h of t.hots) {
        emitted.add(h);
        if (!ctx.screenHots[s.id]?.has(h)) err.push(`EMITTED ${h} unregistered on ${s.id}@${st.id}`);
        const meta = ctx.hots[h];
        if (meta?.calls?.length) {
          let targetFacts: StateFacts | undefined;
          if (meta.to?.startsWith("screen:")) {
            const target = resolveScreen(meta.to.slice(7), `call target ${h}`);
            targetFacts = target?.screen.states.find((candidate) => candidate.id === target.state)?.facts;
          }
          validateCalls(
            s,
            st.id,
            { ...st.facts, ...meta.facts },
            h,
            meta.calls,
            targetFacts,
            !!meta.pendingSync,
            meta.resultFacts,
          );
        }
      }
    }
    for (const h of ctx.screenHots[s.id] ?? []) {
      if (!s.states.some((st) => domTokens(st.html).hots.has(h))) err.push(`ORPHAN hotspot ${h}: registered on ${s.id} but emitted in no state`);
    }
    // Rail stability (2026-08-16, admin prototype review): a flow dialog's
    // step rail is declared once per flow and never changes mid-flow. Flows
    // are grouped by their dialog title within a screen (W8 legitimately
    // hosts both the seed and capture flows); every state sharing a title
    // must render the identical ordered step-label list. W11 once swapped a
    // one-item "Policy" rail into the same chrome — the regression this locks.
    {
      const railsByFlow = new Map<string, { labels: string; state: string }>();
      for (const st of s.states) {
        const title = st.html.match(/id="flow-dialog-title">([^<]*)</)?.[1];
        if (!title) continue;
        const labels = [...st.html.matchAll(/<span class="st">([^<]*)<\/span>/g)].map((m) => m[1]).join(" · ");
        const seen = railsByFlow.get(title);
        if (!seen) railsByFlow.set(title, { labels, state: st.id });
        else if (seen.labels !== labels)
          err.push(`RAIL ${s.id}@${st.id}: flow "${title}" renders steps [${labels}] but @${seen.state} renders [${seen.labels}] — a flow's rail never changes mid-flow`);
      }
    }
    // A commitment whose state chip reads Fulfilled is done; offering evidence
    // attach there contradicts both the chip and §5.3, which gates attach to
    // Active / EvidenceSubmitted / PartiallyApproved. Scoped to the CHIP
    // markup (kit chip(), tone ok) so a greyed future "Fulfilled" stage label
    // on an Active timeline — legitimate UI — can never trip it.
    for (const st of s.states) {
      if (!domTokens(st.html).hots.has("w2.add-evidence")) continue;
      if (/class="ch ok(?: dot)?"[^>]*>Fulfilled</.test(st.html))
        err.push(`STATE ${s.id}@${st.id}: evidence attach offered on a Fulfilled commitment`);
    }
    for (const st of s.states) {
      const text = stripTags(st.html);
      // A confirmation exists to take the reason the contract stores — and only
      // that reason. Both directions checked against REASON_CONFIRMS above.
      if (st.id.endsWith("-confirm")) {
        const hasReason = /Reason \(required\)/.test(text);
        if (REASON_CONFIRMS.has(st.id) && !hasReason)
          err.push(`CONFIRM ${s.id}@${st.id}: confirmation without its contract-required reason field`);
        if (!REASON_CONFIRMS.has(st.id) && hasReason)
          err.push(`CONFIRM ${s.id}@${st.id}: reason field on an act whose contract call takes no reason`);
      }
      // Pre-acceptance states cannot carry post-acceptance history: a shared
      // fixture body once showed "Accepted — João took this up" on an offer
      // nobody had claimed. Deliberately a whole-text word match — the locked
      // design keeps pre-acceptance detail to ONE timeline moment, so even a
      // future-stage "Accepted" label is out of bounds here.
      if ((st.id === "offered" || st.id === "requested") && /\bAccepted\b/.test(text))
        err.push(`STATE ${s.id}@${st.id}: pre-acceptance state shows an Accepted moment`);
    }
  }

  return { sbs, errors: err, warnings: warn };
}
