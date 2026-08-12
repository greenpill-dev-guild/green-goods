// Screen registry assembly. Hi-fi screens register here as batches land
// (screens/client.ts, screens/admin.ts, screens/public.ts); everything not yet
// migrated renders through the ascii shim from the legacy frame data, so the
// artifact stays coherent mid-upgrade. September C-frames stay ascii forever.

import { deriveAscii, renderAscii } from "../ascii";
import { esc } from "../html";
import { F, FT, HOTMAP } from "../legacy";
import { SBS } from "../journeys";
import type { HotMeta, HotRegistry, ResolveTables, Screen, Surface } from "../types";
import { ADMIN_DEFS } from "./admin";
import { PUBLIC_DEFS } from "./public";
import { SETTLEMENT_DEFS } from "./settlement";
import { CLIENT_DEFS } from "./client";
import { EXCHANGE_DEFS } from "./exchange";
import { WALLET_DEFS } from "./client-wallet";
import { FUNDING_DEFS } from "./funding";

// W6 retired (Decision Log #28f): summary line moved into the W5 drawer header.
const RETIRED = new Set(["W6"]);
// Lo-fi variant frames absorbed into hi-fi parent states (see ALIASES).
const DISSOLVED = new Set(["W1P", "W1S", "MF3", "MF5", "MF6", "MF10", "W23G", "MF8", "W7X", "MF1", "MF4", "MF13", "MF9"]);

// Screens-tab groups (order = display order). W6 dropped from Client PWA.
const GROUP_DEFS: { name: string; surface: Surface; ids: string[] }[] = [
  // W32–W35 are the offer-over-time set (saved details → series → places →
  // Story). They stay inside the one client panel: the Screens tab keys its
  // tabpanel by surface, so a second client group would collide on that id.
  { name: "Client PWA", surface: "client", ids: ["W1", "W2", "W2a", "W2b", "W3", "W4", "W36", "W5", "W23", "W25", "WFLOW", "W28", "W29", "W30", "W31", "W32", "W34", "W35"] },
  { name: "Admin console", surface: "admin", ids: ["W7", "W8", "W9", "W10", "W11", "W12", "W13", "W14", "W37", "W21", "W22", "W24", "W26", "HUBWORK"] },
  { name: "Editorial website", surface: "editorial", ids: ["W15", "W16"] },
  { name: "Community PWA — September preview (lo-fi)", surface: "community", ids: ["C1", "C3", "C4", "C5", "C6", "C9", "C10"] },
];

// Screen-library chapters (2026-08-10): the same clustered treatment the
// guided-flow catalog uses. Renameable data — the build asserts only that each
// surface's chapters exactly cover its GROUP_DEFS ids, never names or counts.
const SCREEN_CHAPTERS: Record<string, { label: string; ids: string[] }[]> = {
  client: [
    { label: "The pool & its promises", ids: ["W1", "W2", "W4", "W25", "W36"] },
    { label: "Create & prove", ids: ["W3", "W2a", "W2b", "WFLOW"] },
    { label: "Ongoing Offers", ids: ["W32", "W34", "W35"] },
    { label: "Exchange & templates", ids: ["W28", "W29", "W30", "W31"] },
    { label: "Wallet", ids: ["W5", "W23"] },
  ],
  admin: [
    { label: "Pool & seasons", ids: ["W7", "W11", "W26"] },
    { label: "Seed & capture", ids: ["W8", "W9"] },
    { label: "Review & decisions", ids: ["W10", "W13", "W14", "W37", "HUBWORK"] },
    { label: "Community & operations", ids: ["W12", "W24"] },
    { label: "Settlement", ids: ["W21", "W22"] },
  ],
  editorial: [{ label: "Public pages", ids: ["W15", "W16"] }],
  community: [{ label: "September preview (lo-fi)", ids: ["C1", "C3", "C4", "C5", "C6", "C9", "C10"] }],
};
// Old deep-link ids → new screen[@state] targets. Extended per batch as
// variant frames dissolve into states of their parent screens.
export const ALIASES: Record<string, string> = {
  W6: "W5",
  W1P: "W1@claim-pending",
  W1S: "W1@claim-superseded",
  MF3: "W2@expired",
  MF5: "W1@waiting-membership",
  MF6: "W2@request-evidence-submitted",
  MF10: "W1@cycle-summary",
  W23G: "W23@delivery-blocked",
  MF8: "W25@context-chooser",
  W7X: "W7@claim-outcomes",
  MF1: "W7@ready",
  MF4: "W7@expiry-queue",
  MF13: "W10@attach-assessment",
  MF9: "W26@review",
};

// ---- collect journey-referenced match-strings per legacy frame ----
const stepHotsByFrame: Record<string, { m: string; l: string }[]> = {};
const stepMarksByFrame: Record<string, string[]> = {};
for (const sb of SBS) {
  for (const sc of sb.steps) {
    const sid = sc.f.split("@")[0];
    if (!F[sid]) continue; // hi-fi screens resolve their own ids
    const addHot = (h: { m: string; l: string }) => {
      (stepHotsByFrame[sid] ??= []).push(h);
    };
    if (sc.hot && "m" in sc.hot) addHot({ m: sc.hot.m, l: sc.hot.l });
    for (const a of sc.alts ?? []) if ("m" in a) addHot({ m: a.m, l: a.l });
    for (const mk of sc.marks ?? []) (stepMarksByFrame[sid] ??= []).push(mk);
  }
}

// ---- build ----
export const SCREENS: Screen[] = [];
export const HOTS: HotRegistry = {};
export const TABLES: ResolveTables = { hotByString: {}, markByString: {} };
export const SCREEN_HOTS: Record<string, Set<string>> = {};
export const SCREEN_MARKS: Record<string, Set<string>> = {};
export const BUILD_ERRORS: string[] = [];

// Chapter coverage must exactly match GROUP_DEFS — derived, not transcribed.
for (const { surface, ids } of GROUP_DEFS) {
  const chaptered = (SCREEN_CHAPTERS[surface] ?? []).flatMap((chapter) => chapter.ids);
  const missing = ids.filter((id) => !chaptered.includes(id));
  const extra = chaptered.filter((id) => !ids.includes(id));
  const dupes = chaptered.filter((id, ix) => chaptered.indexOf(id) !== ix);
  if (missing.length || extra.length || dupes.length)
    BUILD_ERRORS.push(`SCREEN CHAPTERS ${surface}: missing [${missing}] extra [${extra}] duplicated [${dupes}]`);
}

// Hi-fi screen modules export HifiDef arrays; imports land here as batches
// ship (B1: CLIENT_DEFS, B3: ADMIN_DEFS, B5: PUBLIC_DEFS).
export type HifiDef = {
  screen: Omit<Screen, "reviewVisible">;
  hots: Record<string, HotMeta>;
};
const REG: HifiDef[] = [
  ...CLIENT_DEFS,
  ...EXCHANGE_DEFS,
  ...WALLET_DEFS,
  ...FUNDING_DEFS,
  ...ADMIN_DEFS,
  ...SETTLEMENT_DEFS,
  ...PUBLIC_DEFS,
];

const hifiById = new Map(REG.map((d) => [d.screen.id, d]));

for (const g of GROUP_DEFS) {
  for (const id of g.ids) {
    if (RETIRED.has(id)) continue;
    const hifi = hifiById.get(id);
    if (hifi) {
      SCREENS.push({ ...hifi.screen, group: g.name, surface: g.surface, reviewVisible: g.surface !== "community" });
      SCREEN_HOTS[id] = new Set(Object.keys(hifi.hots));
      SCREEN_MARKS[id] = new Set();
      for (const [hid, meta] of Object.entries(hifi.hots)) {
        if (HOTS[hid]) BUILD_ERRORS.push(`duplicate hotspot id ${hid}`);
        HOTS[hid] = meta;
      }
      continue;
    }
    const text = F[id];
    if (!text) {
      BUILD_ERRORS.push(`GROUP screen ${id} missing from legacy frames and hi-fi registry`);
      continue;
    }
    const d = deriveAscii(id, text, HOTMAP[id] ?? [], stepHotsByFrame[id] ?? [], stepMarksByFrame[id] ?? []);
    BUILD_ERRORS.push(...d.errors);
    const proposed = id.startsWith("MF");
    SCREENS.push({
      id,
      title: FT[id] ?? id,
      surface: g.surface,
      frame: "ascii",
      group: g.name,
      reviewVisible: g.surface !== "community",
      states: [{ id: "default", label: "lo-fi", proposed, html: renderAscii(text, d) }],
    });
    TABLES.hotByString[id] = d.hotByString;
    TABLES.markByString[id] = d.markByString;
    SCREEN_HOTS[id] = new Set(d.hots.map((h) => h.id));
    SCREEN_MARKS[id] = new Set(Object.values(d.markByString));
    for (const h of d.hots) {
      HOTS[h.id] = h.meta;
    }
  }
}

// Frames present in legacy data but not in any group (retired/dissolved aside)
for (const id of Object.keys(F)) {
  if (RETIRED.has(id) || DISSOLVED.has(id)) continue;
  if (!GROUP_DEFS.some((g) => g.ids.includes(id))) BUILD_ERRORS.push(`legacy frame ${id} not in any Screens group`);
}

export const GROUPS: [string, string[]][] = GROUP_DEFS.map((g) => [
  g.name,
  g.ids.filter((id) => !RETIRED.has(id) && SCREENS.some((s) => s.id === id)),
]);

export const REVIEW_GROUPS: { name: string; surface: Exclude<Surface, "community">; ids: string[] }[] = GROUP_DEFS
  .filter((g): g is { name: string; surface: Exclude<Surface, "community">; ids: string[] } => g.surface !== "community")
  .map((g) => ({
    ...g,
    ids: g.ids.filter((id) => !RETIRED.has(id) && SCREENS.some((s) => s.id === id && s.reviewVisible)),
  }));

export function screenById(id: string): Screen | undefined {
  return SCREENS.find((s) => s.id === id);
}

const friendlyTitle = (screen: Screen) => screen.title.replace(/^\s*(?:W\d+a?|HUBWORK|WFLOW)\s*[·—:-]\s*/i, "");

// Static Screen-library cards. Community remains in the registry and direct
// hash graph, but is deliberately absent from this presentation catalog.
export function screenCardsHtml(): string {
  // Screens cluster under SCREEN_CHAPTERS headings — the same chapter
  // treatment the guided-flow catalog uses (2026-08-10). Coverage is asserted
  // against GROUP_DEFS above, so a new screen cannot silently skip its chapter.
  return REVIEW_GROUPS.map(({ name, surface }, groupIx) => {
    const clusters = (SCREEN_CHAPTERS[surface] ?? [])
      .map(({ label, ids: clusterIds }) =>
        `<h3 class="chapter-h">${esc(label)}</h3><div class="grid">` +
        clusterIds
          .map((id) => {
            // Total lookup: a chapter id without a registered screen renders
            // nothing here — the chapter/registry cross-check reports it.
            const s = screenById(id);
            if (!s) return "";
            const states = `${s.states.length} ${s.states.length === 1 ? "state" : "states"}`;
            return `<button class="sbcard sc" data-frame="${id}"><span class="screenkey">${esc(id)}</span><span class="sbt">${esc(friendlyTitle(s))}</span><span class="sbm">${states}</span></button>`;
          })
          .join("") +
        `</div>`)
      .join("");
    return `<section class="catalog-panel screen-catalog" id="screen-panel-${surface}" role="tabpanel" aria-labelledby="screen-tab-${surface}" data-screen-surface="${surface}"${groupIx ? " hidden" : ""}><h2>${esc(name)}</h2>${clusters}</section>`;
  }).join("");
}
