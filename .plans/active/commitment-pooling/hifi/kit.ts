// Component kit — string builders over the tokens.ts classes. Each mimics a
// real Green Goods component (noted per function). Screens compose these and
// wrap journey-relevant controls with hot(id, …) from html.ts.

import { esc } from "./html";
import { icon } from "./icons";

// ---- device chrome ----------------------------------------------------------

// Installed-PWA viewport: bezel, status bar, body column, home indicator.
export function phoneFrame(body: string, opts: { offline?: boolean } = {}): string {
  return `<div class="phone"><div class="scr">
<div class="statusbar"><span class="num">9:41</span><span class="sbr">${opts.offline ? icon("wifi-off-line", "s") : ""}<span class="sb-sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i></span><span class="sb-batt"></span></span></div>
${body}
<div class="homebar"><i></i></div>
</div></div>`;
}

// Screen header — client views hand-render h1 (.title-screen grammar).
export function hdr(title: string, opts: { back?: boolean; trailing?: string } = {}): string {
  return `<div class="hdr">${opts.back ? `<button type="button" class="hback" aria-label="Back">${icon("arrow-left-line", "l")}</button>` : ""}<h1>${esc(title)}</h1>${opts.trailing ? `<span class="hx">${opts.trailing}</span>` : ""}</div>`;
}

// Garden detail tab row — the net-new 4th GardenTab "Pool" (uiux-spec §5.1).
export function gardenTabs(active: "work" | "insights" | "gardeners" | "pool"): string {
  const tabs: [string, string][] = [["work", "Work"], ["insights", "Insights"], ["gardeners", "Gardeners"], ["pool", "Pool"]];
  return `<div class="gtabs">${tabs.map(([id, l]) => `<button type="button" class="gtab${id === active ? " on" : ""}">${l}</button>`).join("")}</div>`;
}

// Bottom AppBar — packages/client/src/components/Layout/AppBar.tsx.
export function appBar(active: "home" | "garden" | "profile", opts: { badge?: number } = {}): string {
  const tabs: ["home" | "garden" | "profile", string, string][] = [
    ["home", "Home", "home"],
    ["garden", "Garden", "plant"],
    ["profile", "Profile", "user"],
  ];
  return `<div class="abar">${tabs
    .map(([id, l, ic]) => {
      const on = id === active;
      const badge = id === "home" && opts.badge ? `<span class="badge num">${opts.badge}</span>` : "";
      return `<button type="button" class="atab${on ? " on" : ""}">${badge}${icon(`${ic}-${on ? "fill" : "line"}`)}<span>${l}</span></button>`;
    })
    .join("")}</div>`;
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

// Commitment lifecycle state → chip (UI states per uiux-spec §4.3).
export function stateChip(state: string): string {
  const tones: Record<string, ChipTone> = {
    Offered: "plain", Requested: "plain", Accepted: "request", Active: "request",
    "Evidence in": "warn", "Partly approved": "warn", "Ready to confirm": "warn",
    Fulfilled: "ok", Reconciled: "plain", Cancelled: "plain", Expired: "plain",
    "Under review": "warn", Queued: "queued", Waiting: "queued",
  };
  return chip(state, tones[state] ?? "plain", { dot: true });
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
  return `<div class="seg">${items.map((l, i) => `<button type="button" class="sg${i === activeIx ? " on" : ""}">${esc(l)}</button>`).join("")}</div>`;
}

export function kv(k: string, v: string): string {
  return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
}

export function sectionTitle(t: string, trailing = ""): string {
  return `<div class="t-sec">${esc(t)}${trailing ? `<span class="hx">${trailing}</span>` : ""}</div>`;
}

// ---- forms (W3 / sheets) ----------------------------------------------------

export function field(label: string, control: string): string {
  return `<div class="fld"><span class="fl">${esc(label)}</span>${control}</div>`;
}

export function input(value: string, opts: { placeholder?: boolean; select?: boolean; icon?: string } = {}): string {
  return `<div class="inp${opts.select ? " sel" : ""}">${opts.icon ? icon(opts.icon, "s") : ""}<span${opts.placeholder ? ' class="ph"' : ""}>${esc(value)}</span></div>`;
}

export function radio(options: { label: string; meta?: string; on?: boolean }[]): string {
  return `<div class="radio">${options
    .map((o) => `<div class="ro${o.on ? " on" : ""}"><span class="rdot"></span><div><div class="rl">${esc(o.label)}</div>${o.meta ? `<div class="rm">${esc(o.meta)}</div>` : ""}</div></div>`)
    .join("")}</div>`;
}

export function stepDots(n: number, current: number): string {
  return `<div class="stepdots">${Array.from({ length: n }, (_, i) => `<i class="${i < current ? "done" : i === current ? "on" : ""}"></i>`).join("")}</div>`;
}

// ---- composition ------------------------------------------------------------

// In-phone bottom sheet over dimmed context (DialogShell / PwaSheet grammar).
export function sheetOver(behind: string, title: string, inner: string): string {
  return `<div class="sheetstage"><div class="behind">${behind}</div><div class="scrimm"></div><div class="sheet"><div class="drag"></div><div class="sh-t">${esc(title)}</div>${inner}</div></div>`;
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
