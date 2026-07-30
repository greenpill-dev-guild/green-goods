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

import type { SB as RawSB, Scene } from "./journeys";
import { PHONE_VIEWPORT_HEIGHT, PHONE_VIEWPORT_WIDTH } from "./tokens";
import { HOME_SURFACE, SCENE_SURFACES } from "./types";
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
  | "pool" | "cycle" | "cycleLiveCommitments" | "commitment"
  | "settlementAccount" | "beneficiarySettlementAccount" | "disbursement" | "payoutPlan";
const FACT_KEYS = [
  "pool", "cycle", "cycleLiveCommitments", "commitment", "kind", "settlementAccount", "beneficiarySettlementAccount", "disbursement", "payoutPlan",
] as const satisfies readonly (keyof StateFacts)[];
type CallRule = {
  key: FactKey;
  allowed: readonly string[];
  next?: string;
  effects?: Partial<Record<FactKey, string>>;
  kinds?: readonly string[];
  requires?: Partial<Record<FactKey, readonly string[]>>;
  resultAllowed?: readonly string[];
};

// Contract-spec lifecycle gates, expressed once and applied to every emitted
// hotspot that names a call. Calls run in order, so compound controls cannot
// hide an illegal second act behind legal first-act copy.
const CALL_RULES: Record<ContractCall, CallRule> = {
  createCommitment: { key: "pool", allowed: ["Open"] },
  claimCommitment: { key: "commitment", allowed: ["Offered", "Requested"] },
  acceptClaim: { key: "commitment", allowed: ["Offered", "Requested"], next: "Accepted" },
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
  raiseDispute: { key: "commitment", allowed: ["Accepted", "Active", "EvidenceSubmitted", "PartiallyApproved", "ReadyForConfirmation", "Expired"], next: "Disputed" },
  resolveDispute: {
    key: "commitment",
    allowed: ["Disputed"],
    resultAllowed: ["Accepted", "ReadyForConfirmation", "Fulfilled", "Cancelled", "Expired"],
  },
  recordRewardPaid: { key: "commitment", allowed: ["Fulfilled"] },
  markPoolReady: { key: "pool", allowed: ["NotReady"], next: "Ready" },
  openPool: { key: "pool", allowed: ["Ready"], next: "Open" },
  pausePool: { key: "pool", allowed: ["Open"], next: "Paused" },
  resumePool: { key: "pool", allowed: ["Paused"], next: "Open" },
  closePool: { key: "pool", allowed: ["Open", "Paused"], next: "Closed" },
  compostPool: { key: "pool", allowed: ["Closed"], next: "Composted" },
  reopenPool: { key: "pool", allowed: ["Composted"], next: "Ready" },
  seedCycle: { key: "pool", allowed: ["Ready", "Open"], effects: { cycle: "Seeded" } },
  openCycle: { key: "cycle", allowed: ["Seeded"], next: "Open", requires: { pool: ["Open"] } },
  closeCycle: { key: "cycle", allowed: ["Open"], next: "Reconciled", requires: { cycleLiveCommitments: ["Zero"] } },
  compostCycle: { key: "cycle", allowed: ["Reconciled"], next: "Composted" },
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
  createBatch: { key: "disbursement", allowed: ["Queued"] },
  dispatchDisbursement: { key: "disbursement", allowed: ["Queued"], next: "Dispatched" },
  dispatchBatch: { key: "disbursement", allowed: ["Queued"], next: "Dispatched" },
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

// data-hot / data-mark tokens actually present in one state's html
function domTokens(html: string) {
  const hots = new Set<string>();
  const marks = new Set<string>();
  for (const m of html.matchAll(/data-hot="([^"]*)"/g)) hots.add(m[1]);
  for (const m of html.matchAll(/data-mark="([^"]*)"/g)) for (const t of m[1].split(" ")) if (t) marks.add(t);
  return { hots, marks };
}

// Enabled buttons are promises of interaction. A button is valid when it owns
// a hotspot or sits inside one; preview-only chrome must be honestly disabled.
// This small stack parser keeps the artifact build dependency-free.
function scanEnabledButtons(screenId: string, stateId: string, html: string) {
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
      err.push(`CONTROL ${screenId}@${stateId}: enabled button "${label}" lacks data-hot`);
    }
    if (!voidTags.has(tag) && !/\/\s*$/.test(attrs)) stack.push({ tag, hot: ownsHot });
  }
}

function scanFormNames(screenId: string, stateId: string, html: string) {
  for (const match of html.matchAll(/<(input|select)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    const labelledBy = attrs.match(/\baria-labelledby="([^"]+)"/)?.[1];
    const ariaLabel = attrs.match(/\baria-label="([^"]+)"/)?.[1];
    const hasFor = id ? html.includes(`for="${id}"`) : false;
    const hasLabelledBy = labelledBy ? labelledBy.split(/\s+/).every((labelId) => html.includes(`id="${labelId}"`)) : false;
    if (!ariaLabel && !hasFor && !hasLabelledBy) err.push(`FORM ${screenId}@${stateId}: ${tag} lacks a visible programmatic label`);
  }
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
const BANNED_CLIENT_PUBLIC: [RegExp, string][] = [
  [/\bdisputes?d?\b/i, 'dispute ("under review by stewards" is the ceiling)'],
  [/\blegal\b/i, "legal"],
];
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
  "fallback-confirm", "cancel-batch-confirm", "close-delivery-confirm",
  "cancel-queued-confirm",
  "withdraw-confirm", // cancelCommitment(commitmentId, reasonCID) — creator path
]);

function scanEverywhere(where: string, text: string, sink = err) {
  for (const [re, name] of BANNED_EVERYWHERE) if (re.test(text)) sink.push(`VOCAB ${where}: "${name}"`);
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
  const pct = text.match(/promised units|% of promised/i);
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
    persona: sb.persona,
    reviewVisible: sb.reviewVisible,
    reviewGroup: sb.reviewGroup,
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
    const text = [sb.title, sb.persona, sb.scen, ...sb.steps.flatMap((sc) => [
      sc.who, sc.surface, sc.st, sc.ev, sc.note, sc.hot?.l,
      ...(sc.alts ?? []).map((a) => a.l),
      ...(sc.br ?? []).map((b) => b.l),
    ])].filter(Boolean).join(" ");
    scanEverywhere(`JOURNEY ${sb.id}`, text);
  }
  for (const [hid, meta] of Object.entries(ctx.hots)) scanEverywhere(`HOT ${hid}`, [meta.l, meta.info].filter(Boolean).join(" "));

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
    });
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
    // A promise whose state chip reads Fulfilled is done; offering evidence
    // attach there contradicts both the chip and §5.3, which gates attach to
    // Active / EvidenceSubmitted / PartiallyApproved. Scoped to the CHIP
    // markup (kit chip(), tone ok) so a greyed future "Fulfilled" stage label
    // on an Active timeline — legitimate UI — can never trip it.
    for (const st of s.states) {
      if (!domTokens(st.html).hots.has("w2.add-evidence")) continue;
      if (/class="ch ok(?: dot)?"[^>]*>Fulfilled</.test(st.html))
        err.push(`STATE ${s.id}@${st.id}: evidence attach offered on a Fulfilled promise`);
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
