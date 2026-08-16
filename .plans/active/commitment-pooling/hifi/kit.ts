// Component kit — string builders over the tokens.ts classes. Each mimics a
// real Green Goods component (noted per function). Screens compose these and
// wrap journey-relevant controls with hot(id, …) from html.ts.

import { CYCLE, SEASON_LIVE } from "./fixtures";
import { esc, escAttr, hot } from "./html";
import { icon } from "./icons";
import { PHONE_VIEWPORT_HEIGHT, PHONE_VIEWPORT_WIDTH } from "./tokens";

// ---- device chrome ----------------------------------------------------------

// Installed-PWA viewport: bezel, fixed status/home chrome, and the same owned
// inner scroll surface as AppShell's #app-scroll. AppShell-backed frames carry
// the shipping 69px AppBar reservation by default; callers may choose the active
// destination or explicitly opt out for a genuinely non-AppShell surface.
export function phoneFrame(body: string, opts: { offline?: boolean; appBar?: string | false; header?: string; overlay?: string } = {}): string {
  const bottomBar = opts.appBar === false ? "" : (opts.appBar ?? appBar("garden"));
  return `<div class="phonefit" data-phone-scale="1"><div class="phone"><div class="scr" data-viewport-width="${PHONE_VIEWPORT_WIDTH}" data-viewport-height="${PHONE_VIEWPORT_HEIGHT}">
<div class="statusbar"><span class="num">9:41</span><span class="sbr">${opts.offline ? icon("wifi-off-line", "s") : ""}<span class="sb-sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i></span><span class="sb-batt"></span></span></div>
${opts.header ?? ""}<main class="appscroll" data-appbar="${bottomBar ? "visible" : "hidden"}">${body}</main>
${opts.overlay ?? ""}${bottomBar}
<div class="homebar"><i></i></div>
</div></div></div>`;
}

// Fixed bottom action bar for full-screen flows — the Submit Work chrome
// (uiux §5.4 + 2026-08-11 Appendix B addendum: ONE row, matching the shipping
// bar — an optional icon/short-text secondary beside one full-width primary,
// never two stacked full buttons; detour affordances belong in page content).
// validate.ts rejects a bar carrying two full-width buttons. Pass the result
// as phoneFrame's appBar so it sits between the scroll and homebar.
export function actionBar(primary: string, secondary?: string): string {
  return `<div class="fbar">${secondary ?? ""}${primary}</div>`;
}

// Screen header — client views hand-render h1 (.title-screen grammar).
export function hdr(title: string, opts: { back?: boolean; trailing?: string } = {}): string {
  return `<div class="hdr">${opts.back ? `<button type="button" class="hback" aria-label="Back — preview only" disabled>${icon("arrow-left-line", "l")}</button>` : ""}<h1>${esc(title)}</h1>${opts.trailing ? `<span class="hx">${opts.trailing}</span>` : ""}</div>`;
}

// Garden detail tab row — the net-new GardenTab "Pool" leads and is the
// default landing when a pool exists (uiux-spec §5.1 + 2026-08-14 addendum);
// a garden without a pool draws the original Work-first row with Pool absent.
// With a hotPrefix, inactive tabs become inspectable hotspots (`${prefix}-work` …)
// so every drawn control a user would tap is registered.
export function gardenTabs(active: "work" | "insights" | "gardeners" | "pool", opts: { hotPrefix?: string } = {}): string {
  const tabs: [string, string][] = [["pool", "Pool"], ["work", "Work"], ["insights", "Insights"], ["gardeners", "Gardeners"]];
  return `<div class="gtabs" role="tablist" aria-label="Garden sections">${tabs
    .map(([id, l]) => {
      if (!opts.hotPrefix) return `<span class="gtab${id === active ? " on" : ""}"${id === active ? ' aria-current="true"' : ""}>${l}</span>`;
      const button = `<button type="button" role="tab" aria-selected="${id === active}" class="gtab${id === active ? " on" : ""}">${l}</button>`;
      return hot(`${opts.hotPrefix}-${id}`, button);
    })
    .join("")}</div>`;
}

// Bottom AppBar — packages/client/src/components/Layout/AppBar.tsx.
export function appBar(active: "home" | "garden" | "profile", opts: { badge?: number } = {}): string {
  const tabs: ["home" | "garden" | "profile", string, string][] = [
    ["home", "Home", "home"],
    ["garden", "Garden", "plant"],
    ["profile", "Profile", "user"],
  ];
  return `<nav class="abar" aria-label="Primary">${tabs
    .map(([id, l, ic]) => {
      const on = id === active;
      const badge = id === "home" && opts.badge ? `<span class="badge num">${opts.badge}</span>` : "";
      return `<span class="atab${on ? " on" : ""}"${on ? ' aria-current="page"' : ""}>${badge}${icon(`${ic}-${on ? "fill" : "line"}`)}<span>${l}</span></span>`;
    })
    .join("")}</nav>`;
}

// SyncStatusBar — queued/offline job strip above the AppBar.
export function syncBar(text: string): string {
  return `<div class="syncbar">${icon("refresh-line", "s")}<span>${esc(text)}</span></div>`;
}

// ---- surfaces ---------------------------------------------------------------

// opts.edge — the promise-direction edge (2026-08-14): a 3px inset stripe,
// green for offers, sky for requests, so a browse list reads direction at
// scroll speed without recoloring whole cards (volume hierarchy stays).
export function card(inner: string, opts: { cls?: string; edge?: "offer" | "request" } = {}): string {
  const cls = `${opts.cls ? " " + opts.cls : ""}${opts.edge ? ` edge-${opts.edge}` : ""}`;
  return `<div class="card${cls}">${inner}</div>`;
}

export function banner(text: string, tone: "amber" | "stone" | "green" | "error", ic = "information-line"): string {
  return `<div class="ban ${tone}">${icon(ic, "s")}<span>${esc(text)}</span></div>`;
}

// ---- atoms ------------------------------------------------------------------

export type ChipTone = "plain" | "offer" | "request" | "domain" | "ok" | "warn" | "err" | "ink" | "queued";
export function chip(label: string, tone: ChipTone = "plain", opts: { dot?: boolean } = {}): string {
  const t = tone === "plain" ? "" : ` ${tone}`;
  return `<span class="ch${t}${opts.dot ? " dot" : ""}">${esc(label)}</span>`;
}

// Tap-first reasons (register #95): the common reasons for an act render as
// chips above its reason field. Tapping fills the field; the field stays — it
// is the stored record and REASON_CONFIRMS still requires it. Chips carry no
// hotspot: the acting control of these dialogs remains the confirm button.
export function reasonChips(options: string[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:2px 0">${options.map((o) => chip(o)).join("")}</div><div class="t-meta">Tap a reason to fill it in — or say it your own way.</div>`;
}

// StatusBadge (shared/components/StatusBadge.tsx) — icon + colour, never colour
// alone (WCAG 1.4.1). Anatomy: rounded-full pill, 1px border, px-2 py-0.5, 11px
// semibold, 12px icon, gap-1; tone = bg-lighter / text-dark / border-light.
// Client-only (admin/settlement keep the flatter .ch chips).
export type SbTone = "success" | "warning" | "error" | "info" | "neutral";
export function statusBadge(label: string, tone: SbTone, iconName: string): string {
  return `<span class="sbadge ${tone}">${icon(iconName, "s")}${esc(label)}</span>`;
}

// Commitment lifecycle state → StatusBadge (UI states per uiux-spec §4.3).
export function stateChip(state: string): string {
  const map: Record<string, [SbTone, string]> = {
    Offered: ["neutral", "time-line"], Requested: ["neutral", "time-line"],
    Accepted: ["info", "hand-heart-line"], Active: ["info", "leaf-line"],
    "Evidence in": ["warning", "image-line"], "Partly approved": ["warning", "time-line"],
    "Ready to confirm": ["warning", "time-line"], Fulfilled: ["success", "checkbox-circle-fill"],
    Reconciled: ["neutral", "seedling-line"], Cancelled: ["neutral", "close-line"], Expired: ["neutral", "time-line"],
    Withdrawn: ["neutral", "close-line"],
    "Under review": ["warning", "error-warning-line"], Queued: ["neutral", "time-line"], Waiting: ["neutral", "time-line"],
  };
  const [tone, ic] = map[state] ?? ["neutral", "time-line"];
  return statusBadge(state, tone, ic);
}

export function btn(
  label: string,
  opts: { kind?: "pri" | "sec" | "ghost" | "danger"; icon?: string; full?: boolean; sm?: boolean; disabled?: boolean; ariaLabel?: string } = {},
): string {
  const k = opts.kind ?? "sec";
  const aria = opts.ariaLabel ? ` aria-label="${escAttr(opts.ariaLabel)}"` : "";
  return `<button type="button" class="b ${k}${opts.full ? " full" : ""}${opts.sm ? " sm" : ""}"${opts.disabled ? " disabled" : ""}${aria}>${opts.icon ? icon(opts.icon, "s") : ""}${esc(label)}</button>`;
}

export function meter(pct: number, opts: { left?: string; right?: string; tickPct?: number } = {}): string {
  const tick = opts.tickPct != null ? `<span class="tick" style="left:${opts.tickPct}%"></span>` : "";
  const row = opts.left || opts.right ? `<div class="mrow"><span>${esc(opts.left ?? "")}</span><span class="num">${esc(opts.right ?? "")}</span></div>` : "";
  return `<div class="meter"><div class="tr"><div class="fi" style="width:${pct}%"></div>${tick}</div>${row}</div>`;
}

export function timeline(entries: { label: string; meta?: string; open?: boolean; warn?: boolean; note?: string }[]): string {
  return `<div class="tl">${entries
    .map(
      (e) =>
        `<div class="te${e.open ? " open" : ""}${e.warn ? " warn" : ""}"><span class="td"></span><div class="tb"><b>${esc(e.label)}</b>${e.meta ? ` <span class="tm">— ${esc(e.meta)}</span>` : ""}${e.note ? `<div class="tm">${esc(e.note)}</div>` : ""}</div></div>`,
    )
    .join("")}</div>`;
}

export function listRow(opts: { icon?: string; primary: string; meta?: string; chipHtml?: string; trailing?: string; chevron?: boolean }): string {
  const tail = `${opts.chipHtml ?? ""}${opts.trailing ?? ""}${opts.chevron ? icon("arrow-right-s-line") : ""}`;
  return `<div class="lr">${opts.icon ? icon(opts.icon) : ""}<div class="grow"><div class="lp">${esc(opts.primary)}</div>${opts.meta ? `<div class="lm">${esc(opts.meta)}</div>` : ""}</div>${tail ? `<div class="tail">${tail}</div>` : ""}</div>`;
}

// opts.badges — per-pill count badges (index → count), the WalletDrawer tab
// count pattern (§5.8: Commitments mirrors the cookie-jar tab badge).
export function seg(items: string[], activeIx: number, opts: { badges?: Partial<Record<number, number>> } = {}): string {
  return `<div class="seg" role="group" aria-label="Current filter">${items
    .map((l, i) => {
      const n = opts.badges?.[i];
      const badge = n ? `<span class="nbadge num">${n}</span>` : "";
      return `<span class="sg${i === activeIx ? " on" : ""}"${i === activeIx ? ' aria-current="true"' : ""}>${esc(l)}${badge}</span>`;
    })
    .join("")}</div>`;
}

// Season + campaigns rail (2026-08-14) — one horizontal snap row: the Season
// slide leads and stays visually primary (wider), campaign slides follow with
// a peek of the next. Presentation only: slides open their cycle; the browse
// scope select keeps owning list scope, so swiping never silently refilters.
export function cycleRail(slides: string[]): string {
  return `<div class="crail" role="group" aria-label="Season and campaigns">${slides.join("")}</div>`;
}

// Floating creation entry (2026-08-14) — mirrors the shared FabButton the
// admin mobile shell already uses. Closed: one "+" above the AppBar. Open:
// the caller stacks the two one-word doors (D3) above the same spot and the
// FAB flips to a close affordance. Returns the bare button; callers wrap it
// in hot() and assemble `.fabwrap` / `.fabscrim` around it.
export function fabButton(open: boolean): string {
  return `<button type="button" class="fabbtn${open ? " x" : ""}" aria-label="${open ? "Close" : "Offer or request"}" aria-expanded="${open ? "true" : "false"}">${icon(open ? "close-line" : "add-line", "l")}</button>`;
}

export function kv(k: string, v: string): string {
  return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
}

export function sectionTitle(t: string, trailing = ""): string {
  return `<div class="t-sec">${esc(t)}${trailing ? `<span class="hx">${trailing}</span>` : ""}</div>`;
}

// FormInfo — the shipping step-section header (client
// components/Cards/Form/FormInfo.tsx): a filled, padded, rounded card with
// the icon in a bordered 48px circular holder beside title + helper line
// (PR #710 review corrected the bare-flex-row first draft).
export function formInfo(ic: string, title: string, info: string): string {
  return `<div class="finfo"><span class="fic">${icon(ic)}</span><div class="grow"><div class="ft">${esc(title)}</div><div class="fi">${esc(info)}</div></div></div>`;
}

// ---- forms (W3 / sheets) ----------------------------------------------------

let fieldSeq = 0;
let radioSeq = 0;

export function field(label: string, control: string): string {
  const labelId = `f${++fieldSeq}`;
  const nativeCount = control.match(/<(?:input|select)\b/g)?.length ?? 0;
  if (control.includes('class="radio"') || nativeCount !== 1) {
    const grouped = control.includes('class="radio"')
      ? control
      : control.replace(/<(input|select)\b/g, `<$1 aria-labelledby="${labelId}"`);
    return `<fieldset class="fld"><legend class="fl" id="${labelId}">${esc(label)}</legend>${grouped}</fieldset>`;
  }
  const controlId = `${labelId}c`;
  const linked = control.replace(/<(input|select)\b/, `<$1 id="${controlId}"`);
  return `<div class="fld"><label class="fl" for="${controlId}">${esc(label)}</label>${linked}</div>`;
}

export function input(value: string, opts: { placeholder?: boolean; select?: boolean; textarea?: boolean; icon?: string; ariaLabel?: string; labelledBy?: string } = {}): string {
  const naming = opts.labelledBy
    ? ` aria-labelledby="${escAttr(opts.labelledBy)}"`
    : opts.ariaLabel
      ? ` aria-label="${escAttr(opts.ariaLabel)}"`
      : "";
  const control = opts.select
    ? `<select${naming} disabled><option>${esc(value)}</option></select>`
    : opts.textarea
      // The shipping FormText renders a real multiline textarea (rows=4,
      // views/Garden/Details.tsx) — a single-line input cannot stand in for it.
      ? `<textarea rows="4"${naming}${opts.placeholder ? ` placeholder="${escAttr(value)}"` : ""} readonly>${opts.placeholder ? "" : esc(value)}</textarea>`
      : `<input type="text"${naming}${opts.placeholder ? ` placeholder="${escAttr(value)}"` : ` value="${escAttr(value)}"`} readonly>`;
  return `<span class="inp${opts.select ? " sel" : ""}${opts.textarea ? " ta" : ""}">${opts.icon ? icon(opts.icon, "s") : ""}${control}</span>`;
}

export function radio(
  options: { label: string; meta?: string; on?: boolean; hot?: string }[],
  opts: { interactive?: boolean; name?: string } = {},
): string {
  const name = escAttr(opts.name ?? options.map((o) => o.label).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36));
  return `<div class="radio">${options
    .map((o) => {
      const optionId = `r${++radioSeq}`;
      const dot = opts.interactive
        ? `<input class="rdot" id="${optionId}" type="radio" name="${name}"${o.on ? " checked" : ""}>`
        : `<span class="rdot" aria-hidden="true"></span>`;
      const row = `<label class="ro${!opts.interactive && o.on ? " on" : ""}"${opts.interactive ? ` for="${optionId}"` : ""}>${dot}<span><span class="rl">${esc(o.label)}</span>${o.meta ? `<span class="rm">${esc(o.meta)}</span>` : ""}</span></label>`;
      return o.hot ? hot(o.hot, row) : row;
    })
    .join("")}</div>`;
}

export function stepDots(n: number, current: number): string {
  return `<div class="stepdots" role="img" aria-label="Step ${current + 1} of ${n}">${Array.from({ length: n }, (_, i) => `<i aria-hidden="true" class="${i < current ? "done" : i === current ? "on" : ""}"></i>`).join("")}</div>`;
}

// FormProgress — mirrors the shipping stepper (packages/client/src/components/
// Communication/Progress/Progress.tsx): numbered 20px circles, a check when a
// step completes, an accent ring on the current step, hairline + chevron
// connectors. Wizards render THIS, not dots (iteration 2, 2026-08-11).
export function formProgress(total: number, current: number): string {
  const items: string[] = [];
  for (let i = 0; i < total; i++) {
    const done = i < current;
    const cur = i === current;
    items.push(`<span class="fpstep${done ? " done" : cur ? " cur" : ""}">${done ? icon("check-line", "s") : `<span class="num">${i + 1}</span>`}</span>`);
    if (i < total - 1) items.push(`<span class="fpline${done ? " done" : ""}"></span><span class="fpsep">${icon("arrow-right-s-line", "s")}</span>`);
  }
  return `<div class="fprog" role="img" aria-label="Step ${current + 1} of ${total}">${items.join("")}</div>`;
}

// Fixed wizard header — the Submit Work TopNav: close on step 1, BACK on every
// later step (iteration 2: the X-only header was a fidelity break), title,
// FormProgress trailing.
export function flowHeader(title: string, step: number, total: number): string {
  const leading = step === 0
    ? `<button type="button" class="hback" aria-label="Close — preview only" disabled>${icon("close-line", "l")}</button>`
    : `<button type="button" class="hback" aria-label="Back — preview only" disabled>${icon("arrow-left-line", "l")}</button>`;
  return `<div class="hdr fixed">${leading}<h1>${esc(title)}</h1><span class="hx">${formProgress(total, step)}</span></div>`;
}

// Equal 2-up kind cards (iteration 2): identical-size tappable cards — icon,
// label, one meta line — selected card fills the accent tint. The same
// component serves both directions of the composer.
export function kindCards(options: { icon: string; label: string; meta: string; on?: boolean; hot?: string }[]): string {
  const cells = options.map((o) => {
    const cell = `<div class="kcard${o.on ? " on" : ""}">${icon(o.icon)}<div class="kl">${esc(o.label)}</div><div class="km">${esc(o.meta)}</div></div>`;
    return o.hot ? hot(o.hot, cell) : cell;
  });
  return `<div class="kgrid">${cells.join("")}</div>`;
}

// ---- composition ------------------------------------------------------------

// In-phone bottom sheet over dimmed context. Gesture sheets (PwaSheet) show the
// tinted drag handle; tabbed drawers (ModalDrawer / WalletDrawer) pass
// handle:false — they dismiss via chrome, not a drag pill.
export function sheetOver(behind: string, title: string, inner: string, opts: { handle?: boolean } = {}): string {
  const handle = opts.handle === false ? "" : `<div class="drag"></div>`;
  return `<div class="sheetstage"><div class="behind">${behind}</div><div class="scrimm"></div><div class="sheet">${handle}<div class="sh-t">${esc(title)}</div>${inner}</div></div>`;
}

// Garden-detail header (views/Home/Garden/index.tsx): fixed image banner (h-36,
// rounded-b-3xl) with an overlaid back control, then the garden name +
// location/founded meta. The bottom AppBar is hidden here — this is the chrome.
export function gardenHeader(name: string, meta: { location: string; founded: string }): string {
  return `<div class="ghead"><div class="gbanner"><button type="button" class="gback" aria-label="Back — preview only" disabled>${icon("arrow-left-line", "l")}</button></div><div class="gtitle"><h1 class="title-section">${esc(name)}</h1><div class="gmeta"><span class="gm">${icon("home-line", "s")}${esc(meta.location)}</span><span class="gsep">•</span><span class="gm">${icon("calendar-line", "s")}${esc(meta.founded)}</span></div></div></div>`;
}

// Home header (views/Home/index.tsx): h4 title + a trailing icon-button row
// (filter / wallet / work). Distinct from garden-detail's banner header.
export function homeHeader(): string {
  return `<div class="hhead"><h4 class="hh-title">Home</h4><div class="hh-actions"><button type="button" class="hh-ic" aria-label="Filter — preview only" disabled>${icon("search-line", "s")}</button><button type="button" class="hh-ic" aria-label="Wallet — preview only" disabled>${icon("wallet-line", "s")}</button><button type="button" class="hh-ic" aria-label="Work — preview only" disabled>${icon("plant-line", "s")}</button></div></div>`;
}

export function pagepad(...children: string[]): string {
  return `<div class="pagepad">${children.join("\n")}</div>`;
}

export function disclosure(title: string, count: string, inner: string, opts: { open?: boolean } = {}): string {
  return `<details class="disc"${opts.open ? " open" : ""}><summary>${esc(title)}<span class="cnt">${esc(count)}</span><span class="caret">${icon("arrow-right-s-line", "s")}</span></summary><div class="dbody">${inner}</div></details>`;
}

export function hero(title: string, msg: string, ic = "checkbox-circle-fill"): string {
  return `<div class="hero"><div class="halo">${icon(ic)}</div><div class="ht">${esc(title)}</div><div class="hm">${esc(msg)}</div></div>`;
}

// Skeleton placeholder — "loading preserves layout" (uiux-spec §12). Client-only:
// mirrors a real card's shape (optional avatar/title) so nothing shifts on load.
export function skeleton(opts: { title?: boolean; avatar?: boolean; lines?: number; cls?: string } = {}): string {
  const widths = ["92%", "78%", "66%", "84%", "58%"];
  const n = opts.lines ?? 3;
  const head = opts.avatar
    ? `<div class="skrow"><span class="skcircle"></span><div class="grow" style="display:flex;flex-direction:column;gap:8px"><div class="skbar t" style="width:64%"></div><div class="skbar sm" style="width:40%"></div></div></div>`
    : opts.title
      ? `<div class="skbar t" style="width:58%"></div>`
      : "";
  const bars = Array.from({ length: n }, (_, i) => `<div class="skbar${i === n - 1 ? " sm" : ""}" style="width:${widths[i % widths.length]}"></div>`).join("");
  return `<div class="sk${opts.cls ? " " + opts.cls : ""}">${head}${bars}</div>`;
}

// Centered recovery/empty state — not-found, read-error, and empty (which must
// "name the scope", uiux-spec §12). Caller passes pre-wrapped hotspot actions.
export function emptyState(iconName: string, title: string, body: string, actions = ""): string {
  return `<div class="empty"><span class="emptyIc">${icon(iconName, "l")}</span><div class="t-title">${esc(title)}</div><div class="t-meta">${esc(body)}</div>${actions ? `<div class="brow" style="justify-content:center;width:100%">${actions}</div>` : ""}</div>`;
}

// ---- promoted screen composites (components-tab pass, 2026-08-14) -----------
// Formerly screen-local in screens/client.ts and screens/client-wallet.ts;
// promoted so the kit is the single component source. Fixture copy and w1.*
// hotspot defaults ride along unchanged — these are the same casts the screens
// draw, not parameterized abstractions.

// Creator by-line — the D5 card contract (uiux Appendix B addendum 2026-08-11)
// puts a face on every browse card: avatar + name, "for {garden}" when a
// garden claims. Cards carry chips → title → by-line → quantity+due → real
// progress → ONE context action or one plain reason line; notes and declared
// value live in detail.
export function byline(name: string, opts: { forGarden?: string } = {}): string {
  return `<div class="byline"><span class="avatar" aria-hidden="true">${esc(name[0] ?? "")}</span><span class="t-meta">by ${esc(name)}${opts.forGarden ? ` · for ${esc(opts.forGarden)}` : ""}</span></div>`;
}

// Team strip — overlapping initial avatars (W2 people row, the funding pledge
// row). Net-new as a primitive: the shipping client renders people via
// ImageWithFallback letter fallbacks per view, with no avatar-stack component.
export function teamstrip(initials: readonly string[]): string {
  return `<span class="teamstrip">${initials.map((n) => `<span class="avatar" aria-hidden="true">${esc(n)}</span>`).join("")}</span>`;
}

// Domains get their own equal-weight row (2026-08-14 second pass, Afo): every
// involved domain listed, none privileged as "primary" — a promise pairing
// AGRO with EDU is both, not AGRO-with-a-footnote. No row = an evidence-only
// service promise, and the "Support / service" kind chip up top says so in
// words. The real build renders DomainBadge (icon + label) from DOMAIN_CONFIG.
const DOMAIN_CLS: Record<string, string> = { AGRO: "agro", EDU: "edu", SOLAR: "solar", WASTE: "waste" };
export function domainRow(domains: string[]): string {
  return domains.length
    ? `<div class="dmrow">${domains.map((d) => `<span class="dm ${DOMAIN_CLS[d] ?? "agro"}">${esc(d)}</span>`).join("")}</div>`
    : "";
}

// Browse filter row (2026-08-14): direction chips plus the personal Mine
// toggle — personal scope is orthogonal to direction, so it is not a fourth
// direction pill. The exchange-pair filter (formerly "Matched") returns with
// the exchange wave; paired cards keep their "In exchange" chip meanwhile.
export function poolFilters(activeIx: number, opts: { mine?: boolean } = {}): string {
  return hot(
    "w1.filters",
    `<div class="filters">${seg(["All", "Offers", "Requests"], activeIx)}<span class="mine${opts.mine ? " on" : ""}" role="switch" aria-checked="${opts.mine ? "true" : "false"}">Mine</span></div>`,
  );
}

// Scoped state counts, never a cross-commitment percentage: this pool's units
// are hours, rides, sessions and surveys, so a single "62%" would average
// incommensurable things (uiux-spec §5.2, §12). A seeded or empty season shows
// no counts line at all rather than a row of zeroes. The card counts promises
// made and kept — the same pair W5, W12, W15 and W26 print for this moment
// (PRD-760). Cycle cards follow layout option B (2026-08-14 third pass, Afo):
// the [Season]/[Campaign] + stage chips LEAD the card, everything stacks on
// one left axis, and counts join the stack — nothing floats right.
export function seasonCard(opts: { made?: number; kept?: number; stage?: string } = {}): string {
  const made = opts.made ?? SEASON_LIVE.made;
  const kept = opts.kept ?? SEASON_LIVE.kept;
  const counts = made === 0 && kept === 0 ? "" : `<div class="t-meta num">${made} promises · ${kept} kept</div>`;
  return card(
    hot(
      "w1.season-card",
      `<div class="grow"><div class="cardrow">${chip("Season", "plain")}${chip(opts.stage ?? "Open", "plain")}</div><div class="t-title">${CYCLE}</div><div class="t-meta">runs through Aug 30</div>${counts}</div>`,
    ),
  );
}

// Season + campaigns share one snap rail (2026-08-14): the Season slide leads
// and stays wider — campaigns are peers you can reach in one swipe, not what a
// member came for. Presentation only: slides open their cycle, and the browse
// scope select keeps owning list scope, so swiping never silently refilters.
export function seasonSlide(opts: { made?: number; kept?: number; stage?: string } = {}): string {
  return `<div class="cslide lead">${seasonCard(opts)}</div>`;
}
export function emptySeasonSlide(): string {
  return `<div class="cslide lead">${card(
    `<div class="cardrow">${chip("Season", "plain")}</div><div class="t-title">No season right now</div><div class="t-meta">Stewards open the next one</div>`,
  )}</div>`;
}
export function campaignSlide(hotId: string, title: string, stage: string, counts: string): string {
  return `<div class="cslide">${card(
    hot(hotId, `<div class="grow"><div class="cardrow">${chip("Campaign", "plain")}${chip(stage, "plain")}</div><div class="t-title">${title}</div><div class="t-meta">through Aug 18</div><div class="t-meta num">${counts}</div></div>`),
  )}</div>`;
}

// Card grammar (2026-08-14 second pass, Afo — the shipping WorkCard grammar):
// the WHOLE card opens the promise detail; the footer button exists only when
// a claim act is available from browse. Navigation-only buttons are retired.
export function offerCard(opts: {
  queued?: boolean;
  waiting?: boolean;
  failed?: boolean;
  readOnly?: boolean;
  readOnlyNote?: string;
  detailHot?: string;
  team?: number;
} = {}): string {
  const chips = `${chip("Offer", "offer")}${opts.team ? chip(`Team of ${opts.team}`, "plain") : ""}${opts.queued ? chip("Queued", "queued") : ""}${opts.waiting ? chip("Waiting", "queued") : ""}${opts.failed ? chip("Couldn't send", "err") : ""}`;
  const cta = opts.queued || opts.waiting || opts.failed || opts.readOnly
    ? ""
    : `<div class="brow">${hot("w1.take-up", btn("Take this up", { kind: "sec" }))}</div>`;
  const note = opts.waiting
    ? `<div class="t-meta">Waiting for your garden membership — it will send once you're welcomed in.</div>`
    : opts.failed
      ? `<div class="t-meta">Five send attempts used. You can retry or discard.</div><div class="brow">${hot("w1.retry-send", btn("Retry", { kind: "sec", sm: true }))}${hot("w1.discard-send", btn("Discard", { kind: "ghost", sm: true }))}</div>`
      : opts.readOnly
        ? `<div class="t-meta">${opts.readOnlyNote ?? "This promise remains visible, but taking it up is not available right now."}</div>`
        : "";
  const title = opts.waiting ? "Compost workshop" : "Prune the north beds";
  const meta = opts.waiting ? "3 sessions · runs with the season" : "6 hours · due Aug 12";
  // Queued/waiting/failed casts are YOUR OWN sends — no by-line on yourself
  // (P1 row-subset rule: variants omit rows, never reorder them).
  const own = opts.queued || opts.waiting || opts.failed;
  const inner = `<div class="cardrow">${chips}</div><div class="t-title">${title}</div>${own ? "" : byline("Maria")}<div class="t-meta num">${meta}</div>${domainRow(["AGRO"])}${note}${cta}`;
  if (opts.queued || opts.waiting || opts.failed) return card(inner, { edge: "offer" });
  const openHot = opts.readOnly ? opts.detailHot : "w1.open-offer";
  const c = card(inner, { edge: "offer", cls: openHot ? "cardlink" : undefined });
  return openHot ? hot(openHot, c) : c;
}

export function requestCard(opts: { openClaim?: boolean; queued?: boolean; context?: string; claimHot?: string } = {}): string {
  // Mode-helper trim (2026-08-14 night): the act's own label carries the
  // claim mode — "I can help" is open, "Ask to take this up" is reviewed —
  // so the separate mode line is gone from browse cards (uiux §5.2 trim note).
  const inner = `<div class="cardrow">${chip("Request", "request")}${chip("Support / service", "plain")}${opts.queued ? chip("Queued", "queued") : ""}</div><div class="t-title">Ride to the market on Saturday</div>${byline("Ana")}<div class="t-meta num">1 ride · ${opts.context ?? "runs with the season"}</div>${
    opts.queued
      ? `<div class="t-meta">Saved on this device — it will send when connected.</div>`
      : opts.openClaim
        ? `<div class="brow">${hot(opts.claimHot ?? "w1.take-up-request", btn("I can help", { kind: "sec" }))}</div>`
        : `<div class="brow">${hot("w1.ask-take-up", btn("Ask to take this up", { kind: "sec" }))}</div>`
  }`;
  if (opts.queued) return card(inner, { edge: "request" });
  const openHot = opts.openClaim ? "w1.open-request" : "w1.open-request-gated";
  return hot(openHot, card(inner, { edge: "request", cls: "cardlink" }));
}

// Ongoing-Offer place card — the public life of a CommitmentSeries on the pool
// tab (D8a): "Ongoing" chip + places-left is the card's real progress; the
// whole card opens the series detail where places are taken up (no nav button).
export function ongoingOfferCard(): string {
  return hot("w1.open-ongoing", card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Ongoing", "plain")}${chip("Support / service", "plain")}</div><div class="t-title">Saturday veggie box</div>${byline("Maria")}<div class="t-meta num">1 box each week · runs with the season</div><div class="t-meta num">2 places open</div>`,
    { edge: "offer", cls: "cardlink" },
  ));
}

// Team-offer card — the D5 roster indicator: a forming team is visible right
// on the browse card; the whole card opens the promise (team view lives inside).
// Two-domain fixture: compost restoration pairs AGRO with WASTE, both equal.
export function teamOfferCard(): string {
  return hot("w1.open-team-offer", card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Team of 3", "plain")}</div><div class="t-title">Restore the compost bays</div>${byline("Maria")}<div class="t-meta num">4 sessions · due Aug 24</div>${domainRow(["AGRO", "WASTE"])}`,
    { edge: "offer", cls: "cardlink" },
  ));
}

export function fundedOfferCard(): string {
  return card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Support / service", "plain")}${chip("40 G$", "plain")}</div><div class="t-title">Design a market poster</div>${byline("Ben")}<div class="t-meta num">1 poster design · runs with the season</div><div class="t-meta">Your deposit instructions appear only after the funding record is ready.</div><div class="brow">${hot("w1.ask-funded", btn("Ask to fund this", { kind: "sec" }))}</div>`,
    { edge: "offer" },
  );
}

// Saved-Offer row (W32) — a saved detail set is reusable input to either offer
// path, never a second product object beside the Offer. "Offered over time" is
// the only tag that implies a pool-scoped series exists.
export function offerRow(opts: { title: string; meta: string; tag: string; tone: ChipTone; hotId?: string }): string {
  const row = listRow({
    icon: "seedling-line",
    primary: opts.title,
    meta: opts.meta,
    chipHtml: chip(opts.tag, opts.tone),
    chevron: true,
  });
  return opts.hotId ? hot(opts.hotId, row) : row;
}

// Selection-card specimen — ActionCard/GardenCard (height "selection"):
// tinted media strip standing in for the image/ActionBannerFallback, body
// with title + line, selected ring.
export function selCard(opts: { tint: string; media: string; title: string; line: string; selected?: boolean }): string {
  return `<div class="acard${opts.selected ? " on" : ""}"><div class="amedia ${opts.tint}">${opts.media}</div><div class="abody"><div class="at">${opts.title}</div><div class="am">${opts.line}</div></div></div>`;
}
export function selRail(cards: string[]): string {
  return `<div class="selrail">${cards.join("")}</div>`;
}

// Promise slide — the intro's third rail (2026-08-14, Afo: many promises must
// not stack downward): compact cards with the pool tab's direction edge,
// nearest due first, swipe for more. Tapping one enters the scoped flow.
export function promiseSlide(opts: { title: string; needs: string; due: string; edge: "offer" | "request"; hotId?: string }): string {
  const c = `<div class="card pcard edge-${opts.edge}${opts.hotId ? " cardlink" : ""}"><div class="t-title">${opts.title}</div><div class="t-meta num">${opts.needs}</div><div class="t-meta num">${opts.due}</div></div>`;
  return opts.hotId ? hot(opts.hotId, c) : c;
}

// ---- admin dialect (relocated from screens/admin.ts, components-tab pass) ---
// The M3 operator-cockpit builders shared by the admin, settlement, and funding
// screen files. Journey-hot wiring (adminChromeHots, nav targets) stays in
// screens/admin.ts — these are the drawable components only.

export type Tone = "garden" | "hub" | "community" | "actions";
export type NavId = "hub" | "garden" | "community" | "actions" | "operations";

// The browser window is the outer viewer frame (S1 scales it); its body hosts
// the full canvas (adminCanvas). deskWin stays; the invented top tab-bar does not.
export function deskWin(url: string, body: string): string {
  return `<div class="deskwin"><div class="winbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>${body}</div>`;
}

// AdminCard — M3 elevated solid surface (head + optional trailing + body).
export const acard = (head: string, body: string, trailing = "") =>
  `<div class="acard"><div class="ahead"><span class="at">${head}</span>${trailing ? `<span class="ax">${trailing}</span>` : ""}</div>${body}</div>`;

// Cycle/settlement stage stepper.
export const stages = (list: string[], activeIx: number) =>
  `<div class="stages">${list
    .map((s, i) => `<span class="st1${i < activeIx ? " done" : i === activeIx ? " on" : ""}"><i></i>${s}</span>`)
    .join(`<span class="sep"></span>`)}</div>`;

// GardenChip — the AppBar's left pill (garden selector), never a brand logo.
export const gardenChip = (name: string, hotId?: string) =>
  `<button type="button" class="gchip" data-component="GardenChip"${hotId ? ` data-hot="${hotId}"` : " disabled"} aria-label="Select garden"><span class="leaf">${icon("seedling-line", "s")}<span class="dot"></span></span><span class="nm">${esc(name)}</span><span class="caret"></span></button>`;

const iconBtn = (name: string, label: string) =>
  `<button type="button" class="iconbtn" aria-label="${esc(label)} — preview only" disabled>${icon(name)}</button>`;

// Transparent AppBar (h-14) — GardenChip left, search/bell/settings/profile right.
const adminAppBar = (garden: string, hotPrefix: string, interactive: boolean) =>
  `<header class="appbar" data-component="AppBar">${gardenChip(garden, interactive ? `${hotPrefix}.garden-selector` : undefined)}<div class="appbar-actions">${iconBtn("search-line", "Search")}${iconBtn("notification-line", "Notifications")}${iconBtn("settings-line", "Settings")}${iconBtn("user-line", "Profile")}</div></header>`;

// Floating glass workspace dock (NavigationBar) — the app's only backdrop-blur.
// Operations is appended only inside its deployer-gated workspace; it is not a
// global fifth destination for ordinary stewards.
const CORE_NAV_ITEMS: [NavId, string, string][] = [
  ["hub", "Hub", "home-line"], ["garden", "Garden", "seedling-line"],
  ["community", "Community", "group-line"], ["actions", "Actions", "leaf-line"],
];
const OPERATIONS_NAV_ITEM: [NavId, string, string] = ["operations", "Operations", "send-plane-line"];
export const navItems = (active: NavId) => active === "operations" ? [...CORE_NAV_ITEMS, OPERATIONS_NAV_ITEM] : CORE_NAV_ITEMS;
const navDock = (active: NavId, hotPrefix: string, interactive: boolean) =>
  `<nav class="navdock" aria-label="Workspaces" data-component="NavigationBar">${navItems(active).map(
    ([id, l, ic]) => `<button type="button" class="nditem${id === active ? " on" : ""}"${interactive ? ` data-hot="${hotPrefix}.nav-${id}"` : " disabled"} aria-label="${l} workspace"${id === active ? ' aria-current="page"' : ""}><span class="ndic">${icon(ic)}</span><span>${l}</span></button>`,
  ).join("")}</nav>`;

// PageHeader — big bold h1 (sticky under the AppBar) with slots. text/eyebrow/
// description are plain copy (escaped); meta/actions/toolbar carry markup.
export function pageHeader(opts: {
  title: string; eyebrow?: string; description?: string; meta?: string; actions?: string; toolbar?: string;
}): string {
  const main = `<div class="ph-main">${opts.eyebrow ? `<div class="eyebrow">${esc(opts.eyebrow)}</div>` : ""}<h1>${esc(opts.title)}</h1>${
    opts.description ? `<div class="ph-desc">${esc(opts.description)}</div>` : ""
  }${opts.meta ? `<div class="ph-meta">${opts.meta}</div>` : ""}</div>`;
  return `<div class="pghead" data-component="PageHeader"><div class="ph-row">${main}${
    opts.actions ? `<div class="ph-actions">${opts.actions}</div>` : ""
  }</div>${opts.toolbar ? `<div class="ph-toolbar">${opts.toolbar}</div>` : ""}</div>`;
}

// AdminTabRail — segmented-card sub-tabs (NOT underline). Each tab may carry a
// count and an optional hotspot id (wired only where it maps to a real screen).
export type RailTab = { label: string; count?: number; hot?: string };
export function tabRail(items: RailTab[], activeIx: number): string {
  const interactive = items.some((it) => it.hot);
  return `<div class="tabrail" role="${interactive ? "tablist" : "group"}" aria-label="${interactive ? "View" : "Current section"}" data-component="AdminTabRail" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items
    .map((it, i) => {
      const cnt = it.count != null ? `<span class="cnt">${it.count}</span>` : "";
      const content = `<span class="lbl">${esc(it.label)}</span>${cnt}`;
      return it.hot
        ? hot(it.hot, `<span class="trhit"><button type="button" role="tab" aria-selected="${i === activeIx}" class="trtab${i === activeIx ? " on" : ""}">${content}</button></span>`)
        : `<span class="trtab${i === activeIx ? " on" : ""}"${interactive ? ` role="tab" aria-selected="${i === activeIx}" aria-disabled="true"` : ""}>${content}</span>`;
    })
    .join("")}</div>`;
}

// Assemble the canvas body (AppBar + route card + dock). Screen fns wrap this in
// deskWin(url, …). tone drives the gradient + accents; nav highlights the dock.
export function adminCanvas(
  tone: Tone, nav: NavId,
  parts: { screenId: string; garden: string; header: string; tabRail?: string; body: string; interactiveChrome?: boolean },
): string {
  const hotPrefix = parts.screenId.toLowerCase();
  const interactiveChrome = parts.interactiveChrome !== false;
  return `<div class="wsgrid" data-tone="${tone}" data-component="CanvasLayout">${adminAppBar(parts.garden, hotPrefix, interactiveChrome)}<main class="mainscroll"><section class="routecard">${parts.header}${
    parts.tabRail ?? ""
  }${parts.body}</section></main>${navDock(nav, hotPrefix, interactiveChrome)}</div>`;
}

// AdminDialog — own scrim + 28dp solid surface over the dimmed canvas. `behind`
// is the full adminCanvas(...) so the dialog reads as floating over the route.
export function adminDialogM3(
  behind: string, tone: Tone, opts: { title: string; body: string; actions: string; closeHot?: string },
): string {
  const close = `<button type="button" class="dclose" aria-label="Close">${icon("close-line", "s")}</button>`;
  return `<div class="dlgstage"><div class="dlg-behind" inert aria-hidden="true">${behind}</div><div class="scrimm"></div><div class="adlg" data-tone="${tone}" data-component="AdminDialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><div class="dlg-head"><span class="dt" id="admin-dialog-title">${esc(
    opts.title,
  )}</span>${opts.closeHot ? hot(opts.closeHot, close) : close}</div><div class="dlg-body">${opts.body}</div><div class="dlg-foot">${opts.actions}</div></div></div>`;
}

// Admin action flows are hosted in a centered flow AdminDialog wrapping
// ActionFlowShell: pinned header, desktop step rail, centred reading column,
// pinned footer. The footer mirrors the shipping callers (SubmitWork /
// CreateAssessment / CreateAction): ONE leading button that morphs — Cancel on
// the first step, Back after — beside the primary, right-aligned. Back and
// Cancel never render together; the AdminDialog X (cancelHot) is the constant
// exit on every step. The real footer's left slot is a progress/status slot
// (AdminLinearProgress + message), drawn empty here because no in-flight state
// is prototyped.
export type FlowStep = { title: string; desc: string };
export function flowDialog(
  behind: string,
  tone: Tone,
  opts: { context: string; title: string; steps: FlowStep[]; current: number; body: string; back?: string; cancelHot: string; next: string },
): string {
  const rail = `<nav class="steprail" aria-label="Steps">${opts.steps
    .map((s, i) => {
      const cls = i === opts.current ? " on" : i < opts.current ? " done" : "";
      return `<div class="srow${cls}"${i === opts.current ? ' aria-current="step"' : ""}><span class="sdot">${i < opts.current ? "✓" : i + 1}</span><span><span class="st">${esc(s.title)}</span><span class="sd">${esc(s.desc)}</span></span></div>`;
    })
    .join("")}</nav>`;
  const leading = opts.back
    ? hot(opts.back, btn("Back", { kind: "ghost", icon: "arrow-left-line" }))
    : hot(opts.cancelHot, btn("Cancel", { kind: "ghost" }));
  const close = hot(opts.cancelHot, `<button type="button" class="dclose" aria-label="Close">${icon("close-line", "s")}</button>`);
  return `<div class="dlgstage"><div class="dlg-behind" inert aria-hidden="true">${behind}</div><div class="scrimm"></div><div class="adlg flow" data-tone="${tone}" data-component="AdminDialog" role="dialog" aria-modal="true" aria-labelledby="flow-dialog-title"><div class="dlg-head"><span class="eyebrow">${esc(
    opts.context,
  )}</span><span class="dt" id="flow-dialog-title">${esc(opts.title)}</span>${close}</div><div class="flowrow">${rail}<div class="dlg-body"><div class="flowform">${
    opts.body
  }</div></div></div><div class="dlg-foot"><span class="fprog"></span><span class="fend">${leading}${opts.next}</span></div></div></div>`;
}

// Dense data table — hairline row dividers, no cell borders, no zebra
// (uiux-spec §12: tabular data stays a table; queues render as list-rows).
export const dtable = (heads: string[], rows: string[][], caption: string) =>
  `<table class="dtab"><caption class="visually-hidden">${esc(caption)}</caption><thead><tr>${heads.map((h) => `<th scope="col">${h ? esc(h) : '<span class="visually-hidden">Actions</span>'}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
