// Component kit — string builders over the tokens.ts classes. Each mimics a
// real Green Goods component (noted per function). Screens compose these and
// wrap journey-relevant controls with hot(id, …) from html.ts.

import { esc, escAttr, hot } from "./html";
import { icon } from "./icons";
import { PHONE_VIEWPORT_HEIGHT, PHONE_VIEWPORT_WIDTH } from "./tokens";

// ---- device chrome ----------------------------------------------------------

// Installed-PWA viewport: bezel, fixed status/home chrome, and the same owned
// inner scroll surface as AppShell's #app-scroll. AppShell-backed frames carry
// the shipping 69px AppBar reservation by default; callers may choose the active
// destination or explicitly opt out for a genuinely non-AppShell surface.
export function phoneFrame(body: string, opts: { offline?: boolean; appBar?: string | false; header?: string } = {}): string {
  const bottomBar = opts.appBar === false ? "" : (opts.appBar ?? appBar("garden"));
  return `<div class="phonefit" data-phone-scale="1"><div class="phone"><div class="scr" data-viewport-width="${PHONE_VIEWPORT_WIDTH}" data-viewport-height="${PHONE_VIEWPORT_HEIGHT}">
<div class="statusbar"><span class="num">9:41</span><span class="sbr">${opts.offline ? icon("wifi-off-line", "s") : ""}<span class="sb-sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i></span><span class="sb-batt"></span></span></div>
${opts.header ?? ""}<main class="appscroll" data-appbar="${bottomBar ? "visible" : "hidden"}">${body}</main>
${bottomBar}
<div class="homebar"><i></i></div>
</div></div></div>`;
}

// Fixed bottom action bar for full-screen flows — the Submit Work chrome
// (uiux §5.4: TopNav + FormProgress fixed, actions fixed at the foot). Pass
// the result as phoneFrame's appBar so it sits between the scroll and homebar.
export function actionBar(actions: string): string {
  return `<div class="fbar">${actions}</div>`;
}

// Screen header — client views hand-render h1 (.title-screen grammar).
export function hdr(title: string, opts: { back?: boolean; trailing?: string } = {}): string {
  return `<div class="hdr">${opts.back ? `<button type="button" class="hback" aria-label="Back — preview only" disabled>${icon("arrow-left-line", "l")}</button>` : ""}<h1>${esc(title)}</h1>${opts.trailing ? `<span class="hx">${opts.trailing}</span>` : ""}</div>`;
}

// Garden detail tab row — the net-new 4th GardenTab "Pool" (uiux-spec §5.1).
// With a hotPrefix, inactive tabs become inspectable hotspots (`${prefix}-work` …)
// so every drawn control a user would tap is registered.
export function gardenTabs(active: "work" | "insights" | "gardeners" | "pool", opts: { hotPrefix?: string } = {}): string {
  const tabs: [string, string][] = [["work", "Work"], ["insights", "Insights"], ["gardeners", "Gardeners"], ["pool", "Pool"]];
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

export function card(inner: string, opts: { cls?: string } = {}): string {
  return `<div class="card${opts.cls ? " " + opts.cls : ""}">${inner}</div>`;
}

export function banner(text: string, tone: "amber" | "stone" | "green" | "error", ic = "information-line"): string {
  return `<div class="ban ${tone}">${icon(ic, "s")}<span>${esc(text)}</span></div>`;
}

export function statTiles(items: { n: string; label: string }[]): string {
  return `<div class="stats">${items.map((s) => `<div class="stat"><div class="n">${esc(s.n)}</div><div class="l">${esc(s.label)}</div></div>`).join("")}</div>`;
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
  opts: { kind?: "pri" | "sec" | "ghost" | "danger"; icon?: string; full?: boolean; sm?: boolean; disabled?: boolean } = {},
): string {
  const k = opts.kind ?? "sec";
  return `<button type="button" class="b ${k}${opts.full ? " full" : ""}${opts.sm ? " sm" : ""}"${opts.disabled ? " disabled" : ""}>${opts.icon ? icon(opts.icon, "s") : ""}${esc(label)}</button>`;
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

export function seg(items: string[], activeIx: number): string {
  return `<div class="seg" role="group" aria-label="Current filter">${items.map((l, i) => `<span class="sg${i === activeIx ? " on" : ""}"${i === activeIx ? ' aria-current="true"' : ""}>${esc(l)}</span>`).join("")}</div>`;
}

export function kv(k: string, v: string): string {
  return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
}

export function sectionTitle(t: string, trailing = ""): string {
  return `<div class="t-sec">${esc(t)}${trailing ? `<span class="hx">${trailing}</span>` : ""}</div>`;
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

export function input(value: string, opts: { placeholder?: boolean; select?: boolean; icon?: string; ariaLabel?: string; labelledBy?: string } = {}): string {
  const naming = opts.labelledBy
    ? ` aria-labelledby="${escAttr(opts.labelledBy)}"`
    : opts.ariaLabel
      ? ` aria-label="${escAttr(opts.ariaLabel)}"`
      : "";
  const control = opts.select
    ? `<select${naming} disabled><option>${esc(value)}</option></select>`
    : `<input type="text"${naming}${opts.placeholder ? ` placeholder="${escAttr(value)}"` : ` value="${escAttr(value)}"`} readonly>`;
  return `<span class="inp${opts.select ? " sel" : ""}">${opts.icon ? icon(opts.icon, "s") : ""}${control}</span>`;
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
