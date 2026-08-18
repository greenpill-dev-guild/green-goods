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
// Two acts in a bar are equal halves (2026-08-17, Afo). Sized to their text they
// came out at 131 and 124 in a 358px bar, so the pair looked ragged and the
// target position moved from screen to screen. This wraps them as ONE element,
// which also keeps the capture bar's icon run out of the rule: that is a run,
// not a pair.
export function barPair(a: string, b: string): string {
  return `<div class="fpair">${a}${b}</div>`;
}

export function actionBar(primary: string, secondary?: string): string {
  return `<div class="fbar">${secondary ?? ""}${primary}</div>`;
}

// Screen header — client views hand-render h1 (.title-screen grammar).
export function hdr(title: string, opts: { back?: boolean; trailing?: string } = {}): string {
  return `<div class="hdr">${opts.back ? `<button type="button" class="hback" aria-label="Back, preview only" disabled>${icon("arrow-left-line", "l")}</button>` : ""}<h1>${esc(title)}</h1>${opts.trailing ? `<span class="hx">${opts.trailing}</span>` : ""}</div>`;
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

// The direction edge — a 3px inset stripe, green for offers, sky for requests —
// was retired 2026-08-16 (round 8, Afo). Direction is already carried by the
// Offer/Request chip in text, so the stripe was a second encoding of the same
// fact, and it gave otherwise identical cards two different silhouettes.
export function card(inner: string, opts: { cls?: string } = {}): string {
  return `<div class="card${opts.cls ? ` ${opts.cls}` : ""}">${inner}</div>`;
}

export function banner(text: string, tone: "amber" | "stone" | "green" | "error", ic = "information-line"): string {
  return `<div class="ban ${tone}">${icon(ic, "s")}<span>${esc(text)}</span></div>`;
}

// ---- atoms ------------------------------------------------------------------

// `season` and `campaign` are ONE hue at two weights (2026-08-17, Afo: "the
// season/campaign tag should be color coded"). They needed their own, because a
// cycle is a different CLASS of tag from the three that existed: offer/request
// is direction, domain is subject matter, and a cycle is the container both sit
// in. Admin had been drawing `chip("Campaign", "request")` — the Request tone
// exactly — so a campaign tag and a request tag were the same colour, and the
// client drew no chip at all, carrying the cycle as prose in the meta line.
// Filled season, outlined campaign: the season is the pool's ground rhythm and
// campaigns run on top of it, any number at a time.
export type ChipTone =
  | "plain" | "offer" | "request" | "domain" | "ok" | "warn" | "err" | "ink" | "queued"
  | "season" | "campaign";
export function chip(label: string, tone: ChipTone = "plain", opts: { dot?: boolean } = {}): string {
  const t = tone === "plain" ? "" : ` ${tone}`;
  return `<span class="ch${t}${opts.dot ? " dot" : ""}">${esc(label)}</span>`;
}

// Tap-first PICKERS are not chips-as-labels, even though they were built from
// the same function (2026-08-17, Afo: "the unit, how many each one and open
// places to start … can be slightly bigger so easier to select"). A label on a
// card describes; a picker is a control, and `.ch`'s box reset at tokens.ts
// deliberately defeats the 44px minimum — correct for the label, an
// accessibility defect for the control. `pickRow` is the control form: same
// shape, real target, one row.
export function pickRow(
  items: { label: string; on?: boolean; hotId?: string }[],
  opts: { ariaLabel?: string } = {},
): string {
  const label = opts.ariaLabel ? ` aria-label="${escAttr(opts.ariaLabel)}"` : "";
  return `<div class="pickrow" role="group"${label}>${items
    .map((it) => {
      // Preview-only pickers are honestly disabled — the selected value is a
      // fixture, not a live control (validate.ts's enabled-button rule). Only a
      // picker that actually goes somewhere carries a hotspot.
      const b = `<button type="button" class="pick${it.on ? " on" : ""}"${
        it.on ? ' aria-pressed="true"' : ' aria-pressed="false"'
      }${it.hotId ? "" : " disabled"}>${esc(it.label)}</button>`;
      return it.hotId ? hot(it.hotId, b) : b;
    })
    .join("")}</div>`;
}

// Tap-first reasons (register #95): the common reasons for an act render as
// chips above its reason field. Tapping fills the field; the field stays — it
// is the stored record and REASON_CONFIRMS still requires it. Chips carry no
// hotspot: the acting control of these dialogs remains the confirm button.
export function reasonChips(options: string[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:2px 0">${options.map((o) => chip(o)).join("")}</div><div class="t-meta">Tap a reason to fill it in, or say it your own way.</div>`;
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
    "Proof in": ["warning", "image-line"], "Partly approved": ["warning", "time-line"],
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
  const row = opts.left || opts.right ? `<div class="mtrow"><span>${esc(opts.left ?? "")}</span><span class="num">${esc(opts.right ?? "")}</span></div>` : "";
  return `<div class="meter"><div class="tr"><div class="fi" style="width:${pct}%"></div>${tick}</div>${row}</div>`;
}

export function timeline(entries: { label: string; meta?: string; open?: boolean; warn?: boolean; note?: string }[]): string {
  return `<div class="tl">${entries
    .map(
      (e) =>
        `<div class="te${e.open ? " open" : ""}${e.warn ? " warn" : ""}"><span class="td"></span><div class="tb"><b>${esc(e.label)}</b>${e.meta ? ` <span class="tm">· ${esc(e.meta)}</span>` : ""}${e.note ? `<div class="tm">${esc(e.note)}</div>` : ""}</div></div>`,
    )
    .join("")}</div>`;
}

// `thumb` swaps the leading glyph for a real 44px thumbnail (2026-08-17, Afo:
// media stays ONE list, and the photo rows carry the picture rather than an
// image-line icon). 44px is the shipped minimum touch target — Media.tsx sizes
// its remove control `min-h-11 min-w-11` — so the thumbnail is tappable into
// the preview at the size a finger already expects. `thumbHotId` makes it so.
export function listRow(opts: {
  icon?: string;
  thumb?: number;
  thumbHotId?: string;
  primary: string;
  meta?: string;
  chipHtml?: string;
  trailing?: string;
  chevron?: boolean;
}): string {
  const tail = `${opts.chipHtml ?? ""}${opts.trailing ?? ""}${opts.chevron ? icon("arrow-right-s-line") : ""}`;
  let lead = "";
  if (opts.thumb !== undefined) {
    const t = `<span class="lthumb" role="img" aria-label="${escAttr(opts.primary)}" style="background-image:${photoFill(opts.thumb)}"><span class="zoom">${icon("search-line", "s")}</span></span>`;
    lead = opts.thumbHotId ? hot(opts.thumbHotId, t) : t;
  } else if (opts.icon) {
    lead = icon(opts.icon);
  }
  return `<div class="lr">${lead}<div class="grow"><div class="lp">${esc(opts.primary)}</div>${opts.meta ? `<div class="lm">${esc(opts.meta)}</div>` : ""}</div>${tail ? `<div class="tail">${tail}</div>` : ""}</div>`;
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

// A titled section on a read surface: a quiet h6 label sitting on the canvas
// with its content in a card beneath (2026-08-16 round 10). This is the shipped
// work view's anatomy verbatim — WorkView.tsx renders `<h6>Garden</h6>` then a
// GardenCard, `<h6>Media</h6>` then a Carousel, `<h6>Details</h6>` then
// FormCards — and it is what replaced the commitment view's stack of disclosures.
//
// The label stays OUTSIDE the card because that is where the work view puts it;
// carding the label too would box the whole page and lose the scannable rhythm
// of heading, content, heading, content.
// unitLabel is an UNBOUNDED on-chain string, and no contract bound is being
// added for now (2026-08-17, Afo: "avoid contract work for now and make sure the
// UI has a good guard that will work with future contract deployments"). So the
// guard cannot live on the write path alone — anything writing directly to the
// module can store a label of any length, and every surface that renders one has
// to survive it.
//
// This is the render-side guard: a label longer than the cap is cut with an
// ellipsis and keeps its full text in `title`, so nothing overflows and nothing
// is silently lost. It is deliberately independent of whatever the composer
// allows, so it keeps working unchanged if a contract bound lands later — a
// bound only makes the truncation stop firing.
export const UNIT_LABEL_CAP = 24;
export function unitLabel(raw: string): string {
  const clean = raw.trim();
  return clean.length <= UNIT_LABEL_CAP
    ? esc(clean)
    : `<span class="ulab" title="${escAttr(clean)}">${esc(clean.slice(0, UNIT_LABEL_CAP - 1))}…</span>`;
}

// The commitment's identity card (2026-08-17 round 21, Afo). The top of the
// commitment view had been four bare rows stacked on the canvas — header, chips,
// a lone domain row, a dense people line — each with its own ad-hoc padding and
// no grouping. This is one object: the card someone tapped in the pool, expanded.
//
// Terms deliberately stay OUT of it and remain in Details (Afo: "we don't want to
// repeat too much information"). What the card carries instead is the thing that
// exists nowhere else — where this stands and what has been done.
export function identityCard(opts: {
  title: string;
  chips: string;
  domains?: string[];
  people: { initial: string; line: string }[];
  teamRow?: string;
  progress?: string;
}): string {
  const peopleRows = opts.people
    .map((p) => `<div class="idp"><span class="avatar">${esc(p.initial)}</span><span>${esc(p.line)}</span></div>`)
    .join("");
  return `<div class="card idcard"><div class="idt">${esc(opts.title)}</div><div class="cardrow">${opts.chips}${
    opts.domains ? domainRow(opts.domains) : ""
  }</div><div class="idrule"></div>${peopleRows}${opts.teamRow ?? ""}${
    opts.progress ? `<div class="idrule"></div>${opts.progress}` : ""
  }</div>`;
}

// "What's been done" — the completion picture, and the one place the difference
// between the two readiness paths is legible. Requirement counts carry BARS
// because approved work is what advances a DomainImpact commitment; evidence
// sits below a hairline with NO bar, because on garden work it credits the
// people who helped without moving readiness at all (contract-spec: attachEvidence
// has no kind gate, but submitForConfirmation rejects DomainImpact). On a service
// the proof line IS the readiness path, so it stands alone.
export function progressBlock(opts: {
  rows?: { label: string; done: number; of: number }[];
  proof?: string;
  assessment?: string;
  note?: string;
}): string {
  const bars = (opts.rows ?? [])
    .map((r) => {
      const pct = r.of === 0 ? 0 : Math.round((r.done / r.of) * 100);
      return `<div class="prow">${meter(pct, { left: r.label, right: `${r.done} of ${r.of}` })}${
        r.done >= r.of ? `<span class="pdone">${icon("check-line", "s")}</span>` : ""
      }</div>`;
    })
    .join("");
  const tail = [
    opts.proof ? `<div class="pflat">${icon("image-line", "s")}<span>${esc(opts.proof)}</span></div>` : "",
    opts.assessment ? `<div class="pflat">${icon("shield-check-line", "s")}<span>${esc(opts.assessment)}</span></div>` : "",
  ].join("");
  return `<div class="h6s">What's been done</div>${bars}${
    tail ? `${bars ? `<div class="phair"></div>` : ""}${tail}` : ""
  }${opts.note ? `<div class="t-meta">${esc(opts.note)}</div>` : ""}`;
}

// MemberCard — the details step's added-team carousel. The carousel is Afo's
// call from round 15 ("when you add we place in a carousel in the top half"),
// and it is the right call for SPACE: a vertical roster pushes the media list
// off a 700px phone as soon as three people are on it.
//
// What it held was wrong. A 96px tile carried an initial, a truncated name and
// a truncated address, and — because of the `.mtile` collision — rendered as a
// 60px green square showing only the letter: "they don't give any context as to
// who you added or anything" (2026-08-17, Afo). So the carousel stays and the
// CARD grows up: 216px laid out as GardenMemberItem is laid out — 40px avatar
// left, name and account stacked beside it, role beneath — with the remove
// control absolutely positioned so it costs the text column no width.
//
// Registered-date is deliberately NOT carried. Gardeners.tsx shows it because
// that list is a membership record; this list is a team you are assembling, and
// when someone joined the garden has no bearing on whether they should be on
// this commitment. Role does: exactly one person is the accountable
// leadProvider, and this is the last cheap moment to correct which one.
export function memberCard(opts: {
  name: string;
  sub?: string;
  photo?: number;
  role?: string;
  lead?: boolean;
  removeHotId?: string;
  hotId?: string;
}): string {
  const remove = opts.removeHotId
    ? hot(
        opts.removeHotId,
        // Media.tsx's remove control: a bordered surface square holding the
        // close glyph, not a bare glyph. The button itself stays transparent so
        // the 44px minimum touch target does not inflate the visible box.
        `<button class="mcx" type="button" aria-label="${escAttr(`Remove ${opts.name} from the team`)}"><span class="mcxb">${icon("close-line", "s")}</span></button>`,
      )
    : "";
  const card = `<div class="mcard">${remove}${avatar({ name: opts.name, photo: opts.photo })}<div class="grow"><div class="mn${
    /^0x/i.test(opts.name) ? " addr" : ""
  }" title="${escAttr(opts.name)}">${esc(opts.name)}</div>${
    opts.sub ? `<div class="ms" title="${escAttr(opts.sub)}">${esc(opts.sub)}</div>` : ""
  }${opts.role ? `<div class="mrole${opts.lead ? " lead" : ""}">${esc(opts.role)}</div>` : ""}</div></div>`;
  return opts.hotId ? hot(opts.hotId, card) : card;
}
export function memberTrail(cards: string[]): string {
  return `<div class="mtrail" role="group" aria-label="On the team">${cards.join("")}</div>`;
}

// FormCard — the shipped review's detail card, one per detail
// (packages/client/src/components/Cards/Form/FormCard.tsx:19): a card whose head
// is an icon plus the label above a rule, with the value beneath it. WorkView
// stacks these under an h6 "Details"; Submit Work's review IS a WorkView, so
// every review in this feature stacks them too (2026-08-17, Afo: "the review
// view needs to follow the form cards we use in work submission").
export function formCard(ic: string, label: string, value: string): string {
  return `<div class="fcard"><div class="fch">${icon(ic)}<span>${esc(label)}</span></div><div class="fcv">${esc(value)}</div></div>`;
}

export function sectionCard(label: string, inner: string, opts: { flush?: boolean } = {}): string {
  return `<div class="h6s">${esc(label)}</div><div class="card sect${opts.flush ? " flush" : ""}">${inner}</div>`;
}

// A label/value row inside a section card. WorkView stacks one FormCard per
// detail, but it carries two; a commitment carries six, and six cards each with
// their own bordered header would be exactly the card-itis the design contract
// warns about. One card, six rows.
export function detailRow(label: string, value: string): string {
  return `<div class="drow"><span class="dk">${esc(label)}</span><span class="dv">${esc(value)}</span></div>`;
}

// OfferRecord — what an ongoing offer has given, over time (2026-08-17, Afo:
// "one thing she's able to offer multiple times, and the key reason is how do
// we show the value of a commitment over time").
//
// This is the whole reason an ongoing offer exists. A commitment is the unit of
// ACCOUNTABILITY — it opens, is taken up, is confirmed, and ends. An ongoing
// offer is the unit of VALUE, and its worth is the pattern: twelve sessions
// across five seasons, which no single commitment can express.
//
// Every figure here is a NUMERATOR. That is the rule, not a style choice.
// Appendix D.3 forbids per-person rates, grades and comparisons on public
// surfaces, and what makes those possible is a denominator: "4 kept · 1 lapsed"
// lets anyone compute 80%, while "12 sessions given" cannot be turned into a
// score however you arrange it. So the public record counts things that
// HAPPENED and never states a total. The cost is deliberate and was accepted:
// this never distinguishes twelve of twelve from twelve of thirty. The full
// kept-and-lapsed record stays where D.3 puts it, with the member and their
// stewards.
export function offerRecord(opts: {
  since: string;
  given: string;
  people?: string;
  compact?: boolean;
}): string {
  const parts = [`Running since ${esc(opts.since)}`, esc(opts.given), opts.people ? esc(opts.people) : ""].filter(Boolean);
  if (opts.compact) return `<div class="orec compact">${parts.join(" · ")}</div>`;
  return `<div class="orec">${parts
    .map((p, i) => `<div class="orow"${i === 0 ? "" : ""}>${icon(i === 0 ? "time-line" : i === 1 ? "hand-heart-line" : "group-line", "s")}<span>${p}</span></div>`)
    .join("")}</div>`;
}

// ---- photographs ------------------------------------------------------------
//
// A photograph, drawn (2026-08-17, Afo: "if you add an image, it shows the image
// and you have an image preview. Not just a card"). The artifact is one
// self-contained file with no external requests, so a real JPEG is not on the
// table — but a word in a tinted box is not a photograph either, and every
// media surface in this feature was drawing one. Each fill is a layered
// gradient with the anatomy a cropped garden photo has at 44–96px: a soft
// highlight where light falls, a mid body, a darker foot. Deterministic by
// index, so an item draws the same picture on every render and across screens.
// Each fill layers a bright source, a shadowed corner and a body ramp. Two
// layers alone read as a colour swatch at 44px — a photograph has light coming
// from somewhere and dark somewhere else, and that contrast is what makes a
// thumbnail legible as a picture rather than a tint.
const PHOTO_FILLS = [
  "radial-gradient(58% 46% at 24% 14%, rgba(255,252,224,.72), transparent 70%), radial-gradient(72% 64% at 88% 96%, rgba(12,26,10,.62), transparent 66%), linear-gradient(158deg,#A6C177 0%,#5C7C3F 44%,#24361C 100%)",
  "radial-gradient(54% 44% at 76% 18%, rgba(255,246,214,.68), transparent 68%), radial-gradient(70% 62% at 14% 92%, rgba(30,16,6,.60), transparent 64%), linear-gradient(196deg,#D8B584 0%,#8A6B45 50%,#3B2A18 100%)",
  "radial-gradient(60% 48% at 34% 82%, rgba(248,255,232,.62), transparent 70%), radial-gradient(66% 58% at 82% 10%, rgba(16,32,14,.58), transparent 62%), linear-gradient(142deg,#BFD495 0%,#6E8C4C 42%,#2C3F21 100%)",
  "radial-gradient(56% 46% at 62% 20%, rgba(255,240,226,.70), transparent 66%), radial-gradient(72% 60% at 10% 94%, rgba(40,14,8,.58), transparent 64%), linear-gradient(172deg,#E4B79E 0%,#A2694F 48%,#4A2A1D 100%)",
  "radial-gradient(58% 44% at 20% 26%, rgba(240,255,246,.62), transparent 68%), radial-gradient(68% 62% at 90% 88%, rgba(8,28,22,.60), transparent 64%), linear-gradient(150deg,#A3C6AE 0%,#527A63 42%,#1F352A 100%)",
  "radial-gradient(56% 48% at 70% 72%, rgba(255,253,226,.66), transparent 68%), radial-gradient(66% 56% at 16% 12%, rgba(26,28,10,.56), transparent 62%), linear-gradient(184deg,#CBD199 0%,#7E8A52 46%,#343A1E 100%)",
];
export function photoFill(ix: number): string {
  return PHOTO_FILLS[((ix % PHOTO_FILLS.length) + PHOTO_FILLS.length) % PHOTO_FILLS.length];
}

// Avatar — Gardeners.tsx:72 resolves `member.avatar || ensAvatar ||
// "/images/avatar.png"`, so a gardener is a PHOTOGRAPH in the product, and the
// generic person image when nothing is on file. It is never a letter; the
// letter-initial discs this kit used were an invention with no shipped analog,
// which is how a member card could collapse to "one letter" and still look
// deliberate. Pass `photo` when the person has one, omit it for the default.
export function avatar(opts: { name: string; photo?: number; cls?: string }): string {
  const cls = `avatar${opts.cls ? ` ${opts.cls}` : ""}`;
  if (opts.photo === undefined)
    return `<span class="${cls} nopic" role="img" aria-label="${escAttr(`${opts.name}, no photo on file`)}">${icon("user-fill")}</span>`;
  return `<span class="${cls}" role="img" aria-label="${escAttr(opts.name)}" style="background-image:${photoFill(opts.photo)}"></span>`;
}

// The COMPOSER treatment. Media.tsx is `flex flex-col gap-3` on mobile and only
// becomes a grid at md:, which a 390px phone never reaches — so what a gardener
// actually sees is full-width photos at aspect-4/3, stacked, each big enough to
// check before sending, with the remove control pinned over the image
// (2026-08-17, Afo: "go take a look at the actual client code … we are not
// using a grid"). The READ surface is a different treatment; see mediaStrip.
export function mediaStack(
  items: { label: string; photo?: number; kind?: "audio" | "link" | "note"; removeHotId?: string; hotId?: string }[],
): string {
  const KIND_IC = { audio: "mic-line", link: "link-m", note: "sticky-note-line" } as const;
  return `<div class="mstack">${items
    .map((m) => {
      if (m.photo === undefined)
        return `<div class="mrow">${icon(KIND_IC[m.kind ?? "note"])}<div class="grow"><div class="lp">${esc(m.label)}</div></div>${
          m.removeHotId
            ? hot(m.removeHotId, `<button class="mx" type="button" aria-label="${escAttr(`Remove ${m.label}`)}">${icon("close-line", "s")}</button>`)
            : ""
        }</div>`;
      const shot = `<div class="mshot" role="img" aria-label="${escAttr(m.label)}" style="background-image:${photoFill(m.photo)}"><span class="zoom">${icon("search-line", "s")}</span></div>`;
      return `<div class="mwrap">${m.hotId ? hot(m.hotId, shot) : shot}${
        m.removeHotId
          ? hot(m.removeHotId, `<button class="mx over" type="button" aria-label="${escAttr(`Remove ${m.label}`)}">${icon("close-line", "s")}</button>`)
          : ""
      }</div>`;
    })
    .join("")}</div>`;
}

// Media strip — the work view's Carousel of ImageWithFallback tiles. Evidence
// on the commitment view used to be text rows with an image icon; showing the
// actual thumbnails is the single biggest reason to flatten this screen.
//
// The tiles are real thumbnails as of 2026-08-17 (Afo, read views). A photo
// draws its picture; a voice note, a link and a written note have no image to
// draw, so they keep the dashed tile and carry their KIND as a glyph rather
// than the word "note" — WorkView's media section only ever holds images, so
// the non-image kinds are this feature's own addition and should not pretend
// to be pictures. Class is `.mthumb`, not `.mtile`: the member tile also
// claimed `.mtile`, and on client screens `.hf.s-client .mtile` outweighed
// `.hf .mtile`, so every member card rendered at the media tile's 60×78 with
// its name box computing to 2px.
export function mediaStrip(
  items: { label: string; photo?: number; kind?: "audio" | "link" | "note"; hotId?: string }[],
): string {
  const KIND_IC = { audio: "mic-line", link: "link-m", note: "sticky-note-line" } as const;
  return `<div class="mstrip">${items
    .map((m) => {
      const tile =
        m.photo === undefined
          ? `<div class="mthumb kind"><span class="ic-wrap">${icon(KIND_IC[m.kind ?? "note"])}</span><span class="mtl">${esc(m.label)}</span></div>`
          : `<div class="mthumb" role="img" aria-label="${escAttr(m.label)}" style="background-image:${photoFill(m.photo)}"><span class="zoom">${icon("search-line", "s")}</span></div>`;
      return m.hotId ? hot(m.hotId, tile) : tile;
    })
    .join("")}</div>`;
}

// ImagePreview — ImagePreviewDialog (shared/components/Dialog), the thing a
// thumbnail opens into. Its header is a counter on the left and a control
// cluster on the right, over a black-to-transparent gradient; the image is
// object-contain inside a rounded, hairline-bordered viewport; prev/next arrows
// appear only when there IS a prev or next. The zoom trio is `hidden sm:flex`
// in the shipped component — pinch is native on touch — so a phone frame draws
// download and close only, which is what makes room for the close button at
// 375px. Photos only: the dialog is fed `photoOnlyData`, so a voice note or a
// link in the same list is not part of the sequence and the counter never
// counts it (Media.tsx:165).
export function imagePreview(opts: {
  ix: number;
  of: number;
  photo: number;
  closeHotId: string;
  downloadHotId: string;
  prevHotId?: string;
  nextHotId?: string;
}): string {
  const iconBtn = (id: string | undefined, ic: string, label: string, cls: string) => {
    const b = `<button class="ipb ${cls}" type="button" aria-label="${escAttr(label)}">${icon(ic)}</button>`;
    return id ? hot(id, b) : b;
  };
  return `<div class="ipv" role="dialog" aria-label="Image preview" aria-modal="true">
<div class="iph"><span class="ipc">${opts.ix} / ${opts.of}</span><span class="ipa">${iconBtn(
    opts.downloadHotId,
    "external-link-line",
    "Download image",
    "",
  )}<span class="ipsep">${iconBtn(opts.closeHotId, "close-line", "Close preview", "solid")}</span></span></div>
<div class="ipi" style="background-image:${photoFill(opts.photo)}"></div>
${opts.prevHotId ? iconBtn(opts.prevHotId, "arrow-left-s-line", "Previous image", "nav prev") : ""}
${opts.nextHotId ? iconBtn(opts.nextHotId, "arrow-right-s-line", "Next image", "nav next") : ""}
</div>`;
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

// stepDots retired 2026-08-16: its one consumer (the W26 full-page wizard)
// converted to the flow dialog's step rail; client wizards render FormProgress.

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
    ? `<button type="button" class="hback" aria-label="Close, preview only" disabled>${icon("close-line", "l")}</button>`
    : `<button type="button" class="hback" aria-label="Back, preview only" disabled>${icon("arrow-left-line", "l")}</button>`;
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
// The handle distinguishes the two shipped shells, and they size differently
// (2026-08-16 round 11): a gesture sheet (PwaSheet, with the drag handle) is as
// tall as its content up to a ceiling; a tabbed drawer (ModalDrawer /
// WalletDrawer, no handle) is a FIXED tall panel, because its tabs must not
// make the whole surface jump height as you move between them.
//
// The body scrolls; the handle and title stay pinned. Neither was true before —
// the sheet had no max-height and no overflow at all, so long content simply
// grew past the top of the phone with no way to reach it.
export function sheetOver(
  behind: string,
  title: string,
  inner: string,
  opts: { handle?: boolean; ic?: string; info?: string } = {},
): string {
  const drawer = opts.handle === false;
  const handle = drawer ? "" : `<div class="drag"></div>`;
  // With an icon and info, the sheet header takes FormInfo's anatomy — badge,
  // title, meaning (2026-08-16 round 11). A sheet already owns a title, so a
  // FormInfo card *inside* it would state the same thing twice; giving the
  // header the same shape is how a sheet joins the flow grammar without
  // repeating itself.
  const head = opts.info
    ? `<div class="sh-head"><span class="fic">${icon(opts.ic ?? "information-line")}</span><div class="grow"><div class="sh-t">${esc(
        title,
      )}</div><div class="fi">${esc(opts.info)}</div></div></div>`
    : `<div class="sh-t">${esc(title)}</div>`;
  return `<div class="sheetstage"><div class="behind">${behind}</div><div class="scrimm"></div><div class="sheet${
    drawer ? " drawer" : ""
  }">${handle}${head}<div class="sh-body">${inner}</div></div></div>`;
}

// Garden-detail header (views/Home/Garden/index.tsx): fixed image banner (h-36,
// rounded-b-3xl) with an overlaid back control, then the garden name +
// location/founded meta. The bottom AppBar is hidden here — this is the chrome.
export function gardenHeader(name: string, meta: { location: string; founded: string }): string {
  return `<div class="ghead"><div class="gbanner"><button type="button" class="gback" aria-label="Back, preview only" disabled>${icon("arrow-left-line", "l")}</button></div><div class="gtitle"><h1 class="title-section">${esc(name)}</h1><div class="gmeta"><span class="gm">${icon("home-line", "s")}${esc(meta.location)}</span><span class="gsep">•</span><span class="gm">${icon("calendar-line", "s")}${esc(meta.founded)}</span></div></div></div>`;
}

// Home header (views/Home/index.tsx): h4 title + a trailing icon-button row
// (filter / wallet / work). Distinct from garden-detail's banner header.
export function homeHeader(): string {
  return `<div class="hhead"><h4 class="hh-title">Home</h4><div class="hh-actions"><button type="button" class="hh-ic" aria-label="Filter, preview only" disabled>${icon("search-line", "s")}</button><button type="button" class="hh-ic" aria-label="Wallet, preview only" disabled>${icon("wallet-line", "s")}</button><button type="button" class="hh-ic" aria-label="Work, preview only" disabled>${icon("plant-line", "s")}</button></div></div>`;
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
// byline (avatar + "by Maria") retired 2026-08-16: the commitment card carries the
// creator as the first field of its meta line, so nothing rendered it any more.

// Team strip — overlapping initial avatars (W2 people row, the funding pledge
// row). Net-new as a primitive: the shipping client renders people via
// ImageWithFallback letter fallbacks per view, with no avatar-stack component.
export function teamstrip(initials: readonly string[]): string {
  return `<span class="teamstrip">${initials.map((n) => `<span class="avatar" aria-hidden="true">${esc(n)}</span>`).join("")}</span>`;
}

// Domains get their own equal-weight row (2026-08-14 second pass, Afo): every
// involved domain listed, none privileged as "primary" — a commitment pairing
// AGRO with EDU is both, not AGRO-with-a-footnote. No row = an evidence-only
// service commitment, and the "Support / service" kind chip up top says so in
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

// MemberRow — the shipped garden Gardeners item, reused wherever this feature
// needs to show or pick a person (2026-08-17, Afo: "take some styling and look
// from the gardeners list we have in the garden view"). Anatomy read from
// packages/client/src/components/Features/Garden/Gardeners.tsx:74 — a full-width
// tappable row, 40px avatar, name, subline, a registered line with a calendar
// glyph, and an optional badge pinned top-right.
//
// The name follows that component's own resolution order: username, then email
// or phone, and only THEN a formatted address. So a wallet address appears as
// the primary line exactly when nothing better is on file — which is the rule
// Afo asked for, and which shipped code already implements.
export function memberRow(opts: {
  name: string;
  sub?: string;
  joined?: string;
  badge?: string;
  photo?: number;
  select?: "on" | "off";
  hotId?: string;
}): string {
  const sel = opts.select ? `<span class="msel${opts.select === "on" ? " on" : ""}" aria-hidden="true"></span>` : "";
  const row = `<div class="mbrow${opts.select === "on" ? " picked" : ""}">
${avatar({ name: opts.name, photo: opts.photo })}
<div class="grow"><div class="mn${/^0x/i.test(opts.name) ? " addr" : ""}">${esc(opts.name)}</div>${
    opts.sub ? `<div class="ms">${esc(opts.sub)}</div>` : ""
  }${opts.joined ? `<div class="mj">${icon("calendar-line", "s")}${esc(opts.joined)}</div>` : ""}</div>
${opts.badge ? `<span class="mbadge">${esc(opts.badge)}</span>` : ""}${sel}</div>`;
  return opts.hotId ? hot(opts.hotId, row) : row;
}

// Scoped state counts, never a cross-commitment percentage: this pool's units
// are hours, rides, sessions and surveys, so a single "62%" would average
// incommensurable things (uiux-spec §5.2, §12). A seeded or empty season shows
// no counts line at all rather than a row of zeroes. The card counts commitments
// made and kept — the same pair W5, W12, W15 and W26 print for this moment
// (PRD-760). Cycle cards follow layout option B (2026-08-14 third pass, Afo):
// the [Season]/[Campaign] + stage chips LEAD the card, everything stacks on
// one left axis, and counts join the stack — nothing floats right.
// What is still open in this cycle, by exact unit label (2026-08-16 round 8,
// Afo). This is where pool capacity belongs on the client: on the cycle card
// that already owns the scope, not in a separate "what this pool holds" card
// above it — that card cost 236px of a 700px phone and pushed every commitment
// below the fold.
//
// Scope is the CYCLE, not the pool, which is also more correct than the block
// it replaces: a season card showing pool-wide units would be describing a
// different thing than its own counts. Derived from SEASON_LIVE so the units
// and the kept counts on the same card cannot drift apart. Never summed —
// "27 hours" and "7 rides" share no denominator (Appendix D.1).
const seasonOpenUnits = () =>
  Object.entries(SEASON_LIVE.units)
    .map(([label, { done, of }]) => `${of - done} ${label}`)
    .join(" · ");

// Cycle card — the commitment card's anatomy with one extra meta line, because a
// cycle carries both what is open in it and how it has gone (2026-08-16 round
// 9). Title first, tags last, square reserved on the right at the card's full
// content height.
export function cycleCard(opts: {
  title: string;
  units: string;
  counts: string;
  kind: string;
  stage: string;
  media?: { label: string; tint?: "agro" | "waste" | "garden" | "quiet"; photo?: number };
  hotId?: string;
}): string {
  const inner = `<div class="pcbody"><div class="t-title">${esc(opts.title)}</div><div class="t-meta num">${
    opts.units ? `${esc(opts.units)} open` : "nothing open"
  }</div><div class="t-meta num">${esc(opts.counts)}</div><div class="ptags">${chip(opts.kind, opts.kind === "Season" ? "season" : opts.kind === "Campaign" ? "campaign" : "plain")}${chip(opts.stage)}</div></div>${
    opts.media ? `<div class="pmedia tall" role="img" aria-label="${escAttr(opts.media.label)}" style="background-image:${photoFill(opts.media.photo ?? 0)}"></div>` : `<div class="pmedia tall none"></div>`
  }`;
  const c = card(inner, { cls: `pcard2 cyc${opts.hotId ? " cardlink" : ""}` });
  return opts.hotId ? hot(opts.hotId, c) : c;
}

export function seasonCard(opts: { made?: number; kept?: number; stage?: string; units?: string } = {}): string {
  const made = opts.made ?? SEASON_LIVE.made;
  const kept = opts.kept ?? SEASON_LIVE.kept;
  return cycleCard({
    title: CYCLE,
    units: opts.units ?? seasonOpenUnits(),
    counts: made === 0 && kept === 0 ? "no commitments yet · through Aug 30" : `${made} commitments · ${kept} kept · through Aug 30`,
    kind: "Season",
    stage: opts.stage ?? "Open",
    media: { label: "photo", tint: "garden" , photo: 1 },
    hotId: "w1.season-card",
  });
}

// Season + campaigns share one snap rail (2026-08-14): the Season slide leads
// and stays wider — campaigns are peers you can reach in one swipe, not what a
// member came for. Presentation only: slides open their cycle, and the browse
// scope select keeps owning list scope, so swiping never silently refilters.
export function seasonSlide(opts: { made?: number; kept?: number; stage?: string } = {}): string {
  return `<div class="cslide">${seasonCard(opts)}</div>`;
}
export function emptySeasonSlide(): string {
  return `<div class="cslide">${cycleCard({
    title: "No season right now",
    units: "",
    counts: "Stewards open the next one",
    kind: "Season",
    stage: "None open",
  })}</div>`;
}
// Same anatomy as the season slide, so the rail has one card height.
export function campaignSlide(hotId: string, title: string, stage: string, counts: string, units = ""): string {
  return `<div class="cslide">${cycleCard({
    title,
    units,
    counts: `${counts} · through Aug 18`,
    kind: "Campaign",
    stage,
    hotId,
  })}</div>`;
}

// COMMITMENT CARD, option E (2026-08-16 round 9, Afo). One anatomy for every
// commitment on every surface: title, one meta line, one tag row, and a reserved
// square on the right that holds the commitment's image when it has one.
//
// Three rules make every card the same height, which is what the old family of
// five hand-built variants could not do:
//
//  1. NO ACTIONS ON CARDS. Taking something up happens in the commitment view,
//     where a member can read the whole thing first — the card's job is to be
//     legible, not to be a control. This also removes the row that varied most.
//  2. THE TAG ROW NEVER WRAPS. Fixed priority, hard cap, then a count. What
//     survives is always: what it is, then what is unusual about it. Domains
//     roll into the count first because the filter row above the list already
//     filters by domain.
//  3. THE IMAGE SLOT IS ALWAYS RESERVED. A commitment with no photo shows nothing
//     there and nothing shifts, so titles in a mixed list share one wrap point.
//     The square is 1:1 at the card's full content height (the shipping
//     WorkCard's media grammar), and never drives the height — three text rows
//     already exceed it.
const TAG_CAP = 3;

export function commitmentCard(opts: {
  title: string;
  meta: string;
  // Ordered by priority. The first is the kind chip and is never dropped.
  tags: { label: string; tone?: ChipTone }[];
  // The cycle gets its OWN slot rather than competing for the three tag places
  // (2026-08-17, Afo). It had been prose in the meta line — "Tool library
  // campaign", "runs with the season" — so the client had no cycle tag to
  // colour at all. It is justified on the card despite the carousel above it
  // naming a cycle, because the pool list MIXES cycles: the season and its
  // campaigns appear together under "All current", and a row in a mixed list
  // has to name its own container (frontend-design Rule 17's stated exception).
  cycle?: { label: string; kind: "season" | "campaign" };
  // The value-over-time line, for an ongoing offer. It sits on the CARD because
  // that is where the decision happens: a neighbour scanning the pool sees that
  // this has been running and giving before they tap (2026-08-17, Afo).
  record?: string;
  media?: { label: string; tint?: "agro" | "waste" | "garden" | "quiet"; photo?: number };
  hotId?: string;
  note?: string;
  acts?: string;
}): string {
  const shown = opts.tags.slice(0, TAG_CAP);
  const hidden = opts.tags.length - shown.length;
  const tagRow = `<div class="ptags">${shown.map((t) => chip(t.label, t.tone ?? "plain")).join("")}${
    hidden > 0 ? `<span class="ch more">+${hidden}</span>` : ""
  }${opts.cycle ? chip(opts.cycle.label, opts.cycle.kind) : ""}</div>`;
  // No media means no square. It used to draw an empty grey placeholder, which
  // on the card you had just made read as a picture that failed to load
  // (2026-08-17, Afo). The text column simply takes the full width.
  const media = opts.media
    ? `<div class="pmedia" role="img" aria-label="${escAttr(opts.media.label)}" style="background-image:${photoFill(opts.media.photo ?? 0)}"></div>`
    : "";
  const inner = `<div class="pcbody"><div class="t-title">${esc(opts.title)}</div><div class="t-meta num">${esc(opts.meta)}</div>${opts.record ?? ""}${tagRow}${
    opts.note ? `<div class="t-meta">${esc(opts.note)}</div>` : ""
  }${opts.acts ?? ""}</div>${media}`;
  const c = card(inner, { cls: `pcard2${opts.hotId ? " cardlink" : ""}` });
  return opts.hotId ? hot(opts.hotId, c) : c;
}

// Legacy card grammar (2026-08-14). Retained only until every call site moves
// to commitmentCard above.
// Every browse cast of an Offer. The queued/waiting/failed casts are the
// member's OWN sends, so they carry no creator name and keep their recovery
// controls — those are device-state acts on a commitment that has not left the
// phone, not claim acts, so they are the one exception to "no actions on cards".
export function offerCard(opts: {
  queued?: boolean;
  waiting?: boolean;
  failed?: boolean;
  readOnly?: boolean;
  readOnlyNote?: string;
  detailHot?: string;
  team?: number;
} = {}): string {
  const own = opts.queued || opts.waiting || opts.failed;
  const tags: { label: string; tone?: ChipTone }[] = [{ label: "Offer", tone: "offer" }];
  if (opts.team) tags.push({ label: `Team of ${opts.team}` });
  if (opts.queued) tags.push({ label: "Queued", tone: "queued" });
  if (opts.waiting) tags.push({ label: "Waiting", tone: "queued" });
  if (opts.failed) tags.push({ label: "Couldn't send", tone: "err" });
  tags.push({ label: "AGRO" });
  const title = opts.waiting ? "Compost workshop" : "Prune the north beds";
  const amount = opts.waiting ? "3 sessions" : "6 hours · due Aug 12";
  const note = opts.waiting
    ? "Waiting for your garden membership. It will send once you're welcomed in."
    : opts.failed
      ? "Five send attempts used. You can retry or discard."
      : opts.readOnly
        ? (opts.readOnlyNote ?? "This commitment remains visible, but taking it up is not available right now.")
        : undefined;
  return commitmentCard({
    title,
    meta: own ? amount : `Maria · ${amount}`,
    tags,
    cycle: { label: "First Rains", kind: "season" },
    media: opts.waiting ? undefined : { label: "photo", tint: "agro" , photo: 2 },
    note,
    acts: opts.failed
      ? `<div class="brow">${hot("w1.retry-send", btn("Retry", { kind: "sec", sm: true }))}${hot("w1.discard-send", btn("Discard", { kind: "ghost", sm: true }))}</div>`
      : undefined,
    hotId: own ? undefined : opts.readOnly ? opts.detailHot : "w1.open-offer",
  });
}

export function requestCard(opts: { openClaim?: boolean; queued?: boolean; context?: string; claimHot?: string } = {}): string {
  // The claim mode used to be carried by the card button's own label ("I can
  // help" open, "Ask to take this up" reviewed). With acts moved into the
  // commitment view, the card no longer says which it is — the view does, where
  // the member can read the terms before deciding.
  const tags: { label: string; tone?: ChipTone }[] = [{ label: "Request", tone: "request" }];
  if (opts.queued) tags.push({ label: "Queued", tone: "queued" });
  tags.push({ label: "Support / service" });
  return commitmentCard({
    title: "Ride to the market on Saturday",
    meta: opts.queued ? "1 ride" : "Ana · 1 ride",
    tags,
    cycle: opts.context
      ? { label: opts.context.replace(/ campaign$/, ""), kind: "campaign" as const }
      : { label: "First Rains", kind: "season" as const },
    note: opts.queued ? "Saved on this device. It will send when connected." : undefined,
    hotId: opts.queued ? undefined : opts.openClaim ? "w1.open-request" : "w1.open-request-gated",
  });
}

// Ongoing-Offer place card — the public life of a CommitmentSeries on the pool
// tab (D8a): the "Ongoing" tag plus how many are left is the card's real progress,
// and the whole card opens the series detail where places are taken up.
export function ongoingOfferCard(): string {
  return commitmentCard({
    title: "Saturday veggie box",
    meta: "Maria · 1 box each week · 2 open now",
    tags: [{ label: "Offer", tone: "offer" }, { label: "Ongoing" }, { label: "Support / service" }],
    cycle: { label: "First Rains", kind: "season" },
    record: offerRecord({ since: "March", given: "18 boxes given", people: "11 neighbours", compact: true }),
    hotId: "w1.open-ongoing",
  });
}

// Team-offer card — the D5 roster indicator: a forming team is visible right on
// the browse card; the whole card opens the commitment, where joining happens.
// Two domains here, which is exactly the case that used to need a second row —
// now the tag cap absorbs it and WASTE rolls into the count.
export function teamOfferCard(): string {
  return commitmentCard({
    title: "Restore the compost bays",
    meta: "Maria · 4 sessions · due Aug 24",
    tags: [{ label: "Offer", tone: "offer" }, { label: "Team of 3" }, { label: "AGRO" }, { label: "WASTE" }],
    media: { label: "photo", tint: "waste" , photo: 3 },
    hotId: "w1.open-team-offer",
  });
}

export function fundedOfferCard(): string {
  return commitmentCard({
    title: "Design a market poster",
    meta: "Ben · 1 poster design · runs with the season",
    tags: [{ label: "Offer", tone: "offer" }, { label: "40 G$" }, { label: "Support / service" }],
    note: "Your deposit instructions appear only after the funding record is ready.",
  });
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
export function selCard(opts: { tint: string; media: string; title: string; line: string; selected?: boolean; count?: string }): string {
  // The count sits in its own row at the card's foot rather than after the
  // description (2026-08-17, Afo: "some actions description wrap so the
  // quantities are not aligned"). A two-line description used to push the count
  // down, so a rail of cards showed its quantities at three different heights.
  // The description now has a fixed two-line box and the count is anchored.
  const foot = opts.count ? `<div class="acount${opts.count === "tap to add" ? " off" : ""}">${esc(opts.count)}</div>` : "";
  return `<div class="acard${opts.selected ? " on" : ""}"><div class="amedia ${opts.tint}">${esc(opts.media)}</div><div class="abody"><div class="at">${esc(opts.title)}</div><div class="am">${esc(opts.line)}</div>${foot}</div></div>`;
}
export function selRail(cards: string[]): string {
  return `<div class="selrail">${cards.join("")}</div>`;
}

// Commitment slide — the intro's third rail (2026-08-14, Afo: many commitments must
// not stack downward): compact cards, nearest due first, swipe for more.
// Tapping one enters the scoped flow.
export function commitmentSlide(opts: { title: string; needs: string; due: string; hotId?: string }): string {
  const c = `<div class="card pcard${opts.hotId ? " cardlink" : ""}"><div class="t-title">${opts.title}</div><div class="t-meta num">${opts.needs}</div><div class="t-meta num">${opts.due}</div></div>`;
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

// Triage stats (AdminCard + MetaStrip anatomy): number leads, label beneath,
// hairline columns. Each cell jumps to the queue that owns it; a zero count
// renders calm rather than alarming. Redesigned 2026-08-16 — these read as
// stats, never as a row of buttons.
export function statRow(
  items: { n: string; label: string; hotId?: string }[],
  opts: { layout?: "inline" | "stacked" } = {},
): string {
  return `<div class="sumrow${opts.layout === "inline" ? " inline" : ""}" role="group" aria-label="Queue counts">${items
    .map(({ n, label, hotId }) => {
      const inner = `<span class="n num">${esc(n)}</span><span class="l">${esc(label)}</span>`;
      const cls = `sumcell${n === "0" ? " zero" : ""}`;
      // A stat that navigates is a button; one that only reports is not. Never
      // dress a read-only number as a control.
      return hotId
        ? hot(hotId, `<button type="button" class="${cls}">${inner}</button>`)
        : `<span class="${cls} static">${inner}</span>`;
    })
    .join("")}</div>`;
}

// ---- the two row variants (interaction-patterns §5) -------------------------
// RECORD ROW — a thing you look at: title + kind/state chips on line one, calm
// meta (who · how much · when) on line two, and ONE trailing act, or a chevron
// when the row simply opens. Used for commitments, campaigns, activity, queues you
// browse.
export function commitmentRow(opts: {
  title: string;
  chips?: string;
  meta?: string;
  act?: string;
  hotId?: string;
  chevron?: boolean;
}): string {
  const main = `<div class="pmain"><div class="ptop"><b>${esc(opts.title)}</b>${opts.chips ?? ""}</div>${
    opts.meta ? `<div class="pmeta num">${esc(opts.meta)}</div>` : ""
  }</div>`;
  const trailing = `${opts.act ?? ""}${opts.chevron ? icon("arrow-right-s-line", "s") : ""}`;
  const body = opts.hotId ? hot(opts.hotId, main) : main;
  return `<div class="prow">${body}${trailing ? `<span class="pact">${trailing}</span>` : ""}</div>`;
}

// DECISION ROW — a thing you answer: same anatomy, but TWO acts, because
// accept/decline and approve/reject are paired opposites and hiding one behind
// an overflow would be worse than showing both. Affirmative rightmost; the
// declining act sits left of it in the quieter weight. When the decision is
// already made, `outcome` replaces the pair with the state it produced.
export function decisionRow(opts: {
  title: string;
  chips?: string;
  meta?: string;
  affirm?: string;
  decline?: string;
  outcome?: string;
  hotId?: string;
}): string {
  const main = `<div class="pmain"><div class="ptop"><b>${esc(opts.title)}</b>${opts.chips ?? ""}</div>${
    opts.meta ? `<div class="pmeta num">${esc(opts.meta)}</div>` : ""
  }</div>`;
  const trailing = opts.outcome ?? `${opts.decline ?? ""}${opts.affirm ?? ""}`;
  const body = opts.hotId ? hot(opts.hotId, main) : main;
  return `<div class="prow">${body}${trailing ? `<span class="pact">${trailing}</span>` : ""}</div>`;
}

// A card whose HEADER IS ITS OBJECT — the open season heading the Season &
// Campaigns card, rather than a generic title with the season bolted beneath as
// a second header. Title + chips + counts + its one act live in the head; the
// stepper and any peer list follow in the body.
export function objectCard(opts: {
  title: string;
  chips?: string;
  meta?: string;
  acts?: string;
  body?: string;
  // A cycle's card is a door to its own view (2026-08-17): the header opens it,
  // while the acts inside the header row keep acting on it in place.
  hotId?: string;
}): string {
  const wrapTitle = (h: string) => (opts.hotId ? hot(opts.hotId, h) : h);
  return `<div class="acard objcard${opts.hotId ? " cardlink" : ""}"><div class="objhead">${wrapTitle(
    `<div class="objtitle"><div class="ptop"><b>${esc(opts.title)}</b>${opts.chips ?? ""}</div>${
      opts.meta ? `<div class="pmeta num">${esc(opts.meta)}</div>` : ""
    }</div>`,
  )}${
    opts.acts ? `<span class="objacts">${opts.acts}</span>` : ""
  }</div>${opts.body ?? ""}</div>`;
}

// A card's section divider: a quiet subheading with an optional section act
// (AdminCard's internal grouping — "Campaigns · 2 open" with Start Campaign).
export function cardSection(label: string, act = ""): string {
  return `<div class="cardsub">${esc(label)}${act ? `<span class="subact">${act}</span>` : ""}</div>`;
}

// WHAT THE POOL HOLDS — the pool's contents, which the console never showed.
// Before this, every pool surface described how the pool was CONFIGURED
// (charter, cap, assessment) and nothing described what was in it, so neither a
// steward nor a member could answer "what can our pool actually do right now?".
//
// Two parts, because a pool holds two different kinds of thing: what members
// can do for each other, and what sits in the reserve. They are never added
// together and never converted into each other.
//
// The unit rows are exact-label groups straight off CommitmentUnitSummary. They
// are deliberately NOT summed: 40 hours and 12 rides have no shared denominator,
// and inventing one would be inventing a price (Appendix D.1). Rendering the
// groups is the honest version of the single-figure ring in the source model.
//
// Composes Record Rows inside the caller's own card, so admin wraps it in
// `acard` and the client in `card` without either surface borrowing the other's
// chrome.
export function poolHoldings(opts: {
  units: readonly { label: string; open: number; people: number }[];
  reserve?: { amount: string; plans: number };
  capacityNote?: string;
  reserveNote?: string;
  // Who stands behind the units. A garden pool's members are neighbours; the
  // protocol pool's members are gardens, and calling them neighbours there would
  // be a small lie in the one place the block exists to be truthful.
  who?: { one: string; many: string };
}): string {
  const who = opts.who ?? { one: "neighbour", many: "neighbours" };
  const unitRows = opts.units
    .map(({ label, open, people }) =>
      commitmentRow({
        title: `${open} ${unitLabel(label)}`,
        meta: `${people} ${people === 1 ? who.one : who.many} offering`,
      }),
    )
    .join("");
  // The note goes ABOVE the rows: it says what the numbers ARE, and "40 hours"
  // read before that caption is ambiguous between promised, available, and
  // already given.
  const capacity = `${cardSection("What we can do for each other")}${
    opts.capacityNote ? `<div class="t-meta">${esc(opts.capacityNote)}</div>` : ""
  }<div class="holdlist">${unitRows}</div>`;
  if (!opts.reserve) return capacity;
  const plans =
    opts.reserve.plans === 0
      ? "nothing planned to go out"
      : `${opts.reserve.plans} payout${opts.reserve.plans === 1 ? "" : "s"} planned`;
  // The reserve is one row, quieter than the capacity above it — the pool works
  // whether or not anything is in here, and a reserve of nothing is a normal
  // pool rather than an empty one.
  const reserve = `${cardSection("What's in the reserve")}${
    opts.reserveNote ? `<div class="t-meta">${esc(opts.reserveNote)}</div>` : ""
  }<div class="holdlist">${commitmentRow({ title: opts.reserve.amount, meta: plans })}</div>`;
  return `${capacity}${reserve}`;
}

// Scope filters for a list card — AdminFilterChip. One group per dimension
// (state, kind, direction); the active chip carries aria-current.
export function filterChips(chips: { label: string; on?: boolean; hotId?: string }[], ariaLabel: string): string {
  return `<div class="scopechips" role="group" aria-label="${escAttr(ariaLabel)}">${chips
    .map(({ label, on, hotId }) => {
      const c = `<button type="button" class="sc-chip${on ? " on" : ""}"${on ? ' aria-current="true"' : ""}>${esc(label)}</button>`;
      return hotId ? hot(hotId, c) : c;
    })
    .join("")}</div>`;
}

// Cycle/settlement stage stepper.
export const stages = (list: string[], activeIx: number) =>
  `<div class="stages">${list
    .map((s, i) => `<span class="st1${i < activeIx ? " done" : i === activeIx ? " on" : ""}"><i></i>${s}</span>`)
    .join(`<span class="sep"></span>`)}</div>`;

// GardenChip — the AppBar's left pill (garden selector), never a brand logo.
export const gardenChip = (name: string, hotId?: string) =>
  `<button type="button" class="gchip" data-component="GardenChip"${hotId ? ` data-hot="${hotId}"` : " disabled"} aria-label="Select garden"><span class="leaf">${icon("seedling-line", "s")}<span class="dot"></span></span><span class="nm">${esc(name)}</span><span class="caret"></span></button>`;

const iconBtn = (name: string, label: string) =>
  `<button type="button" class="iconbtn" aria-label="${esc(label)}, preview only" disabled>${icon(name)}</button>`;

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
