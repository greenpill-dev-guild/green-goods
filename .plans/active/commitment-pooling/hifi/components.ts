// Components tab — the fourth artifact tab (component-library contract in
// handoffs/claude-components-tab-brief.md, locked 2026-08-14). One entry per
// kit builder / documented screen composite, grouped in the seven client-led
// families, per-surface catalogs behind a Client / Admin / Editorial flip.
// Shipping names lead entry titles; kit builder names ride the annotation.
// Drift policy: flag all, redraw nothing — specimens render exactly what the
// screens draw today, and the DRIFT line names what shipping does differently.
//
// Specimens are static: hotspot ids are stripped and every control renders
// disabled (the validator re-checks both). Where-used lists derive from the
// RENDERED screen states via class markers, so they cannot drift from the
// screens; fixture-bound composites carry explicit ids instead.

import { POOL_HOLDINGS } from "./fixtures";
import { esc, escAttr } from "./html";
import * as kit from "./kit";
import { claimCardCasts } from "./screens/client";
import { SCREENS } from "./screens/index";

export type CompSurface = "client" | "admin" | "editorial";
type FamilyId = "chips" | "cards" | "rails" | "forms" | "chrome" | "feedback" | "people";

const FAMILIES: { id: FamilyId; label: string }[] = [
  { id: "chips", label: "Chips & badges" },
  { id: "cards", label: "Cards" },
  { id: "rails", label: "Rails & carousels" },
  { id: "forms", label: "Forms & inputs" },
  { id: "chrome", label: "Chrome" },
  { id: "feedback", label: "Feedback" },
  { id: "people", label: "People" },
];

type SpecW = "p" | "m" | "l" | "frame";
type Spec = { label: string; html: string; w?: SpecW; h?: number };
type Entry = {
  id: string;
  title: string;
  family: FamilyId;
  /** kit builder names this entry documents (completeness gate in the build). */
  covers: string[];
  kit: string;
  /** Shipping counterpart as path:line (verified by opening the file). */
  ship?: string;
  shipNote?: string;
  netNew?: string;
  deliberate?: string;
  drift?: string;
  rule: string;
  usedIn: RegExp | string[];
  specs: Spec[];
};

// ---- specimen plumbing ------------------------------------------------------

// Strip journey hotspots and disable every control: gallery specimens are
// reviewable drawings, not live surfaces. The validator independently fails
// the build on any surviving data-hot or enabled button.
const specimen = (html: string) =>
  html
    .replace(/\s*data-hot="[^"]*"/g, "")
    .replace(/<button(?![^>]*\bdisabled)/g, "<button disabled")
    .replace(/<input(?![^>]*\bdisabled)/g, "<input disabled");

const usedInIds = (surface: CompSurface, usedIn: RegExp | string[]): string[] =>
  Array.isArray(usedIn)
    ? usedIn
    : SCREENS.filter((s) => s.surface === surface && s.reviewVisible && s.states.some((st) => usedIn.test(st.html))).map((s) => s.id);

const specCell = (surface: CompSurface, s: Spec): string => {
  const w = s.w ?? (surface === "client" ? "p" : "m");
  const style = s.h ? ` style="height:${s.h}px"` : "";
  const inner = w === "frame" ? `<div class="zoomwrap">${specimen(s.html)}</div>` : specimen(s.html);
  return `<figure class="spec w-${w}"><div class="specbox hf s-${surface}"${style}>${inner}</div><figcaption>${esc(s.label)}</figcaption></figure>`;
};

const entryHtml = (surface: CompSurface, e: Entry): { html: string; chromeText: string } => {
  const anchor = surface === "client" ? `components/${e.id}` : `components/${e.id}@${surface}`;
  const tags = [
    e.netNew != null ? `<span class="ctag new">Net-new</span>` : "",
    e.drift ? `<span class="ctag drift">Drift</span>` : "",
    e.deliberate ? `<span class="ctag delib">Decided divergence</span>` : "",
  ].join("");
  const ship = e.ship
    ? `<p class="cship">Shipping counterpart: <code>${esc(e.ship)}</code>${e.shipNote ? ` — ${esc(e.shipNote)}` : ""}</p>`
    : `<p class="cship netnew">Net-new, no shipping counterpart yet${e.netNew ? ` · ${esc(e.netNew)}` : ""}</p>`;
  const drift = e.drift ? `<p class="cdrift">Drift: ${esc(e.drift)}</p>` : "";
  const delib = e.deliberate ? `<p class="cdelib">Decided divergence: ${esc(e.deliberate)}</p>` : "";
  const ids = usedInIds(surface, e.usedIn);
  const used = ids.length
    ? `<p class="cused">On: ${ids.map((id) => `<a class="uchip" href="#screens/${id}">${esc(id)}</a>`).join("")}</p>`
    : "";
  const html = `<article class="centry" id="comp-${surface}-${e.id}" data-centry="${escAttr(e.id)}" data-comp-surface="${surface}">
<header class="chead"><h4>${esc(e.title)}</h4>${tags}<code class="ckit">kit: ${esc(e.kit)}</code><button type="button" class="complink" data-anchor="${escAttr(anchor)}" aria-label="Copy link to ${escAttr(e.title)}">⧉</button></header>
${ship}${delib}${drift}<p class="crule">${esc(e.rule)}</p>
<div class="cspecs">${e.specs.map((s) => specCell(surface, s)).join("")}</div>
${used}</article>`;
  const chromeText = [e.title, e.kit, e.ship, e.shipNote, e.netNew, e.deliberate, e.drift, e.rule, ...e.specs.map((s) => s.label)]
    .filter(Boolean)
    .join(" ");
  return { html, chromeText };
};

// ---- shared fixture snippets ------------------------------------------------

const cardInner = (title: string, meta: string) => `<div class="t-title">${title}</div><div class="t-meta num">${meta}</div>`;
const LIFECYCLE_STATES = [
  "Offered", "Requested", "Accepted", "Active", "Proof in", "Partly approved", "Ready to confirm", "Fulfilled",
  "Reconciled", "Cancelled", "Expired", "Withdrawn", "Under review", "Queued", "Waiting",
];

// ---- client catalog ---------------------------------------------------------

const claims = claimCardCasts();

const CLIENT_ENTRIES: Entry[] = [
  // — Chips & badges —
  {
    id: "chip", title: "Chip", family: "chips", covers: ["chip"],
    kit: `chip(label, tone, {dot})`,
    ship: "packages/shared/src/components/Badge/Badge.tsx:43",
    shipNote: "nearest shipping anatomy; the pooling tone set itself is net-new vocabulary",
    rule: "The workhorse label for kind, direction, and quiet status on cards and rows; never the only signal for state that matters (that is StatusBadge's job).",
    usedIn: /class="ch[\s"]/,
    specs: [
      { label: "all nine tones", html: `<div class="cardrow">${kit.chip("Season of First Rains", "season")}${kit.chip("Market rides", "campaign")}${kit.chip("Offer", "offer")}${kit.chip("Request", "request")}${kit.chip("AGRO", "domain")}${kit.chip("Accepted", "ok")}${kit.chip("Waiting", "warn")}${kit.chip("Couldn't send", "err")}${kit.chip("Closed", "ink")}${kit.chip("Queued", "queued")}</div>` },
      { label: "with dot", html: `<div class="cardrow">${kit.chip("Accepted", "ok", { dot: true })}${kit.chip("Waiting for steward review", "warn", { dot: true })}${kit.chip("Not this time", "plain", { dot: true })}</div>` },
    ],
  },
  {
    id: "status-badge", title: "StatusBadge", family: "chips", covers: ["statusBadge"],
    kit: `statusBadge(label, tone, icon)`,
    ship: "packages/shared/src/components/StatusBadge.tsx:352",
    shipNote: "icon + colour pill, never colour alone",
    rule: "Lifecycle state that matters gets the icon pill; client surfaces only. Admin and settlement keep the flatter chips.",
    usedIn: /class="sbadge/,
    specs: [
      { label: "five tones", html: `<div class="cardrow">${kit.statusBadge("Fulfilled", "success", "checkbox-circle-fill")}${kit.statusBadge("Proof in", "warning", "image-line")}${kit.statusBadge("Couldn't send", "error", "error-warning-line")}${kit.statusBadge("Active", "info", "leaf-line")}${kit.statusBadge("Offered", "neutral", "time-line")}</div>` },
    ],
  },
  {
    id: "lifecycle-chip", title: "Lifecycle states", family: "chips", covers: ["stateChip"],
    kit: `stateChip(state)`,
    netNew: "the pooling lifecycle map onto StatusBadge",
    rule: "One mapping from commitment lifecycle to badge tone + icon, so the same state never renders two ways on two screens.",
    usedIn: /class="sbadge/,
    specs: [
      { label: "the full map", html: `<div class="cardrow">${LIFECYCLE_STATES.map((s) => kit.stateChip(s)).join("")}</div>` },
    ],
  },
  {
    id: "domain-row", title: "Domain row", family: "chips", covers: ["domainRow"],
    kit: `domainRow(domains)`,
    ship: "packages/shared/src/components/DomainBadge.tsx:12",
    drift: "Shipping DomainBadge renders icon + label from DOMAIN_CONFIG with backdrop blur (packages/shared/src/components/DomainBadge.tsx:19). These pills are text-only.",
    rule: "Every involved domain listed on its own equal-weight row, none privileged as primary; no row means an proof-only service commitment.",
    usedIn: /class="dmrow/,
    specs: [
      { label: "all four domains", html: kit.domainRow(["AGRO", "EDU", "SOLAR", "WASTE"]) },
      { label: "a two-domain commitment", html: kit.domainRow(["AGRO", "WASTE"]) },
    ],
  },
  {
    id: "reason-chips", title: "Reason chips", family: "chips", covers: ["reasonChips"],
    kit: `reasonChips(options)`,
    netNew: "tap-first reasons above a reason field",
    rule: "Common reasons render as tappable chips above the reason field; tapping fills the field, and the field stays. It is the stored record.",
    usedIn: /Tap a reason to fill it in/,
    specs: [
      { label: "three options + helper", html: kit.reasonChips(["Rains came early", "Family matter", "Materials missing"]) },
    ],
  },
  // — Cards —
  {
    id: "card", title: "Card", family: "cards", covers: ["card"],
    kit: `card(inner, {cls})`,
    ship: "packages/shared/src/components/Cards/CardBase.tsx:5",
    shipNote: "rounded-2xl base surface",
    rule: "The base surface for everything on the canvas; radius steps down by role (24 list, 20 surface, 16 inset). Direction is carried by the Offer/Request chip in text, never by a coloured edge (retired 2026-08-16).",
    usedIn: /class="card[\s"]/,
    specs: [
      { label: "default (24px)", html: kit.card(cardInner("Prune the north beds", "6 hours · due Aug 12")) },
      { label: "flat", html: kit.card(cardInner("Prune the north beds", "6 hours · due Aug 12"), { cls: "flat" }) },
      { label: "surface (20px)", html: kit.card(cardInner("Prune the north beds", "6 hours · due Aug 12"), { cls: "surface" }) },
      { label: "inset (16px)", html: kit.card(cardInner("Prune the north beds", "6 hours · due Aug 12"), { cls: "inset" }) },
    ],
  },
  {
    id: "form-card", title: "FormCard", family: "cards", covers: ["formCard"],
    kit: `formCard(icon, label, value)`,
    ship: "packages/client/src/components/Cards/Form/FormCard.tsx:19",
    rule: "One card per detail, stacked under an h6. The anatomy WorkView uses and therefore the anatomy every review in this feature uses, since Submit Work's review IS a WorkView (views/Garden/Review.tsx:192).",
    usedIn: /class="fcard/,
    specs: [
      { label: "an amount", html: kit.formCard("leaf-line", "How much", "6 hours") },
      { label: "a due date", html: kit.formCard("calendar-line", "Due", "Aug 30, runs with the season") },
      { label: "a value that runs long", html: kit.formCard("shield-check-line", "Who confirms", "The person you help confirms it. If nobody local is eligible, the Green Goods team can step in with a recorded reason.") },
    ],
  },
  {
    id: "unit-label", title: "Unit label guard", family: "chips", covers: ["unitLabel"],
    kit: `unitLabel(raw)`,
    netNew: "A render-side guard, not an input rule. `unitLabel` is an unbounded on-chain string and no contract bound is planned for now, so anything writing directly to the module can store a label of any length.",
    rule: "Longer than 24 characters is cut with an ellipsis and keeps its full text in `title`, cut, never silently lost. Independent of whatever the composer allows, so it keeps working unchanged if a contract bound lands later; a bound only stops the truncation firing.",
    usedIn: /class="ulab"|holdlist/,
    specs: [
      { label: "an ordinary label", html: `<div class="t-body">27 ${kit.unitLabel("hours")} open</div>` },
      { label: "at the cap", html: `<div class="t-body">4 ${kit.unitLabel("two-hour work sessions")} open</div>` },
      { label: "past the cap, cut, full text in title", html: `<div class="t-body">2 ${kit.unitLabel("full-day accompanied market transport runs")} open</div>` },
    ],
  },
  {
    id: "identity-card", title: "Identity card", family: "cards", covers: ["identityCard"],
    kit: `identityCard({title, chips, domains, people, teamRow, progress})`,
    netNew: "The commitment view's top half. It replaced four bare canvas rows, header, chips, a lone domain row, a dense people line. Each with its own ad-hoc padding and no grouping.",
    rule: "The card someone tapped in the pool, expanded. Terms stay in Details rather than repeating here; what the card carries is what exists nowhere else, where this stands and who is on it.",
    usedIn: /class="card idcard/,
    specs: [
      { label: "an offer with an open team", html: kit.identityCard({ title: "Prune the north beds", chips: `${kit.chip("Offer", "offer")}${kit.stateChip("Active")}`, domains: ["AGRO"], people: [{ initial: "M", line: "Maria offers" }, { initial: "J", line: "João takes it up" }], teamRow: `<div class="idteam">Open team. Anyone eligible may join</div>` }) },
      { label: "a request, three people", html: kit.identityCard({ title: "Clear the drainage channel", chips: `${kit.chip("Request", "request")}${kit.stateChip("Active")}`, domains: ["AGRO"], people: [{ initial: "A", line: "Ana asked for this" }, { initial: "J", line: "João provides" }, { initial: "A", line: "Ana confirms" }] }) },
      { label: "browse. Nobody has taken it up", html: kit.identityCard({ title: "Ride to the market", chips: `${kit.chip("Request", "request")}${kit.stateChip("Offered")}`, people: [{ initial: "A", line: "Ana asked. Nobody has taken it up yet" }] }) },
    ],
  },
  {
    id: "progress-block", title: "What's been done", family: "cards", covers: ["progressBlock"],
    kit: `progressBlock({rows, proof, assessment, note})`,
    netNew: "The completion picture, and the one place the difference between the two readiness paths is legible.",
    rule: "Requirement counts carry BARS. Approved work is what advances a DomainImpact commitment. Everything under the hairline carries NO bar, because on garden work proof credits the people who helped without moving readiness (attachEvidence has no kind gate; submitForConfirmation rejects DomainImpact). On a service the proof line IS the readiness path and stands alone. The explaining line appears only where both are present.",
    usedIn: /class="prow"|class="pflat"/,
    specs: [
      { label: "garden work, with proof", html: `<div class="card idcard">${kit.progressBlock({ rows: [{ label: "Prune", done: 2, of: 2 }, { label: "Plant", done: 8, of: 12 }], proof: "3 items · credits Maria, Ana", note: "Approved work is what moves this forward. Proof credits the people who helped." })}</div>` },
      { label: "a service. Proof is the path", html: `<div class="card idcard">${kit.progressBlock({ proof: "2 items · credits Maria", note: "Proof is what moves this forward, a service names no garden actions." })}</div>` },
      { label: "with a declared assessment", html: `<div class="card idcard">${kit.progressBlock({ rows: [{ label: "Weed", done: 2, of: 2 }], proof: "1 item · credits João", assessment: "Attached · Baseline Aug 1" })}</div>` },
    ],
  },
  {
    id: "member-card", title: "Member card", family: "cards", covers: ["memberCard", "memberTrail", "avatar"],
    kit: `memberTrail([memberCard({name, sub, photo, role, lead, removeHotId})])`,
    ship: "packages/client/src/components/Features/Garden/Gardeners.tsx:75",
    drift: "GardenMemberItem's own layout at a fixed 216px so it can ride a carousel, avatar, name, account, with role replacing the shipped 'Registered:' line. When someone joined the garden has no bearing on whether they belong on this commitment; which one of them is accountable does.",
    rule: "Added team members ride a carousel so the roster never pushes the media list off the details step. The card carries enough to tell two people apart, photo, name, account, because a 96px tile carrying an initial told you nothing about who you had added. Exactly one member is the lead.",
    usedIn: /class="mcard/,
    specs: [
      { label: "a team of three, with the add card", html: kit.memberTrail([kit.memberCard({ name: "João", sub: "joao.eth", photo: 1, role: "Lead", lead: true, removeHotId: "gallery.noop" }), kit.memberCard({ name: "Luz", sub: "luz.eth", photo: 4, role: "Contributor", removeHotId: "gallery.noop" }), kit.memberCard({ name: "0x74…c2", role: "Contributor", removeHotId: "gallery.noop" }), `<div class="mcard addtile">+<div class="mtn">Add</div></div>`]) },
      { label: "no photo and no name on file", html: kit.memberTrail([kit.memberCard({ name: "0x74…c2", role: "Contributor" })]) },
      { label: "a long name truncates rather than wrapping", html: kit.memberTrail([kit.memberCard({ name: "Maria Aparecida do Nascimento", sub: "mariaaparecida.eth", photo: 2, role: "Contributor", removeHotId: "gallery.noop" })]) },
    ],
  },
  {
    id: "member-row", title: "Member row", family: "cards", covers: ["memberRow"],
    kit: `memberRow({name, sub, joined, badge, photo, select, hotId})`,
    ship: "packages/client/src/components/Features/Garden/Gardeners.tsx:75",
    rule: "The shipped garden Gardeners item, reused wherever this feature shows or picks a person. The name follows that component's own resolution order, username, then email or phone, and only then a formatted address, so a wallet address appears as the primary line exactly when nothing better is on file. The avatar is a photograph (`member.avatar || ensAvatar || /images/avatar.png`), never an initial.",
    usedIn: /class="mbrow/,
    specs: [
      { label: "a gardener with a name", html: kit.memberRow({ name: "Sofia", sub: "sofia.eth", joined: "Joined Mar 2025", photo: 0 }) },
      { label: "carrying a role badge", html: kit.memberRow({ name: "Maria", sub: "maria.eth", joined: "Joined Mar 2025", badge: "Lead", photo: 2 }) },
      { label: "no photo on file", html: kit.memberRow({ name: "Sofia", sub: "sofia.eth", joined: "Joined Mar 2025" }) },
      { label: "no name on file", html: kit.memberRow({ name: "0x74…c2", joined: "Joined Aug 2025" }) },
      { label: "selected in the picker", html: kit.memberRow({ name: "João", sub: "joao.eth", joined: "Joined Jan 2025", badge: "Steward", photo: 1, select: "on" }) },
      { label: "unselected in the picker", html: kit.memberRow({ name: "Luz", sub: "luz.eth", joined: "Joined Feb 2025", photo: 4, select: "off" }) },
    ],
  },
  {
    id: "commitment-card", title: "Commitment Card", family: "cards", covers: ["commitmentCard"],
    kit: `commitmentCard({title, meta, tags, media, note, hotId})`,
    ship: "packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:122",
    shipNote: "media-right variant of WorkCard's square media block",
    rule: "ONE anatomy for every commitment on every surface, title, one meta line, one tag row, and a reserved 1:1 square on the right. No acts on cards: taking something up happens in the commitment view, where the terms are readable first. The tag row never wraps, fixed priority (what it is, then what is unusual, then domains), hard cap, then a +N count. The image slot is always reserved, so a commitment without a photo shifts nothing beside it.",
    usedIn: /class="card pcard2/,
    specs: [
      { label: "with photo", html: kit.commitmentCard({ title: "Prune the north beds", meta: "Maria · 6 hours · due Aug 12", tags: [{ label: "Offer", tone: "offer" }, { label: "AGRO" }], media: { label: "photo", tint: "agro" } }) },
      { label: "no photo, slot reserved, nothing shifts", html: kit.commitmentCard({ title: "Ride to the market on Saturday", meta: "Ana · 1 ride · Saturday", tags: [{ label: "Request", tone: "request" }] }) },
      { label: "eight tags, row still one line", html: kit.commitmentCard({ title: "Restore the compost bays", meta: "Maria · 4 sessions · due Aug 24", tags: [{ label: "Offer", tone: "offer" }, { label: "Ongoing" }, { label: "Team of 3" }, { label: "In exchange" }, { label: "40 G$" }, { label: "AGRO" }, { label: "WASTE" }, { label: "Support / service" }], media: { label: "photo", tint: "waste" } }) },
      { label: "wallet cast. Garden replaces creator, state leads", html: kit.commitmentCard({ title: "Beach cleanup Saturday", meta: "Muizenberg · 2 hours", tags: [{ label: "Kept", tone: "ok" }] }) },
    ],
  },
  {
    id: "offer-card", title: "Offer card", family: "cards", covers: ["offerCard"],
    kit: `offerCard({queued, waiting, failed, readOnly, team})`,
    ship: "packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:122",
    shipNote: "the W1 browse casts of commitmentCard",
    rule: "Browse card for an Offer: the whole card opens the detail. Its own-send casts (queued, waiting, failed) keep recovery controls, which are device-state acts rather than claim acts.",
    usedIn: ["W1", "W5"],
    specs: [
      { label: "open for claim", html: kit.offerCard() },
      { label: "team forming", html: kit.offerCard({ team: 3 }) },
      { label: "queued send", html: kit.offerCard({ queued: true }) },
      { label: "waiting for membership", html: kit.offerCard({ waiting: true }) },
      { label: "send failed", html: kit.offerCard({ failed: true }) },
      { label: "read-only", html: kit.offerCard({ readOnly: true }) },
    ],
  },
  {
    id: "request-card", title: "Request card", family: "cards", covers: ["requestCard"],
    kit: `requestCard({openClaim, queued, context})`,
    ship: "packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:122",
    shipNote: "same grammar as the Offer card",
    rule: "Browse card for a Request; the claim button's own label carries the mode: “I can help” is open, “Ask to take this up” is reviewed.",
    usedIn: ["W1"],
    specs: [
      { label: "open claim", html: kit.requestCard({ openClaim: true }) },
      { label: "reviewed claim", html: kit.requestCard() },
      { label: "queued send", html: kit.requestCard({ queued: true }) },
    ],
  },
  {
    id: "ongoing-offer-card", title: "Ongoing-offer place card", family: "cards", covers: ["ongoingOfferCard"],
    kit: `ongoingOfferCard()`,
    netNew: "the public life of a commitment series on the pool tab",
    rule: "An ongoing Offer shows places open as its real progress; the whole card opens the series detail where places are taken up.",
    usedIn: ["W1", "W34"],
    specs: [{ label: "places open", html: kit.ongoingOfferCard() }],
  },
  {
    id: "team-offer-card", title: "Team-offer card", family: "cards", covers: ["teamOfferCard"],
    kit: `teamOfferCard()`,
    netNew: "the forming-team roster visible from browse",
    rule: "A team Offer names its target size on the chip row; the team view itself lives inside the commitment detail.",
    usedIn: ["W1"],
    specs: [{ label: "team of 3, two domains", html: kit.teamOfferCard() }],
  },
  {
    id: "funded-offer-card", title: "Priced-offer card", family: "cards", covers: ["fundedOfferCard"],
    kit: `fundedOfferCard()`,
    netNew: "the member-funded priced Offer",
    rule: "A priced Offer adds its G$ chip; deposit instructions never render before the funding record exists.",
    usedIn: ["W1", "W36"],
    specs: [{ label: "ask to fund", html: kit.fundedOfferCard() }],
  },
  {
    id: "claim-cards", title: "Claim outcome cards", family: "cards", covers: [],
    kit: `claimCard(state), screen-local in screens/client.ts`,
    netNew: "the four outcomes of asking to take a request up",
    rule: "Pending, declined, superseded, and accepted each get their own quiet card; superseded is explicitly not a send failure.",
    usedIn: ["W1"],
    specs: [
      { label: "pending review", html: claims.pending },
      { label: "not this time", html: claims.declined },
      { label: "superseded", html: claims.superseded },
      { label: "accepted", html: claims.accepted },
    ],
  },
  {
    id: "kind-cards", title: "Kind cards", family: "cards", covers: ["kindCards"],
    kit: `kindCards(options)`,
    netNew: "the composer's equal 2-up choice",
    rule: "Identical-size tappable cards for the composer's first choice; the selected card fills the accent tint. The same component serves both directions.",
    usedIn: /class="kgrid/,
    specs: [
      { label: "work selected", html: kit.kindCards([
        { icon: "plant-line", label: "Garden work", meta: "Hours, sessions, harvest shares", on: true },
        { icon: "hand-heart-line", label: "Support / service", meta: "Rides, tools, meals, skills" },
      ]) },
    ],
  },
  {
    id: "offer-row", title: "Saved-offer row", family: "cards", covers: ["offerRow"],
    kit: `offerRow({title, meta, tag, tone})`,
    netNew: "private saved details, reusable input to either offer path",
    rule: "A saved detail set is input you can reuse, never a second product object beside the Offer; only “Offered over time” implies a live series.",
    usedIn: ["W32"],
    specs: [
      { label: "offered over time", html: kit.offerRow({ title: "Saturday veggie box", meta: "Saved in July", tag: "Offered over time", tone: "offer" }) },
      { label: "saved detail", html: kit.offerRow({ title: "Two hours of pruning", meta: "Saved in June", tag: "Saved", tone: "plain" }) },
      { label: "closed", html: kit.offerRow({ title: "Compost workshop", meta: "Series ended", tag: "Closed", tone: "ink" }) },
    ],
  },
  {
    id: "kv-row", title: "Key-value row", family: "cards", covers: ["kv"],
    kit: `kv(key, value)`,
    ship: "packages/client/src/views/Garden/Review.tsx:152",
    shipNote: "the review step's summary-row pattern",
    rule: "Detail facts render as quiet key-value rows; values keep tabular numerals.",
    usedIn: /class="kv"/,
    specs: [
      { label: "fact rows", html: `${kit.kv("Asked", "Jul 9")}${kit.kv("Provider", "myself")}${kit.kv("Due", "Aug 12")}` },
    ],
  },
  {
    id: "list-row", title: "List row", family: "cards", covers: ["listRow"],
    kit: `listRow({icon | thumb, thumbHotId, primary, meta, chipHtml, trailing, chevron})`,
    netNew: "the generic queue/list row",
    rule: "Queues render as list rows, not tables; the tail holds at most a chip, a value, and a chevron. A media row carries the PICTURE in its leading slot, not an image-line icon. The shipped media step renders every photo as an <img> and opens a preview on tap, and 'Photo · just now' beside a generic glyph is the one thing it never does. The thumbnail is 44px, the shipped minimum touch target, so tapping it lands where a finger expects.",
    usedIn: /class="lr"/,
    specs: [
      { label: "with chip + chevron", html: kit.listRow({ icon: "seedling-line", primary: "Prune the north beds", meta: "6 hours · due Aug 12", chipHtml: kit.chip("Offer", "offer"), chevron: true }) },
      { label: "value tail", html: kit.listRow({ icon: "hand-heart-line", primary: "Ride to the market", meta: "Saturday", trailing: `<span class="num">1 ride</span>` }) },
      { label: "a photo · thumbnail, tappable to preview", html: kit.listRow({ thumb: 0, primary: "North beds — before", meta: "Photo · just now", trailing: kit.btn("Remove", { kind: "ghost", sm: true, icon: "close-line", ariaLabel: "Remove this photo" }) }) },
      { label: "a voice note in the same list, no picture to draw", html: kit.listRow({ icon: "mic-line", primary: "Voice note", meta: "0:38 · tap to play" }) },
    ],
  },
  {
    id: "offer-record", title: "Offer record", family: "cards", covers: ["offerRecord"],
    kit: `offerRecord({since, given, people, compact})`,
    netNew: "value over time, for an ongoing offer",
    rule: "A commitment is the unit of accountability and ends; an ongoing offer is the unit of VALUE, and its worth is the pattern no single commitment can express. Every figure is a NUMERATOR, and that is a rule rather than a style choice: Appendix D.3 forbids per-person rates, grades and comparisons on public surfaces, and what makes those possible is a denominator. '4 kept · 1 lapsed' lets anyone compute 80%; '12 sessions given' cannot be turned into a score however it is arranged. The cost is deliberate and was accepted. This never distinguishes twelve of twelve from twelve of thirty, and the full kept-and-lapsed record stays with the member and their stewards where D.3 puts it.",
    usedIn: /class="orec/,
    specs: [
      { label: "on the offer's own screen", html: kit.offerRecord({ since: "March", given: "12 sessions given", people: "9 neighbours took one up" }) },
      { label: "compact, on the pool card", html: kit.offerRecord({ since: "March", given: "18 boxes given", people: "11 neighbours", compact: true }) },
      { label: "new, with nothing given yet", html: kit.offerRecord({ since: "this week", given: "nothing given yet" }) },
    ],
  },
  {
    id: "media-stack", title: "Media stack", family: "cards", covers: ["mediaStack"],
    kit: `mediaStack([{label, photo | kind, hotId, removeHotId}])`,
    ship: "packages/client/src/views/Garden/Media.tsx:690",
    shipNote: "flex flex-col on mobile; the 2-col grid is md: only, which a 390px phone never reaches",
    rule: "The COMPOSER and the READ surface are different treatments, and collapsing them into one is how both came out wrong. Composing, you get full-width photos at aspect-4/3, stacked, each big enough to check before sending, with the remove control pinned over the image. Reading, you get WorkView's Carousel of narrow portrait items. A voice note, link or written note has no picture, so it is a row rather than a pretend photo.",
    usedIn: /class="mstack"/,
    specs: [
      { label: "two photos and a voice note", html: kit.mediaStack([{ label: "North beds — before", photo: 0, removeHotId: "gallery.noop" }, { label: "Voice note · 0:41", kind: "audio", removeHotId: "gallery.noop" }]) },
      { label: "nothing but a written note", html: kit.mediaStack([{ label: "“Two beds left for next week”", kind: "note", removeHotId: "gallery.noop" }]) },
    ],
  },
  {
    id: "bar-pair", title: "Action pair", family: "forms", covers: ["barPair"],
    kit: `actionBar(barPair(a, b))`,
    netNew: "the two-act bottom bar",
    rule: "Two acts in a bar are equal halves. Sized to their own text they came out at 131 and 124 in a 358px bar, so the pair looked ragged and the target position moved from screen to screen. The pair is ONE element, which is also what keeps the capture bar's icon run out of the rule: that is a run, not a pair.",
    usedIn: /class="fpair"/,
    specs: [
      { label: "a choice of two acts", html: `<div class="fbar" style="position:static">${kit.barPair(kit.btn("Add Proof", { kind: "sec" }), kit.btn("Submit Work", { kind: "pri" }))}</div>`, w: "m" },
      { label: "a confirmation", html: `<div class="fbar" style="position:static">${kit.barPair(kit.btn("Not Yet", { kind: "ghost" }), kit.btn("Send It", { kind: "pri" }))}</div>`, w: "m" },
    ],
  },
  {
    id: "pick-row", title: "Picker row", family: "forms", covers: ["pickRow"],
    kit: `pickRow([{label, on, hotId}], {ariaLabel})`,
    netNew: "the tap-first value picker",
    rule: "A picker is a CONTROL, not a chip. The two were built from the same function, and `.ch`'s box reset deliberately defeats the 44px minimum, right for a label that describes a card, an accessibility defect for the unit, amount and count pickers on the how-much step, which rendered at a 24px box. Same shape and rhythm as a chip, real touch target, and a pressed state a label has no use for. A picker with nowhere to go is honestly disabled rather than pretending to be live.",
    usedIn: /class="pickrow"/,
    specs: [
      { label: "unit. One chosen", html: kit.pickRow([{ label: "hours", on: true }, { label: "tasks" }, { label: "meals" }, { label: "rides" }, { label: "other…" }]) },
      { label: "amount, with a custom escape", html: kit.pickRow([{ label: "1" }, { label: "2" }, { label: "6", on: true }, { label: "12" }, { label: "custom…" }]) },
    ],
  },
  {
    id: "image-preview", title: "Image preview", family: "cards", covers: ["imagePreview", "photoFill"],
    kit: `imagePreview({ix, of, photo, closeHotId, prevHotId, nextHotId})`,
    ship: "packages/shared/src/components/Dialog/ImagePreviewDialog.tsx",
    shipNote: "counter left, control cluster right over a black-to-transparent gradient; object-contain image; arrows only when there IS a neighbour",
    drift: "The photograph is a layered gradient rather than a JPEG. The artifact is one self-contained file and cannot fetch an image, but everything about the dialog around it is the shipped anatomy.",
    rule: "A thumbnail opens into the preview, and the preview is a DIALOG: the surface underneath keeps its scroll and its state. Only photos are in the sequence, a voice note or a link in the same list is skipped, because the dialog is fed photoOnlyData. The zoom trio is `hidden sm:flex` in the shipped component, so a phone draws download and close only, which is what keeps close on-screen at 375px.",
    usedIn: /class="ipv"/,
    specs: [
      { label: "one of two, next only", html: `<div style="position:relative;height:300px;border-radius:16px;overflow:hidden">${kit.imagePreview({ ix: 1, of: 2, photo: 0, closeHotId: "gallery.noop", downloadHotId: "gallery.noop", nextHotId: "gallery.noop" })}</div>`, w: "m" },
      { label: "the only photo, no arrows", html: `<div style="position:relative;height:300px;border-radius:16px;overflow:hidden">${kit.imagePreview({ ix: 1, of: 1, photo: 3, closeHotId: "gallery.noop", downloadHotId: "gallery.noop" })}</div>`, w: "m" },
    ],
  },
  {
    id: "section-card", title: "Read-surface section", family: "cards", covers: ["sectionCard", "detailRow", "mediaStrip"],
    kit: `sectionCard(label, inner, {flush}) · detailRow(label, value) · mediaStrip(items)`,
    ship: "packages/client/src/components/Features/Work/WorkView.tsx:78",
    shipNote: "h6 label on the canvas, content in a card. The shipped work view's anatomy",
    rule: "A read surface is sections, not drawers: a quiet label on the canvas with its content OPEN in a card beneath. The commitment view used to stack five closed disclosures, so nothing about a commitment was legible without tapping. Media renders as real THUMBNAILS that open a preview, whoever is deciding is deciding on the photograph. A voice note, a link or a written note has no picture, so it keeps a dashed tile carrying its kind as a glyph rather than pretending to be one. Only a genuinely long, secondary, read-once section (the timeline) stays folded.",
    usedIn: /class="card sect/,
    specs: [
      { label: "details", html: kit.sectionCard("Details", `${kit.detailRow("Amount", "6 hours · due Aug 12")}${kit.detailRow("Season", "First Rains")}${kit.detailRow("Kind", "AGRO")}`), w: "m" },
      { label: "media · flush", html: kit.sectionCard("Media", kit.mediaStrip([{ label: "North beds — before", photo: 0 }, { label: "North beds — after", photo: 2 }, { label: "Voice note", kind: "audio" }]), { flush: true }), w: "m" },
      { label: "media. Nothing but a written note", html: kit.sectionCard("Media", kit.mediaStrip([{ label: "Written note", kind: "note" }, { label: "Site survey", kind: "link" }]), { flush: true }), w: "m" },
    ],
  },
  {
    id: "disclosure", title: "Disclosure", family: "cards", covers: ["disclosure"],
    kit: `disclosure(title, count, inner, {open})`,
    netNew: "progressive disclosure on detail surfaces",
    rule: "Reserved for the genuinely long and secondary, a timeline read once. State, media, details, and people are sections now, not drawers (2026-08-16).",
    usedIn: /class="disc"/,
    specs: [
      { label: "closed", html: kit.disclosure("Timeline", "4", `<div class="t-meta">…</div>`) },
      { label: "open", html: kit.disclosure("Proof", "2", `${kit.kv("Photos", "2")}${kit.kv("Note", "Beds cleared")}`, { open: true }) },
    ],
  },
  // — Rails & carousels —
  {
    id: "cycle-rail", title: "Cycle rail", family: "rails", covers: ["cycleRail", "cycleCard", "seasonCard", "seasonSlide", "emptySeasonSlide", "campaignSlide"],
    kit: `cycleRail(slides) · cycleCard · seasonCard/seasonSlide/emptySeasonSlide/campaignSlide`,
    netNew: "one snap rail of equal-width slides, each carrying what is open in its own cycle",
    rule: "Season and campaigns are peers, so every slide is the same width and the same card. The season used to lead wider, which made siblings look like a parent and its children. Cycle cards speak the commitment card's language (title, meta, tags, square) with one extra meta line, because a cycle carries both what is open in it and how it has gone. Units are per-cycle and never summed across labels.",
    usedIn: /class="crail/,
    specs: [
      { label: "season + campaigns", html: kit.pagepad(kit.cycleRail([kit.seasonSlide(), kit.campaignSlide("g.c1", "Market rides", "Open", "6 of 16 kept"), kit.campaignSlide("g.c2", "Tool library", "Reviewing", "8 of 8 kept")])) },
      { label: "no season yet", html: kit.pagepad(kit.cycleRail([kit.emptySeasonSlide(), kit.campaignSlide("g.c3", "Market rides", "Open", "6 of 16 kept")])) },
      { label: "season card alone, reviewing", html: kit.seasonCard({ stage: "Reviewing" }) },
      { label: "season card, seeded (no counts)", html: kit.seasonCard({ made: 0, kept: 0, stage: "Seeded" }) },
    ],
  },
  {
    id: "selection-rail", title: "Selection rail", family: "rails", covers: ["selRail", "selCard"],
    kit: `selRail(cards) · selCard({tint, media, title, line, selected})`,
    ship: "packages/client/src/components/Cards/Action/ActionCard.tsx:32",
    shipNote: "ActionCard/GardenCard height=selection inside Carousel (packages/client/src/components/Display/Carousel/Carousel.tsx:10)",
    drift: "Shipping selection cards are ~full-width slides, 212px tall with 96–160px media (packages/client/src/components/Display/Carousel/Carousel.tsx:185). These are 200px two-up compacts.",
    rule: "The intro's action and garden pickers: tinted media strip, title + line, accent ring on the selected card.",
    usedIn: /class="selrail/,
    specs: [
      { label: "action cards", html: kit.pagepad(kit.selRail([
        kit.selCard({ tint: "agro", media: "AGRO", title: "Prune", line: "Trees and beds", selected: true }),
        kit.selCard({ tint: "agro", media: "AGRO", title: "Water", line: "Beds and rows" }),
        kit.selCard({ tint: "waste", media: "WASTE", title: "Compost", line: "Bays and bins" }),
      ])) },
      { label: "garden cards", html: kit.pagepad(kit.selRail([
        kit.selCard({ tint: "garden", media: "Rocinha", title: "Rocinha Community Garden", line: "Rio de Janeiro", selected: true }),
        kit.selCard({ tint: "garden", media: "Muizenberg", title: "Muizenberg", line: "Cape Town" }),
      ])) },
    ],
  },
  {
    id: "commitment-rail", title: "Commitment rail", family: "rails", covers: ["commitmentSlide"],
    kit: `commitmentSlide({title, needs, due})`,
    netNew: "the intro's third rail, many commitments cost no vertical space",
    rule: "Compact commitment cards ride the same horizontal grammar as the pickers, nearest due first; tapping one enters the scoped flow.",
    usedIn: /class="card pcard/,
    specs: [
      { label: "offer + request slides", html: kit.pagepad(kit.selRail([
        kit.commitmentSlide({ title: "Prune the north beds", needs: "needs Prune × 2", due: "due Aug 12" }),
        kit.commitmentSlide({ title: "Clear the drainage channel", needs: "needs Mulch × 4", due: "due Aug 30" }),
        kit.commitmentSlide({ title: "Mulch the pathways", needs: "needs Mulch × 3", due: "runs with the season" }),
      ])) },
    ],
  },
  // — Forms & inputs —
  {
    id: "button", title: "Button", family: "forms", covers: ["btn"],
    kit: `btn(label, {kind, icon, full, sm, disabled})`,
    ship: "packages/shared/src/components/Button.tsx:43",
    shipNote: "gg-button · 20px squircle for primary AND secondary; hierarchy is fill vs stroke, never shape",
    drift: "Shipping Button adds md/lg sizes and a loading spinner (packages/shared/src/components/Button.tsx:43), only the default and sm sizes are drawn here.",
    rule: "One primary per surface; secondary is the outlined squircle; ghost for quiet exits; danger only on destructive confirms.",
    usedIn: /class="b /,
    specs: [
      { label: "kinds", html: `<div class="brow">${kit.btn("Make an offer", { kind: "pri" })}${kit.btn("Take this up", { kind: "sec" })}${kit.btn("Not now", { kind: "ghost" })}${kit.btn("Discard", { kind: "danger" })}</div>` },
      { label: "small", html: `<div class="brow">${kit.btn("Retry", { kind: "sec", sm: true })}${kit.btn("Discard", { kind: "ghost", sm: true })}</div>` },
      { label: "full-width primary", html: kit.btn("Send", { kind: "pri", full: true }) },
      { label: "with icon", html: kit.btn("Add proof", { kind: "pri", icon: "camera-line" }) },
      { label: "disabled", html: kit.btn("Send", { kind: "pri", disabled: true }) },
    ],
  },
  {
    id: "field-input", title: "AdminTextField / AdminInlineField", family: "forms", covers: ["field", "input"],
    kit: `field(label, control) · input(value, {select, textarea, icon, placeholder})`,
    ship: "packages/client/src/views/Garden/Details.tsx:355",
    shipNote: "labels via FormFieldWrapper grammar; the shipping FormText textarea is rows=4",
    rule: "Every control gets a visible programmatic label through field(); multiline answers get a real textarea, never a tall single-line input.",
    usedIn: /class="fld"/,
    specs: [
      { label: "text", html: kit.field("Title", kit.input("Prune the north beds")) },
      { label: "placeholder", html: kit.field("Title", kit.input("What are you offering?", { placeholder: true })) },
      { label: "select", html: kit.field("Season", kit.input("Season of First Rains", { select: true })) },
      { label: "textarea", html: kit.field("Notes", kit.input("Bring gloves. The north beds are thorny.", { textarea: true })) },
      { label: "with icon", html: kit.field("Due", kit.input("Aug 12", { icon: "calendar-line" })) },
    ],
  },
  {
    id: "radio-group", title: "AdminChoiceGroup (radio)", family: "forms", covers: ["radio"],
    kit: `radio(options, {interactive})`,
    netNew: "boxed radio rows with meta lines",
    rule: "Choices render as boxed rows with a meta line each; the selected row fills the accent ring.",
    usedIn: /class="radio"/,
    specs: [
      { label: "static", html: kit.radio([
        { label: "Just myself", meta: "You keep this commitment alone", on: true },
        { label: "A team", meta: "Others can join before it starts" },
      ]) },
      { label: "interactive", html: kit.radio([
        { label: "Once", meta: "One commitment, one delivery", on: true },
        { label: "Over time", meta: "A series with places" },
      ], { interactive: true, name: "gallery-cadence" }) },
    ],
  },
  {
    id: "form-info", title: "FormInfo", family: "forms", covers: ["formInfo"],
    kit: `formInfo(icon, title, info)`,
    ship: "packages/client/src/components/Cards/Form/FormInfo.tsx:19",
    drift: "Shipping FormInfo is 16px-radius with three tonal variants (packages/client/src/components/Cards/Form/FormInfo.tsx:13), drawn here at 14px in the single default tone.",
    rule: "The step-section header: filled card, 48px circular icon holder, title + one helper line. Sections start with this, not a bare heading.",
    usedIn: /class="finfo/,
    specs: [
      { label: "select your action", html: kit.formInfo("leaf-line", "Select your action", "What type of work are you submitting?") },
      { label: "select your garden", html: kit.formInfo("plant-line", "Select your garden", "Which garden are you submitting for?") },
    ],
  },
  {
    id: "form-progress", title: "FormProgress", family: "forms", covers: ["formProgress"],
    kit: `formProgress(total, current)`,
    ship: "packages/client/src/components/Communication/Progress/Progress.tsx:10",
    shipNote: "numbered 20px circles, check on completion, accent ring on current",
    rule: "Wizards render the numbered stepper, never dots; it rides the flow header's trailing slot.",
    usedIn: /class="fprog .*fpstep|class="fpstep/,
    specs: [
      { label: "step 1 of 4", html: kit.formProgress(4, 0) },
      { label: "step 3 of 4", html: kit.formProgress(4, 2) },
      { label: "last step", html: kit.formProgress(4, 3) },
    ],
  },
  // — Chrome —
  {
    id: "phone-frame", title: "Phone frame", family: "chrome", covers: ["phoneFrame", "pagepad"],
    kit: `phoneFrame(body, {offline, appBar, header, overlay}) · pagepad(children)`,
    ship: "packages/client/src/routes/AppShell.tsx:24",
    shipNote: "the owned #app-scroll surface; AppShell-backed frames reserve the 69px AppBar",
    rule: "Every client screen lives in the fixed 390×844 viewport with its own inner scroll; pagepad owns the 16px content gutter.",
    usedIn: /class="phonefit/,
    specs: [
      { label: "installed-PWA shell (scaled)", html: kit.phoneFrame(kit.pagepad(kit.hdr("Pool"), kit.card(cardInner("Prune the north beds", "6 hours · due Aug 12"), {})), {}), w: "frame" },
    ],
  },
  {
    id: "screen-header", title: "Screen header", family: "chrome", covers: ["hdr"],
    kit: `hdr(title, {back, trailing})`,
    ship: "packages/client/src/views/Home/Garden/Assessment.tsx:95",
    shipNote: "client views hand-render the title-screen h1 grammar",
    rule: "One h1 per screen; the back affordance is a 44px round hit, and the trailing slot holds at most one quiet element.",
    usedIn: /class="hdr"/,
    specs: [
      { label: "with back", html: kit.hdr("Pool", { back: true }) },
      { label: "with trailing chip", html: kit.hdr("Wallet", { trailing: kit.chip("Queued", "queued") }) },
    ],
  },
  {
    id: "flow-header", title: "Flow header", family: "chrome", covers: ["flowHeader"],
    kit: `flowHeader(title, step, total)`,
    ship: "packages/client/src/views/Garden/index.tsx:778",
    shipNote: "TopNav (packages/client/src/components/Navigation/TopNav.tsx:182) + FormProgress",
    drift: "The shipping Submit Work header carries no title, TopNav renders back + centered FormProgress only (packages/client/src/views/Garden/index.tsx:778); the h1 here is artifact-added.",
    rule: "Close on the first step, back on every later one; the stepper rides the trailing slot.",
    usedIn: /class="hdr fixed"/,
    specs: [
      { label: "step 1. Close", html: kit.flowHeader("Submit work", 0, 4) },
      { label: "step 3, back", html: kit.flowHeader("Submit work", 2, 4) },
    ],
  },
  {
    id: "garden-header", title: "Garden header", family: "chrome", covers: ["gardenHeader"],
    kit: `gardenHeader(name, {location, founded})`,
    ship: "packages/client/src/views/Home/Garden/index.tsx:375",
    shipNote: "h-36 banner, rounded-b-3xl, overlaid back, then name + meta",
    rule: "The garden detail owns its chrome: banner with overlaid back, then the garden name and location/founded meta; the bottom AppBar hides here.",
    usedIn: /class="ghead/,
    specs: [
      { label: "banner + meta", html: kit.gardenHeader("Rocinha Community Garden", { location: "Rocinha, Rio de Janeiro", founded: "Founded 2021" }) },
    ],
  },
  {
    id: "home-header", title: "Home header", family: "chrome", covers: ["homeHeader"],
    kit: `homeHeader()`,
    ship: "packages/client/src/views/Home/index.tsx:237",
    drift: "Shipping header buttons are 32px squares with an invisible enlarged tap target (packages/client/src/views/Home/index.tsx:245). These draw the 44px floor as the visible square.",
    rule: "Home's h4 title plus a trailing icon-button row; distinct from the garden detail's banner header.",
    usedIn: /class="hhead/,
    specs: [{ label: "title + actions", html: kit.homeHeader() }],
  },
  {
    id: "garden-tabs", title: "Garden tabs", family: "chrome", covers: ["gardenTabs"],
    kit: `gardenTabs(active, {hotPrefix})`,
    ship: "packages/client/src/components/Navigation/Tabs/StandardTabs.tsx:24",
    drift: "Shipping StandardTabs supports icons, count badges, and a loading underline (packages/client/src/components/Navigation/Tabs/StandardTabs.tsx:97), undrawn here, and this underline is partial-width.",
    rule: "Pool leads and is the default landing when a pool exists; a garden without a pool draws the original Work-first row with Pool absent.",
    usedIn: /class="gtabs/,
    specs: [
      { label: "pool active", html: kit.gardenTabs("pool") },
      { label: "work active", html: kit.gardenTabs("work") },
    ],
  },
  {
    id: "app-bar", title: "App bar", family: "chrome", covers: ["appBar"],
    kit: `appBar(active, {badge})`,
    ship: "packages/client/src/components/Layout/AppBar.tsx:15",
    drift: "Shipping labels are 14px (packages/client/src/components/Layout/AppBar.tsx:114), drawn 12px here.",
    rule: "Installed-PWA chrome only; hides on garden detail routes and under drawers. The Home badge counts pending reviews.",
    usedIn: /class="abar/,
    specs: [
      { label: "garden active", html: kit.appBar("garden") },
      { label: "home + badge", html: kit.appBar("home", { badge: 3 }) },
    ],
  },
  {
    id: "action-bar", title: "Action bar", family: "chrome", covers: ["actionBar"],
    kit: `actionBar(primary, secondary)`,
    ship: "packages/client/src/views/Garden/index.tsx:792",
    shipNote: "the fixed submit bar. One row, rounded top, safe-area padding",
    rule: "One full-width primary and at most an icon/short-text secondary beside it, never two stacked full buttons; detours live in page content.",
    usedIn: /class="fbar/,
    specs: [
      { label: "primary only", html: kit.actionBar(kit.btn("Send", { kind: "pri", full: true })) },
      { label: "with secondary", html: kit.actionBar(kit.btn("Continue", { kind: "pri", full: true }), kit.btn("Save", { kind: "sec", sm: true })) },
    ],
  },
  {
    id: "fab", title: "Creation FAB", family: "chrome", covers: ["fabButton"],
    kit: `fabButton(open)`,
    ship: "packages/admin/src/components/Shell/FabButton.tsx:23",
    shipNote: "the steward cockpit's forked FabButton (Cockpit M3 1a, split into Shell/FabButton.tsx; the shared Canvas original is superseded for admin); net-new to the client PWA",
    drift: "Shipping FAB is 48px (56px when floating with a label), rounded-full, tone-action filled, and rotates its + 45° when open (packages/admin/src/components/Shell/FabButton.tsx:228). This mirror is a 52px squircle that swaps to an X and recolors.",
    rule: "Closed: one + above the AppBar. Open: the two one-word doors stack above the same spot and the FAB flips to a close affordance.",
    usedIn: /class="fabbtn/,
    specs: [
      { label: "closed", html: kit.fabButton(false) },
      { label: "open + doors", html: `<div style="position:relative;height:190px"><div class="fabwrap" style="position:absolute;right:14px;bottom:10px"><button type="button" class="fabdoor" disabled>Offer</button><button type="button" class="fabdoor" disabled>Request</button>${kit.fabButton(true)}</div></div>`, h: 200 },
    ],
  },
  {
    id: "pool-filters", title: "Browse filters", family: "chrome", covers: ["poolFilters", "seg"],
    kit: `poolFilters(activeIx, {mine}) · seg(items, activeIx, {badges})`,
    ship: "packages/client/src/components/Dialogs/ModalDrawer.tsx:139",
    shipNote: "the count-badge idea is the WalletDrawer tab pattern (packages/client/src/views/Home/WalletDrawer/index.tsx:36); the pill segment itself is net-new",
    rule: "Direction pills plus the personal Mine toggle, personal scope is orthogonal to direction, so it is never a fourth pill.",
    usedIn: /class="seg"/,
    specs: [
      { label: "all + mine off", html: kit.poolFilters(0) },
      { label: "offers + mine on", html: kit.poolFilters(1, { mine: true }) },
      { label: "segment with count badge", html: kit.seg(["Open", "Kept", "Past"], 0, { badges: { 0: 3 } }) },
    ],
  },
  {
    id: "sheet", title: "Bottom sheet", family: "chrome", covers: ["sheetOver"],
    kit: `sheetOver(behind, title, inner, {handle})`,
    ship: "packages/shared/src/components/Dialog/PwaSheet.tsx:94",
    shipNote: "gesture sheets show the tinted drag handle; tabbed drawers (packages/client/src/components/Dialogs/ModalDrawer.tsx:40) omit it",
    rule: "Gesture sheets carry the drag pill; drawers dismissed by chrome pass handle:false. The context behind stays visible under the scrim.",
    usedIn: /class="sheetstage/,
    specs: [
      { label: "gesture sheet", html: kit.sheetOver(kit.pagepad(kit.card(cardInner("Prune the north beds", "6 hours · due Aug 12"))), "Add proof", `${kit.field("Note", kit.input("Beds cleared", { textarea: true }))}`), h: 420 },
      { label: "drawer (no handle)", html: kit.sheetOver(kit.pagepad(kit.card(cardInner("Wallet", ""))), "Commitments", kit.listRow({ icon: "seedling-line", primary: "Prune the north beds", meta: "due Aug 12", chevron: true }), { handle: false }), h: 340 },
    ],
  },
  {
    id: "section-title", title: "Section title", family: "chrome", covers: ["sectionTitle"],
    kit: `sectionTitle(title, trailing)`,
    netNew: "the in-page section heading with a quiet trailing slot",
    rule: "Sections inside a screen get the 16.5px title; the trailing slot holds a count or one quiet link, never an action button.",
    usedIn: /class="t-sec/,
    specs: [{ label: "with trailing count", html: kit.sectionTitle("Open commitments", kit.chip("6", "plain")) }],
  },
  // — Feedback —
  {
    id: "banner", title: "Banner", family: "feedback", covers: ["banner"],
    kit: `banner(text, tone, icon)`,
    ship: "packages/shared/src/components/Alert.tsx:38",
    drift: "Shipping Alert's tones are error / warning / info / success (packages/shared/src/components/Alert.tsx:24). The quiet stone tone here is artifact-only and the blue info tone is undrawn.",
    rule: "Inline context that stays with its section; amber for caution, stone for quiet notes, green for confirmation, error for failures.",
    usedIn: /class="ban /,
    specs: [
      { label: "amber", html: kit.banner("Offline. This will send when connected.", "amber") },
      { label: "stone", html: kit.banner("Only stewards can see this queue.", "stone") },
      { label: "green", html: kit.banner("Confirmation sent to Ana.", "green", "checkbox-circle-fill") },
      { label: "error", html: kit.banner("Five send attempts used.", "error", "error-warning-line") },
    ],
  },
  {
    id: "sync-bar", title: "Sync bar", family: "feedback", covers: ["syncBar"],
    kit: `syncBar(text)`,
    ship: "packages/shared/src/components/SyncStatusBar.tsx:16",
    drift: "Shipping SyncStatusBar has three states (offline / syncing / pending) with per-state icons and a Sync All action for wallet users (packages/shared/src/components/SyncStatusBar.tsx:42). This strip draws one queued state.",
    rule: "The queued-jobs strip sits above the AppBar and never blocks content; counts stay honest to the queue.",
    usedIn: /class="syncbar/,
    specs: [{ label: "queued", html: kit.syncBar("2 items waiting to sync") }],
  },
  {
    id: "skeleton", title: "Skeleton", family: "feedback", covers: ["skeleton"],
    kit: `skeleton({title, avatar, lines})`,
    ship: "packages/shared/src/components/Skeleton.tsx:34",
    shipNote: "SkeletonCard/SkeletonText; the client also ships per-card skeletons",
    rule: "Loading preserves layout: the commitmentholder mirrors the card it stands in for, so nothing shifts when data lands.",
    usedIn: /class="sk[\s"]/,
    specs: [
      { label: "card", html: kit.skeleton() },
      { label: "titled", html: kit.skeleton({ title: true, lines: 2 }) },
      { label: "with avatar", html: kit.skeleton({ avatar: true, lines: 2 }) },
    ],
  },
  {
    id: "empty-state", title: "Empty state", family: "feedback", covers: ["emptyState"],
    kit: `emptyState(icon, title, body, actions)`,
    ship: "packages/shared/src/components/ListPrimitives.tsx:14",
    drift: "Shipping icon circle is 64px (packages/shared/src/components/ListPrimitives.tsx:20), drawn 52px here.",
    rule: "Empty names the scope it is empty of; recovery states get one clear way forward, centered.",
    usedIn: /class="empty"/,
    specs: [
      { label: "scope-named empty", html: kit.emptyState("seedling-line", "No open commitments", "This season has no open offers or requests yet.", kit.btn("Make an offer", { kind: "pri" })) },
      { label: "read error", html: kit.emptyState("error-warning-line", "Couldn't load the pool", "Check your connection and try again.", kit.btn("Retry", { kind: "sec" })) },
    ],
  },
  {
    id: "hero", title: "Hero moment", family: "feedback", covers: ["hero"],
    kit: `hero(title, msg, icon)`,
    netNew: "the client-only fulfilled celebration; the steward cockpit keeps quiet checkmarks",
    rule: "Hero moments live in the client PWA only, at true completions, never for intermediate steps.",
    usedIn: /class="hero"/,
    specs: [{ label: "fulfilled", html: kit.hero("Commitment kept", "Ana confirmed the ride. This one is complete.") }],
  },
  {
    id: "meter", title: "Progress meter", family: "feedback", covers: ["meter"],
    kit: `meter(pct, {left, right, tickPct})`,
    ship: "packages/shared/src/components/Conviction/ConvictionMeter.tsx:68",
    drift: "Shipping ConvictionMeter adds accrual-rate and time-to-threshold labels (packages/shared/src/components/Conviction/ConvictionMeter.tsx:68), undrawn here.",
    rule: "Real single-unit progress only, never a synthetic cross-commitment percentage; the tick marks a threshold.",
    usedIn: /class="meter"/,
    specs: [
      { label: "with labels", html: kit.meter(60, { left: "3 of 5 sessions", right: "60%" }) },
      { label: "with threshold tick", html: kit.meter(62, { tickPct: 80, left: "Conviction", right: "62 of 80" }) },
    ],
  },
  {
    id: "timeline", title: "Timeline", family: "feedback", covers: ["timeline"],
    kit: `timeline(entries)`,
    netNew: "the state history behind a detail disclosure",
    rule: "The commitment's history reads newest context first behind its disclosure; open dots mark the pending step, amber marks caution.",
    usedIn: /class="tl"/,
    specs: [
      { label: "three entries", html: kit.timeline([
        { label: "Offered", meta: "Jul 2" },
        { label: "Accepted", meta: "Jul 9", note: "Taken up by João" },
        { label: "Proof in", meta: "Aug 1", open: true },
      ]) },
      { label: "with caution", html: kit.timeline([
        { label: "Due", meta: "Aug 12", warn: true, note: "Past due. Stewards can extend or expire" },
      ]) },
    ],
  },
  // — People —
  {
    id: "team-strip", title: "Team strip", family: "people", covers: ["teamstrip"],
    kit: `teamstrip(initials)`,
    netNew: "overlapping initial avatars; shipping renders people per-view with letter fallbacks",
    rule: "The people on a commitment render as one overlapping strip beside their line, never a vertical roster on browse surfaces.",
    usedIn: /class="teamstrip/,
    specs: [{ label: "three people", html: `<div class="cardrow">${kit.teamstrip(["M", "J", "A"])}<span class="t-meta">Maria, João and Ana are on this commitment</span></div>` }],
  },
];

// ---- admin catalog (steward cockpit dialect) --------------------------------

const adminRoute = (body: string, opts: { tone?: kit.Tone; tab?: string } = {}) =>
  kit.deskWin("admin.greengoods.app/garden", kit.adminCanvas(opts.tone ?? "garden", "garden", {
    screenId: "GALLERY", garden: "Rocinha Community Garden", interactiveChrome: false,
    header: kit.pageHeader({ title: "Pool", eyebrow: "Garden", description: "Offers, requests, and the season at a glance." }),
    tabRail: opts.tab, body,
  }));

const ADMIN_ENTRIES: Entry[] = [
  {
    id: "chip", title: "Chip", family: "chips", covers: [],
    kit: `chip(label, tone, {dot}), denser 11.5px cast`,
    ship: "packages/shared/src/components/Badge/Badge.tsx:43",
    shipNote: "nearest shipping anatomy; the cockpit keeps flat chips where the client shows StatusBadge pills",
    rule: "Lifecycle and kind labels stay flat chips in the cockpit; icon pills are a client-only signal.",
    usedIn: /class="ch[\s"]/,
    specs: [
      { label: "tones in the cockpit density", html: `<div class="cardrow">${kit.chip("Open", "ok")}${kit.chip("Offer", "offer")}${kit.chip("Request", "request")}${kit.chip("Due", "warn")}${kit.chip("Expired", "plain")}${kit.chip("Paused", "ink")}${kit.chip("Queued", "queued")}</div>` },
    ],
  },
  {
    id: "scope-chips", title: "AdminFilterChip (scope chips)", family: "chips", covers: [],
    kit: `route-local .scopechips markup (screens/admin.ts)`,
    ship: "packages/admin/src/components/AdminFilterChip.tsx:33",
    rule: "Route-local list scope, Open / Confirmed / Past, as filter chips under the summary row; the active chip fills the workspace tone.",
    usedIn: /class="scopechips/,
    specs: [
      { label: "open active", html: `<div class="scopechips"><button type="button" class="sc-chip on" disabled>Open</button><button type="button" class="sc-chip" disabled>Confirmed</button><button type="button" class="sc-chip" disabled>Past</button></div>` },
    ],
  },
  {
    id: "admin-card", title: "AdminCard", family: "cards", covers: ["acard"],
    kit: `acard(head, body, trailing)`,
    ship: "packages/admin/src/components/AdminCard.tsx:9",
    drift: "Shipping AdminCard also has filled and outlined variants plus a density ladder (packages/admin/src/components/AdminCard.tsx:9), only the elevated cast is drawn.",
    rule: "The M3 elevated solid surface a route composes from; the head row carries the title and at most a quiet trailing cluster.",
    usedIn: /class="acard"/,
    specs: [
      { label: "head + body", html: kit.acard("Season of First Rains", `${kit.kv("Commitments", "9 made · 7 kept")}${kit.kv("Runs through", "Aug 30")}`, kit.chip("Open", "ok")) },
    ],
  },
  {
    id: "data-table", title: "Data table", family: "cards", covers: ["dtable"],
    kit: `dtable(heads, rows, caption)`,
    netNew: "dense M3 table, hairline dividers, no zebra; queues stay list-rows",
    rule: "Tabular data stays a table with hairline row dividers; queues and inboxes render as rows, never tables.",
    usedIn: /class="dtab/,
    specs: [
      { label: "three columns", html: kit.dtable(["Commitment", "Provider", "State"], [
        ["Prune the north beds", "João", kit.chip("Active", "ok")],
        ["Ride to the market", "Maria", kit.chip("Due", "warn")],
      ], "Sample commitments"), w: "l" },
    ],
  },
  {
    id: "kv-row", title: "Key-value row", family: "cards", covers: [],
    kit: `kv(key, value), cockpit cast`,
    ship: "packages/shared/src/components/Canvas/MetaStrip.tsx:23",
    shipNote: "detail facts; MetaStrip carries the equivalent header metadata in production",
    rule: "Detail facts on cards and dialogs; values keep tabular numerals.",
    usedIn: /class="kv"/,
    specs: [{ label: "facts", html: `${kit.kv("Confirmer", "Ana")}${kit.kv("Due", "Aug 12")}${kit.kv("Proof", "2 photos")}` }],
  },
  {
    id: "disclosure", title: "Disclosure", family: "cards", covers: [],
    kit: `disclosure(title, count, inner, {open})`,
    netNew: "progressive disclosure on console surfaces",
    rule: "Reference detail (identifiers, raw history) folds behind disclosures so the queue keeps its density.",
    usedIn: /class="disc"/,
    specs: [{ label: "closed", html: kit.disclosure("Details", "5", `<div class="t-meta">…</div>`) }],
  },
  {
    id: "stage-stepper", title: "Stage stepper", family: "forms", covers: ["stages"],
    kit: `stages(list, activeIx)`,
    netNew: "the cycle/settlement stage line",
    rule: "The console's compact where-are-we line; done dots dim, the active stage carries ink.",
    usedIn: /class="stages/,
    specs: [{ label: "mid-cycle", html: kit.stages(["Open", "Reviewing", "Settling", "Closed"], 1), w: "l" }],
  },
  {
    id: "button", title: "AdminButton", family: "forms", covers: [],
    kit: `btn(label, {kind, sm}), denser cockpit cast`,
    ship: "packages/shared/src/components/Button.tsx:43",
    shipNote: "primary fills the workspace tone in the cockpit",
    rule: "Primary fills the active workspace tone; secondary is the 12px-radius outline; danger only on destructive confirms.",
    usedIn: /class="b /,
    specs: [
      { label: "kinds", html: `<div class="brow">${kit.btn("Open the season", { kind: "pri" })}${kit.btn("Review", { kind: "sec" })}${kit.btn("Not now", { kind: "ghost" })}${kit.btn("Cancel cycle", { kind: "danger" })}</div>`, w: "l" },
    ],
  },
  {
    id: "field-input", title: "Field + input", family: "forms", covers: [],
    kit: `field(label, control) · input(value, {select, textarea}) · 44px cockpit density`,
    ship: "packages/admin/src/components/AdminTextField.tsx:1",
    rule: "Same labelled-control contract as the client at console density; helper text stays under the control.",
    usedIn: /class="fld"/,
    specs: [
      { label: "text", html: kit.field("Season name", kit.input("Season of First Rains")) },
      { label: "select", html: kit.field("Confirmer rule", kit.input("The person it was made to", { select: true })) },
    ],
  },
  {
    id: "radio-group", title: "Radio group", family: "forms", covers: [],
    kit: `radio(options), cockpit density`,
    ship: "packages/admin/src/components/AdminChoiceGroup.tsx:1",
    rule: "Boxed rows with meta lines at console density; one group per question.",
    usedIn: /class="radio"/,
    specs: [
      { label: "static", html: kit.radio([
        { label: "This season only", meta: "Ends Aug 30", on: true },
        { label: "Every season", meta: "Renews with the cycle" },
      ]) },
    ],
  },
  {
    id: "reason-chips", title: "Reason chips", family: "chips", covers: [],
    kit: `reasonChips(options)`,
    netNew: "tap-first reasons above confirm dialogs' reason field",
    rule: "Reason-taking confirms show common reasons as chips; the field remains the stored record.",
    usedIn: /Tap a reason to fill it in/,
    specs: [{ label: "pause reasons", html: kit.reasonChips(["Season break", "Waiting on materials", "Charter review"]) }],
  },
  {
    id: "banner", title: "Banner", family: "feedback", covers: [],
    kit: `banner(text, tone, icon)`,
    ship: "packages/shared/src/components/Alert.tsx:38",
    rule: "Quiet inline context; cockpit success feedback stays checkmark-quiet, never a hero moment.",
    usedIn: /class="ban /,
    specs: [
      { label: "amber caution", html: kit.banner("Two commitments pass their due date this week.", "amber", "error-warning-line"), w: "l" },
      { label: "stone note", html: kit.banner("Only stewards can see this queue.", "stone"), w: "l" },
    ],
  },
  {
    id: "quiet-ok", title: "Quiet confirmation", family: "feedback", covers: [],
    kit: `.quietok markup (tokens.ts)`,
    netNew: "the cockpit's quiet-checkmark success row",
    rule: "A green check and one sentence. The cockpit's ceiling for success feedback.",
    usedIn: /class="quietok/,
    specs: [{ label: "saved", html: `<div class="quietok"><svg class="ic" aria-hidden="true"><use href="#i-checkbox-circle-fill"/></svg><span>Season opened.</span></div>`, w: "l" }],
  },
  {
    id: "skeleton", title: "Skeleton", family: "feedback", covers: [],
    kit: `skeleton({title, lines}), M3 card geometry`,
    ship: "packages/shared/src/components/Skeleton.tsx:34",
    rule: "Loading preserves layout at console density; the admin cast drops the client border for elevation.",
    usedIn: /class="sk[\s"]/,
    specs: [{ label: "card", html: kit.skeleton({ title: true }) }],
  },
  {
    id: "empty-state", title: "Empty state", family: "feedback", covers: [],
    kit: `emptyState(icon, title, body, actions)`,
    ship: "packages/shared/src/components/ListPrimitives.tsx:14",
    rule: "Sits directly on the route card, not a bordered panel; names the queue it is empty of.",
    usedIn: /class="empty"/,
    specs: [{ label: "empty queue", html: kit.emptyState("sticky-note-line", "No claims waiting", "New claims land here for review.") }],
  },
  {
    id: "garden-chip", title: "GardenChip", family: "chrome", covers: ["gardenChip"],
    kit: `gardenChip(name, hotId)`,
    ship: "packages/shared/src/components/Canvas/GardenChip.tsx:34",
    rule: "The AppBar's left pill declares the active garden, chrome owns that context, so routes never restate it.",
    usedIn: /class="gchip/,
    specs: [{ label: "selector pill", html: kit.gardenChip("Rocinha Community Garden") }],
  },
  {
    id: "page-header", title: "PageHeader", family: "chrome", covers: ["pageHeader"],
    kit: `pageHeader({title, eyebrow, description, meta, actions, toolbar})`,
    ship: "packages/admin/src/components/Layout/PageHeader.tsx:40",
    rule: "The route's single big h1 with slots; actions live in the header's own row, never beside the title.",
    usedIn: /class="pghead/,
    specs: [
      { label: "eyebrow + description + actions", html: kit.pageHeader({ title: "Pool", eyebrow: "Garden", description: "Offers, requests, and the season at a glance.", actions: kit.btn("Open the season", { kind: "pri" }) }), w: "l" },
    ],
  },
  {
    id: "tab-rail", title: "AdminTabRail", family: "chrome", covers: ["tabRail"],
    kit: `tabRail(items, activeIx)`,
    ship: "packages/admin/src/components/AdminTabRail.tsx:1",
    shipNote: "underline tabs (Cockpit M3 1a) · 2px workspace-accent underline on the active tab; never a raised segment",
    rule: "Sub-views inside a workspace; counts ride the tabs and flip to the tone container pair when active.",
    usedIn: /class="tabrail/,
    specs: [
      { label: "with counts", html: kit.tabRail([{ label: "Overview" }, { label: "Commitments", count: 12 }, { label: "Claims", count: 4 }], 1), w: "l" },
    ],
  },
  {
    id: "canvas", title: "Canvas cockpit", family: "chrome", covers: ["adminCanvas", "deskWin", "navItems"],
    kit: `deskWin(url, adminCanvas(tone, nav, parts))`,
    ship: "packages/admin/src/components/Layout/CanvasLayout.tsx:62",
    shipNote: "AppBar + linen canvas with the faint top wash + transparent route frame + glass dock (packages/admin/src/components/Shell/NavigationBar.tsx:104)",
    rule: "Tone shows in exactly three places (1a): the active tab/nav pill, the single filled action, and the faint canvas wash, never on card surfaces, borders, or hovers.",
    usedIn: /class="wsgrid/,
    specs: [
      { label: "garden workspace", html: adminRoute(kit.acard("Season of First Rains", `${kit.kv("Commitments", "9 made · 7 kept")}${kit.kv("Runs through", "Aug 30")}`, kit.chip("Open", "ok"))), w: "l", h: 560 },
    ],
  },
  {
    id: "admin-dialog", title: "AdminDialog", family: "chrome", covers: ["adminDialogM3"],
    kit: `adminDialogM3(behind, tone, {title, body, actions})`,
    ship: "packages/admin/src/components/AdminDialog.tsx:145",
    rule: "Confirms and small edits float over the dimmed canvas on a 16dp solid surface; destructive confirms take a reason where the act stores one.",
    usedIn: /class="adlg"/,
    specs: [
      { label: "reason-taking confirm", html: kit.adminDialogM3(adminRoute(kit.acard("Season of First Rains", kit.kv("Commitments", "9 made · 7 kept"))), "garden", {
        title: "Pause the pool?",
        body: `${kit.banner("Members keep their commitments; new offers wait until you resume.", "amber", "error-warning-line")}${kit.reasonChips(["Season break", "Charter review"])}${kit.field("Reason", kit.input("Tell members why", { placeholder: true }))}`,
        actions: `${kit.btn("Keep it open", { kind: "ghost" })}${kit.btn("Pause the pool", { kind: "danger" })}`,
      }), w: "l", h: 620 },
    ],
  },
  {
    id: "flow-dialog", title: "ActionFlowShell (flow AdminDialog)", family: "chrome", covers: ["flowDialog"],
    kit: `flowDialog(behind, tone, {context, title, steps, current, body, cancelHot, next})`,
    ship: "packages/admin/src/components/AdminDialog.tsx:145",
    shipNote: "the flow variant hosting ActionFlowShell, step rail, centred column, morphing Cancel/Back",
    rule: "Multi-step creation lives in the flow dialog, never on bare route pages; Cancel morphs to Back after step one and the X stays the constant exit.",
    usedIn: /class="adlg flow"/,
    specs: [
      { label: "step 2 of 3", html: kit.flowDialog(adminRoute(kit.acard("Seeding", kit.kv("Drafts", "2"))), "garden", {
        context: "Garden · Pool", title: "Open the season",
        steps: [{ title: "Name it", desc: "Season name and dates" }, { title: "Confirmer rule", desc: "Who confirms kept commitments" }, { title: "Review", desc: "Check and open" }],
        current: 1,
        body: `${kit.field("Confirmer rule", kit.input("The person it was made to", { select: true }))}${kit.radio([{ label: "Green Goods team fallback on", meta: "Covers commitments with no reachable confirmer", on: true }, { label: "Fallback off", meta: "Unconfirmable commitments wait" }])}`,
        back: "g.back", cancelHot: "g.cancel", next: kit.btn("Continue", { kind: "pri" }),
      }), w: "l", h: 640 },
    ],
  },
  // ---- shipped-palette parity (2026-08-16 review point 3): every admin
  // console component has a gallery home, named as the code names it, so
  // prototypes and AI design tools compose from the real inventory. ----------
  {
    id: "admin-view-actions", title: "AdminViewActions", family: "chrome", covers: [],
    kit: `pageHeader({actions}). The .ph-actions row`,
    ship: "packages/admin/src/components/AdminViewActions.tsx:15",
    shipNote: "one fixed primary rendered rightmost; the set is stable across tabs and states",
    rule: "A view declares ONE action set, identical on every tab; availability is a disabled state, never a missing button. End-aligned, primary rightmost.",
    usedIn: /class="ph-actions"/,
    specs: [{ label: "the Garden view's stable trio", html: `<div class="ph-actions">${kit.btn("View public", { kind: "ghost", sm: true })}${kit.btn("Seed", { kind: "sec", sm: true, icon: "add-line" })}${kit.btn("Edit garden", { kind: "pri", sm: true })}</div>`, w: "m" }],
  },
  {
    id: "fab-button", title: "FabButton (speed dial)", family: "chrome", covers: [],
    kit: `fabButton(open) + .fabwrap/.fabdoor assembly`,
    ship: "packages/admin/src/components/Shell/FabButton.tsx:23",
    shipNote: "below 1024px the view's action set rides this dial; primary sits nearest the trigger",
    rule: "One action set, two presentations: the header row on desktop, the speed dial on the phone. The dial never carries actions the header lacks.",
    usedIn: ["W7M"],
    specs: [{ label: "open dial · primary nearest trigger", html: `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;padding:6px">${`<button type="button" class="fabdoor">View public</button><button type="button" class="fabdoor">Edit garden</button><button type="button" class="fabdoor">Seed a commitment</button>`}${kit.fabButton(true)}</div>`, w: "p" }],
  },
  {
    id: "admin-side-sheet", title: "AdminSideSheet", family: "chrome", covers: [],
    kit: `composed, right-anchored panel over the canvas`,
    ship: "packages/admin/src/components/AdminSideSheet.tsx:1",
    shipNote: "the three global surfaces (profile, settings, notifications), never workspace actions",
    rule: "Global chrome surfaces slide in from the right edge; workspace acts use dialogs and flows instead. Mounted once by the canvas layout on every route.",
    usedIn: ["W7", "W13"],
    specs: [{ label: "notifications surface", html: `<div style="display:flex;justify-content:flex-end;min-height:220px;background:var(--stone-bg);border-radius:12px;overflow:hidden"><aside style="width:250px;background:var(--card);border-left:1px solid var(--ln);padding:14px;display:flex;flex-direction:column;gap:8px"><div class="t-title">Notifications</div><div class="arow"><div class="grow">Maria added proof <span class="t-meta num">6 h</span></div></div><div class="arow"><div class="grow">João's request accepted <span class="t-meta num">2 h</span></div></div></aside></div>`, w: "m" }],
  },
  {
    id: "admin-search-toolbar", title: "AdminSearchToolbar + AdminSortSelect", family: "forms", covers: [],
    kit: `input(value, {placeholder, icon}) + input(value, {select})`,
    ship: "packages/admin/src/components/AdminSearchToolbar.tsx:1",
    shipNote: "the route header's toolbar row; sorting is AdminSortSelect beside it",
    rule: "Search and sort live together in one toolbar row; active filters stay visible and clearable, never hidden behind an icon.",
    usedIn: /aria-label="Search commitments"/,
    specs: [{ label: "search + sort", html: `<div style="display:flex;gap:8px;align-items:center">${kit.input("Search commitments…", { placeholder: true, icon: "search-line", ariaLabel: "Search commitments" })}${kit.input("Newest first", { select: true, ariaLabel: "Sort commitments" })}</div>`, w: "m" }],
  },
  {
    id: "admin-list-item", title: "Record Row", family: "cards", covers: ["commitmentRow"],
    kit: `commitmentRow({title, chips, meta, act, menu, hotId, chevron})`,
    ship: "packages/admin/src/components/AdminListItem.tsx:1",
    shipNote: "state lives in the chip vocabulary with text, never color alone; banners never repeat per-row state",
    rule: "Every commitment and queue row shares ONE anatomy: title + kind/state chips on line one, calm meta on line two, one trailing act or a chevron. Two lines keep a busy row from wrapping its buttons in a narrow column.",
    usedIn: /class="prow"/,
    specs: [
      { label: "opens the commitment", html: kit.commitmentRow({ title: "Prune the north beds", chips: `${kit.chip("Offer", "offer")}${kit.chip("Accepted", "request", { dot: true })}`, meta: "Maria → João · 6 hours · due Aug 12", chevron: true }), w: "l" },
      { label: "one trailing act", html: kit.commitmentRow({ title: "Market rides", chips: `${kit.chip("Campaign", "campaign")}${kit.chip("Past due", "warn", { dot: true })}`, meta: "due Jul 2 · still accepted", act: kit.btn("Expire now", { kind: "danger", sm: true }) }), w: "l" },
    ],
  },
  {
    id: "decision-row", title: "Decision Row", family: "cards", covers: ["decisionRow"],
    kit: `decisionRow({title, chips, meta, affirm, decline, outcome, hotId})`,
    ship: "packages/admin/src/components/AdminListItem.tsx:1",
    shipNote: "the same list-item anatomy carrying a paired decision",
    rule: "The second of the two row variants: a row you ANSWER rather than one you look at. Accept/decline and approve/reject are paired opposites, so both show, affirmative rightmost, the declining act quieter and to its left. Once decided, the pair is replaced by the outcome it produced, so the row never offers a decision twice.",
    usedIn: /class="prow"/,
    specs: [
      { label: "waiting on a decision", html: kit.decisionRow({ title: "Ride to the market on Saturday", chips: `${kit.chip("Request", "request")}${kit.chip("Waiting", "warn", { dot: true })}`, meta: "João · individual · asked Jul 10", decline: kit.btn("Decline…", { kind: "sec", sm: true }), affirm: kit.btn("Accept", { kind: "pri", sm: true }) }), w: "l" },
      { label: "already decided", html: kit.decisionRow({ title: "Ride to the market on Saturday", chips: `${kit.chip("Request", "request")}${kit.chip("Accepted", "ok", { dot: true })}`, meta: "João · individual · asked Jul 10", outcome: `<span class="t-meta">terms stored</span>` }), w: "l" },
    ],
  },
  {
    id: "object-card", title: "Object Card", family: "cards", covers: ["objectCard", "cardSection"],
    kit: `objectCard({title, chips, meta, acts, body}) + cardSection(label, act)`,
    netNew: "the Season & Campaigns card, headed by the season itself",
    rule: "When a card is ABOUT one object, that object heads the card, title, chips, counts, and its one act in the header, instead of a generic title with the object stacked beneath it as a second header. Peers list below under cardSection, whose own act creates more of them.",
    usedIn: /class="acard objcard"/,
    specs: [
      { label: "season heads the card, campaigns follow", html: kit.objectCard({ title: "Season of First Rains", chips: `${kit.chip("Season", "season")}${kit.chip("Open", "ok", { dot: true })}`, meta: "9 commitments · 7 kept · runs through Aug 30", acts: kit.btn("Close Season…", { kind: "sec", sm: true }), body: `${kit.stages(["Seeded", "Open", "In Progress", "Reviewing", "Reconciled", "Finished"], 1)}${kit.cardSection("Campaigns · 2 open", kit.btn("Start Campaign", { kind: "sec", sm: true }))}${kit.commitmentRow({ title: "Market rides", chips: `${kit.chip("Campaign", "campaign")}${kit.chip("Open", "ok", { dot: true })}`, meta: "16 commitments · 6 kept · runs through Sep 15" })}` }), w: "l" },
    ],
  },
  {
    id: "pool-holdings", title: "Pool Holdings", family: "cards", covers: ["poolHoldings"],
    kit: `poolHoldings({units, reserve, capacityNote, reserveNote, who})`,
    netNew: "what the pool actually holds. The pool's contents, which no surface showed",
    rule: "Unit groups are rendered by EXACT LABEL and never summed. 40 hours and 12 rides share no denominator, so a total could only exist by inventing a price (Appendix D.1), and \"hours\" and \"Hours\" stay separate rows because identity is the hash of the stored bytes. The reserve is the second, quieter part: what members can do for each other does not depend on it, and a reserve of nothing is a working pool.",
    usedIn: /class="holdlist"/,
    specs: [
      { label: "garden pool, capacity and reserve", html: kit.poolHoldings({ units: POOL_HOLDINGS.units, reserve: POOL_HOLDINGS.reserve, capacityNote: "Commitments open now, grouped by what they're measured in.", reserveNote: "What neighbours can do for each other doesn't depend on this." }), w: "l" },
      { label: "protocol pool. Members are gardens", html: kit.poolHoldings({ units: [{ label: "surveys", open: 3, people: 2 }, { label: "methodology reviews", open: 2, people: 2 }], who: { one: "garden", many: "gardens" } }), w: "l" },
    ],
  },
  {
    id: "filter-chips", title: "AdminFilterChip (scopes)", family: "chips", covers: ["filterChips"],
    kit: `filterChips([{label, on, hotId}], ariaLabel)`,
    ship: "packages/admin/src/components/AdminFilterChip.tsx:1",
    shipNote: "one group per dimension, state, kind, direction",
    rule: "A list gets scopes, not sibling cards. Past-due, lapsed, ongoing, and confirmed are FILTERS of the commitment list; giving each its own card is what made six differently-designed queues out of one.",
    usedIn: /class="scopechips"/,
    specs: [
      { label: "commitment scopes", html: kit.filterChips([{ label: "Open", on: true }, { label: "Past due" }, { label: "Lapsed" }, { label: "Ongoing" }, { label: "Confirmed" }], "Commitment scope"), w: "l" },
    ],
  },
  {
    id: "stat-row", title: "Triage Stats", family: "feedback", covers: ["statRow"],
    kit: `statRow([{n, label, hotId}], {layout})`,
    ship: "packages/shared/src/components/Canvas/MetaStrip.tsx:1",
    shipNote: "the workspace's queue counts; each cell jumps to the queue that owns it",
    rule: "Counts read as STATS, not buttons: number leading in tabular figures, hairline columns in one card, and a calm zero, a count of nothing must never look like an alert. Inline is the default because a stat strip should cost one line above the fold; the stacked cast suits a wide dashboard with room to breathe.",
    usedIn: /class="sumrow/,
    specs: [
      { label: "inline (default). One line", html: kit.statRow([{ n: "2", label: "Awaiting Confirmation" }, { n: "2", label: "Claims Waiting" }, { n: "0", label: "Failed Payouts" }]), w: "l" },
      { label: "stacked, number over label", html: kit.statRow([{ n: "2", label: "Awaiting Confirmation" }, { n: "2", label: "Claims Waiting" }, { n: "0", label: "Failed Payouts" }], { layout: "stacked" }), w: "l" },
    ],
  },
  {
    id: "workspace-split", title: "Workspace two-column split", family: "chrome", covers: [],
    kit: `.wsrow · .wsmain (focused objects) + .wsrail (container · quick actions · activity)`,
    netNew: "decided 2026-08-16 for the pool tab; lands with its implementation",
    rule: "A workspace tab that earns it splits two ways: the left column carries focused acts and high-level objects; the right rail carries what the container holds, its status, and the activity feed. Collapses to one column narrow. Nothing disappears.",
    usedIn: /class="wsrow"/,
    // This specimen demoed the retired anatomy long after the screens moved on —
    // a "Cycles" card and a rail card titled "Pool — the container", both gone
    // from every screen. A gallery that documents a shape nothing renders is
    // worse than no gallery, so it now mirrors the shipped W7 split.
    specs: [{ label: "left objects · right rail", html: `<div class="wsrow"><div class="wsmain">${kit.objectCard({ title: "Season of First Rains", chips: `${kit.chip("Season", "season")}${kit.chip("Open", "ok", { dot: true })}`, meta: "9 commitments · 7 kept · runs through Aug 30", acts: kit.btn("Close Season…", { kind: "sec", sm: true }) })}</div><aside class="wsrail">${kit.acard("What This Pool Holds", kit.poolHoldings({ units: POOL_HOLDINGS.units.slice(0, 2), who: { one: "neighbour", many: "neighbours" } }))}${kit.acard("Pool Status", `<div class="t-meta">The container your seasons and campaigns run in.</div>${kit.kv("Commitment limit", "24 per person at once")}`, kit.chip("Open", "ok", { dot: true }))}</aside></div>`, w: "l" }],
  },
  {
    id: "meta-strip", title: "MetaStrip", family: "chrome", covers: [],
    kit: `composed, inline stat row under the route title`,
    ship: "packages/shared/src/components/Canvas/MetaStrip.tsx:1",
    shipNote: "the route header's inline metadata (member count, certified impact), data, never actions",
    rule: "Header metadata is a quiet inline strip of labelled numbers; it never carries controls and never becomes a card grid.",
    usedIn: ["W7"],
    specs: [{ label: "garden header stats", html: `<div style="display:flex;gap:14px" class="t-meta"><span><b class="num">23</b> members</span><span><b class="num">4</b> certified impacts</span><span><b class="num">7</b> commitments live</span></div>`, w: "m" }],
  },
  {
    id: "admin-checkbox", title: "AdminCheckbox", family: "forms", covers: [],
    kit: `label.arow > input[type=checkbox] + copy`,
    ship: "packages/admin/src/components/AdminCheckbox.tsx:1",
    rule: "A checkbox always carries its consequence in plain copy beside it; bare boxes never float in a form.",
    usedIn: /type="checkbox"/,
    specs: [{ label: "opt-in with consequence", html: `<label class="arow" style="align-items:flex-start"><input type="checkbox" checked aria-label="Let the Green Goods team confirm if nobody local is eligible" style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">Usable only while nobody local can confirm · always with a recorded reason.</span></span></label>`, w: "m" }],
  },
  {
    id: "admin-setting-row", title: "AdminSettingRow", family: "forms", covers: [],
    kit: `.arow with a trailing control`,
    ship: "packages/admin/src/components/AdminSettingRow.tsx:1",
    rule: "Settings group into labelled rows, name and consequence left, one control trailing; complex settings disclose progressively instead of flooding the card.",
    usedIn: ["W7"],
    specs: [{ label: "setting with trailing act", html: `<div class="arow"><div class="grow"><b>Provider open-commitment cap</b> <span class="t-meta">24 commitments</span></div>${kit.btn("Edit charter", { kind: "sec", sm: true })}</div>`, w: "m" }],
  },
  {
    id: "admin-selectable-card", title: "AdminSelectableCard", family: "cards", covers: [],
    kit: `radio({label, meta}). The equal-cards choice cast`,
    ship: "packages/admin/src/components/AdminSelectableCard.tsx:1",
    shipNote: "equal-weight choice cards; the prototype's radio rows are its dense stand-in",
    rule: "A choice between kinds renders as equal cards or equal rows, never one styled default towering over the rest.",
    usedIn: ["W8", "W11"],
    specs: [{ label: "equal choice rows", html: kit.radio([{ label: "Season", meta: "the pool's main rhythm. One at a time", on: true }, { label: "Campaign", meta: "a focused push, any number may run beside the season" }]), w: "m" }],
  },
  {
    id: "admin-linear-progress", title: "AdminLinearProgress", family: "feedback", covers: [],
    kit: `meter(pct, {left, right}). The prototype's stand-in`,
    ship: "packages/admin/src/components/AdminLinearProgress.tsx:1",
    shipNote: "the flow footer's in-flight slot and queue meters",
    rule: "Progress is a quiet linear track with its numbers beside it; spinners are for unknowable waits only.",
    usedIn: ["W13"],
    specs: [{ label: "queue meter", html: kit.meter(50, { left: "1 of 2 confirmed", right: "1 waiting" }), w: "m" }],
  },
  {
    id: "admin-tooltip", title: "AdminTooltip", family: "chrome", covers: [],
    kit: `composed, quiet hover label`,
    ship: "packages/admin/src/components/AdminTooltip.tsx:1",
    shipNote: "single-action FABs and icon buttons carry their name in a tooltip",
    rule: "Tooltips name controls that show only an icon; they never hold information that exists nowhere else.",
    usedIn: ["W7M"],
    specs: [{ label: "icon-button name", html: `<span style="display:inline-flex;align-items:center;gap:8px"><span class="ch">Seed a commitment</span><span class="t-meta">shown on hover beside the single-action FAB</span></span>`, w: "m" }],
  },
];

// ---- editorial catalog ------------------------------------------------------

const editorialPanel = `<div class="epanel"><span class="kicker">Commitments</span>
<h3 class="serif-h">Midway through the Season of First Rains</h3>
<div class="estatrow"><div class="estat"><div class="serif-n">9</div><div class="l">commitments made</div></div><div class="estat"><div class="serif-n">7</div><div class="l">kept so far</div></div></div>
<hr class="erule">
<p style="margin:0;max-width:52ch">Fulfilled commitments from this cycle are anchored in the certificates below.</p>
<button type="button" class="elink" disabled>See the gardens →</button></div>`;

const EDITORIAL_ENTRIES: Entry[] = [
  {
    id: "site-header", title: "Site header", family: "chrome", covers: [],
    kit: `siteHeader(active, installHot). Screens/public.ts`,
    ship: "packages/client/src/components/Navigation/SiteHeader.tsx:68",
    shipNote: "logo + nav + Install CTA; transparent over the hero in the real app",
    rule: "The restrained top bar carries site context on mid-page editorial sections; Install is the one filled action.",
    usedIn: /class="sitehdr/,
    specs: [
      { label: "impact active", html: `<div class="sitehdr"><span class="brand"><svg class="ic s" aria-hidden="true"><use href="#i-seedling-line"/></svg>Green Goods</span><nav><a>Gardens</a><a class="on">Impact</a><a>Fund</a><a>Actions</a></nav><button type="button" class="install" disabled>Install App</button></div>`, w: "l" },
    ],
  },
  {
    id: "web-window", title: "Web window", family: "chrome", covers: [],
    kit: `webWin(url, body, installHot). Screens/public.ts`,
    netNew: "the browser viewer frame for editorial screens",
    rule: "Editorial screens present inside the browser frame with the site header; body copy owns the page below it.",
    usedIn: /class="webwin/,
    specs: [
      { label: "frame + panel", html: `<div class="webwin"><div class="winbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">greengoods.app/impact</span></div><div class="webbody">${editorialPanel}</div></div>`, w: "l", h: 520 },
    ],
  },
  {
    id: "editorial-panel", title: "Editorial panel", family: "cards", covers: [],
    kit: `.epanel + .kicker + .serif-h + .estatrow + .erule + .elink. Screens/public.ts`,
    netNew: "sharp editorial panel with mono kicker, serif headline, serif numerals",
    rule: "Aggregate-only public storytelling: counts and sentences, no rankings, no participant data; percentages only above the small-community threshold.",
    usedIn: /class="epanel/,
    specs: [{ label: "stats + link", html: editorialPanel, w: "l" }],
  },
  {
    id: "pipeline", title: "Proof pipeline", family: "chips", covers: [],
    kit: `.pipe stage pills. Screens/public.ts`,
    netNew: "the five-stage proof pipeline with the two new stages outlined green",
    rule: "Commitment and Confirmation read as the delta against the known pipeline; stages stay uppercase mono pills.",
    usedIn: /class="pipe"/,
    specs: [
      { label: "five stages", html: `<div class="pipe">${["Assessment", "Commitment", "Work", "Confirmation", "Certificate"].map((s) => `<span class="pstage${s === "Commitment" || s === "Confirmation" ? " new" : ""}">${s}</span>`).join(`<span class="parr">→</span>`)}</div>`, w: "l" },
    ],
  },
];

// ---- assembly ---------------------------------------------------------------

const SURFACES: { id: CompSurface; label: string; entries: Entry[] }[] = [
  { id: "client", label: "Client PWA", entries: CLIENT_ENTRIES },
  { id: "admin", label: "Steward console", entries: ADMIN_ENTRIES },
  { id: "editorial", label: "Editorial website", entries: EDITORIAL_ENTRIES },
];

export const GALLERY_ERRORS: string[] = [];
const seen = new Set<string>();
for (const { id: surface, entries } of SURFACES) {
  for (const e of entries) {
    const key = `${surface}/${e.id}`;
    if (seen.has(key)) GALLERY_ERRORS.push(`COMPONENTS: duplicate entry id ${key}`);
    seen.add(key);
    if (!e.specs.length) GALLERY_ERRORS.push(`COMPONENTS ${key}: no specimens`);
    if (!e.ship && e.netNew == null) GALLERY_ERRORS.push(`COMPONENTS ${key}: neither shipping counterpart nor net-new note`);
    const ids = usedInIds(surface, e.usedIn);
    if (!ids.length) GALLERY_ERRORS.push(`COMPONENTS ${key}: where-used resolved to zero screens`);
    for (const sid of ids) {
      if (!SCREENS.some((s) => s.id === sid)) GALLERY_ERRORS.push(`COMPONENTS ${key}: unknown screen id ${sid}`);
    }
  }
}

/** Kit builders the gallery documents — the build asserts full kit coverage. */
export const COVERED_KIT_BUILDERS = new Set(SURFACES.flatMap(({ entries }) => entries.flatMap((e) => e.covers)));

const catalogHtml = (surface: CompSurface, entries: Entry[]): { html: string; specimens: string; chromeText: string } => {
  const chromeParts: string[] = [];
  const famBlocks = FAMILIES.flatMap(({ id, label }) => {
    const fam = entries.filter((e) => e.family === id);
    if (!fam.length) return [];
    const rendered = fam.map((e) => entryHtml(surface, e));
    chromeParts.push(label, ...rendered.map((r) => r.chromeText));
    return [`<section class="cfam" id="cfam-${surface}-${id}"><h3>${esc(label)}</h3>${rendered.map((r) => r.html).join("")}</section>`];
  });
  const index = `<nav class="cindex" aria-label="Components in this surface">${FAMILIES.flatMap(({ id, label }) => {
    const fam = entries.filter((e) => e.family === id);
    if (!fam.length) return [];
    const anchors = fam.map((e) => `<a href="#components/${e.id}${surface === "client" ? "" : `@${surface}`}">${esc(e.title)}</a>`).join("");
    return [`<span class="cig"><b>${esc(label)}</b>${anchors}</span>`];
  }).join("")}</nav>`;
  const specimens = entries.flatMap((e) => e.specs.map((s) => specimen(s.html))).join("\n");
  return { html: `${index}${famBlocks.join("")}`, specimens, chromeText: chromeParts.join(" ") };
};

const catalogs = SURFACES.map((s) => ({ ...s, ...catalogHtml(s.id, s.entries) }));

/** Per-surface material for the validator: specimen HTML + annotation copy. */
export const GALLERY_SCAN_INPUT = catalogs.map(({ id, specimens, chromeText }) => ({ surface: id, specimens, chromeText }));

export const COMPONENT_COUNTS = {
  entries: SURFACES.reduce((a, s) => a + s.entries.length, 0),
  specimens: SURFACES.reduce((a, s) => a + s.entries.reduce((b, e) => b + e.specs.length, 0), 0),
};

export const COMPONENTS_TAB_HTML = `<div id="comps">
  <h1>Components</h1>
  <p class="sub">Every kit component and documented composite, one surface at a time. The three dialects are different design systems, so the flip below never mixes them. Entries lead with the shipping component name; specimens render every variant and state statically, controls disabled. Copy an entry's link with ⧉ to point at it in feedback.</p>
  <div class="surface-tabs" role="tablist" aria-label="Component surface">${catalogs
    .map(({ id, label }, ix) => `<button class="surface-tab${ix ? "" : " on"}" id="comp-tab-${id}" role="tab" aria-selected="${ix ? "false" : "true"}" aria-controls="comp-panel-${id}"${ix ? ' tabindex="-1"' : ""} data-comp-surface="${id}">${esc(label)}</button>`)
    .join("")}</div>
  ${catalogs
    .map(({ id, html }, ix) => `<section class="catalog-panel comp-catalog" id="comp-panel-${id}" role="tabpanel" aria-labelledby="comp-tab-${id}" data-comp-surface="${id}"${ix ? " hidden" : ""}>${html}</section>`)
    .join("")}
</div>`;
