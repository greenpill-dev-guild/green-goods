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
// OperatorCaptured) — they are not screen copy and are never scanned.

import type { SB as RawSB, Scene } from "./journeys";
import type { HotRegistry, ResolveTables, Screen, ShippedSB, ShippedStep } from "./types";

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
  const text = stripTags(html);
  // Core vocabulary is never warn-only: ASCII and September previews are still
  // rendered copy and must use the same mutual-aid language.
  scanEverywhere(where, text);
  if (sept) return; // another spec owns the remaining dialect-specific copy
  if (screen.surface === "client" || screen.surface === "public") {
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
export function normalizeAndValidate(raw: RawSB[], ctx: Ctx): { sbs: ShippedSB[]; walkedIn: Record<string, { sb: string; n: number; ix: number }[]>; errors: string[]; warnings: string[] } {
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

  const walkedIn: Record<string, { sb: string; n: number; ix: number }[]> = {};
  const sbs: ShippedSB[] = raw.map((sb) => ({
    id: sb.id,
    n: sb.n,
    title: sb.title,
    persona: sb.persona,
    scen: sb.scen,
    surface: sb.surface,
    steps: sb.steps.map((sc, ix): ShippedStep => {
      const where = `${sb.id}:${ix}`;
      const r = resolveScreen(sc.f, where);
      const sid = r?.screen.id ?? sc.f.split("@")[0];
      const v = r?.state ?? "default";
      const tokens = stateTokens.get(`${sid}@${v}`);

      (walkedIn[sid] ??= []);
      if (!walkedIn[sid].some((w) => w.sb === sb.id)) walkedIn[sid].push({ sb: sb.id, n: sb.n, ix });

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
      return { f: sid, v, hot, alts, marks, who: sc.who, surface: sc.surface, st: sc.st, ev: sc.ev, cite: sc.cite, note: sc.note, br, mf: sc.mf };
    }),
  }));

  // Journey chrome, step annotations, branch labels, and hotspot inspector copy
  // are all rendered UI too; scan them rather than limiting vocabulary checks
  // to the screen-state HTML.
  for (const sb of raw) {
    const text = [sb.title, sb.persona, sb.scen, sb.surface, ...sb.steps.flatMap((sc) => [
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
      }
    }
    for (const h of ctx.screenHots[s.id] ?? []) {
      if (!s.states.some((st) => domTokens(st.html).hots.has(h))) err.push(`ORPHAN hotspot ${h}: registered on ${s.id} but emitted in no state`);
    }
  }

  return { sbs, walkedIn, errors: err, warnings: warn };
}
