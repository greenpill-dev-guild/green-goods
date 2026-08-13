// Client PWA hi-fi screens, wallet + protocol set — W5 WalletDrawer pools
// panel, W23 wallet G$ section, W25 protocol-pool claim, WFLOW (existing work
// flow + the MF-7 fulfills row). Same dialect and copy rules as client.ts.
// Dissolved lo-fi variants: W23G → W23@delivery-blocked, MF8 → W25@context-chooser.
// W6's retired home summary card lives on as the W5 header line (Decision Log #28f).

import { GARDEN, SEASON_LIVE } from "../fixtures";
import { hot } from "../html";
import { icon } from "../icons";
import {
  actionBar, banner, btn, card, chip, disclosure, emptyState, field, flowHeader, hdr, homeHeader, input, kv, listRow, meter, pagepad,
  phoneFrame, radio, reasonChips, sectionTitle, seg, sheetOver, skeleton,
} from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// ---------------------------------------------------------------------------
// W5 — WalletDrawer pools panel (uiux-spec §5.8; absorbs W6's summary line)
// ---------------------------------------------------------------------------

const W5_STATES = [
  ["default", "Pools"], ["queued", "Queued rows"], ["waiting-membership", "Waiting rows"], ["empty", "Empty"],
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W5State = (typeof W5_STATES)[number][0];

// The shipping WalletDrawer is a 3-tab ModalDrawer opened from the Home header
// — Cookies · Tokens · Commitments (views/Home/WalletDrawer/index.tsx:31-47) —
// not a four-segment surface under Profile, and there is no Vault tab. G$ lives
// in the existing Tokens tab. §5.8 lands the pools panel in this drawer and
// ships no Profile change.
const walletShell = (inner: string, active: 0 | 1 | 2, segHot?: string) => {
  const rail = seg(["Cookies", "Tokens", "Commitments"], active);
  return sheetOver(
    homeHeader(),
    "Wallet",
    `<div class="t-meta">Your jars, tokens, and promises across gardens.</div>${segHot ? hot(segHot, rail) : rail}${inner}`,
    { handle: false },
  );
};

function w5(state: W5State): string {
  let inner: string;
  switch (state) {
    case "queued":
      inner = `${hot("w5.summary", `<div class="t-meta num">${SEASON_LIVE.kept} of ${SEASON_LIVE.made} promises kept this cycle in ${GARDEN}</div>`)}
${sectionTitle("My commitments")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · Offered", chipHtml: chip("Queued", "queued") }) +
          listRow({ icon: "seedling-line", primary: "Ride to market", meta: "Rocinha · Accepted", chevron: true }),
        { cls: "flat" },
      )}
${banner("Queued promises send when you're back online.", "stone", "wifi-off-line")}`;
      break;
    case "waiting-membership":
      inner = `${sectionTitle("My commitments")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · Offered", chipHtml: chip("Waiting", "queued") }),
        { cls: "flat" },
      )}
${banner("Waiting for your garden membership — it will send once you're welcomed in, without using any attempts.", "stone", "time-line")}`;
      break;
    case "empty":
      inner = `${card(`<div class="t-title">No promises yet</div><div class="t-meta">When you offer support or take something up in a garden pool, it shows here.</div>`)}`;
      break;
    case "loading":
      inner = `${skeleton({ title: true, lines: 1, cls: "flat" })}${skeleton({ avatar: true, lines: 2 })}${skeleton({ avatar: true, lines: 2 })}`;
      break;
    case "not-found":
      inner = emptyState("search-line", "No promises found", "We couldn't find your commitments across gardens. They may still be syncing to this device — try again in a moment.", hot("w5.retry", btn("Try again", { kind: "sec", icon: "refresh-line" })));
      break;
    case "read-error":
      inner = emptyState("wifi-off-line", "Couldn't load your promises", "Something went wrong reaching the network. Your last view is saved on this device.", hot("w5.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })));
      break;
    default:
      inner = `${hot("w5.summary", `<div class="t-meta num">${SEASON_LIVE.kept} of ${SEASON_LIVE.made} promises kept this cycle in ${GARDEN}</div>`)}
${sectionTitle("Waiting on you")}
${card(
        hot("w5.inbox-row", listRow({ icon: "hand-heart-line", primary: "Maria — Prune the north beds", meta: "Rocinha · confirm when kept", chevron: true })) +
          listRow({ icon: "hand-heart-line", primary: "TAS Hub — Field survey ride", meta: "Awka · confirm when kept", chevron: true }),
        { cls: "flat" },
      )}
${disclosure(
        "My commitments",
        "2 across 2 gardens",
        card(
          `<div class="t-meta">Rocinha Community Garden</div>` +
            hot("w5.mine-row", listRow({ icon: "seedling-line", primary: "Ride to market", meta: "Accepted", chevron: true })) +
            `<div class="t-meta" style="margin-top:6px">Muizenberg</div>` +
            listRow({ icon: "seedling-line", primary: "Beach cleanup Saturday", meta: "Fulfilled", chipHtml: chip("Kept", "ok") }),
          { cls: "flat" },
        ),
      )}
${sectionTitle("Things I can offer")}
${card(
        hot("w5.things", listRow({ icon: "sticky-note-line", primary: "Saved details & ongoing offers", meta: "1 saved · 1 ongoing — private to you", chevron: true })),
        { cls: "flat" },
      )}`;
  }
  // The shipping AppBar hides while any drawer is open (AppBar.tsx:33).
  return phoneFrame(walletShell(inner, 2, "w5.seg"), { offline: state === "queued" || state === "read-error", appBar: false });
}

const W5_HOTS: HifiDef["hots"] = {
  "w5.seg": { l: "Wallet tabs", info: "The shipping WalletDrawer's three tabs — Cookies · Tokens · Commitments. Commitments is the cross-garden promises home (UX:186); G$ balances stay in Tokens." },
  "w5.summary": { l: "Cycle summary line", info: "W6's retired Home card lives on as this header line (Decision Log #28f); absolute numbers below the small-community threshold (UX:191). The counts belong to one garden's open cycle and say so — the panel below spans gardens, but no cross-garden total is derived, because unlike cycles never aggregate." },
  "w5.inbox-row": { l: "Pending confirmation", to: "screen:W4", info: "Inbox of promises waiting on YOUR confirmation, across gardens (UX:185)." },
  "w5.mine-row": { l: "My commitment", to: "screen:W2", info: "Your own promises grouped by garden." },
  "w5.things": { l: "Things I can offer", to: "screen:W32@saved-with-ongoing", info: "The drawn entry for W32 (2026-08-11 D8a, uiux §5.8 addendum): private saved details plus your ongoing Offers with rest / resume / retire. The pool tab shows only their public places." },
  "w5.retry": { l: "Try again", info: "Read-surface recovery for the cross-garden pools panel — loading / not-found / read-error, never a “None” chip (UX:51-52 · AM:12)." },
};

// ---------------------------------------------------------------------------
// W23 — wallet G$ section + send (settlement-spec §7; W23G dissolved)
// ---------------------------------------------------------------------------

const W23_STATES = [
  ["balance", "Support received"], ["contributor-receipt", "Contributor receipt"], ["send", "Send"], ["send-pending", "Sending"], ["send-failed", "Send failed"], ["delivery-blocked", "Delivery blocked"],
] as const;
type W23State = (typeof W23_STATES)[number][0];

function w23(state: W23State): string {
  let inner: string;
  switch (state) {
    case "contributor-receipt":
      inner = `${card(
        `<div class="cardrow">${chip("Arrived", "ok", { dot: true })}<div class="grow"></div><div class="t-title num">+140 G$</div></div>
<div class="t-title">Prune the north beds</div>
${kv("Paid by", "Rocinha garden Safe")}${kv("Your recognition", "35% · approved pruning work")}${kv("Payment basis", "Hypercert recognition weights")}${kv("Garden retained", "100 G$ of 500 G$")}
${banner("Recognition records your contribution to the impact certificate. This receipt records the separate child payout that reached your account.", "stone")}`,
      )}`;
      break;
    case "send":
      inner = `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Ana", "ok")}${chip("Maria")}${chip("Garden jar")}</div>
<div class="t-meta">Tap a recent recipient, or paste an address below.</div>
${field("To", input("address or member…", { placeholder: true, icon: "user-line" }))}
<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("5 G$")}${chip("20 G$", "ok")}${chip("Half")}${chip("All")}</div>
${field("Amount", input("20 G$"))}
${banner("Sent from your account on Celo. No gas needed.", "stone", "send-plane-line")}
${hot("w23.send-submit", btn("Send", { kind: "pri", full: true }))}`;
      break;
    case "send-pending":
      inner = `${listRow({ icon: "send-plane-line", primary: "20 G$ → Ana", meta: "Sending…", chipHtml: chip("Wallet pending", "queued") })}
${banner("Waiting for the wallet to confirm. If it fails, it retries inline — nothing is lost.", "stone")}`;
      break;
    case "send-failed":
      inner = `${field("To", input("Ana · 0x71…4c2", { icon: "user-line" }))}
${field("Amount", input("20 G$"))}
${banner("The wallet didn't confirm this send. Your recipient and amount are still here — try again when you're ready.", "amber", "error-warning-line")}
${hot("w23.send-retry", btn("Try again", { kind: "pri", full: true, icon: "refresh-line" }))}`;
      break;
    case "delivery-blocked":
      inner = `${card(
        `<div class="cardrow">${chip("Planned", "queued")}<div class="t-title">Member delivery isn't on yet</div></div><div class="t-meta">The Celo account and sponsored-send path hasn't passed its round-trip check. Garden-to-garden funding continues; personal balances and Send wait.</div>${hot("w23.tech-status", btn("View technical status", { kind: "ghost" }))}`,
      )}`;
      break;
    default:
      inner = `${card(
        `<div class="cardrow"><div class="grow"><div class="t-title">Support received</div><div class="t-meta">G$ · Celo</div></div><div class="t-title num">128 G$</div></div>` +
          hot("w23.arrived-row", listRow({ icon: "checkbox-circle-fill", primary: "+140 G$ — Prune the north beds", meta: "Contributor payout arrived · receipt ↗", chipHtml: chip("Arrived", "ok") })) +
          listRow({ icon: "time-line", primary: "+15 G$ — Market rides", meta: "On its way" }),
        { cls: "flat" },
      )}
${hot("w23.send", btn("Send G$", { kind: "pri", full: true, icon: "send-plane-line" }))}`;
  }
  // G$ is a token balance, so it belongs to the drawer's existing Tokens tab —
  // not a second surface claiming the Commitments panel W5 already owns.
  return phoneFrame(walletShell(inner, 1), { appBar: false });
}

const W23_HOTS: HifiDef["hots"] = {
  "w23.send": { l: "Send G$", to: "screen:W23@send", info: "Online-only wallet action, sponsored gas — never enters the offline queue (UX:219)." },
  "w23.send-submit": { l: "Send", to: "screen:W23@send-pending", info: "Wallet-pending → confirmed; failure surfaces inline with retry (UX:219)." },
  "w23.send-retry": { l: "Try again", to: "screen:W23@send-pending", info: "Retries the online-only wallet action with the recipient and amount retained (UX:219)." },
  "w23.arrived-row": { l: "Arrived row", to: "screen:W23@contributor-receipt", info: "“Arrived” means an authenticated CCIP success acknowledgment — dispatched or Celo-executed/ack-pending never render as arrived. The receipt keeps Hypercert recognition and the child payout distinct." },
  "w23.tech-status": { l: "Technical status", info: "AA/paymaster gate failed: first contributor-child preparation and member sends stay off; authorized ProtocolToGarden seeding by a current protocol steward or the SettlementModule owner continues Safe-to-Safe (SS §5)." },
};

// ---------------------------------------------------------------------------
// W25 — protocol-pool claim (wireframes.md:671; MF8 dissolved into chooser)
// ---------------------------------------------------------------------------

const W25_STATES = [
  ["card", "Protocol card"], ["context-chooser", "Provider context"], ["pending", "Waiting for review"], ["accepted", "Accepted — garden provides"],
] as const;
type W25State = (typeof W25_STATES)[number][0];

function w25(state: W25State): string {
  // The provider-context choice is locked to the pre-claim sheet (register #51,
  // MF-8). Asking it on the card too meant the same question twice — with
  // opposite defaults — so the card carries only the claim entry point.
  const protocolCard = card(
    `<div class="cardrow">${chip("Protocol", "ink")}${chip("Request", "request")}</div><div class="t-title">Methodology survey</div><div class="t-meta num">1 survey · stewards review who takes this up</div>${hot("w25.ask", btn("Ask to take this up", { kind: "pri", full: true }))}`,
  );
  const head = hdr("Awka Hub", { back: true });

  if (state === "context-chooser") {
    const behind = `${head}${pagepad(protocolCard)}`;
    return phoneFrame(
      sheetOver(
        behind,
        "Take this up…",
        `${hot("w25.chooser", radio([{ label: "As myself", meta: "the promise is yours", on: true }, { label: "For Awka Hub", meta: "you steward this garden" }], { interactive: true, name: "commitment-context" }))}
${banner("Working for the garden: its account makes the promise; you remain the requester.", "stone", "group-line")}
${hot("w25.continue", btn("Continue", { kind: "pri", full: true }))}${hot("w25.cancel", btn("Cancel", { kind: "ghost", full: true }))}`,
      ),
      { appBar: false },
    );
  }
  if (state === "pending") {
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Waiting for review", "warn", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Claimant", "Awka Hub (garden)")}${kv("Asked by", "you")}<div class="t-meta">Work and evidence will anchor to your garden; the promise stays with the protocol pool.</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  }
  if (state === "accepted")
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Accepted", "ok", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Provider", "Awka Hub — your garden")}${kv("Asked by", "you")}<div class="t-meta">Your garden made this promise. Work and evidence from Awka gardeners anchor to it, and the support that follows goes to the garden.</div><div class="brow">${hot("w25.open-promise", btn("Open the promise", { kind: "pri", full: true }))}</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  return phoneFrame(`${head}${pagepad(banner("From the protocol pool — surveys and activations any garden can take up.", "stone", "information-line"), protocolCard)}<div style="flex:1"></div>`, { appBar: false });
}

const W25_HOTS: HifiDef["hots"] = {
  "w25.chooser": { l: "Context chooser", info: "Garden claim: claimant = GardenAccount, requestedBy = you. No custody, no member-delivery via garden claims (AM:38-39)." },
  "w25.continue": { l: "Continue", to: "screen:W25@pending", info: "Creates the claim request with the chosen context's stored terms — claimant, requestedBy, kind, gardenContext (CS:133). Protocol pool defaults steward-reviewed (register #19); W1's pending/declined/superseded grammar applies unchanged.", calls: ["claimCommitment"] },
  "w25.cancel": { l: "Cancel", to: "screen:W25", info: "Closes the provider-context sheet without creating a claim request." },
  "w25.open-promise": { l: "Open the promise", to: "screen:W2@garden-provider", info: "The garden-provided promise opens in the ordinary commitment detail; work and evidence rails are unchanged." },
  "w25.ask": { l: "Ask to take this up", to: "screen:W25@context-chooser", info: "Opens the provider-context sheet before any claim request exists; the garden option renders for eligible stewards only (CS:581). The (Protocol) chip is the only new mark on the card grammar (WF:671)." },
};

// ---------------------------------------------------------------------------
// WFLOW — the existing Submit Work flow, drawn as its real four steps
// (2026-08-11 D6, uiux §5.7 addendum): intro → media → details → review, plus
// the net-new "Fulfills a promise" picker (pickable work-first, prefilled and
// locked promise-first) and the client link-existing-work picker that replaces
// the old admin-console mis-wire. Everything else mirrors the shipping flow.
// ---------------------------------------------------------------------------

type WflowState = "intro" | "media" | "details" | "fulfills-pick" | "review" | "link-picker";

// Iteration 2: the real Submit Work TopNav — close on step 1, back after,
// FormProgress numbered circles (kit.flowHeader). The link-picker keeps a
// plain back header with no progress (it is a picker, not a step).
const wfHead = (step: number | null, title = "Submit work") =>
  step == null
    ? `<div class="hdr fixed"><button type="button" class="hback" aria-label="Back — preview only" disabled>${icon("arrow-left-line", "l")}</button><h1>${title}</h1></div>`
    : flowHeader(title, step, 4);

function wflow(state: WflowState): string {
  let head = wfHead(0);
  let content: string;
  let actions: string;
  let secondary = "";
  switch (state) {
    case "media":
      head = wfHead(1);
      content = pagepad(
        sectionTitle("Media", chip("2 of 1 needed", "ok")),
        hot("wflow.tap-add", `<div class="card flat" style="border-style:dashed;align-items:center;text-align:center;padding:22px 14px">${icon("camera-line", "l")}<div class="t-title">Tap to add photos or video</div><div class="t-meta">or use the buttons below — voice notes record from the mic</div></div>`),
        card(
          listRow({ icon: "image-line", primary: "Pruning — before", meta: "Photo · just now" }) +
            listRow({ icon: "image-line", primary: "Pruning — after", meta: "Photo · just now" }) +
            listRow({ icon: "mic-line", primary: "Voice note", meta: "0:41 · tap to play" }),
          { cls: "flat" },
        ),
        banner("Photos and voice notes stay on this device until the work sends.", "stone", "wifi-off-line"),
      );
      secondary = `${hot("wflow.capture-camera", btn("", { kind: "sec", sm: true, icon: "camera-line", ariaLabel: "Take a photo" }))}${hot("wflow.capture-gallery", btn("", { kind: "sec", sm: true, icon: "image-line", ariaLabel: "Choose from your library" }))}${hot("wflow.capture-audio", btn("", { kind: "sec", sm: true, icon: "mic-line", ariaLabel: "Record a voice note" }))}`;
      actions = hot("wflow.media-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    case "details":
      head = wfHead(2);
      content = pagepad(
        field("Action", input("Prune", { select: true })),
        field("Time spent", input("2 hours", { select: true })),
        field("Notes", input("Cleared the north beds", { placeholder: true })),
        hot("wflow.fulfills-field", listRow({ icon: "hand-heart-line", primary: "Fulfills a promise", meta: "Prune the north beds · tap to change", chevron: true })),
        `<div class="t-meta">Started from a promise? It's already chosen here. Started from the Garden tab? Pick one — or none.</div>`,
      );
      actions = hot("wflow.details-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    case "fulfills-pick":
      head = wfHead(2);
      content = pagepad(
        sectionTitle("Fulfills a promise"),
        `<div class="t-meta">Your open garden-work promises in this garden. Approved work counts toward the one you pick.</div>`,
        card(
          hot("wflow.pick-promise", listRow({ icon: "hand-heart-line", primary: "Prune the north beds", meta: "Your offer · needs Prune × 2 · Plant × 12", chipHtml: chip("Chosen", "ok") })) +
            listRow({ icon: "hand-heart-line", primary: "Clear the drainage channel", meta: "Ana's ask · needs Weed × 2 · Mulch × 4" }) +
            listRow({ icon: "close-line", primary: "None", meta: "just garden work — link one later if you like" }),
          { cls: "flat" },
        ),
      );
      actions = hot("wflow.pick-done", btn("Use this promise", { kind: "pri", full: true }));
      break;
    case "review":
      head = wfHead(3);
      content = pagepad(
        card(`<div class="t-sec" style="margin:0 0 4px">Garden</div>` + listRow({ icon: "home-line", primary: "Rocinha Community Garden", meta: "Rocinha, Rio de Janeiro" })),
        card(`<div class="t-sec" style="margin:0 0 4px">Media</div>` + listRow({ icon: "image-line", primary: "2 photos", meta: "pruning session" }) + listRow({ icon: "mic-line", primary: "Voice note", meta: "0:41" })),
        card(
          `<div class="t-sec" style="margin:0 0 4px">Details</div>${kv("Action", "Prune")}${kv("Time spent", "2 hours")}` +
            hot("wflow.fulfills", listRow({ icon: "hand-heart-line", primary: "Fulfills: Prune the north beds", meta: "Offer · AGRO", chipHtml: chip("Promise", "offer") })),
        ),
        `<div class="t-meta">Everything here is the existing work submission — the fulfills row is the promise link.</div>`,
      );
      actions = hot("wflow.submit", btn("Submit work", { kind: "pri", full: true }));
      break;
    case "link-picker":
      head = wfHead(null, "Link existing work");
      content = pagepad(
        `<div class="t-meta">Choose one of your works and the requirement row it counts toward.</div>`,
        card(
          hot("wflow.link-work-row", listRow({ icon: "image-line", primary: "Pruning session", meta: "Approved · Jul 30", chipHtml: chip("Chosen", "ok") })) +
            listRow({ icon: "image-line", primary: "Mulching the paths", meta: "Waiting for review · Aug 2" }),
          { cls: "flat" },
        ),
        field("Counts toward", radio([
          { label: "Prune × 2", meta: "1 of 2 approved so far", on: true },
          { label: "Plant × 12", meta: "8 of 12 approved so far" },
        ], { interactive: true, name: "wflow-link-requirement" })),
        `<div class="t-meta">Repeated actions never guess — you name the exact requirement row.</div>`,
      );
      actions = hot("wflow.link-confirm", btn("Link this work", { kind: "pri", full: true }));
      break;
    default: // intro
      content = pagepad(
        sectionTitle("What work?"),
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
${card(`${icon("leaf-line")}<div class="t-title">Prune</div><div class="t-meta">AGRO · trees and beds</div><span class="ch ok">chosen</span>`, { cls: "flat" })}
${card(`${icon("drop-line")}<div class="t-title">Water</div><div class="t-meta">AGRO · beds and rows</div><span class="ch">tap to choose</span>`, { cls: "flat" })}
</div>`,
        field("Garden", input("Rocinha Community Garden", { select: true })),
      );
      actions = hot("wflow.intro-continue", btn("Continue", { kind: "pri", full: true }));
  }
  return phoneFrame(content, { header: head, appBar: actionBar(actions, secondary || undefined) });
}

const WFLOW_HOTS: HifiDef["hots"] = {
  "wflow.intro-continue": { l: "Continue to media", to: "screen:WFLOW@media", info: "The shipping intro step — action + garden choice — continues to media capture." },
  "wflow.tap-add": { l: "Tap to add photos or video", info: "The shipping capture area — tapping the surface opens the picker; the evidence flow mirrors this exactly (iteration 2)." },
  "wflow.capture-camera": { l: "Take a photo", info: "The shipping media step's one-tap capture from the fixed bar; the pooling evidence flow mirrors this interaction (uiux §5.5 addendum 2026-08-11)." },
  "wflow.capture-gallery": { l: "Choose from your library", info: "Gallery pick, multiple allowed, with HEIC conversion and compression." },
  "wflow.capture-audio": { l: "Record a voice note", info: "Audio notes record from the bar and play back inline — the shipping interaction." },
  "wflow.media-continue": { l: "Continue to details", to: "screen:WFLOW@details", info: "Media → details, exactly as shipped." },
  "wflow.fulfills-field": { l: "Fulfills a promise (NEW)", to: "screen:WFLOW@fulfills-pick", info: "The work-first direction (2026-08-11 D6, uiux §5.7 addendum): pickable when the flow was entered from the Garden tab; prefilled and locked when deep-linked from a promise. Writes the same meta.commitmentId + dependent workLink path." },
  "wflow.pick-promise": { l: "Choose this promise", info: "Lists the gardener's Accepted/Active garden-work promises in the selected garden; choosing none submits ordinary work." },
  "wflow.pick-done": { l: "Use this promise", to: "screen:WFLOW@details", info: "Returns to details with the chosen promise shown in the fulfills field." },
  "wflow.details-continue": { l: "Continue to review", to: "screen:WFLOW@review", info: "Details → review, exactly as shipped." },
  "wflow.fulfills": { l: "Fulfills row", info: "The locked read-only commitment-context row on review (MF-7, UX:174) — it repeats the details-step choice and never re-opens the picker here." },
  "wflow.submit": { l: "Submit work", to: "screen:W2@active", info: "Existing work job + meta.commitmentId; the queue auto-links after sync (UX:220)." },
  "wflow.link-work-row": { l: "Choose this work", info: "One of the gardener's approved or pending works; approval status is shown, never guessed." },
  "wflow.link-confirm": { l: "Link this work", to: "screen:W2@active", info: "Enqueues workLink with the exact workUID + requirementIndex (2026-08-11 D6 — this picker replaces the old admin-console mis-wire). Repeated action UIDs never use first-match behavior (UX:140).", calls: ["linkWork"], pendingSync: true },
};

// ---------------------------------------------------------------------------

export const WALLET_DEFS: HifiDef[] = [
  {
    screen: { id: "W5", title: "W5 · WalletDrawer pools panel", surface: "client", frame: "phone", group: "Client PWA",
      states: W5_STATES.map(([id, label]) => ({ id, label, html: w5(id) })) },
    hots: W5_HOTS,
  },
  {
    screen: { id: "W23", title: "W23 · Wallet G$ + send", surface: "client", frame: "phone", group: "Client PWA",
      states: W23_STATES.map(([id, label]) => ({ id, label, html: w23(id) })) },
    hots: W23_HOTS,
  },
  {
    screen: { id: "W25", title: "W25 · Protocol-pool claim", surface: "client", frame: "phone", group: "Client PWA",
      states: W25_STATES.map(([id, label]) => ({
        id,
        label,
        facts: {
          commitment: id === "accepted" ? "Accepted" : "Requested",
          kind: "SupportService",
        } satisfies StateFacts,
        html: w25(id),
      })) },
    hots: W25_HOTS,
  },
  {
    screen: { id: "WFLOW", title: "Submit Work flow (+ promise link)", surface: "client", frame: "phone", group: "Client PWA",
      states: [
        { id: "intro", label: "1 · Intro", html: wflow("intro") },
        { id: "media", label: "2 · Media", html: wflow("media") },
        { id: "details", label: "3 · Details (+ fulfills field)", html: wflow("details") },
        { id: "fulfills-pick", label: "Fulfills a promise — picker", html: wflow("fulfills-pick") },
        { id: "review", label: "4 · Review (+ fulfills row)", html: wflow("review") },
        { id: "link-picker", label: "Link existing work — picker", facts: { pool: "Open", cycle: "Open", commitment: "Active", kind: "DomainImpact" } satisfies StateFacts, html: wflow("link-picker") },
      ] },
    hots: WFLOW_HOTS,
  },
];
