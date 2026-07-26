// Screen registry assembly. Hi-fi screens register here as batches land
// (screens/client.ts, screens/admin.ts, screens/public.ts); everything not yet
// migrated renders through the ascii shim from the legacy frame data, so the
// artifact stays coherent mid-upgrade. September C-frames stay ascii forever.

import { deriveAscii, renderAscii } from "../ascii";
import { esc } from "../html";
import { F, FT, HOTMAP } from "../legacy";
import { SBS } from "../journeys";
import type { HotRegistry, ResolveTables, Screen, Surface } from "../types";
import { ADMIN_DEFS } from "./admin";
import { PUBLIC_DEFS } from "./public";
import { SETTLEMENT_DEFS } from "./settlement";
import { CLIENT_DEFS } from "./client";
import { WALLET_DEFS } from "./client-wallet";

// W6 retired (Decision Log #28f): summary line moved into the W5 drawer header.
const RETIRED = new Set(["W6"]);
// Lo-fi variant frames absorbed into hi-fi parent states (see ALIASES).
const DISSOLVED = new Set(["W1P", "W1S", "MF3", "MF5", "MF6", "MF10", "W23G", "MF8", "W7X", "MF1", "MF4", "MF13", "MF9"]);

// Screens-tab groups (order = display order). W6 dropped from Client PWA.
const GROUP_DEFS: { name: string; surface: Surface; ids: string[] }[] = [
  { name: "Client PWA", surface: "client", ids: ["W1", "W2", "W2a", "W3", "W4", "W5", "W23", "W25", "WFLOW"] },
  { name: "Admin console", surface: "admin", ids: ["W7", "W8", "W9", "W10", "W11", "W12", "W13", "W14", "W21", "W22", "W24", "W26", "HUBWORK"] },
  { name: "Editorial website", surface: "editorial", ids: ["W15", "W16"] },
  { name: "Community PWA — September preview (lo-fi)", surface: "community", ids: ["C1", "C3", "C4", "C5", "C6", "C9", "C10"] },
];

// Old deep-link ids → new screen[@state] targets. Extended per batch as
// variant frames dissolve into states of their parent screens.
export const ALIASES: Record<string, string> = {
  W6: "W5",
  W1P: "W1@claim-pending",
  W1S: "W1@claim-superseded",
  MF3: "W2@expired",
  MF5: "W1@waiting-membership",
  MF6: "W2@evidence-submitted",
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

// Hi-fi screen modules export HifiDef arrays; imports land here as batches
// ship (B1: CLIENT_DEFS, B3: ADMIN_DEFS, B5: PUBLIC_DEFS).
export type HifiDef = {
  screen: Omit<Screen, "reviewVisible">;
  hots: Record<string, { l: string; to?: string; info?: string }>;
};
const REG: HifiDef[] = [
  ...CLIENT_DEFS,
  ...WALLET_DEFS,
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
  return REVIEW_GROUPS.map(
    ({ name, surface, ids }, groupIx) =>
      `<section class="catalog-panel screen-catalog" id="screen-panel-${surface}" role="tabpanel" aria-labelledby="screen-tab-${surface}" data-screen-surface="${surface}"${groupIx ? " hidden" : ""}><h2>${esc(name)}</h2><div class="grid">` +
      ids
        .map((id) => {
          const s = screenById(id)!;
          const states = `${s.states.length} ${s.states.length === 1 ? "state" : "states"}`;
          return `<button class="sbcard sc" data-frame="${id}"><span class="screenkey">${esc(id)}</span><span class="sbt">${esc(friendlyTitle(s))}</span><span class="sbm">${states}</span></button>`;
        })
        .join("") +
      `</div></section>`,
  ).join("");
}
