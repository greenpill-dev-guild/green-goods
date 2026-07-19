// asciiScreen shim: renders a legacy lo-fi ASCII frame as pre-baked HTML with
// the same data-hot / data-mark DOM contract the hi-fi screens use, so the
// player has exactly one render model.
//
// Hotspot ids are derived from HOTMAP order ("W1.h0", "W1.h1", …) plus any
// extra match-strings the journeys reference that HOTMAP doesn't carry
// ("W1.x0", …). Mark ids derive from journey mark strings ("W1.m0", …); a mark
// string that exactly equals a hotspot's string resolves to the hotspot id.
// Marks may overlap hotspots (e.g. W22's "Infrastructure timeout: [ Request
// again ]" contains the "[ Request again ]" control); the emitter splits mark
// spans around buttons and stamps covered buttons with data-mark too, so
// [data-mark~=id] highlighting always covers the full marked run.

import type { Hot } from "./legacy";
import type { HotMeta } from "./types";
import { esc, escAttr } from "./html";

type Range = { s: number; e: number; id: string };

export type Derived = {
  hots: { id: string; meta: HotMeta; range: Range }[];
  hotByString: Record<string, string>;
  markByString: Record<string, string>;
  markRanges: Range[];
  errors: string[];
};

// First occurrence of `m` in `text` that does not overlap any range in
// `claimed`; searches later occurrences on clash. Returns null when every
// occurrence clashes (or the string is absent).
function firstFit(text: string, m: string, claimed: Range[]): { s: number; e: number } | null {
  let from = 0;
  let idx: number;
  while ((idx = text.indexOf(m, from)) !== -1) {
    const end = idx + m.length;
    if (!claimed.some((c) => idx < c.e && end > c.s)) return { s: idx, e: end };
    from = end;
  }
  return null;
}

export function deriveAscii(
  frameId: string,
  text: string,
  hotmap: Hot[],
  stepHots: { m: string; l: string }[], // hot/alt match-strings journeys use on this frame
  stepMarkStrings: string[],
): Derived {
  const errors: string[] = [];
  const hots: Derived["hots"] = [];
  const hotByString: Record<string, string> = {};
  const claimed: Range[] = [];

  hotmap.forEach((h, i) => {
    if (hotByString[h.m] !== undefined) return; // duplicate registry string
    const fit = firstFit(text, h.m, claimed);
    if (!fit) {
      errors.push(`ASCII ${frameId}: hotspot "${h.m}" not placeable`);
      return;
    }
    const id = `${frameId}.h${i}`;
    const range = { ...fit, id };
    claimed.push(range);
    hots.push({ id, meta: { l: h.l, to: h.to, info: h.info }, range });
    hotByString[h.m] = id;
  });

  let extraN = 0;
  for (const sh of stepHots) {
    if (hotByString[sh.m] !== undefined) continue;
    const fit = firstFit(text, sh.m, claimed);
    if (fit) {
      const id = `${frameId}.x${extraN++}`;
      const range = { ...fit, id };
      claimed.push(range);
      hots.push({ id, meta: { l: sh.l }, range });
      hotByString[sh.m] = id;
      continue;
    }
    // Every occurrence clashes: resolve to the single hotspot it overlaps
    // (e.g. a step string that is a prefix of a registered control).
    const idx = text.indexOf(sh.m);
    if (idx === -1) {
      errors.push(`ASCII ${frameId}: step hotspot "${sh.m}" not found in frame`);
      continue;
    }
    const end = idx + sh.m.length;
    const overlapping = claimed.filter((c) => idx < c.e && end > c.s);
    if (overlapping.length === 1) hotByString[sh.m] = overlapping[0].id;
    else errors.push(`ASCII ${frameId}: step hotspot "${sh.m}" overlaps ${overlapping.length} controls`);
  }

  const markByString: Record<string, string> = {};
  const markRanges: Range[] = [];
  let markN = 0;
  for (const m of stepMarkStrings) {
    if (markByString[m] !== undefined) continue;
    if (hotByString[m] !== undefined) {
      markByString[m] = hotByString[m]; // identical string → highlight the control itself
      continue;
    }
    const fit = firstFit(text, m, markRanges); // marks may overlap hotspots, not each other
    if (!fit) {
      errors.push(`ASCII ${frameId}: mark "${m}" not placeable`);
      continue;
    }
    const id = `${frameId}.m${markN++}`;
    markRanges.push({ ...fit, id });
    markByString[m] = id;
  }

  return { hots, hotByString, markByString, markRanges, errors };
}

export function renderAscii(text: string, d: Derived): string {
  const bounds = new Set<number>([0, text.length]);
  for (const h of d.hots) {
    bounds.add(h.range.s);
    bounds.add(h.range.e);
  }
  for (const m of d.markRanges) {
    bounds.add(m.s);
    bounds.add(m.e);
  }
  const cuts = [...bounds].sort((a, b) => a - b);

  const hotAt = (p: number) => d.hots.find((h) => h.range.s <= p && p < h.range.e);
  const marksAt = (p: number) => d.markRanges.filter((m) => m.s <= p && p < m.e).map((m) => m.id);

  let out = "";
  let openHot: { id: string; stamped: string[] } | null = null;
  for (let i = 0; i < cuts.length - 1; i++) {
    const s = cuts[i];
    const e = cuts[i + 1];
    if (s === e) continue;
    const seg = esc(text.slice(s, e));
    const hotHere = hotAt(s);
    const markIds = marksAt(s);

    if (openHot && (!hotHere || hotHere.id !== openHot.id)) {
      out += "</button>";
      openHot = null;
    }
    if (hotHere && !openHot) {
      // Marks spanning the whole control ride on the button element itself.
      const whole = d.markRanges
        .filter((m) => m.s <= hotHere.range.s && m.e >= hotHere.range.e)
        .map((m) => m.id);
      out += `<button type="button" class="hspot" data-hot="${escAttr(hotHere.id)}"${
        whole.length ? ` data-mark="${escAttr(whole.join(" "))}"` : ""
      } aria-label="${escAttr(hotHere.meta.l)}">`;
      openHot = { id: hotHere.id, stamped: whole };
    }
    if (openHot) {
      const inner = markIds.filter((m) => !openHot!.stamped.includes(m));
      out += inner.length ? `<span data-mark="${escAttr(inner.join(" "))}">${seg}</span>` : seg;
      continue;
    }
    out += markIds.length ? `<span data-mark="${escAttr(markIds.join(" "))}">${seg}</span>` : seg;
  }
  if (openHot) out += "</button>";
  return `<pre class="frame ascii">${out}</pre>`;
}
