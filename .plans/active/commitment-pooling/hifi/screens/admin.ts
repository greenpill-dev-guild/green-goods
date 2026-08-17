// Admin hi-fi screens — W7 garden pool tab, W8 seeding console, W9 analog
// capture, W10 commitment dialog, W11 allocation, W13 hub confirm, W14
// assessment additions, HUBWORK. Restrained M3 operator cockpit (.s-admin):
// solid dense surfaces, Plus Jakarta Sans stack, quiet checkmarks, no hero
// language. Copy: "steward" everywhere (Decision Log #28c); on-chain `operator` allocation
// class RENDERS as "steward" (W11 rule). Dissolved lo-fi variants: MF1 →
// W7@ready, MF4 → W7@expiry-queue, W7X → W7@claim-outcomes, MF13 →
// W10@attach-assessment.

import { POOL_HOLDINGS, POOL_LIFETIME, SEASON_LIVE } from "../fixtures";
import { groupStates } from "../frames";
import { hot } from "../html";
import { icon } from "../icons";
import {
  acard, adminCanvas, adminDialogM3, banner, btn, chip, deskWin, disclosure, dtable, emptyState, fabButton, field, flowDialog, hdr, input, kv, meter,
  cardSection, decisionRow, filterChips, navItems, objectCard, pageHeader, phoneFrame, poolHoldings, commitmentRow, radio, reasonChips, sheetOver, skeleton, stages, statRow, tabRail,
} from "../kit";
import type { FlowStep, NavId, RailTab, Tone } from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// Admin chrome/component builders were relocated into ../kit (components-tab
// pass, 2026-08-14) so the kit is the single component source. What stays here
// is journey wiring — chrome hotspot registration and nav targets — plus the
// screen definitions themselves.

const NAV_TARGETS: Partial<Record<NavId, string>> = {
  hub: "screen:W13",
  garden: "screen:W7",
  community: "screen:W12",
  operations: "screen:W24",
};

export function adminChromeHots(hotPrefix: string, active: NavId): HifiDef["hots"] {
  const hots: HifiDef["hots"] = {
    [`${hotPrefix}.garden-selector`]: {
      l: "Select garden",
      info: "Garden selection remains in the shipping AppBar; this prototype keeps Rocinha fixed while exposing the control contract.",
    },
  };
  for (const [id, label] of navItems(active)) {
    const target = NAV_TARGETS[id];
    hots[`${hotPrefix}.nav-${id}`] = id === active || !target
      ? { l: `${label} workspace`, info: `${label} is ${id === active ? "the current" : "a preview-only"} workspace in this storyboard.` }
      : { l: `${label} workspace`, to: target, info: `Opens the representative ${label} workspace screen.` };
  }
  return hots;
}

// Dirty-flow discard guard — one per flow, so "Keep editing" returns to the
// flow that was actually open. A single shared W8 dialog swallowed capture,
// open-cycle, and assessment cancels into the seed flow's first step.
const discardDialog = (behind: string, tone: Tone, keepHot: string, discardHot: string, what?: string) =>
  adminDialogM3(behind, tone, {
    title: "Discard changes?",
    body: banner(
      `${what ?? "Nothing here has been saved yet"}. Leaving now discards what you've entered.`,
      "amber",
      "error-warning-line",
    ),
    actions: `${hot(keepHot, btn("Keep Editing", { kind: "ghost" }))}${hot(discardHot, btn("Discard", { kind: "danger" }))}`,
    closeHot: keepHot,
  });

// ---------------------------------------------------------------------------
// W7 — Garden workspace Pool tab (uiux-spec §6.2)
// ---------------------------------------------------------------------------

const W7_STATES = [
  ["open", "Open"], ["open-no-cycle", "Open — no active cycle"],
  ["seeded", "Season prepared — opens to fill"],
  ["not-ready", "Not taking commitments yet"], ["preflight-complete", "Ready to set up"], ["ready", "Set up — no season yet"],
  ["paused", "Paused"], ["paused-cycle-composted", "Paused · season composted"],
  ["reconciled", "Reconciled"], ["cycle-composted", "Season composted — close?"],
  ["close-blocked-live", "Close blocked — live commitments"], ["pool-closed", "Pool closed"],
  ["compost-pool-confirm", "Compost pool — confirm"], ["pool-composted", "Pool composted"],
  ["reopen-confirm", "Reopen pool — confirm"], ["edit-pool", "Edit pool settings"],
  ["claims", "Claims waiting"], ["claim-declined", "Declined — others pending"], ["claim-outcomes", "Claim outcomes"], ["expiry-queue", "Lapsed this cycle"],
  ["due-live", "Past due — expiry available"],
  ["series-view", "Ongoing Offers — series context"],
  ["pause-confirm", "Pause — confirm"], ["close-pool-confirm", "Close pool — confirm"],
  ["paused-close-pool-confirm", "Close paused pool — confirm"],
  ["cancel-cycle-confirm", "Cancel season — confirm"], ["paused-cancel-cycle-confirm", "Cancel paused season — confirm"],
  ["paused-cycle-cancelled", "Paused · season cancelled"],
  ["decline-claim-confirm", "Decline claim — confirm"],
  ["loading", "Loading"], ["empty", "No commitments yet"],
] as const;
type W7State = (typeof W7_STATES)[number][0];

// Steward-facing pool status says what is TRUE for members, never the on-chain
// state name (NotReady/Ready/Open are implementation words — NN/g heuristic 2).
const w7PoolChip = (state: W7State) => {
  const notTaking = chip("Not taking commitments yet", "plain", { dot: true });
  const map: Partial<Record<W7State, string>> = {
    "not-ready": notTaking, "preflight-complete": notTaking, ready: chip("Set up — no season yet", "warn", { dot: true }),
    paused: chip("Paused", "warn", { dot: true }), "paused-cycle-composted": chip("Paused", "warn", { dot: true }),
    "paused-cycle-cancelled": chip("Paused", "warn", { dot: true }),
  };
  return map[state] ?? chip("Taking commitments", "ok", { dot: true });
};

const w7PoolCard = (state: W7State) => {
  const preOpen = state === "not-ready" || state === "preflight-complete";
  // Pre-open, the card is STATUS ONLY: the single primary act lives in the left
  // column's empty state, so the page never offers the same act twice
  // (frontend-design Rule 5 · no action duplication).
  const acts = preOpen
    ? ""
    : state === "ready"
      ? hot("w7.edit-settings", btn("Edit Pool", { kind: "sec", sm: true }))
      : state === "close-blocked-live"
        ? `${hot("w7.edit-settings", btn("Edit Pool", { kind: "sec", sm: true }))}${hot("w7.review-live-promises", btn("Review Live Commitments", { kind: "pri" }))}`
        : state === "paused-cycle-composted"
          ? hot("w7.resume-composted", btn("Resume Pool", { kind: "sec", sm: true }))
          : state === "paused"
            ? `${hot("w7.edit-settings", btn("Edit Pool", { kind: "sec", sm: true }))}${hot("w7.resume", btn("Resume Pool", { kind: "pri" }))}`
            : state === "open-no-cycle" || state === "cycle-composted"
              ? hot("w7.edit-settings", btn("Edit Pool", { kind: "sec", sm: true }))
              : `${hot("w7.edit-settings", btn("Edit Pool", { kind: "sec", sm: true }))}${hot("w7.pause", btn("Pause…", { kind: "sec", sm: true }))}`;
  // The destructive exit, separated from the safe cluster.
  const destructive =
    state === "cycle-composted"
      ? `<div class="actrow">${hot("w7.close-pool", btn("Close Pool…", { kind: "danger", sm: true }))}</div>`
      : state === "paused-cycle-composted"
        ? `<div class="actrow">${hot("w7.close-pool-paused", btn("Close Pool…", { kind: "danger", sm: true }))}</div>`
        : "";
  // Setup facts are a CHECKLIST while a garden is being set up, and noise once
  // it runs (2026-08-16 round 5: "How it works — agreed ✓" is a strange thing
  // to read every day). Pre-open the card lists what is still missing; open, it
  // carries only the rule a steward actually consults — the commitment limit.
  const meta = preOpen
    ? `<div class="checkline">${state === "preflight-complete" ? `${icon("check-line", "s")}Agreement written` : `${icon("close-line", "s")}Agreement not written yet`}</div>
<div class="checkline">${state === "not-ready" ? `${icon("close-line", "s")}Starting assessment needed` : `${icon("check-line", "s")}Starting assessment recorded`}</div>
<div class="checkline">${icon("close-line", "s")}Commitment limit not set</div>`
    : kv("Commitment limit", "24 per person at once");
  const note =
    state === "not-ready"
      ? banner("An evaluator records the garden's starting assessment from the Hub. Setting up comes after.", "stone")
      : state === "preflight-complete"
        ? banner("The starting assessment is in — setting up is the last step before neighbors can commitment.", "stone")
        : state === "ready"
          ? banner("Set up and waiting. Starting a season is what lets neighbors commitment.", "stone")
          : state === "open-no-cycle"
            ? banner("No season is running. Start one — or a shorter campaign — from Quick actions.", "stone")
            : state === "cycle-composted"
              ? banner("Every season and campaign here has finished, and nothing is live. Start the next season from Quick actions, or close the pool for good.", "stone")
              : state === "close-blocked-live"
                ? banner("Two commitments are still live. They need to be kept, cancelled, or expired before this pool can close.", "amber", "error-warning-line")
                : state === "paused-cycle-composted"
                  ? banner("The season has finished and the pool is still paused. Resume to prepare another, or close it while keeping the history.", "amber", "error-warning-line")
                  : state === "paused"
                    ? banner("Paused: “seasonal flooding, back after the rains”. Members keep adding evidence and recovering commitments; making, claiming, and confirming wait.", "amber", "error-warning-line")
                    : "";
  // The pool is the CONTAINER — this card is its one home, in the tab's right
  // rail (2026-08-16 decisions 2/3): status, setup facts, lifecycle — clearly
  // separated from the Season and Campaign objects in the main column.
  // "Pool Status" — the tab is already called Pool, so the card names what it
  // actually holds (2026-08-16 round 4).
  // Settlement surfaces as a row here rather than a tab — uiux §5 locks that
  // ("every screen is designed so a settlement row can be added without moving
  // anything"), and without it the whole payout console was unreachable from
  // the garden.
  const settlement = preOpen
    ? ""
    : commitmentRow({
        title: "Settlement",
        chips: chip("1 Plan Open", "ink"),
        meta: "Repair the greenhouse · 3 contributors · not yet finalized",
        hotId: "w7.settlement-row",
        chevron: true,
      });
  return acard(
    "Pool Status",
    `<div class="t-meta">The container your seasons and campaigns run in.</div>${meta}${note}${settlement}${acts ? `<div class="actrow">${acts}</div>` : ""}${destructive}`,
    w7PoolChip(state),
  );
};

const w7Cycles = (state: W7State) => {
  // While Paused, opening a cycle would revert (openCycle needs the pool Open —
  // CS:727). Controls stay visible and honestly disabled; winding a season down
  // remains live.
  const paused = state === "paused" || state === "paused-cycle-composted";
  const composted = state === "cycle-composted" || state === "paused-cycle-composted";
  const seasonChip = composted
    ? chip("Finished", "plain", { dot: true })
    : state === "reconciled"
      ? chip("Reconciled", "plain", { dot: true })
      : paused
        ? chip("Open · participation paused", "warn", { dot: true })
        : chip("Open", "ok", { dot: true });
  // ONE act on the season, always: the next step in its life. Cancelling is the
  // alternative ENDING, offered inside the close flow where the season's state
  // is already on screen — so no overflow menu exists on this surface
  // (2026-08-16 round 6).
  const seasonAct = composted
    ? hot("w7.report-row", btn("Report", { kind: "sec", sm: true }))
    : state === "reconciled"
      ? hot("w7.report-row", btn("Report", { kind: "sec", sm: true }))
      : paused
        ? hot("w7.close-season-paused", btn("Close Season…", { kind: "sec", sm: true }))
        : hot("w7.close-season", btn("Close Season…", { kind: "sec", sm: true }));
  const stageIx = composted ? 5 : state === "reconciled" ? 4 : 1;
  // Campaigns are PEERS of the season, listed under the card's own section
  // divider — never nested under it, never a second card.
  const campaignRows = composted
    ? `${commitmentRow({ title: "Market rides", chips: `${chip("Campaign", "request")}${chip("Finished", "plain", { dot: true })}`, meta: "16 commitments · 14 kept · ended Aug 30" })}
${commitmentRow({ title: "Tool library", chips: `${chip("Campaign", "request")}${chip("Finished", "plain", { dot: true })}`, meta: "8 commitments · 8 kept · ended Aug 30" })}
${commitmentRow({ title: "Seedling swap", chips: `${chip("Campaign", "request")}${chip("Finished", "plain", { dot: true })}`, meta: "6 commitments · 5 kept · ended Aug 30" })}`
    : `${commitmentRow({ title: "Market rides", chips: `${chip("Campaign", "request")}${chip("Open", "ok", { dot: true })}`, meta: "16 commitments · 6 kept · runs through Sep 15" })}
${commitmentRow({ title: "Tool library", chips: `${chip("Campaign", "request")}${chip("Reviewing", "warn", { dot: true })}`, meta: "8 commitments · 8 kept · closed Aug 12" })}
${commitmentRow({
        title: "Seedling swap",
        chips: `${chip("Campaign", "request")}${chip("Not open yet", "plain", { dot: true })}`,
        meta: "0 commitments · 0 kept · runs through Sep 30",
        act: paused
          ? btn("Open", { kind: "sec", sm: true, disabled: true })
          : hot("w7.open-cycle-flow", btn("Open", { kind: "sec", sm: true })),
      })}`;
  const campaignCount = composted ? "Campaigns · 3 finished" : "Campaigns · 2 open · 1 waiting to open";
  const startCampaign = paused
    ? btn("Start Campaign", { kind: "sec", sm: true, disabled: true })
    : hot("w7.start-campaign", btn("Start Campaign", { kind: "sec", sm: true }));
  // The card's HEADER IS THE SEASON (2026-08-16 round 6) — one title bar, not a
  // generic card title with the season stacked beneath it as a second header.
  return objectCard({
    title: "Season of First Rains",
    chips: `${chip("Season", "ink")}${seasonChip}`,
    meta: `${SEASON_LIVE.made} commitments · ${SEASON_LIVE.kept} kept · runs through Aug 30`,
    acts: seasonAct,
    body: `${stages(["Seeded", "Open", "In Progress", "Reviewing", "Reconciled", "Finished"], stageIx)}
${cardSection(campaignCount, startCampaign)}
${campaignRows}`,
  });
};

// No season running: the same card, headed by the absence and carrying the one
// act that fixes it. Start Season lives HERE — on the object it creates — not in
// a generic quick-actions bucket (2026-08-16 round 6).
const w7NoSeason = (canStart: boolean) =>
  objectCard({
    title: "No season running",
    chips: chip("Season", "ink"),
    meta: "A season is the pool's main rhythm — one at a time, campaigns beside it",
    acts: canStart
      ? hot("w7.seed-cycle", btn("Start Season", { kind: "pri", sm: true }))
      : btn("Start Season", { kind: "pri", sm: true, disabled: true }),
    body: `${cardSection(
      "Campaigns · none yet",
      canStart
        ? hot("w7.start-campaign", btn("Start Campaign", { kind: "sec", sm: true }))
        : btn("Start Campaign", { kind: "sec", sm: true, disabled: true }),
    )}<div class="t-meta">Campaigns are shorter pushes that can run beside a season — or on their own.</div>`,
  });

// WHO IS IN THIS POOL (2026-08-16 round 7). Nothing anywhere answered "who else
// offers what I need" or "who have I given to and received from" — the entire
// member-facing relational surface was one history line buried in the claims
// queue. This is a roster: the people, what each currently offers, and the D.3
// line promoted out of that queue to where it describes a person rather than a
// claim.
//
// Privacy binds unchanged (D.3 + decision #21): per-member rows render for pool
// stewards and the member themself only, counts never percentages, no grade, no
// comparison between members, no cross-pool merge. `promiseKeptRate` stays a
// pool-level figure and never appears on a person. Deliberately a LIST, not a
// graph — a force-directed network in a garden console is decoration, and a list
// answers the same question honestly.
const w7Members = () =>
  acard(
    "Who's In This Pool",
    `<div class="t-meta">What each person currently offers, and how their commitments have gone here. Counts only — this is shared memory for stewarding, never a score or a ranking.</div>
${commitmentRow({
      title: "Maria",
      chips: `${chip("6 hours", "offer")}${chip("2 rides", "offer")}`,
      meta: "4 kept · 1 lapsed · 2 received · carrying 1 open",
    })}
${commitmentRow({
      title: "João",
      chips: `${chip("3 tool loans", "offer")}`,
      meta: "6 kept · 0 lapsed · 3 received · carrying 2 open",
    })}
${commitmentRow({
      title: "Ana",
      chips: `${chip("4 hours", "offer")}${chip("12 seedling trays", "offer")}`,
      meta: "2 kept · 0 lapsed · 1 received · carrying 1 open",
    })}
${commitmentRow({
      title: "Leila",
      chips: chip("nothing open right now", "plain"),
      meta: "3 kept · 1 lapsed · 4 received · carrying nothing",
    })}
${cardSection("19 more gardeners in this pool", hot("w7.all-members", btn("See Everyone", { kind: "sec", sm: true })))}`,
  );

// ONE Commitments card for the whole pool (2026-08-16 round 6). Past due, lapsed,
// blocking-close, and ongoing-offer views used to be four separately designed
// cards; they are FILTERS of this list, exactly as uiux §6.2 item 3 specifies
// (search + filter chips + sort, AdminListItem rows).
type CommitmentScope = "open" | "past-due" | "lapsed" | "ongoing" | "blocking";

const w7Filters = (scope: CommitmentScope) =>
  filterChips(
    [
      { label: "Open", on: scope === "open" || scope === "blocking", hotId: "w7.filter-open" },
      { label: "Past due", on: scope === "past-due", hotId: "w7.filter-due" },
      { label: "Lapsed", on: scope === "lapsed", hotId: "w7.filter-lapsed" },
      { label: "Ongoing", on: scope === "ongoing", hotId: "w7.filter-ongoing" },
      { label: "Confirmed", hotId: "w7.filter-confirmed" },
    ],
    "Commitment scope",
  );

// The row information contract: chips = kind · lifecycle · at most one
// attention chip; meta = who · how much · when. Always those, always in order.
const W7_COMMITMENT_ROWS: Record<CommitmentScope, string> = {
  open: `${commitmentRow({
    title: "Prune the north beds",
    chips: `${chip("Offer", "offer")}${chip("Accepted", "request", { dot: true })}`,
    meta: "Maria → João · 6 hours · due Aug 12",
    hotId: "w7.commitment-row",
    chevron: true,
  })}
${commitmentRow({
    title: "Repair tool handles",
    chips: `${chip("Support", "ink")}${chip("Evidence In", "warn", { dot: true })}${chip("Needs You", "err")}`,
    meta: "Maria → João · 1 session · due Aug 12",
    hotId: "w7.stalled-row",
    chevron: true,
  })}
${commitmentRow({
    title: "Market ride",
    chips: `${chip("Request", "request")}${chip("Offered", "offer", { dot: true })}`,
    meta: "João · 1 ride · due Aug 20",
    hotId: "w7.value-row",
    chevron: true,
  })}
${commitmentRow({
    title: "Repair the greenhouse",
    chips: `${chip("Team", "ink")}${chip("Kept", "ok", { dot: true })}${chip("Payment Not Planned", "warn")}`,
    meta: "Maria's crew · 1 repair · kept Jul 12",
    hotId: "w7.fulfilled-row",
    chevron: true,
  })}
${commitmentRow({
    title: "Pruning workshop",
    chips: `${chip("Offer", "offer")}${chip("Kept", "ok", { dot: true })}${chip("Payout Not Recorded", "warn")}`,
    meta: "Maria → the garden · 1 workshop · kept Jul 10",
    hotId: "w7.external-row",
    chevron: true,
  })}`,
  "past-due": `${commitmentRow({
    title: "Market rides",
    chips: `${chip("Campaign", "request")}${chip("Accepted", "request", { dot: true })}${chip("Past Due", "err")}`,
    meta: "João · 16 rides · was due Jul 2",
    act: hot("w7.expire-commitment", btn("Expire Now", { kind: "danger", sm: true })),
  })}
${commitmentRow({
    title: "Prune the north beds",
    chips: `${chip("Offer", "offer")}${chip("Accepted", "request", { dot: true })}`,
    meta: "Maria → João · 6 hours · due Aug 12",
    hotId: "w7.commitment-row",
    chevron: true,
  })}`,
  lapsed: `${commitmentRow({
    title: "Market rides",
    chips: `${chip("Campaign", "request")}${chip("Expired", "plain", { dot: true })}`,
    meta: "João · 16 rides · lapsed Jul 2 · 0 kept",
    act: hot("w7.reseed", btn("Re-seed…", { kind: "sec", sm: true })),
  })}`,
  ongoing: `${commitmentRow({
    title: "Hosting climate workshops",
    chips: `${chip("Ongoing Offer", "offer")}${chip("Active", "ok", { dot: true })}`,
    meta: "Maria · 3 places made · 1 open now",
    hotId: "w7.series-row",
    chevron: true,
  })}
${commitmentRow({
    title: "Saturday tool repair",
    chips: `${chip("Ongoing Offer", "offer")}${chip("Resting", "plain", { dot: true })}`,
    meta: "Rui · 5 places made · none open while resting",
    hotId: "w7.series-row-resting",
    chevron: true,
  })}
${commitmentRow({
    title: "Seedling starter kits",
    chips: `${chip("Ongoing Offer", "offer")}${chip("Retired", "plain", { dot: true })}`,
    meta: "retired May 30 · 8 places made · 8 kept",
    hotId: "w7.series-row-retired",
    chevron: true,
  })}`,
  blocking: `${commitmentRow({
    title: "Market rides",
    chips: `${chip("Campaign", "request")}${chip("Accepted", "request", { dot: true })}${chip("Past Due", "err")}`,
    meta: "João · 16 rides · was due Jul 2",
    act: hot("w7.filter-due", btn("Review", { kind: "sec", sm: true })),
  })}
${commitmentRow({
    title: "Market ride",
    chips: `${chip("Request", "request")}${chip("Offered", "offer", { dot: true })}`,
    meta: "João · 1 ride · due Aug 20",
    hotId: "w7.value-row",
    chevron: true,
  })}`,
};

const W7_COMMITMENT_NOTE: Partial<Record<CommitmentScope, string>> = {
  ongoing: banner(
    "State and context only — the console never edits a member's ongoing Offer. Resting, resuming, and retiring stay with its holder.",
    "stone",
    "information-line",
  ),
  blocking: banner(
    "These two must be kept, cancelled, or expired before the pool can close.",
    "amber",
    "error-warning-line",
  ),
};

// The steward's first question on this tab is "what needs me?" — so these are a
// TO-DO LIST: every count is something a steward can act on. "Awaiting
// confirmation" was dropped in round 6; it waits on members, not on you.
const w7Summary = () =>
  statRow([
    { n: "2", label: "Claims Waiting", hotId: "w7.jump-claims" },
    { n: "2", label: "Needs Recovery", hotId: "w7.jump-recovery" },
    { n: "0", label: "Failed Payouts", hotId: "w7.jump-payouts" },
  ]);

// ONE Claims card, conditional per uiux §6.2 item 4 (visible only while
// approval-gated requests exist). Rows are DECISION rows — accept and decline
// are paired opposites, so both show. The funded-claim checkpoint is a row here
// with its funding chip, not a seventh card.
const w7Claims = (state: W7State) => {
  const declined = state === "claim-declined";
  const outcomes = state === "claim-outcomes";
  if (outcomes)
    return acard(
      "Claims",
      `${decisionRow({
        title: "Ride to the market on Saturday",
        chips: `${chip("Request", "request")}${chip("Declined", "plain", { dot: true })}`,
        meta: "Maria · individual · asked Jul 9",
        outcome: `<span class="t-meta">reason recorded</span>`,
      })}
${decisionRow({
        title: "Ride to the market on Saturday",
        chips: `${chip("Request", "request")}${chip("Accepted", "ok", { dot: true })}`,
        meta: "João · individual · asked Jul 10",
        outcome: `<span class="t-meta">terms stored</span>`,
      })}
${decisionRow({
        title: "Ride to the market on Saturday",
        chips: `${chip("Request", "request")}${chip("Superseded", "plain", { dot: true })}`,
        meta: "Maria · individual · asked again Jul 10",
        outcome: `<span class="t-meta">another was accepted</span>`,
      })}
${banner("Accepting one request supersedes the others — an indexer side-effect, never a member's act.", "stone")}`,
    );
  return acard(
    "Claims",
    `${decisionRow({
      title: "Ride to the market on Saturday",
      chips: `${chip("Request", "request")}${declined ? chip("Declined", "plain", { dot: true }) : chip("Waiting", "warn", { dot: true })}`,
      meta: "Maria · individual · asked Jul 9",
      outcome: declined ? `<span class="t-meta">reason recorded</span>` : undefined,
      decline: declined ? undefined : hot("w7.decline-claim", btn("Decline…", { kind: "sec", sm: true })),
      affirm: declined ? undefined : hot("w7.accept-maria", btn("Accept", { kind: "pri", sm: true })),
    })}
${decisionRow({
      title: "Ride to the market on Saturday",
      chips: `${chip("Request", "request")}${chip("Waiting", "warn", { dot: true })}`,
      meta: "João · individual · asked Jul 10",
      decline: hot("w7.decline-joao", btn("Decline…", { kind: "sec", sm: true })),
      affirm: hot("w7.accept-claim", btn("Accept", { kind: "pri", sm: true })),
    })}
${decisionRow({
      title: "Design a market poster",
      chips: `${chip("Offer", "offer")}${chip("Waiting", "warn", { dot: true })}${chip("40 G$ Pledged", "ink")}`,
      meta: "Maria · individual · asked Jul 11",
      outcome: hot("w7.open-funded-claim", btn("Review Funding", { kind: "sec", sm: true })),
    })}${
      declined
        ? banner("Only Maria's request changed. João's stays waiting, the commitment stays claimable, and Maria may ask again.", "stone")
        : ""
    }`,
  );
};

const w7Commitments = (scope: CommitmentScope = "open") =>
  acard(
    "Commitments",
    `${w7Filters(scope)}
${W7_COMMITMENT_ROWS[scope]}${W7_COMMITMENT_NOTE[scope] ?? ""}`,
    input("Search…", { placeholder: true, icon: "search-line", ariaLabel: "Search commitments" }),
  );

const W7_DESC: Record<W7State, string> = {
  open: "Season of First Rains is live — offers and requests between neighbors.",
  "open-no-cycle": "No season is running — start one, or a campaign beside it.",
  "not-ready": "This garden isn't taking commitments yet.",
  "preflight-complete": "The starting assessment is in — set up commitments next.",
  ready: "Set up and waiting for its first season.",
  paused: "Paused for the season — evidence and recovery stay open.",
  "paused-cycle-composted": "The season has composted; the pool remains paused.",
  reconciled: "The season is reconciled — commitments settled; compost comes next.",
  "cycle-composted": "Every cycle has composted — seed the next one, or close the pool.",
  "close-blocked-live": "Two live commitments still need a safe outcome before the pool can close.",
  "pool-closed": "The pool is closed — its history stays with the garden.",
  "compost-pool-confirm": "The pool is closed — confirm before archiving it.",
  "pool-composted": "The pool is composted — reopen it to begin a new era.",
  "reopen-confirm": "The pool is composted — reopen it to begin a new era.",
  "paused-cycle-cancelled": "The season is cancelled; the pool remains paused.",
  "edit-pool": "Season of First Rains is live — offers and requests between neighbors.",
  "claim-declined": "Maria's request is declined; João's stays pending.",
  "claim-outcomes": "How this cycle's steward-reviewed claims resolved.",
  claims: "Requests waiting for a steward decision in this cycle.",
  "expiry-queue": "Commitments that lapsed this cycle — offer them again.",
  "due-live": "Past-due commitments remain live until someone submits the permissionless expiry action.",
  "series-view": "Ongoing Offers grouped by series — read-only state and context.",
  loading: "Loading the pool…",
  empty: "The pool is open and waiting for its first commitment.",
  "pause-confirm": "Season of First Rains is live — offers and requests between neighbors.",
  "close-pool-confirm": "Season of First Rains is live — offers and requests between neighbors.",
  "paused-close-pool-confirm": "The season has composted; the pool remains paused.",
  "cancel-cycle-confirm": "Season of First Rains is live — offers and requests between neighbors.",
  "paused-cancel-cycle-confirm": "Paused for the season — evidence and recovery stay open.",
  "decline-claim-confirm": "Season of First Rains is live — offers and requests between neighbors.",
};

// Dimmed pool route behind a W7 confirmation. Hotspot-free for the same reason
// W10's is: foreign ids here would break bidirectional hotspot integrity.
export const w7Behind = (state: "open" | "ready" | "paused" | "closed" | "composted" = "open") =>
  adminCanvas("garden", "garden", {
    screenId: "W7",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({
      title: "Garden",
      description:
        state === "ready"
          ? W7_DESC.ready
          : state === "paused"
            ? W7_DESC.paused
            : state === "composted"
              ? W7_DESC["pool-composted"]
              : state === "closed"
                ? W7_DESC["pool-closed"]
              : W7_DESC.open,
    }),
    tabRail: tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3),
    body: acard(
      "Pool Status",
      `<div class="t-meta">The container your seasons and campaigns run in.</div>${kv("Commitment limit", "24 per person at once")}`,
      state === "ready"
        ? chip("Set up — no season yet", "warn", { dot: true })
        : state === "paused"
          ? chip("Paused", "warn", { dot: true })
        : state === "composted"
          ? chip("Archived", "plain", { dot: true })
          : state === "closed"
            ? chip("Closed", "plain", { dot: true })
          : chip("Taking commitments", "ok", { dot: true }),
    ),
  });

// Every consequential pool or cycle act names its blast radius and takes the
// reason the contract stores — and ONLY when the contract stores one: closePool
// takes no reason (CS:556), so its confirmation is banner-only. validate.ts
// enforces both directions via REASON_CONFIRMS. Each of these was previously
// one click straight to the outcome state — which teaches an implementer that
// no confirmation exists.
const w7Confirm = (radius: string, reason: string, chips?: string[]) =>
  `${banner(radius, "amber", "error-warning-line")}${chips ? reasonChips(chips) : ""}${field("Reason (required)", input(reason))}`;

const W7_CONFIRMS: Partial<Record<W7State, { title: string; body: string; actions: string; closeHot: string }>> = {
  "pause-confirm": {
    title: "Pause this pool",
    body: w7Confirm(
      "Pausing stops new commitments, claims, and confirmations for 23 members across 7 open commitments. Evidence, work linkage, and recovery stay open; resuming clears this reason.",
      "seasonal flooding, back after the rains",
      ["Weather or season", "Group is regrouping", "Safety first"],
    ),
    actions: `${hot("w7.confirm-dismiss", btn("Keep Running", { kind: "ghost" }))}${hot("w7.pause-confirm", btn("Pause Pool", { kind: "pri" }))}`,
    closeHot: "w7.confirm-dismiss",
  },
  "close-pool-confirm": {
    title: "Close this pool",
    // Banner-only on purpose: closePool(poolId) stores no reason (CS:556), and
    // this confirm is reachable only from the cycle-composted card, where the
    // zero-live and terminal-cycle assertions are true.
    body: banner(
      "Closing ends participation for 23 members. Every cycle is terminal and all live commitments have been wound down; history stays with the garden. Compost and reopen stay available.",
      "amber",
      "error-warning-line",
    ),
    actions: `${hot("w7.close-dismiss", btn("Keep Open", { kind: "ghost" }))}${hot("w7.close-pool-confirm", btn("Close Pool", { kind: "danger" }))}`,
    closeHot: "w7.close-dismiss",
  },
  "paused-close-pool-confirm": {
    title: "Close this paused pool",
    body: banner(
      "Closing ends participation for 23 members. The pool is paused, every cycle is terminal, and all live commitments have been wound down; its history stays with the garden. Compost and reopen stay available.",
      "amber",
      "error-warning-line",
    ),
    actions: `${hot("w7.paused-close-dismiss", btn("Keep Paused", { kind: "ghost" }))}${hot("w7.close-pool-paused-confirm", btn("Close Pool", { kind: "danger" }))}`,
    closeHot: "w7.paused-close-dismiss",
  },
  "compost-pool-confirm": {
    title: "Compost this pool",
    body: banner(
      "Composting archives this closed pool. Its seasons, commitments, reasons, and settlement history remain readable; reopening later begins from Ready.",
      "amber",
      "error-warning-line",
    ),
    actions: `${hot("w7.compost-dismiss", btn("Keep Closed", { kind: "ghost" }))}${hot("w7.compost-confirm", btn("Compost Pool", { kind: "danger" }))}`,
    closeHot: "w7.compost-dismiss",
  },
  "cancel-cycle-confirm": {
    title: "Cancel this season",
    body: w7Confirm(
      "Season of First Rains has no live commitments; all 8 are kept, cancelled, or expired. Cancelling ends the season for everyone in it; each commitment keeps its own record, and members see the reason you give here.",
      "funding fell through for the rains",
      ["Funding fell through", "Season replanned", "Started by mistake"],
    ),
    actions: `${hot("w7.confirm-dismiss", btn("Keep the Season", { kind: "ghost" }))}${hot("w7.cancel-cycle-confirm", btn("Cancel Season", { kind: "danger" }))}`,
    closeHot: "w7.confirm-dismiss",
  },
  "paused-cancel-cycle-confirm": {
    title: "Cancel this paused season",
    body: w7Confirm(
      "The pool stays paused. Season of First Rains has no live commitments; all 8 are kept, cancelled, or expired. Cancelling ends the season, and every commitment keeps its own record and reason.",
      "funding fell through for the rains",
      ["Funding fell through", "Season replanned", "Started by mistake"],
    ),
    actions: `${hot("w7.paused-confirm-dismiss", btn("Keep the Season", { kind: "ghost" }))}${hot("w7.cancel-cycle-paused-confirm", btn("Cancel Season", { kind: "danger" }))}`,
    closeHot: "w7.paused-confirm-dismiss",
  },
  "decline-claim-confirm": {
    title: "Decline Maria's request",
    body: w7Confirm(
      "Only Maria's request is declined — João's stays pending and the commitment stays claimable. Maria sees your reason and may ask again.",
      "provider context — see charter",
      ["Crew is full", "Needs more experience", "Asked after another was chosen"],
    ),
    actions: `${hot("w7.decline-dismiss", btn("Keep Pending", { kind: "ghost" }))}${hot("w7.decline-claim-confirm", btn("Decline Request", { kind: "pri" }))}`,
    closeHot: "w7.decline-dismiss",
  },
};

function w7(state: W7State): string {
  if (state === "edit-pool")
    return deskWin(
      "admin.greengoods.app/garden/pool",
      adminDialogM3(w7Behind("open"), "garden", {
        title: "Pool Settings",
        body: `${field("What this pool is for", input("Neighbours in Rocinha offer help and ask for it — rides, tools, workshops, and garden work. Commitments are kept in the open and confirmed by the person they were made to.", { textarea: true }))}${field("How many commitments one person can hold at once", input("24"))}${banner(
          "Both stay editable for the pool's whole life. Changing the limit never affects commitments already made.",
          "stone",
        )}`,
        actions: `${hot("w7.edit-pool-dismiss", btn("Cancel", { kind: "ghost" }))}${hot("w7.edit-pool-save", btn("Save Settings", { kind: "pri" }))}`,
        closeHot: "w7.edit-pool-dismiss",
      }),
    );
  const confirm = W7_CONFIRMS[state];
  if (confirm)
    return deskWin(
      "admin.greengoods.app/garden/pool",
      adminDialogM3(
        w7Behind(state === "compost-pool-confirm" ? "closed" : state.startsWith("paused-") ? "paused" : "open"),
        "garden",
        confirm,
      ),
    );
  if (state === "reopen-confirm")
    return deskWin(
      "admin.greengoods.app/garden/pool",
      adminDialogM3(w7Behind("composted"), "garden", {
        title: "Reopen this pool",
        body: `${banner("Reopening moves the composted pool to Ready. Members still cannot participate until a steward opens it again.", "stone")}${kv("Next state", "Ready")}${kv("History", "preserved")}`,
        actions: `${hot("w7.reopen-dismiss", btn("Keep Composted", { kind: "ghost" }))}${hot("w7.reopen-confirm", btn("Reopen to Ready", { kind: "pri" }))}`,
        closeHot: "w7.reopen-dismiss",
      }),
    );

  // ---- Stable view actions (interaction-patterns §1) ----------------------
  // The Garden view's ONE action set, identical on every tab and every state,
  // mirroring the shipped buildGardenViewActions pair (garden.utils.ts:103)
  // plus Seed (2026-08-16 decision 1). Availability is expressed by disabling,
  // never by removing: createCommitment requires Pool Open (CS:747).
  const seedable = [
    "open", "reconciled", "cycle-composted", "claims", "claim-declined",
    "claim-outcomes", "expiry-queue", "due-live", "series-view", "funded-claim", "empty",
  ].includes(state);
  // TWO button weights in the row, never three: outlined secondaries and one
  // filled primary. A text + outlined + filled trio read as three unrelated
  // controls (2026-08-16 round 4).
  const headerActions = `${hot("w7.view-public", btn("View Public", { kind: "sec", sm: true }))}${
    seedable
      ? hot("w7.seed", btn("Seed Commitment", { kind: "sec", sm: true, icon: "add-line" }))
      : btn("Seed Commitment", { kind: "sec", sm: true, icon: "add-line", disabled: true })
  }${hot("w7.edit-garden", btn("Edit Garden", { kind: "pri", sm: true }))}`;
  // The shipped Garden header's MetaStrip (buildGardenHeaderStats) — garden-level
  // facts that change and reward attention. "1 season live" was dropped: a number
  // that is always 1 measures nothing (2026-08-16 round 5).
  const headerMeta = `<span><b class="num">23</b> Gardeners</span><span><b class="num">4</b> Certified Impacts</span><span><b class="num">${POOL_LIFETIME.kept}</b> Commitments Kept</span>`;

  // ---- Right rail (decision 2): container status · quick actions · activity.
  // The pool card is the container's one home; the cycle doors live under
  // Quick actions; the feed keeps ambient awareness without a second tab.
  const poolRailStates: W7State[] = [
    "open", "open-no-cycle", "seeded", "not-ready", "preflight-complete", "ready", "reconciled",
    "cycle-composted", "close-blocked-live", "paused", "paused-season-menu", "paused-cycle-composted",
    "claims", "claim-declined", "claim-outcomes", "expiry-queue", "due-live",
    "series-view", "funded-claim", "empty",
  ];
  // Every activity line opens the thing it describes — an update you can't act
  // on is a notification, not a workspace.
  const activityRow = (hotId: string, text: string, when: string) =>
    commitmentRow({ title: text, meta: when, hotId, chevron: true });
  // Offers arriving are the pool filling up, and the feed never showed them —
  // so the one thing a steward most wants to watch after opening a season was
  // invisible in the cockpit. This is the admin-side version of that moment:
  // a quiet row, never a celebration (hero moments are client-only, register #27).
  const activity = acard(
    "Activity",
    `${activityRow("w7.activity-offer", "Ana offered 4 hours of weeding", "40 minutes ago")}
${activityRow("w7.activity-claim", "João's ride request accepted", "2 hours ago")}
${activityRow("w7.activity-evidence", "Maria added evidence to Prune the north beds", "6 hours ago")}
${activityRow("w7.activity-work", "Pruning session approved for Prune the north beds", "Jul 8")}`,
  );
  // WHAT THE POOL HOLDS — the pool's contents, which no surface showed before
  // (2026-08-16 round 7). Pool Status beneath it says how the container is
  // CONFIGURED and where it is in its life; this says what is actually in it,
  // which is the question a steward and a member both open the tab to answer.
  // Two subjects, so two cards — holdings first, because it is the pool's face.
  const holdings = (empty: boolean) =>
    acard(
      "What This Pool Holds",
      empty
        ? `<div class="t-meta">${
            state === "seeded"
              ? "Nothing yet — a prepared season holds no commitments. Opening it is what lets neighbors start filling this."
              : "Nothing yet. As neighbors offer help and ask for it, what this pool can do for its members shows up here."
          }</div>`
        : poolHoldings({
            units: POOL_HOLDINGS.units,
            reserve: POOL_HOLDINGS.reserve,
            capacityNote: "Commitments open now, grouped by what they're measured in.",
            reserveNote: "What neighbors can do for each other doesn't depend on this.",
          }),
    );
  // A pool that has never opened has no quick actions (its one act is the left
  // column's primary), nothing in it yet, and no activity — the rail is status
  // only until it opens.
  const preOpen = state === "not-ready" || state === "preflight-complete" || state === "ready";
  // Seeded shows holdings (honestly empty, which is the point) and status, but
  // no activity — nothing has happened in a season that hasn't opened.
  const railFor = (poolState: W7State) =>
    preOpen
      ? w7PoolCard(poolState)
      : state === "seeded"
        ? `${holdings(true)}${w7PoolCard(poolState)}`
        : `${holdings(state === "empty")}${w7PoolCard(poolState)}${activity}`;
  // Two-column page: left = focused objects and acts, right = the rail.
  // Collapses to one column below 900px (tokens.ts .wsrow).
  const page = (left: string, poolState: W7State = state) =>
    poolRailStates.includes(state)
      ? `<div class="wsrow"><div class="wsmain">${left}</div><aside class="wsrail">${railFor(poolState)}</aside></div>`
      : left;

  let body: string;
  if (state === "loading") {
    body = `<div class="wsrow"><div class="wsmain">${skeleton({ title: true, lines: 2 })}${skeleton({ lines: 3 })}</div><aside class="wsrail">${skeleton({ lines: 3 })}${skeleton({ lines: 2 })}${skeleton({ lines: 2 })}</aside></div>`;
  } else if (state === "empty") {
    body = page(
      emptyState(
        "seedling-line",
        "No commitments yet",
        "When the pool is open, offers and requests between neighbors show up here. Seed the first commitment to begin.",
        hot("w7.seed", btn("Seed Commitment", { kind: "pri", sm: true, icon: "add-line" })),
      ),
      "open",
    );
  } else if (state === "not-ready" || state === "preflight-complete") {
    // A pool that has never opened has no season, commitments, or claims. One
    // primary, and the rail's checklist says what is still missing.
    body = page(
      state === "not-ready"
        ? emptyState(
            "seedling-line",
            "This garden isn't taking commitments yet",
            "Neighbours can offer help and ask for it here once you've set up how this pool works.",
            hot("w7.setup", btn("Set Up Commitments", { kind: "pri", sm: true })),
          )
        : emptyState(
            "seedling-line",
            "Ready to set up",
            "Setting up writes how this pool works and opens its first season — one pass, four short steps.",
            hot("w7.setup", btn("Set Up Commitments", { kind: "pri", sm: true })),
          ),
    );
  } else if (state === "ready" || state === "open-no-cycle") {
    // Set up, nothing running: the season card headed by its own absence.
    body = page(w7NoSeason(true));
  } else if (state === "seeded") {
    // The prepared season, waiting to open (2026-08-16 round 7). This state did
    // not exist: the console jumped from "no season" to a season full of
    // commitments, so the one moment a steward is actually preparing something had
    // no screen. A Seeded cycle holds no commitments by contract — opening is what
    // lets the garden fill it, which is why that is the only act here and why
    // it reads as an opening rather than a settings save.
    body = page(
      objectCard({
        title: "Season of First Rains",
        chips: `${chip("Season", "ink")}${chip("Prepared — not open yet", "warn", { dot: true })}`,
        meta: "Runs Aug 1 – Aug 30 · terms written · nobody can commitment yet",
        acts: hot("w7.open-season-flow", btn("Open to the Garden", { kind: "pri", sm: true })),
        body: `${stages(["Seeded", "Open", "In Progress", "Reviewing", "Reconciled", "Finished"], 0)}
<div class="t-meta">Opening tells everyone the season has begun, and is the moment neighbors can start offering help and asking for it. Until then this season is only written down.</div>
${cardSection("Campaigns · none yet", hot("w7.start-campaign", btn("Start Campaign", { kind: "sec", sm: true })))}
<div class="t-meta">A campaign can run beside this season, or open before it.</div>`,
      }),
    );
  } else if (state === "pool-closed") {
    // §4.1 Closed: view-only history; compost is the remaining act and reopen
    // follows compost. No season/commitment consoles on a closed pool.
    body = acard(
      "Pool Status",
      `${kv("History", `${POOL_LIFETIME.seasons} season · ${POOL_LIFETIME.made} commitments · ${POOL_LIFETIME.kept} kept`)}${banner(
        "The pool is closed — its history stays with the garden. Archiving it keeps that history; reopening starts the next era.",
        "stone",
      )}<div class="actrow">${hot("w7.compost-pool", btn("Archive Pool…", { kind: "sec", sm: true }))}</div>`,
      chip("Closed", "plain", { dot: true }),
    );
  } else if (state === "pool-composted") {
    body = acard(
      "Pool Status",
      `${kv("History", `${POOL_LIFETIME.seasons} season · ${POOL_LIFETIME.made} commitments · ${POOL_LIFETIME.kept} kept`)}${banner(
        "This pool is archived. Reopening preserves its history; members can't take part again until a season opens.",
        "stone",
      )}<div class="actrow">${hot("w7.reopen-pool", btn("Reopen Pool…", { kind: "pri", sm: true }))}</div>`,
      chip("Archived", "plain", { dot: true }),
    );
  } else if (state === "paused-cycle-cancelled") {
    body = page(w7NoSeason(false));
  } else if (state === "empty") {
    body = page(`${w7Summary()}${w7Cycles("open")}${acard(
      "Commitments",
      emptyState(
        "seedling-line",
        "No commitments yet",
        "Offers and requests between neighbors show up here. Seed the first one to begin.",
        hot("w7.seed", btn("Seed Commitment", { kind: "pri", sm: true, icon: "add-line" })),
      ),
    )}`, "open");
  } else if (state === "claims" || state === "claim-declined" || state === "claim-outcomes") {
    body = page(`${w7Summary()}${w7Claims(state)}${w7Commitments("open")}`, "open");
  } else if (state === "due-live") {
    body = page(`${w7Summary()}${w7Commitments("past-due")}`, "open");
  } else if (state === "expiry-queue") {
    body = page(`${w7Summary()}${w7Commitments("lapsed")}`, "open");
  } else if (state === "series-view") {
    body = page(`${w7Summary()}${w7Commitments("ongoing")}`, "open");
  } else if (state === "close-blocked-live") {
    body = page(`${w7Summary()}${w7Commitments("blocking")}`);
  } else if (state === "reconciled" || state === "cycle-composted" || state === "paused-cycle-composted") {
    body = page(`${w7Summary()}${w7Cycles(state)}${w7Commitments("open")}`);
  } else {
    // The running pool: triage, the season and its campaigns, the commitments, then
    // the people behind them.
    body = page(
      `${w7Summary()}${w7Cycles(state)}${w7Commitments("open")}${w7Members()}`,
      state === "paused" ? "paused" : "open",
    );
  }
  const header = pageHeader({
    title: "Garden",
    description: W7_DESC[state],
    meta: headerMeta,
    actions: headerActions,
  });
  return deskWin(
    "admin.greengoods.app/garden/pool",
    adminCanvas("garden", "garden", {
      screenId: "W7",
      garden: "Rocinha",
      header,
      tabRail: tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3),
      body,
    }),
  );
}

const W7_HOTS: HifiDef["hots"] = {
  "w7.open-funded-claim": {
    l: "Review funded claim",
    to: "screen:W37@claim",
    info: "Opens the priced-Offer funding checkpoint without accepting the claim or recording a deposit.",
  },
  "w7.series-row": { l: "Active ongoing Offer", info: "Series context is read-only in the console (register #97): instances group under their series, and the available count equals current Offered instances. Lifecycle acts (rest/resume/retire) stay with the holder in the client." },
  "w7.series-row-resting": { l: "Resting ongoing Offer", info: "Resting pauses new places only — an existing Offered place stays claimable, so availability derives from current Offered instances, never from series state. Kept history remains visible." },
  "w7.series-row-retired": { l: "Retired ongoing Offer", info: "Read-only terminal context — retirement never erases the series' kept instances." },
  "w7.pause": { l: "Pause pool (reason)", to: "screen:W7@pause-confirm", info: "pausePool with mandatory reason CID; members keep evidence/linkage + recovery (UX:60)." },
  "w7.confirm-dismiss": { l: "Keep as it is", to: "screen:W7", info: "Closes the confirmation without applying the act." },
  "w7.pause-confirm": { l: "Pause pool (confirm)", to: "screen:W7@paused", info: "pausePool(reason) — the stored reason renders in the member banner (UX:60 · CS:725).", calls: ["pausePool"] },
  "w7.close-pool-confirm": { l: "Close pool (confirm)", to: "screen:W7@pool-closed", info: "closePool(poolId) runs only with zero live commitments and zero non-terminal cycles. It stores no reason, preserves history, and leaves compost/reopen available.", calls: ["closePool"] },
  "w7.close-pool-paused-confirm": { l: "Close paused pool (confirm)", to: "screen:W7@pool-closed", info: "closePool(poolId) changes Paused → Closed only after all commitments are terminal and every cycle is Cancelled or Composted; it stores no reason and preserves history.", calls: ["closePool"] },
  "w7.close-dismiss": { l: "Keep the pool open", to: "screen:W7@cycle-composted", info: "Closes the confirmation; the pool stays open with its composted season's history." },
  "w7.paused-close-dismiss": { l: "Keep the pool paused", to: "screen:W7@paused-cycle-composted", info: "Closes the confirmation; the pool stays Paused and its season stays Composted." },
  "w7.paused-confirm-dismiss": { l: "Keep the paused season", to: "screen:W7@paused", info: "Closes the confirmation without cancelling the season or resuming the pool." },
  "w7.decline-dismiss": { l: "Keep pending", to: "screen:W7@claims", info: "Closes the confirmation and returns to the claims queue with both requests still pending." },
  "w7.cancel-cycle-confirm": { l: "Cancel season (confirm)", to: "screen:W7@open-no-cycle", info: "cancelCycle(reason) ends only the season — the pool stays open without an active cycle, and members read the stored reason in a quiet banner (UX:77 · CS:104).", calls: ["cancelCycle"] },
  "w7.cancel-cycle-paused-confirm": { l: "Cancel paused season (confirm)", to: "screen:W7@paused-cycle-cancelled", info: "cancelCycle(reason) changes only the cycle to Cancelled; the pool remains Paused and members read the reason.", calls: ["cancelCycle"] },
  "w7.decline-claim-confirm": { l: "Decline request (confirm)", to: "screen:W7@claim-declined", info: "declineClaim(reason) clears exactly one request — the other row stays pending; the claimant may ask again (CS:734).", calls: ["declineClaim"] },
  "w7.resume": { l: "Resume pool", to: "screen:W7", info: "resumePool clears the indexed reason (CS:725).", calls: ["resumePool"] },
  "w7.setup": {
    l: "Set up commitments",
    to: "screen:W11@setup-how",
    info: "The garden's ONE setup act. The flow collects how the pool works, the season, and the split, then submits the whole ordered sequence at its last step — setPoolCharter, setProviderOpenCommitmentCap, markPoolReady, seedCycle, openPool, openCycle. The steward never sees or performs the intermediate pool states (2026-08-16 round 3; supersedes the Edit-readiness → Mark-ready → Open-pool path).",
  },
  "w7.edit-pool-dismiss": { l: "Cancel", to: "screen:W7", info: "Closes the settings dialog without changing the pool." },
  "w7.edit-pool-save": { l: "Save Settings", to: "screen:W7", info: "setPoolCharter + setProviderOpenCommitmentCap — both editable for the pool's whole life; neither touches commitments already made.", calls: ["setPoolCharter", "setProviderOpenCommitmentCap"] },
  "w7.settlement-row": { l: "Settlement", to: "screen:W21", info: "The garden's payout console. Settlement rides in as a row on an existing card (uiux §5) rather than a new tab; before round 6 it was unreachable from the garden entirely." },
  "w7.edit-settings": {
    l: "Edit Pool",
    to: "screen:W7@edit-pool",
    info: "Opens the pool's settings dialog — how it works and the commitment limit. setPoolCharter and setProviderOpenCommitmentCap stay editable for the pool's whole life (CS:723,751).",
  },
  "w7.close-pool": { l: "Close pool", to: "screen:W7@close-pool-confirm", info: "Offered only after indexed pool live commitments and non-terminal cycles are both zero; closePool takes no reason." },
  "w7.close-pool-paused": { l: "Close paused pool", to: "screen:W7@paused-close-pool-confirm", info: "Offered only after the paused pool has zero live commitments and zero non-terminal cycles." },
  "w7.review-live-promises": { l: "Review live commitments", to: "screen:W7@due-live", info: "Returns to the due-live commitment rows so expiry can be submitted before close." },
  "w7.close-season": { l: "Close season", to: "screen:W26", info: "Opens the close wizard while the cycle remains Reviewing/Open on-chain. Once every commitment is terminal and liveCommitmentCount is zero, the first write closes the cycle before shares or mint." },
  "w7.close-season-paused": { l: "Close paused season", to: "screen:W26@paused-review", info: "Opens the same close wizard without resuming the Paused pool; a terminal zero-live-count cycle closes before certificate composition." },
  "w7.seed-cycle": { l: "Start a season", to: "screen:W11@details", info: "The season door, on the card that owns the season — opens the ONE start-a-season flow (details → allocation → open) in its final shell from step one; one open Season at a time (CS:566 · UX:66)." },
  "w7.start-campaign": { l: "Start a campaign", to: "screen:W11@campaign-details", info: "The campaign door, on the card's Campaigns section — the same three-step flow with Campaign preselected; any number of campaigns may run beside the one open Season (UX:66)." },
  "w7.open-season-flow": { l: "Open this season to the garden", to: "screen:W11@presets", info: "A prepared Season is Seeded and holds nothing: createCommitment rejects any cycle that is not Open (CreationChecksLib.sol:72). Opening runs the remaining §6.10 steps — the split, then openCycle — and is the moment neighbors can start promising." },
  "w7.accept-claim": { l: "Accept claim", to: "screen:W7@claim-outcomes", info: "Consumes the stored request terms; other pending rows become Superseded (CS:733).", calls: ["acceptClaim"] },
  "w7.decline-claim": { l: "Decline claim (reason)", to: "screen:W7@decline-claim-confirm", info: "Clears exactly one request; the claimant may ask again (CS:734)." },
  "w7.reseed": { l: "Re-seed", to: "screen:W8", info: "Lapsed seeded commitments re-enter the seeding console prefilled (UX:94). Adopted MF-4." },
  "w7.expire-commitment": {
    l: "Expire past-due commitment",
    to: "screen:W7@expiry-queue",
    info: "Permissionless expireCommitment changes the still-live past-due row to Expired, releases reserved capacity exactly once, supersedes pending claims, and decrements pool/cycle live counts before the post-expiry queue appears.",
    calls: ["expireCommitment"],
  },
  // Info-only mirrors of the two acts this storyboard walks: accepting Maria or
  // declining João is equally legal, but the resulting outcome set is not drawn
  // (the outcomes state depicts João accepted / Maria superseded). Named so the
  // control is honest about being a preview rather than silently inert.
  "w7.accept-maria": { l: "Accept Maria's request", info: "Legal and symmetric to accepting João — consumes Maria's stored terms and supersedes every other pending row (CS:733). The mirrored outcome set is not drawn; the storyboard walks the accept-João path. Garden-context claims live on the protocol console (W12/sb13).", calls: ["acceptClaim"] },
  "w7.decline-joao": { l: "Decline João's request (reason)", info: "Legal and symmetric to declining Maria — clears only João's row with a required reason (CS:734). The mirrored outcome set is not drawn; the storyboard walks the decline-Maria path.", calls: ["declineClaim"] },
  "w7.open-cycle-flow": { l: "Open this campaign", to: "screen:W11@campaign-allocation", info: "Runs the §6.10 open flow (allocation → open) for this Seeded Campaign. The pool is already Open here, so the flow uses its campaign path — no Ready-pool guard (CS:114)." },
  "w7.compost-pool": { l: "Compost pool", to: "screen:W7@compost-pool-confirm", info: "Opens a banner-only confirmation; compostPool stores no reason." },
  "w7.compost-dismiss": { l: "Keep pool closed", to: "screen:W7@pool-closed", info: "Closes the confirmation without archiving the pool." },
  "w7.compost-confirm": { l: "Compost pool (confirm)", to: "screen:W7@pool-composted", info: "compostPool archives the closed pool; reopenPool starts the next era (§4.1).", calls: ["compostPool"] },
  "w7.reopen-pool": { l: "Reopen pool", to: "screen:W7@reopen-confirm", info: "Opens the no-reason confirmation for reopenPool(poolId, false)." },
  "w7.reopen-dismiss": { l: "Keep composted", to: "screen:W7@pool-composted", info: "Closes the confirmation without changing the composted pool." },
  "w7.reopen-confirm": { l: "Reopen to Ready", to: "screen:W7@ready", info: "reopenPool(poolId, false) preserves history and returns Composted → Ready.", calls: ["reopenPool"] },
  "w7.resume-composted": { l: "Resume after cycle compost", to: "screen:W7@cycle-composted", info: "resumePool changes only Paused → Open; the cycle stays Composted.", calls: ["resumePool"] },
  "w7.view-public": { l: "View public", info: "The Garden view's stable action set (garden.utils.ts): opens the garden's public client page in a new tab — a separate context, so a new tab on purpose." },
  "w7.edit-garden": { l: "Edit garden", info: "The Garden view's stable primary (garden.utils.ts): opens the shipped garden settings dialog — name, banner, membership. The pool container's own settings stay on the Pool card in the rail." },
  "w7.commitment-row": { l: "Commitment row", to: "screen:W10", info: "Opens the commitment dialog." },
  "w7.stalled-row": { l: "Stalled commitment row", to: "screen:W10@accepted", info: "Evidence is in but the recipient cannot confirm — opens the detail whose three exits are mark ready, cancel, and send for confirmation (UX:294)." },
  "w7.fulfilled-row": { l: "Fulfilled team commitment row", to: "screen:W10@fulfilled", info: "A kept group commitment whose payment is still unplanned — opens the detail where recognition and payment planning begin (SS group-settlement amendment)." },
  "w7.value-row": { l: "Pre-acceptance commitment terms", to: "screen:W10@edit-declared-value", info: "Opens the steward-only records term editor while the Request is still unaccepted." },
  "w7.jump-recovery": { l: "Commitments needing recovery", to: "screen:W7@due-live", info: "Opens the commitment list filtered to the ones stalled or past due — the work only a steward can unstick." },
  "w7.filter-open": { l: "Open commitments", to: "screen:W7", info: "The default scope: everything live in this pool. Scopes are filters of ONE list, not separate cards (2026-08-16 round 6)." },
  "w7.filter-due": { l: "Past-due commitments", to: "screen:W7@due-live", info: "Past due but still live — expiry is an explicit permissionless act, so the row offers it here." },
  "w7.filter-lapsed": { l: "Lapsed commitments", to: "screen:W7@expiry-queue", info: "Already expired; the row's act is re-seeding it for the next cycle." },
  "w7.filter-ongoing": { l: "Ongoing Offers", to: "screen:W7@series-view", info: "Series-grouped standing offers — read-only context; rest/resume/retire stay with the holder in the client." },
  "w7.filter-confirmed": { l: "Confirmed commitments", info: "Kept commitments and their settled records; the same list under its closing scope." },
  "w7.external-row": { l: "Kept commitment, payout unrecorded", to: "screen:W10@external-fulfilled", info: "A commitment kept on the external-payout rail whose payout has not been recorded yet — opens the detail that owns recordConsiderationPaid." },
  "w7.jump-claims": { l: "Claims waiting", to: "screen:W7@claims", info: "Opens the steward-reviewed claims queue — a distinct triage task with its own view." },
  "w7.jump-payouts": { l: "Failed payouts", info: "Scrolls to declared rewards whose recorded payout failed; zero here means nothing is stuck." },
  "w7.activity-offer": { l: "Ana's new offer", to: "screen:W10", info: "A commitment arriving is the pool filling up — the feed's most common line once a season opens, and the one it never showed. Opens the offer itself." },
  "w7.all-members": { l: "See everyone in this pool", info: "The roster shows the most active members; the full list is the same rows, paged. Preview-only here — the point is that four rows never read as the whole pool when the header says 23 gardeners." },
  "w7.activity-claim": { l: "João's accepted request", to: "screen:W7@claim-outcomes", info: "Activity lines open what they describe — this one lands on the claim outcomes for that request (2026-08-16 round 5: an update you can't act on is a notification, not a workspace)." },
  "w7.activity-evidence": { l: "Maria's evidence", to: "screen:W10", info: "Opens the commitment the evidence was added to, with its evidence list and the acts available on it." },
  "w7.activity-work": { l: "Approved pruning session", to: "screen:HUBWORK@approved", info: "Opens the Hub's work queue at the decision that counted toward this commitment." },
  "w7.report-row": { l: "Cycle report", to: "screen:W26@review", info: "Reconciliation report (UX:75)." },
  "w7.seed": { l: "Seed a commitment", to: "screen:W8", info: "Console seeding — SeasonCampaign and steward-captured kinds exist only here (UX:154). Desktop puts creation in the header actions; below 1024px the same action rides the FabButton speed dial (W7M)." },
};

// ---------------------------------------------------------------------------
// W8 — seeding console (uiux-spec §6.3)
// ---------------------------------------------------------------------------

const W8_STATES = [
  ["step1", "1 · What"], ["step2", "2 · How much"], ["step3", "3 · Proof & confirmation"],
  ["step3-no-protocol", "3 · Proof (no protocol pool)"],
  ["step4", "4 · Review"], ["captured-for", "Captured for a member"],
  ["discard", "Discard changes?"],
] as const;
type W8State = (typeof W8_STATES)[number][0];

// Rule and reward were one step carrying four decisions — confirmers, threshold,
// claim mode, and the reward rail with its amount. They are two concerns and
// they split cleanly.
// The client composer's grammar, admin density (Decision Log #64 + 2026-08-16
// review point 12): what → how much → proof/protection → sectioned review,
// with the reward rail as the step-3 Advanced detour — same steps as the PWA,
// denser fields, never a parallel pattern.
const SEED_STEPS: FlowStep[] = [
  { title: "What", desc: "the kind of commitment, in its words" },
  { title: "How much", desc: "units, target, due, and the team" },
  { title: "Proof & confirmation", desc: "the protection step — who confirms, how it's claimed" },
  { title: "Review", desc: "sectioned check, then seed" },
];
// W9's two steps and W8@captured-for are one capture flow, so they share a rail.
export const CAPTURE_STEPS: FlowStep[] = [
  { title: "Who", desc: "the member you're recording for" },
  { title: "What kind", desc: "offer, request, or confirmation" },
  { title: "Record", desc: "check it, then record" },
];

const SEED_URL = "admin.greengoods.app/garden/pool/seed";

function w8(state: W8State): string {
  if (state === "discard")
    return deskWin(
      SEED_URL,
      discardDialog(w7Behind(), "garden", "w8.keep-editing", "w8.discard-confirm", "This commitment hasn't been seeded yet"),
    );

  if (state === "captured-for")
    return deskWin(
      "admin.greengoods.app/garden/pool/capture",
      flowDialog(w7Behind(), "garden", {
        context: "Rocinha · recording for Kwame",
        title: "Record on a member's behalf",
        steps: CAPTURE_STEPS,
        current: 2,
        body: `${banner("Recording for Kwame — recorded by the steward, the commitment stays the member's.", "stone", "hand-heart-line")}${kv("Kind", "Member offer · captured")}${kv("Title", "Compost workshop")}${kv("Reason", "recorded at the field gathering")}${disclosure(
          "Who the record names",
          "source · recorder · confirmer",
          `${kv("Commitment source", "Kwame — named as the record's creator")}${kv("Recorded by", "David — steward, kept as metadata beside the record")}${kv("Confirmed by", "the commitment's counterparty when it is kept — or a steward fallback with a recorded reason")}`,
          { open: true },
        )}`,
        back: "w8.back-capture",
        cancelHot: "w8.cancel-capture",
        next: hot("w8.record", btn("Record It", { kind: "pri" })),
      }),
    );

  const order: W8State[] = ["step1", "step2", "step3", "step4"];
  // The no-protocol variant is step 3's deployment-conditional twin — it keeps
  // step 3's slot so the progress row and back-navigation stay valid.
  const stepIx = order.indexOf(state === "step3-no-protocol" ? "step3" : state);
  let inner: string;
  let next: string;
  switch (state) {
    case "step2":
      inner = `${field("Unit", input("rides", { select: true }))}${field("Target", input("16"))}${field("Due", input("cycle deadline", { select: true }))}${hot("w8.contributor-policy", field("Contributor policy", radio([{ label: "Open team", meta: "eligible garden members may join" }, { label: "Lead-managed team", meta: "the lead or steward manages the roster", on: true }], { interactive: true, name: "seed-contributor-policy" })))}${banner("This campaign commitment is evidence-confirmed, so it has no garden-work action requirements or assessment gate.", "stone")}`;
      next = hot("w8.continue-requirements", btn("Continue", { kind: "pri" }));
      break;
    case "step3":
      inner = `${field("Confirmers", `<div class="arow"><div class="grow">Maria</div>${icon("close-line", "s")}</div><div class="arow"><div class="grow">João</div>${icon("close-line", "s")}</div>${hot("w8.add-address", btn("Add Address", { kind: "ghost", sm: true, icon: "add-line" }))}`)}
${field("Threshold", input("2 of 2", { select: true }))}
${banner("Choose up to the current confirmer limit — the console reads MAX_CONFIRMERS from the deployed module and blocks the name past it before review.", "stone", "information-line")}
${hot("w8.protocol-fallback", `<label class="arow" style="align-items:flex-start"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" checked style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">On for this pilot · usable only while nobody local can confirm, always with a recorded reason · every contributor remains excluded.</span></span></label>`)}
${hot("w8.claim-mode", field("Claim mode", radio([{ label: "Open", meta: "anyone in the garden may take it up", on: true }, { label: "Steward-reviewed", meta: "requests wait for review" }], { interactive: true, name: "claim-mode" })))}
${disclosure(
        "Advanced — declared reward",
        "External payout record",
        `${hot("w8.reward", field("Reward rail", radio([
  { label: "None", meta: "no declared reward" },
  { label: "External payout record", meta: "record a completed jar or treasury payout", on: true },
  { label: "Celo G$ settlement", meta: "queue delivery after fulfilment" },
], { interactive: true, name: "reward-rail" })))}
${field("External reward", `<div class="arow"><div class="grow">${input("Garden jar", { select: true })}</div><div class="grow">${input("20 DAI")}</div></div>`)}
${banner("One rail only. External payouts are recorded after the fact; Celo G$ support becomes a conserved provider-garden payout plan after fulfilment.", "stone")}`,
      )}`;
      next = hot("w8.continue-rule", btn("Continue", { kind: "pri" }));
      break;
    case "step3-no-protocol":
      inner = `${field("Confirmers", `<div class="arow"><div class="grow">Maria</div>${icon("close-line", "s")}</div><div class="arow"><div class="grow">João</div>${icon("close-line", "s")}</div>`)}
${field("Threshold", input("2 of 2", { select: true }))}
${banner("Choose up to the current confirmer limit — the console reads MAX_CONFIRMERS from the deployed module and blocks the name past it before review.", "stone", "information-line")}
<label class="arow" style="align-items:flex-start;opacity:.55"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" disabled><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">Unavailable on this deployment: no Green Goods protocol pool is registered yet. The review stores the fallback off and blocks until the named rule is reachable locally.</span></span></label>
${banner("Repair path: register the protocol pool (deployment operation), or name a reachable local confirmer group before seeding.", "amber", "error-warning-line")}
${hot("w8.claim-mode", field("Claim mode", radio([{ label: "Open", meta: "anyone in the garden may take it up", on: true }, { label: "Steward-reviewed", meta: "requests wait for review" }], { interactive: true, name: "w8-claim-mode-noproto" })))}`;
      next = hot("w8.continue-rule", btn("Continue", { kind: "pri" }));
      break;
    case "step4":
      // Sectioned review — the client composer's review anatomy (Decision Log
      // #63), grouped by the step that captured each fact.
      inner = `<div class="t-title">What</div>${kv("Kind", "Campaign commitment · the pool offers")}${kv("Title", "Market rides")}${kv("Cycle", "Season of First Rains")}
<div class="t-title">How much</div>${kv("Unit · target", "rides · 16")}${kv("Due", "cycle deadline")}${kv("Contributor policy", "Lead-managed team · lead or steward manages the roster")}
<div class="t-title">Proof & confirmation</div>${kv("Requirements", "evidence-confirmed")}${kv("Confirmers", "named group · 2 of 2")}${kv("Green Goods team fallback", "on (pilot default) · reason required if used")}${kv("Claim mode", "steward-reviewed")}
<div class="t-title">Declared reward</div>${kv("Rail", "External payout record")}${kv("Reward", "20 DAI · garden jar · reference only")}`;
      next = hot("w8.seed", btn("Seed This Commitment", { kind: "pri" }));
      break;
    default:
      inner = `${field("Type", radio([{ label: "Season / campaign commitment", meta: "the pool offers or requests", on: true }, { label: "Support / service" }, { label: "Garden work (impact)" }, { label: "Capture for a member", meta: "record a member's own commitment as their scribe", hot: "w8.kind-capture" }]))}
${field("Direction", radio([{ label: "The pool offers", on: true }, { label: "The pool requests" }]))}
${field("Cycle", input("Season: First Rains", { select: true }))}${field("Title", input("Market rides"))}`;
      next = hot("w8.continue-scope", btn("Continue", { kind: "pri" }));
  }
  return deskWin(
    SEED_URL,
    flowDialog(w7Behind(), "garden", {
      context: "Rocinha · Season of First Rains",
      title: "Seed a commitment",
      steps: SEED_STEPS,
      current: stepIx,
      body: inner,
      back: stepIx > 0 ? `w8.back-step${stepIx}` : undefined,
      cancelHot: "w8.cancel",
      next,
    }),
  );
}

const W8_HOTS: HifiDef["hots"] = {
  "w8.contributor-policy": { l: "Contributor policy", info: "Chooses the immutable Open or LeadManaged roster policy at seeding; the review repeats who may join or edit the team." },
  "w8.add-address": { l: "Add confirmer address", info: "Adds another named confirmer before the threshold is locked." },
  "w8.protocol-fallback": { l: "Green Goods team fallback", info: "Writes protocolFallbackEnabled — ON by default for the pilot (decision 2026-08-10, supersedes the 2026-08-02 off-by-default closure). Requires the registered protocol pool; usable only while the ordinary path is unreachable; never permits a contributor to confirm." },
  "w8.claim-mode": { l: "Claim mode", info: "Set at seeding; prefilled by context — protocol pool gated, garden campaigns open." },
  "w8.reward": { l: "Reward rail", info: "Exactly one rail is declared: none, an external payout record, or a Celo G$ settlement. External rewards are references only; G$ uses the settlement module." },
  "w8.kind-capture": { l: "Capture for a member", to: "screen:W9", info: "The What step's fourth kind hands off to the capture flow — recording a member's own commitment as their scribe (StewardCaptured, §6.5)." },
  "w8.continue-scope": { l: "Continue to how much", to: "screen:W8@step2", info: "What → how much (the composer's step grammar, Decision Log #64)." },
  "w8.continue-requirements": { l: "Continue to proof & confirmation", to: "screen:W8@step3", info: "How much → the protection step: who confirms, how it is claimed, with the reward rail as its Advanced detour." },
  "w8.continue-rule": { l: "Continue to review", to: "screen:W8@step4", info: "Proof & confirmation → the sectioned review." },
  "w8.back-step1": { l: "Back to what", to: "screen:W8", info: "Steps back with everything entered so far retained." },
  "w8.back-step2": { l: "Back to how much", to: "screen:W8@step2", info: "Steps back with everything entered so far retained." },
  "w8.back-step3": { l: "Back to proof & confirmation", to: "screen:W8@step3", info: "Steps back with everything entered so far retained." },
  "w8.back-capture": { l: "Back to capture kind", to: "screen:W9@capture-kind", info: "Steps back to the capture kind without discarding the chosen member." },
  "w8.cancel": { l: "Cancel seeding", to: "screen:W8@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard." },
  "w8.cancel-capture": { l: "Cancel capture", to: "screen:W9@discard", info: "The capture flow's own discard guard — Keep editing returns to the capture flow, not the seed console." },
  "w8.record": { l: "Record the captured commitment", to: "screen:W7", info: "StewardCaptured create — the member stays the social source; the steward is recorded as recordedBy (CS:730)." },
  "w8.keep-editing": { l: "Keep editing", to: "screen:W8", info: "Returns to the flow with entered values intact." },
  "w8.discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the flow and drops the unsaved seeded commitment." },
  "w8.seed": { l: "Seed this commitment", to: "screen:W7", info: "Console seeding — season/campaign and steward-captured kinds are created only here (UX:154).", calls: ["createCommitment"] },
};

// ---------------------------------------------------------------------------
// W9 — analog capture (uiux-spec §6.5)
// ---------------------------------------------------------------------------

const W9_STATES = [
  ["pick-member", "Who"], ["no-member", "Not a member yet"], ["capture-kind", "What kind"],
  ["capture-fallback", "A confirmation — steward fallback"], ["discard", "Discard changes?"],
] as const;
type W9State = (typeof W9_STATES)[number][0];

// The capture kinds: offers and requests stay the MEMBER'S own commitment (the
// steward is metadata); the third door is the steward's OWN fallback
// confirmation — never signed as the member, and completed INSIDE this flow's
// shell (interaction-patterns §2: a flow never changes shell mid-stream).
const w9KindRadio = (state: W9State) =>
  radio([
    { label: "Their offer", meta: "stays the member's own commitment", on: state === "capture-kind", hot: "w9.kind-social" },
    { label: "Their request", meta: "stays the member's own commitment", hot: "w9.kind-social" },
    { label: "A confirmation of their commitment", meta: "recorded as your own steward fallback — always carries a reason, never signed as the member", on: state === "capture-fallback", hot: "w9.kind-confirmation" },
  ], { interactive: true, name: "capture-kind" });

function w9(state: W9State): string {
  if (state === "discard")
    return deskWin(
      "admin.greengoods.app/garden/pool/capture",
      discardDialog(w7Behind(), "garden", "w9.keep-editing", "w9.discard-confirm", "This record hasn't been saved yet"),
    );
  const pick = state === "pick-member" || state === "no-member";
  const inner =
    state === "no-member"
      ? `${hot("w9.member", field("Member", input("Ifeoma", { icon: "search-line" })))}
${emptyState(
        "user-line",
        "Not a member yet",
        "Every recorded commitment belongs to a member address holding a garden role — capture needs membership first, a phone never. Invite them to the garden, then record.",
        hot("w9.invite", btn("Invite to the Garden", { kind: "sec", sm: true })),
      )}`
      : pick
        ? `${hot("w9.member", field("Member", input("Search members…", { placeholder: true, icon: "search-line" })))}
<div class="arow"><div class="grow"><b>Kwame</b> <span class="t-meta">joined May · 4 commitments kept</span></div>${hot("w9.choose", btn("Choose", { kind: "sec", sm: true }))}</div>`
        : state === "capture-fallback"
          ? `${field("Capture", w9KindRadio(state))}
${kv("Commitment", "Compost workshop — Kwame's offer, kept at the gathering")}${kv("Eligibility path", "Garden fallback · local Hats")}
${reasonChips(["Confirmed on a site visit", "Recipient has no device", "Agreed at the gathering"])}${field("Reason (required)", input("recipient has no device"))}
${banner("This one is yours, not theirs: the fallback confirmation is recorded by you as steward — the member timeline will read “confirmed by garden steward — fallback” with this reason. The commitment itself stays the member's.", "stone", "shield-check-line")}`
          : field("Capture", w9KindRadio(state));
  return deskWin(
    "admin.greengoods.app/garden/pool/capture",
    flowDialog(w7Behind(), "garden", {
      context: "Rocinha · on a member's behalf",
      title: "Record on a member's behalf",
      steps: CAPTURE_STEPS,
      current: pick ? 0 : state === "capture-fallback" ? 2 : 1,
      body: `${banner(
        "“Recorded by your steward on your behalf. The commitment stays yours.” — the member sees exactly this.",
        "stone",
        "hand-heart-line",
      )}${inner}`,
      back: pick ? undefined : state === "capture-fallback" ? "w9.back-kind" : "w9.back",
      cancelHot: "w9.cancel",
      // Choosing the member is the advance on step one, so the footer's forward
      // action stays disabled until one is picked. The fallback confirmation
      // completes INSIDE this shell — no jump to a different dialog.
      next: pick
        ? btn("Continue", { kind: "pri", disabled: true })
        : state === "capture-fallback"
          ? hot("w9.record-confirmation", btn("Confirm as Garden Fallback", { kind: "pri" }))
          : hot("w9.continue", btn("Continue", { kind: "pri" })),
    }),
  );
}

const W9_HOTS: HifiDef["hots"] = {
  "w9.member": { l: "Pick the member", info: "The member is the social source; the steward is only the recorder (UX:437). The picker lists garden members only — capture has no address-less path (open spec question, CS §12)." },
  "w9.choose": { l: "Choose Kwame", to: "screen:W9@capture-kind", info: "Selects Kwame as the member whose offer, request, or confirmation is being recorded." },
  "w9.invite": { l: "Invite to the garden", info: "Garden onboarding provisions the address and role that make someone a member; steward capture requires the member to exist first — the spec has no address-less member path (flagged as an open question in CS §12)." },
  "w9.kind-social": { l: "Their offer / their request", info: "Both stay the member's own commitment: creator = the member, the steward rides as recordedBy metadata (CS:730)." },
  "w9.kind-confirmation": { l: "A confirmation of their commitment", to: "screen:W9@capture-fallback", info: "Advances to the record step of this same flow — the steward's own fallback confirmation, attributed to the steward with PoolFallback/ProtocolFallback provenance and a required reason, never signed as the member." },
  "w9.continue": { l: "Continue to captured commitment", to: "screen:W8@captured-for", info: "Carries the selected member and capture kind into the seeding review." },
  "w9.record-confirmation": { l: "Confirm as garden fallback", to: "screen:W2@captured-fulfilled", info: "confirmFulfillmentAsFallback — current non-contributor Hat authority, required reason; the member timeline reads “confirmed by garden steward — fallback” with the reason. Completed inside the capture flow's own shell.", calls: ["confirmFulfillmentAsFallback"] },
  "w9.back": { l: "Back to member", to: "screen:W9", info: "Steps back to the member picker with the chosen member retained." },
  "w9.back-kind": { l: "Back to capture kind", to: "screen:W9@capture-kind", info: "Steps back to the kind choice with everything entered so far retained." },
  "w9.cancel": { l: "Cancel capture", to: "screen:W9@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w9.keep-editing": { l: "Keep editing", to: "screen:W9", info: "Returns to the capture flow with the entered values intact." },
  "w9.discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the capture flow and drops the unsaved record." },
};

// ---------------------------------------------------------------------------
// W10 — commitment dialog (uiux-spec §6.2/§6.7; MF13 dissolved)
// ---------------------------------------------------------------------------

const W10_STATES = [
  ["detail", "Detail"], ["detail-fallback-eligible", "Detail · ordinary confirmation unreachable"],
  ["external-fulfilled", "Fulfilled — external payout unpaid"],
  ["fulfilled", "Fulfilled — Celo plan needed"],
  ["contributor-allocation", "Contributor allocation"],
  ["edit-declared-value", "Edit declared value"],
  ["record-payout", "Record payout"],
  ["fallback-confirm", "Garden fallback confirm"],
  ["protocol-fallback-confirm", "Green Goods team fallback confirm"],
  ["raise-dispute", "Raise dispute"], ["resolve-dispute", "Resolve dispute"], ["attach-assessment", "Attach assessment"],
  ["accepted", "Accepted — evidence in"], ["mark-ready-override", "Mark ready (override)"],
  ["cancel", "Cancel commitment"], ["not-found", "Not found"],
  ["garden-ready", "Garden-provided — ready"], ["garden-fulfilled", "Garden-provided — fulfilled"],
  ["queue-settlement-garden", "Queue G$ to the garden"],
] as const;
type W10State = (typeof W10_STATES)[number][0];

// Dimmed garden Pool tab behind the dialog. Hotspot-free (foreign hotspot ids
// would fail the bidirectional-integrity check on W10's states).
const w10Behind = () =>
  adminCanvas("garden", "garden", {
    screenId: "W10",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Garden", description: "Season of First Rains — the pool's commitments." }),
    tabRail: tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3),
    body: acard(
      "Commitments",
      `<div class="arow"><div class="grow"><b>Prune the north beds</b> ${chip("Offer", "offer")} <span class="t-meta num">Maria · 6 h</span></div>${chip("Ready", "warn", { dot: true })}</div>
<div class="arow"><div class="grow"><b>Market ride</b> ${chip("Request", "request")} <span class="t-meta num">João · 1</span></div>${chip("Accepted", "request", { dot: true })}</div>`,
    ),
  });

const W10_TITLE: Record<W10State, string> = {
  detail: "Prune the north beds", "detail-fallback-eligible": "Prune the north beds",
  "external-fulfilled": "Prune the north beds", fulfilled: "Prune the north beds",
  "contributor-allocation": "Contributor recognition and payment",
  "edit-declared-value": "Edit declared value",
  accepted: "Repair tool handles", "record-payout": "Record payout",
  "fallback-confirm": "Confirm as garden fallback",
  "protocol-fallback-confirm": "Confirm for Green Goods team",
  "raise-dispute": "Raise dispute", "resolve-dispute": "Resolve dispute",
  "attach-assessment": "Attach assessment", "mark-ready-override": "Mark service ready with override",
  "garden-ready": "Methodology survey", "garden-fulfilled": "Methodology survey",
  "queue-settlement-garden": "Queue Celo settlement",
  cancel: "Cancel this service commitment", "not-found": "Commitment unavailable",
};

function w10(state: W10State): string {
  const cmChips = (...c: string[]) => `<div class="actrow" style="margin:0 0 2px">${c.join("")}</div>`;
  const dismiss = (label = "Cancel") => hot("w10.dismiss", btn(label, { kind: "ghost" }));
  let body: string;
  let actions: string;
  switch (state) {
    case "edit-declared-value":
      body = `${cmChips(chip("Request", "request"), chip("Offered", "offer", { dot: true }))}
${kv("Commitment", "Market ride · one trip")}
${field("Declared unit value", input("15"))}
${field("Value basis", input("G$ per ride"))}
${banner("This pre-acceptance records-only term does not move funds or set an exchange rate. Existing claims re-read the updated terms before a steward acts.", "stone", "information-line")}`;
      actions = `${dismiss()}${hot("w10.value-confirm", btn("Save Declared Value", { kind: "pri" }))}`;
      break;
    case "contributor-allocation":
      body = `${cmChips(chip("Fulfilled", "ok", { dot: true }), chip("Team commitment", "ink"))}
${banner("Start from the Hypercert gardener-share weights. Recognition remains an impact record; this editor prepares how the garden will pay its members.", "stone", "information-line")}
${kv("Declared support", "500 G$")}${kv("Garden retains", "100 G$ · operations and follow-up")}${kv("Available to contributors", "400 G$")}
${acard("Contributor split", `${kv("Maria · lead", "160 G$ · 40% recognition")}${kv("Ana", "140 G$ · 35% recognition")}${kv("Kwame", "100 G$ · 25% recognition")}`)}
${field("Reason for retained amount (required)", input("Garden operations and follow-up costs"))}
${banner("The garden Safe is the payer. Save keeps this editable as a draft; a separate Finalize action verifies both vector hashes and conservation before any child can dispatch.", "amber")}
<div class="actrow">${hot("w10.all-retained-preview", btn("Preview All-Retained Case", { kind: "ghost", sm: true }))}</div>`;
      actions = `${dismiss("Close")}${hot("w10.save-contributor-allocation", btn("Save Draft", { kind: "pri" }))}`;
      break;
    case "record-payout":
      body = `${kv("Reward rail", "External payout record")}${kv("Declared reward", "20 DAI · garden jar")}${field("Rail reference", input("cookie-jar withdrawal #128"))}${banner("Records that the external reward moved outside the app — no value moves here. Celo G$ rewards are delivered by the settlement queue instead.", "stone")}`;
      actions = `${dismiss()}${hot("w10.payout-confirm", btn("Record Payout", { kind: "pri" }))}`;
      break;
    case "external-fulfilled":
      body = `${cmChips(chip("Offer", "offer"), chip("Fulfilled", "ok", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 4)}
${kv("Reward rail", "Arbitrum external payout record")}${kv("Declared reward", "20 DAI · garden jar")}${kv("Payment", "unpaid")}
${banner("This rail records a jar or treasury payment that happens outside the app. It never opens the Celo contributor-allocation editor.", "stone")}`;
      actions = `${dismiss("Close")}${hot("w10.record-payout", btn("Record External Payout", { kind: "pri" }))}`;
      break;
    case "fallback-confirm":
      body = `${kv("Eligibility path", "Garden fallback · local Hats")}${reasonChips(["Confirmed on a site visit", "Recipient has no device", "Agreed at the gathering"])}${field("Reason (required)", input("confirmed on site visit"))}${banner("Every frozen team address is blocked. The member timeline will say “confirmed by garden steward — fallback” and show this reason.", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.fallback-confirm", btn("Confirm as Garden Fallback", { kind: "pri" }))}`;
      break;
    case "protocol-fallback-confirm":
      body = `${kv("Eligibility path", "Green Goods team fallback · enabled (pilot default)")}${reasonChips(["No eligible local confirmer", "Named group unreachable", "Recipient left the garden"])}${field("Reason (required)", input("no eligible local confirmer"))}${banner("Current protocol-garden Hats are checked at signing. Every contributor is blocked, and module-owner status alone grants no authority. The member timeline will say “confirmed by Green Goods team — fallback.”", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.protocol-fallback-confirm", btn("Confirm for Green Goods Team", { kind: "pri" }))}`;
      break;
    case "raise-dispute":
      body = `${reasonChips(["Delivery contested", "Details look wrong", "Needs a second look"])}${field("Reason (required)", input("delivery contested at the gathering"))}${banner("Freezes the commitment for review. Members see “under review by stewards” — never dispute language.", "stone")}`;
      actions = `${dismiss()}${hot("w10.dispute-confirm", btn("Raise Dispute", { kind: "pri" }))}`;
      break;
    case "resolve-dispute":
      body = `${kv("Your role", "Steward · contributor on this commitment")}${field("Outcome", hot("w10.resolve-options", radio([{ label: "Restore previous state", meta: "returns the exact stored state — no unit movement", on: true }, { label: "Cancelled" }, { label: "Expired" }], { interactive: true, name: "resolution" })))}${reasonChips(["Resolved at the gathering", "Work completed since", "Agreed to release it"])}${field("Reason (required)", input("resolved at the weekly gathering"))}${banner("Fulfilled is unavailable because your connected steward address is on the contributor roster. A non-contributor steward may see that outcome only when its policy and verified-credit gates pass. Every available outcome renders its reason in the member timeline.", "stone")}`;
      actions = `${dismiss()}${hot("w10.resolve", btn("Resolve", { kind: "pri" }))}`;
      break;
    case "attach-assessment":
      body = `${field("Assessment", hot("w10.assessment-pick", radio([{ label: "Baseline — AGRO — Jul 2", meta: "v3 · provider garden", on: true }, { label: "Delta — AGRO+EDU — Jul 9", meta: "v3" }], { interactive: true, name: "assessment" })))}${banner("Only current assessments recorded for the provider garden appear here.", "stone")}`;
      actions = `${dismiss()}${hot("w10.attach", btn("Attach", { kind: "pri" }))}`;
      break;
    case "accepted":
      // Evidence-only, pre-ready: the Send-for-confirmation / Mark-ready-override
      // twin (UX:294) plus the steward cancel (MF-2b).
      // Footer is dismissive + confirming only (M3 basic dialog). The two
      // alternatives sit in the body beside the consequence that distinguishes
      // them: an irreversible cancel must never occupy the left footer slot,
      // which means "close this dialog" in every other W10 state — and the
      // sentence that separates the three used to sit below the fold.
      body = `${cmChips(chip("Offer", "offer"), chip("Accepted", "request", { dot: true }), chip("Evidence in", "warn", { dot: true }))}
${banner("Evidence is in. Send it to the recipient, who confirms the commitment was kept.", "stone")}
${kv("Maria → João", "1 repair session · due Aug 12")}
${stages(["Offered", "Accepted", "Evidence in", "Ready", "Fulfilled"], 2)}
${kv("Kind", "Support · evidence-only")}${kv("Evidence", "2 items · photo, note")}${kv("Provider", "Maria — cannot confirm")}
<div class="arow"><div class="grow"><b>Recipient can't confirm?</b> <span class="t-meta">A steward can mark it ready with a recorded reason.</span></div>${hot("w10.mark-override", btn("Mark Ready…", { kind: "sec", sm: true }))}</div>
<div class="arow"><div class="grow"><b>Called off?</b> <span class="t-meta">Cancelling releases the committed units and records why.</span></div>${hot("w10.cancel", btn("Cancel Commitment…", { kind: "danger", sm: true }))}</div>`;
      actions = `${dismiss()}${hot("w10.send-confirmation", btn("Send for Confirmation", { kind: "pri" }))}`;
      break;
    case "mark-ready-override":
      body = `${reasonChips(["Checked in the field", "Recipient has no device", "Agreed at the gathering"])}${field("Reason (required)", input("field-verified at the weekly gathering"))}${banner("Steward override — separate from Send for confirmation. Moves the commitment to Ready without the recipient's send; the reason is stored and shows in the member timeline.", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.override-confirm", btn("Mark Ready", { kind: "pri" }))}`;
      break;
    case "cancel":
      body = `${reasonChips(["Withdrawn by agreement", "No longer needed", "Duplicate commitment"])}${field("Reason (required)", input("withdrawn by agreement at the gathering"))}${banner("Steward cancel — Accepted becomes Cancelled with a recorded reason. Committed units release; the member sees the reason, never “cancelled” alone.", "stone", "error-warning-line")}`;
      actions = `${dismiss("Keep commitment")}${hot("w10.cancel-confirm", btn("Cancel Commitment", { kind: "danger" }))}`;
      break;
    case "garden-ready":
      // A garden-claimed protocol commitment: the PROVIDER is a GardenAccount, so
      // the provider-exclusion rule applies to the garden, not to a person.
      body = `${cmChips(chip("Protocol", "ink"), chip("Request", "request"), chip("Ready", "warn", { dot: true }))}
${kv("Protocol pool → Awka Hub", "1 survey · due Aug 12")}
${stages(["Requested", "Accepted", "Evidence in", "Ready", "Fulfilled"], 3)}
${kv("Evidence", "2 items · survey sheet, note")}${kv("Provider", "Awka Hub (garden) — cannot confirm")}${kv("Eligible", "you ○ · Dana ○ (2 of 2 protocol stewards)")}
${kv("Reward rail", "Celo G$ settlement")}${kv("Support", "25 G$ · payer-garden payout plan · unqueued")}`;
      actions = `${dismiss("Close")}${hot("w10.garden-confirm", btn("Confirm — Commitment Kept", { kind: "pri" }))}`;
      break;
    case "garden-fulfilled":
      body = `${cmChips(chip("Protocol", "ink"), chip("Fulfilled", "ok", { dot: true }))}
${kv("Protocol pool → Awka Hub", "1 survey")}
${stages(["Requested", "Accepted", "Evidence in", "Ready", "Fulfilled"], 4)}
${kv("Confirmed", "2 of 2 protocol stewards · Jul 12")}${kv("Provider garden", "Awka Hub — its gardeners worked and proved it")}
${kv("Reward rail", "Celo G$ settlement")}${kv("Support", "25 G$ · contributor allocation required")}
${banner("Recognition stays attached to Awka Hub's delivery team. Its provider-garden Safe retains the declared garden amount and pays contributors; any protocol-to-garden funding is a separate route.", "stone")}`;
      actions = `${dismiss("Close")}${hot("w10.queue-settlement-garden", btn("Create Payout Draft…", { kind: "pri" }))}`;
      break;
    case "queue-settlement-garden":
      body = `${kv("Consideration rail", "Celo G$ settlement")}${kv("Declared support", "25 G$")}${kv("Payer", "Awka Hub · payer garden Safe")}${kv("Garden retains", "5 G$")}${kv("Contributor children", "Maria 12 G$ · João 8 G$")}${banner(
        "Saving creates an editable draft and derives payment weights from these amounts. Finalization separately verifies recognition, conservation, and canonical recipients before any child can dispatch.",
        "stone",
      )}`;
      actions = `${dismiss()}${hot("w10.queue-settlement-garden-confirm", btn("Save Draft", { kind: "pri" }))}`;
      break;
    case "not-found":
      body = emptyState(
        "error-warning-line",
        "This commitment couldn't be loaded",
        "It may be mid-sync, or the link is stale. Retry, or return to the pool to pick it again.",
        hot("w10.retry", btn("Retry", { kind: "sec", sm: true })),
      );
      actions = hot("w10.back-pool", btn("Back to Pool", { kind: "ghost" }));
      break;
    case "detail-fallback-eligible":
      body = `${cmChips(chip("Offer", "offer"), chip("Ready", "warn", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12 · open claim")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 3)}
${kv("Evidence", "2 items · photo, note")}${kv("Linked work", "Pruning session (approved)")}${kv("Provider", "Maria — cannot confirm")}${kv("Ordinary path", "Unreachable · no eligible named/default confirmer remains")}
${banner("The indexed eligibility check found that the ordinary path cannot reach its threshold. A current non-contributor garden steward may use fallback with a required reason.", "amber", "shield-check-line")}
${kv("Reward rail", "External payout record")}${kv("Reward", "20 DAI · garden jar · unpaid — recordable once confirmed")}`;
      actions = `${dismiss("Close")}${hot("w10.fallback", btn("Confirm as garden fallback…", { kind: "sec" }))}${hot("w10.raise", btn("Raise Dispute…", { kind: "sec" }))}`;
      break;
    case "fulfilled":
      // Recording a payout is a Fulfilled-only act (uiux-spec §6.7). Giving it
      // its own state keeps it off the Ready detail and makes sb10's declared
      // "Fulfilled" step show a screen that agrees with the caption.
      body = `${cmChips(chip("Offer", "offer"), chip("Fulfilled", "ok", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 4)}
${kv("Confirmed", "João · Jul 12 · 2 of 2")}${kv("Provider", "Maria — cannot confirm")}
${kv("Team", "Maria · lead; Ana and Kwame · contributors")}${kv("Recognition", "40% · 35% · 25% from approved contribution")}
${kv("Reward rail", "Celo G$ settlement")}${kv("Declared support", "500 G$ · payer-garden Safe")}${kv("Payment", "plan not yet saved")}
${banner("The garden receives the commitment support, retains an explicit amount, then pays contributors through child deliveries.", "stone")}`;
      actions = `${dismiss("Close")}${hot("w10.allocate-contributors", btn("Set Recognition and Payment…", { kind: "pri" }))}`;
      break;
    default:
      body = `${cmChips(chip("Offer", "offer"), chip("Ready", "warn", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12 · open claim")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 3)}
${kv("Evidence", "2 items · photo, note")}${kv("Linked work", "Pruning session (approved)")}${kv("Provider", "Maria — cannot confirm")}${kv("Eligible", "João ✓ · Ana ○ · you ○ (1 of 2 required)")}
${kv("Reward rail", "External payout record")}${kv("Reward", "20 DAI · garden jar · unpaid — recordable once confirmed")}`;
      // An inspection state legitimately has no dominant act, but it still needs
      // a way out that is not the X: both remaining controls open further
      // dialogs, so neither can double as the dismiss.
      actions = `${dismiss("Close")}${hot("w10.raise", btn("Raise Dispute…", { kind: "sec" }))}`;
  }
  return deskWin(
    "admin.greengoods.app/garden/pool",
    adminDialogM3(w10Behind(), "garden", { title: W10_TITLE[state], body, actions, closeHot: "w10.dismiss" }),
  );
}

const W10_HOTS: HifiDef["hots"] = {
  "w10.value-confirm": {
    l: "Save declared value",
    to: "screen:W7@open",
    info: "setDeclaredValue is a steward-only pre-acceptance edit. It records the exact value/basis pair and emits ValueDeclared without moving value.",
    calls: ["setDeclaredValue"],
  },
  "w10.allocate-contributors": { l: "Set recognition and payment", to: "screen:W10@contributor-allocation", info: "Opens the steward editor with Hypercert recognition weights as the default payment weights." },
  "w10.save-contributor-allocation": { l: "Create payout draft", to: "screen:W21@payout-plan-edit", info: "Creates the stable recognition-bound Draft with its canonical default, then opens the separate recoverable amount-vector edit. If the edit transaction is rejected, retry only setContributorPayouts; never recreate the parent.", calls: ["createCommitmentPayoutPlan"] },
  "w10.all-retained-preview": { l: "Preview all-retained case", to: "screen:W21@payout-retained", info: "Shows the zero-child path: finalization completes the plan without CCIP or a self-transfer." },
  "w10.record-payout": { l: "Record payout", to: "screen:W10@record-payout", info: "ArbitrumExternal only: AdminConfirmDialog captures the executed rail reference → ConsiderationPaid; no value moves here." },
  "w10.payout-confirm": { l: "Record payout (confirm)", to: "screen:W7", info: "ArbitrumExternal only: recordConsiderationPaid → ConsiderationPaid, then back to the pool workspace; the member's row flips to reward released on their side. The dry run rehearses this with a real minimal Cookie Jar withdrawal (register #34h).", calls: ["recordConsiderationPaid"] },
  "w10.fallback": { l: "Confirm as garden fallback", to: "screen:W10@fallback-confirm", info: "Current local-garden Hats only; mandatory reason; every contributor is blocked (CS §6.1)." },
  "w10.fallback-confirm": { l: "Garden fallback (confirm)", to: "screen:W2@fulfilled-pool-fallback", info: "confirmFulfillmentAsFallback emits the caller, PoolFallback, and required reason; the member timeline renders that exact provenance.", calls: ["confirmFulfillmentAsFallback"] },
  "w10.protocol-fallback-confirm": {
    l: "Green Goods team fallback (confirm)",
    to: "screen:W2@fulfilled-protocol-fallback",
    info: "For a fallback-enabled commitment (pilot default on), confirmFulfillmentAsFallback emits the caller, ProtocolFallback, and required reason. Current protocol-pool Hats are required; module ownership alone is rejected.",
    calls: ["confirmFulfillmentAsFallback"],
    facts: { commitment: "ReadyForConfirmation", pool: "Open", cycle: "Open", kind: "DomainImpact" },
  },
  "w10.raise": { l: "Raise dispute", to: "screen:W10@raise-dispute", info: "Steward dispute entry, Accepted through Expired (UX:300)." },
  "w10.dispute-confirm": { l: "Raise dispute (confirm)", to: "screen:W2@disputed", info: "raiseDispute stores preDisputeState; member copy stays “under review by stewards” (CS:143).", calls: ["raiseDispute"] },
  "w10.resolve-options": { l: "Resolution outcomes", info: "This contributor-steward fixture exposes RestorePrevious / Cancelled / Expired only. Fulfilled is hidden because the on-chain SelfConfirmation guard would reject this actor; eligible non-contributor stewards receive the separately gated Fulfilled option (CS:144)." },
  "w10.resolve": { l: "Resolve", to: "screen:W2@ready-confirmer", info: "This fixture selects RestorePrevious, returning the exact stored ReadyForConfirmation state with no unit movement (LAP:186).", calls: ["resolveDispute"], resultFacts: { commitment: "ReadyForConfirmation" } },
  "w10.assessment-pick": { l: "Assessment picker", info: "Attach re-runs the auto-Ready check → CommitmentReadyForConfirmation (CS:235)." },
  "w10.attach": { l: "Attach assessment", to: "screen:W2@ready-confirmer", info: "attachAssessment → auto-Ready re-run (UX:287). Library-only state (2026-08-16 decision 4): the per-commitment assessment gate stays Hub/evaluator-side for v1, so no steward journey walks this — drawn for on-chain state coverage (the module call exists, ICommitmentPoolingModule:930).", calls: ["attachAssessment"] },
  "w10.send-confirmation": { l: "Send for confirmation", to: "screen:W2@support-ready-confirmer", info: "Evidence-only records expose Send for confirmation to eligible creator/counterparty/steward; the member result keeps the SupportService cast (UX:294).", calls: ["submitForConfirmation"] },
  "w10.mark-override": { l: "Mark ready with override", to: "screen:W10@mark-ready-override", info: "Steward-only, separate from Send for confirmation; requires a visible reason (UX:294)." },
  "w10.override-confirm": { l: "Mark ready (confirm)", to: "screen:W2@support-ready-confirmer", info: "Records the override reason; the member timeline keeps the service identity and shows the steward marked it ready (UX:294).", calls: ["markReadyForConfirmation"] },
  "w10.cancel": { l: "Cancel commitment (steward)", to: "screen:W10@cancel", info: "MF-2b: steward cancel of an Accepted (or §4.1 Paused) commitment — cancelCommitment (CS:745; AM:36-37)." },
  "w10.cancel-confirm": { l: "Cancel commitment (confirm)", to: "screen:W2@support-cancelled", info: "Accepted → Cancelled with a recorded reason; units release; the member result keeps the SupportService cast and its reason (CS:745).", calls: ["cancelCommitment"] },
  "w10.garden-confirm": { l: "Confirm — commitment kept", to: "screen:W10@garden-fulfilled", info: "confirmFulfillment by a named protocol steward; takes no reason. Every frozen member of the providing garden's delivery team is excluded (CS §6.1).", calls: ["confirmFulfillment"] },
  "w10.queue-settlement-garden": { l: "Set contributor payout", to: "screen:W10@queue-settlement-garden", info: "CeloSettlement rail on a garden-claimed commitment; recognition weights seed a provider-garden-funded payout plan, while Record payout remains unavailable (SS §3)." },
  "w10.queue-settlement-garden-confirm": {
    l: "Create payout draft",
    to: "screen:W21@payout-plan-edit",
    info: "Creates the stable provider-garden Draft with its canonical recognition-bound default, then opens the separate amount-vector edit. A failed or rejected edit resumes here and retries only setContributorPayouts; finalization remains separate (SS §3.1.3).",
    calls: ["createCommitmentPayoutPlan"],
    facts: { commitment: "Fulfilled", settlementAccount: "Active" },
  },
  "w10.dismiss": { l: "Close dialog", to: "screen:W10", info: "Closes without applying the pending steward action." },
  "w10.retry": { l: "Retry commitment read", to: "screen:W10", info: "Retries the commitment read; the sentinel state never renders as a lifecycle chip." },
  "w10.back-pool": { l: "Back to pool", to: "screen:W7", info: "Returns to the scoped garden pool after a missing record." },
};

// ---------------------------------------------------------------------------
// W11 — open-cycle allocation policy (uiux-spec §6.10)
// ---------------------------------------------------------------------------

const W11_STATES = [
  ["setup-how", "Set up · 1 · How it works"], ["setup-how-blocked", "Set up · 1 · assessment needed"],
  ["setup-season", "Set up · 2 · The season"], ["setup-split", "Set up · 3 · The split"],
  ["setup-open", "Set up · 4 · Open"], ["setup-discard", "Set up · discard changes?"],
  ["details", "1 · The season"], ["presets", "2 · The split"], ["invalid-sum", "The split doesn't total 100%"], ["guard", "3 · Open"],
  ["recognition-policy", "How gardeners share their part"],
  ["campaign-details", "1 · The campaign"], ["campaign-allocation", "Campaign · the split"], ["campaign-open", "Campaign · open"],
  ["discard", "Discard changes?"], ["campaign-discard", "Campaign · discard changes?"],
] as const;
type W11State = (typeof W11_STATES)[number][0];

// Starting a season or campaign is ONE flow in ONE shell (interaction-patterns
// §2 — the old design opened a small details dialog, then jumped into this
// wizard): the season step records the cycle (seedCycle), the split sets the
// allocation, open carries the Ready-pool guard (register #34a).
const CYCLE_STEPS: FlowStep[] = [
  { title: "The season", desc: "name it and set its window" },
  { title: "The split", desc: "how each kept commitment divides" },
  { title: "Open", desc: "check it, then open the season to the garden" },
];

// FIRST RUN — one flow that absorbs the whole setup sequence (2026-08-16 round
// 3). A steward used to perform four separate console acts in state-machine
// vocabulary ("Edit readiness" → "Mark pool ready" → "Start a season" →
// "Open pool and cycle"); Tesler's Law says the system carries that, not them.
// Nothing is written until the last step, which submits the ordered writes.
const SETUP_STEPS: FlowStep[] = [
  { title: "How it works", desc: "what this pool is for" },
  { title: "The season", desc: "name it and set its window" },
  { title: "The split", desc: "how each kept commitment divides" },
  { title: "Open", desc: "check it, then open" },
];

// Two entry contexts, because the guard prompt is only TRUE from one of them.
// The season path runs from a Ready pool (sb9a), where opening the cycle opens
// the pool with it. The campaign path runs from the Cycles console of a pool
// that is ALREADY Open, so it must not claim the pool is merely Ready — and it
// names the campaign, not the Season, in its context line.
const w11IsCampaign = (state: W11State) => state.startsWith("campaign");
const W11_CONTEXT = (state: W11State) =>
  w11IsCampaign(state) ? "Rocinha · Seedling swap (Campaign)" : "Rocinha · Season of First Rains";

// The six-role split editor, shared by the setup and season flows.
const w11SplitRows = (bad: boolean) =>
  [
    ["Gardeners", bad ? "64" : "60"], ["Treasury", "15"], ["Steward", "10"],
    ["Evaluator", "5"], ["Community", "5"], ["Funder", "5"],
  ]
    .map(([l, v], i) => `<div class="arow"><div class="grow" id="s${i}">${l}</div>${input(v, { labelledBy: `s${i}` })}<span class="t-meta">%</span></div>`)
    .join("");

function w11(state: W11State): string {
  if (state === "setup-discard")
    return deskWin(
      "admin.greengoods.app/garden/pool/setup",
      discardDialog(w7Behind("ready"), "garden", "w11.setup-keep-editing", "w11.setup-discard-confirm", "Nothing has been set up yet"),
    );
  if (state.startsWith("setup-")) {
    const blocked = state === "setup-how-blocked";
    const stepIx = state === "setup-season" ? 1 : state === "setup-split" ? 2 : state === "setup-open" ? 3 : 0;
    let inner: string;
    let next: string;
    let back: string | undefined;
    if (state === "setup-season") {
      inner = `${field("Name", input("Season of First Rains"))}${field("Runs through", input("Aug 30"))}
${banner("One season runs at a time. Shorter campaigns can run beside it whenever you need them.", "stone")}`;
      back = "w11.setup-back-how";
      next = hot("w11.setup-continue-season", btn("Continue", { kind: "pri" }));
    } else if (state === "setup-split") {
      inner = `<div class="t-meta">When a commitment is kept, its units divide across six roles. The standard split is already applied.</div>
${hot("w11.setup-preset", field("Preset", radio([{ label: "Garden-led (standard)", on: true }, { label: "Balanced" }, { label: "Custom" }], { interactive: true, name: "setup-preset" })))}
${w11SplitRows(false)}<div class="quietok">${icon("check-line")}total: 100%</div>
${kv("Gardeners' part", "shared 35% for taking part · 65% for proven contribution")}
${banner("The standard sharing applies to this first season. You can adjust it when you start the next one.", "stone")}`;
      back = "w11.setup-back-season";
      next = hot("w11.setup-continue-split", btn("Continue", { kind: "pri" }));
    } else if (state === "setup-open") {
      inner = `<div class="t-title">How it works</div>${kv("What this pool is for", "neighbourly help in Rocinha — rides, tools, workshops, garden work")}${kv("Commitment limit", "24 at once per person")}${kv("Starting assessment", "recorded ✓")}
<div class="t-title">The season</div>${kv("Name", "Season of First Rains")}${kv("Runs through", "Aug 30")}
<div class="t-title">The split</div>${kv("Six roles", "Gardeners 60 · Treasury 15 · Steward 10 · Evaluator 5 · Community 5 · Funder 5")}${kv("Gardeners' part", "35% taking part · 65% proven contribution")}
${banner("Opening records how this pool works, then opens the pool and its first season together. Neighbours can make and take up commitments straight away.", "stone", "information-line")}`;
      back = "w11.setup-back-split";
      next = hot("w11.setup-open-all", btn("Open Season", { kind: "pri" }));
    } else {
      inner = `${field("What this pool is for", input("Neighbours in Rocinha offer help and ask for it — rides, tools, workshops, and garden work. Commitments are kept in the open and confirmed by the person they were made to.", { textarea: true }))}
${
        blocked
          ? `${banner("This garden needs its starting assessment before commitments can open. An evaluator records it from the Hub — you can come back to this in one step.", "amber", "error-warning-line")}<div class="actrow">${hot("w11.setup-goto-assess", btn("Go to Assessments", { kind: "sec", sm: true }))}</div>`
          : `<div class="quietok">${icon("check-line")}Starting assessment recorded — nothing else is waiting.</div>`
      }
${disclosure(
        "Advanced",
        "commitment limit",
        `${field("How many commitments one person can hold at once", input("24"))}<div class="t-meta">A safety limit so nobody over-commits. 24 suits most gardens.</div>`,
      )}
${banner("Nothing is recorded yet — the last step shows exactly what opens.", "stone")}`;
      next = blocked
        ? btn("Continue", { kind: "pri", disabled: true })
        : hot("w11.setup-continue-how", btn("Continue", { kind: "pri" }));
    }
    return deskWin(
      "admin.greengoods.app/garden/pool/setup",
      flowDialog(w7Behind("ready"), "garden", {
        context: "Rocinha · first season",
        title: "Set up commitments",
        steps: SETUP_STEPS,
        current: stepIx,
        body: inner,
        back,
        cancelHot: "w11.setup-cancel",
        next,
      }),
    );
  }
  if (state === "discard" || state === "campaign-discard")
    return deskWin(
      "admin.greengoods.app/garden/pool/open-cycle",
      discardDialog(
        w7Behind(state === "campaign-discard" ? "open" : "ready"),
        "garden",
        state === "campaign-discard" ? "w11.campaign-keep-editing" : "w11.keep-editing",
        state === "campaign-discard" ? "w11.campaign-discard-confirm" : "w11.discard-confirm",
        "This cycle hasn't been opened yet",
      ),
    );
  if (state === "details" || state === "campaign-details") {
    const campaign = state === "campaign-details";
    return deskWin(
      "admin.greengoods.app/garden/pool/open-cycle",
      flowDialog(w7Behind(campaign ? "open" : "ready"), "garden", {
        context: campaign ? "Rocinha · new campaign" : "Rocinha · new season",
        title: campaign ? "Start a campaign" : "Start a season",
        steps: CYCLE_STEPS,
        current: 0,
        body: `${field(
          "Type",
          radio(
            [
              { label: "Season", meta: "the pool's main rhythm — one at a time", on: !campaign },
              { label: "Campaign", meta: "a focused push — any number may run beside the season", on: campaign },
            ],
            { interactive: true, name: campaign ? "campaign-cycle-type" : "cycle-type" },
          ),
        )}${field("Name", input(campaign ? "Seedling swap" : "Season of First Rains"))}${field("Runs through", input(campaign ? "Sep 15" : "Aug 30"))}${banner(
          campaign
            ? "Campaigns run beside the season and never replace it. Continuing records the campaign; allocation and opening follow in the next steps."
            : "Continuing records the season first — seedCycle stores no reason. Allocation and opening follow in the next steps.",
          "stone",
        )}`,
        cancelHot: campaign ? "w11.campaign-cancel" : "w11.cancel",
        next: campaign
          ? hot("w11.campaign-details-continue", btn("Continue", { kind: "pri" }))
          : hot("w11.details-continue", btn("Continue", { kind: "pri" })),
      }),
    );
  }
  if (state === "guard" || state === "campaign-open") {
    const campaign = state === "campaign-open";
    const body = campaign
      ? `${banner("The pool is already open, so opening this campaign only starts the campaign — it runs alongside the open Season.", "stone", "information-line")}${kv("Pool", "Open")}${kv("Cycle", "Seedling swap · Campaign")}${kv("Runs alongside", "Season of First Rains")}${kv("Allocation", "Gardeners 60 · Treasury 15 · Steward 10 · Evaluator 5 · Community 5 · Funder 5")}${kv("Recognition policy", "35% equal participation · 65% verified contribution")}`
      // The last step used to open with the pool's state and a list of
      // percentages — it read as committing an allocation policy. What actually
      // happens is that the garden gets a season it can commitment into, so that
      // is what it says first; the policy stays right below it, unchanged.
      : `${banner("Opening tells the whole garden the season has begun. From that moment neighbors can offer help, ask for it, and take each other up — nobody can commit until then.", "stone", "seedling-line")}${kv("What opens", "Season of First Rains · runs Aug 1 – Aug 30")}${kv("Who it opens to", "23 gardeners in Rocinha")}${kv("Pool", "Ready — opens with the season")}${kv("Allocation", "Gardeners 60 · Treasury 15 · Steward 10 · Evaluator 5 · Community 5 · Funder 5")}${kv("Recognition policy", "35% equal participation · 65% verified contribution")}`;
    const orderedCalls = campaign
      ? ""
      : banner("This confirmation submits two ordered writes: openPool(poolId), then openCycle(cycleId, allocation, recognitionPolicy).", "stone");
    return deskWin(
      "admin.greengoods.app/garden/pool/open-cycle",
      flowDialog(w7Behind(campaign ? "open" : "ready"), "garden", {
        context: W11_CONTEXT(state),
        title: campaign ? "Start a campaign" : "Start a season",
        steps: CYCLE_STEPS,
        current: 2,
        body: `${body}${orderedCalls}`,
        back: campaign ? "w11.campaign-back" : "w11.back",
        cancelHot: campaign ? "w11.campaign-cancel" : "w11.cancel",
        next: campaign
          ? hot("w11.campaign-open-cycle", btn("Open Campaign", { kind: "pri" }))
          : hot("w11.open-cycle", btn("Open to the Garden", { kind: "pri" })),
      }),
    );
  }

  // The recognition editor is a detour WITHIN the allocation step — same
  // title, same two-step rail, step 1 still current. The rail never changes
  // mid-flow (2026-08-16 review decision; this screen once swapped in its own
  // one-item "Policy" rail inside identical chrome).
  if (state === "recognition-policy")
    return deskWin(
      "admin.greengoods.app/garden/pool/open-cycle",
      flowDialog(w7Behind("ready"), "garden", {
        context: W11_CONTEXT(state),
        title: "Start a season",
        steps: CYCLE_STEPS,
        current: 1,
        body: `<div class="t-title">Gardener recognition</div>
${banner("Part of this allocation step: every fulfilled commitment receives an equal commitment budget inside the gardener class. Choose how each commitment shares that budget between equal participation and verified contribution.", "stone", "information-line")}
${field("Equal participation", input("35"))}${field("Verified contribution", input("65"))}
${kv("Policy total", "100% · valid")}${kv("Commitment budget", "equal across fulfilled commitments")}
${kv("No eligible contributors", "certificate expansion blocked · no lead fallback")}${kv("Repair", "proof link + steward reason + before/after audit")}
${banner("The two editable fields are stored as 3,500 / 6,500 bps when the cycle opens. Recognition weights are the default for payment, but do not themselves move funds.", "amber")}`,
        back: "w11.recognition-done",
        cancelHot: "w11.cancel",
        next: hot("w11.recognition-done", btn("Use This Policy", { kind: "pri" })),
      }),
    );

  const bad = state === "invalid-sum";
  const rows = [
    ["Gardeners", bad ? "64" : "60"], ["Treasury", "15"], ["Steward", "10"],
    ["Evaluator", "5"], ["Community", "5"], ["Funder", "5"],
  ]
    .map(([l, v], i) => `<div class="arow"><div class="grow" id="a${i}">${l}</div>${input(v, { labelledBy: `a${i}` })}<span class="t-meta">%</span></div>`)
    .join("");
  const sum = bad
    ? banner("Shares must total exactly 100% — currently 104%.", "error", "error-warning-line")
    : `<div class="quietok">${icon("check-line")}total: 100%</div>`;
  const inner = `<div class="t-meta">Set how each fulfilled commitment's units split across the six roles.</div>
${banner("The standard Garden-led split arrives already applied — most seasons continue straight through. Adjust a share only when this season is genuinely different.", "stone", "checkbox-circle-fill")}
${hot("w11.presets", field("Preset", radio([{ label: "Garden-led (default)", on: true }, { label: "Balanced" }, { label: "Custom" }], { interactive: true, name: "allocation-preset" })))}
${rows}${sum}
${hot("w11.recognition", field("Gardener recognition", `<div class="arow"><div class="grow">${input("35")}<span class="t-meta">% equal</span></div><div class="grow">${input("65")}<span class="t-meta">% verified</span></div></div><div class="quietok">${icon("check-line")}total: 100%</div>`))}
${banner("Treasury is at the 15% guidance floor. This split is locked when the cycle opens and reads back unchanged at close.", "stone")}`;
  const campaign = w11IsCampaign(state);
  return deskWin(
    "admin.greengoods.app/garden/pool/open-cycle",
    flowDialog(w7Behind(campaign ? "open" : "ready"), "garden", {
      context: W11_CONTEXT(state),
      title: campaign ? "Start a campaign" : "Start a season",
      steps: CYCLE_STEPS,
      current: 1,
      body: inner,
      cancelHot: campaign ? "w11.campaign-cancel" : "w11.cancel",
      next: bad
        ? btn("Continue", { kind: "pri", disabled: true })
        : campaign
          ? hot("w11.campaign-continue", btn("Continue", { kind: "pri" }))
          : hot("w11.continue", btn("Continue", { kind: "pri" })),
    }),
  );
}

const W11_HOTS: HifiDef["hots"] = {
  // ---- first-run setup flow ----
  "w11.setup-continue-how": { l: "Continue to the season", to: "screen:W11@setup-season", info: "How it works → the season. Nothing is written yet: the agreement, limit, and season are all submitted at the last step." },
  "w11.setup-continue-season": { l: "Continue to the split", to: "screen:W11@setup-split", info: "The season → the split." },
  "w11.setup-continue-split": { l: "Continue to open", to: "screen:W11@setup-open", info: "The split → the final check." },
  "w11.setup-back-how": { l: "Back to how it works", to: "screen:W11@setup-how", info: "Steps back with everything entered so far retained." },
  "w11.setup-back-season": { l: "Back to the season", to: "screen:W11@setup-season", info: "Steps back with everything entered so far retained." },
  "w11.setup-back-split": { l: "Back to the split", to: "screen:W11@setup-split", info: "Steps back with everything entered so far retained." },
  "w11.setup-preset": { l: "Split presets", info: "Presets prefill an editable percent editor; the allocation class named for the garden's caretaker role always renders as “steward” (Decision Log #28c)." },
  "w11.setup-goto-assess": { l: "Go to assessments", to: "screen:W13@assess", info: "The Hub's Assess stage, where an evaluator records the garden's starting assessment. Setup resumes from its first step afterwards." },
  "w11.setup-open-all": {
    l: "Open the season",
    to: "screen:W7",
    info: "The one write moment: setPoolCharter, setProviderOpenCommitmentCap, markPoolReady, seedCycle, openPool, openCycle — submitted in that order. Every intermediate pool state the steward used to click through (NotReady → Ready → Open) is carried by the flow instead (CS:723,751,724,566,100,114).",
    calls: ["setPoolCharter", "setProviderOpenCommitmentCap", "markPoolReady", "seedCycle", "openPool", "openCycle"],
  },
  "w11.setup-cancel": { l: "Cancel setup", to: "screen:W11@setup-discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w11.setup-keep-editing": { l: "Keep editing", to: "screen:W11@setup-how", info: "Returns to setup with everything entered intact." },
  "w11.setup-discard-confirm": { l: "Discard", to: "screen:W7@preflight-complete", info: "Leaves setup; nothing was recorded, so the pool is exactly as it was." },
  // ---- season / campaign flow ----
  "w11.details-continue": { l: "Continue to allocation", to: "screen:W11@presets", info: "seedCycle(poolId, Season, startTime, endTime, metadataCID) → CycleSeeded, then straight into the allocation step of the same flow — one shell, start to open (CS:566).", calls: ["seedCycle"] },
  "w11.campaign-details-continue": { l: "Continue to allocation", to: "screen:W11@campaign-allocation", info: "seedCycle with Campaign on the already-open pool → CycleSeeded, then the campaign's allocation step in the same shell (CS:566 · UX:66).", calls: ["seedCycle"] },
  "w11.recognition": { l: "Edit recognition policy", to: "screen:W11@recognition-policy", info: "Opens the recognition detour inside the same allocation step — the flow's title and three-step rail stay put (rail-stability rule, 2026-08-16)." },
  "w11.recognition-done": { l: "Use recognition policy", to: "screen:W11@presets", info: "Returns to the six-class allocation with the entered 35/65 within-gardener policy retained; Back does the same, since the detour never leaves the allocation step." },
  "w11.presets": { l: "Allocation presets", info: "Presets prefill an editable percent editor; the protocol allocation class renders as “steward” (Decision Log #28c)." },
  "w11.continue": { l: "Continue to open", to: "screen:W11@guard", info: "Allocation → the open step, which carries the Ready-pool guard prompt." },
  "w11.back": { l: "Back to allocation", to: "screen:W11@presets", info: "Steps back to the six-role split with the entered values retained." },
  "w11.cancel": { l: "Cancel the start flow", to: "screen:W11@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w11.keep-editing": { l: "Keep editing", to: "screen:W11@presets", info: "Returns to the allocation editor with the entered shares intact." },
  // Step 1 already called seedCycle, so discarding leaves a REAL Seeded season
  // behind. This used to land on the open pool — a console showing a running
  // season full of commitments that had never been opened. It lands on the season
  // it actually created.
  "w11.discard-confirm": { l: "Discard", to: "screen:W7@seeded", info: "Leaves the start flow. The season was recorded at step 1 (seedCycle), so it stays Seeded and the console shows it waiting to open — no commitments can exist in it until then (CreationChecksLib.sol:72)." },
  "w11.open-cycle": { l: "Open the pool and season", to: "screen:W7", info: "Two ordered writes: openPool(poolId), then openCycle(cycleId, allocation, recognitionPolicy). The cycle call validates, stores, and emits both complete snapshots; each percentage group must total 100% (UX:322-333).", calls: ["openPool", "openCycle"] },
  // Campaign path — same flow from an already-Open pool, so no guard prompt.
  "w11.campaign-continue": { l: "Continue to open", to: "screen:W11@campaign-open", info: "Allocation → the open step. The pool is already Open, so this step opens only the campaign." },
  "w11.campaign-back": { l: "Back to allocation", to: "screen:W11@campaign-allocation", info: "Steps back to this campaign's six-role split with the entered values retained." },
  "w11.campaign-cancel": { l: "Cancel open-cycle", to: "screen:W11@campaign-discard", info: "A dirty flow confirms before discarding; Keep editing returns to the campaign flow, not the Season one." },
  "w11.campaign-keep-editing": { l: "Keep editing", to: "screen:W11@campaign-allocation", info: "Returns to the campaign allocation editor with the entered shares intact." },
  "w11.campaign-discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the flow; the campaign stays Seeded." },
  "w11.campaign-open-cycle": { l: "Open the campaign", to: "screen:W7", info: "openCycle(cycleId, allocation, recognitionPolicy) on a pool that is already Open — any number of Campaigns may run concurrently beside the one Season (UX:66 · CS:114).", calls: ["openCycle"] },
};

// ---------------------------------------------------------------------------
// W13 — Hub Confirm stage (+ W13b context chip) (uiux-spec §6.9)
// ---------------------------------------------------------------------------

const W13_STATES = [
  ["queue", "Confirm Queue"], ["context-chip", "Work card chip (W13b)"], ["assess", "Assess stage"], ["empty", "Nothing to confirm"],
] as const;
type W13State = (typeof W13_STATES)[number][0];

// Hub workspace real rail: Work · Assess · Certify · History; Confirm is net-new.
// The rail is live on the Hub's own routes (prefixed per screen, exactly as
// adminChromeHots does — hotspot ids are globally unique). A dimmed backdrop
// passes no prefix and renders it inert.
const hubRail = (activeIx: number, prefix?: string) =>
  tabRail(
    [
      { label: "Work", count: 3, hot: prefix ? `${prefix}.tab-work` : undefined },
      { label: "Assess", count: 1, hot: prefix ? `${prefix}.tab-assess` : undefined },
      { label: "Certify", count: 2 },
      { label: "Confirm", count: 2, hot: prefix ? `${prefix}.tab-confirm` : undefined },
      { label: "History" },
    ],
    activeIx,
  );

// Without these the Work queue and the Assess stage existed but could only be
// entered from the middle of a flow (round 6 reachability fix).
const hubRailHots = (prefix: string): HifiDef["hots"] => ({
  [`${prefix}.tab-work`]: { l: "Work stage", to: "screen:HUBWORK", info: "The Hub's existing Work queue — submitted work waiting on an approval decision." },
  [`${prefix}.tab-assess`]: { l: "Assess stage", to: "screen:W13@assess", info: "The Hub's Assess stage, where evaluators record a garden's assessments." },
  [`${prefix}.tab-confirm`]: { l: "Confirm stage", to: "screen:W13", info: "The confirmations queue — rows you are eligible to confirm, each naming its authority path." },
});

function w13(state: W13State): string {
  const rail = hubRail(state === "context-chip" ? 0 : state === "assess" ? 1 : 3, "w13");
  let inner: string;
  if (state === "assess") {
    // The Hub's Assess stage — the route the assessment flow opens over, so
    // leaving that flow has a real place to land instead of the Confirm tab.
    inner = acard(
      "Assessments",
      `${commitmentRow({
        title: "Rocinha · starting record",
        chips: `${chip("AGRO", "domain")}${chip("Recorded", "ok", { dot: true })}`,
        meta: "Dr. Chen · for the garden · recorded Jul 2",
      })}
${commitmentRow({
        title: "Awka Hub · season close",
        chips: `${chip("AGRO", "domain")}${chip("Waiting", "warn", { dot: true })}`,
        meta: "evaluator only · for Season of First Rains · at the close",
      })}`,
      hot("w13.new-assessment", btn("Create Assessment", { kind: "pri", sm: true, icon: "add-line" })),
    );
  } else if (state === "empty") {
    inner = emptyState(
      "checkbox-circle-fill",
      "Nothing waiting for confirmation",
      "Named, local-fallback, and explicitly opted-in Green Goods team rows land here when you're eligible.",
    );
  } else if (state === "context-chip") {
    inner = acard(
      "Work Queue",
      `${decisionRow({
        title: "Pruning session",
        chips: `${chip("Work", "ink")}${chip("Waiting", "warn", { dot: true })}${hot("w13.chip", chip("Fulfills: Prune the north beds", "offer"))}`,
        meta: "João · 2 photos · submitted Jul 8",
        decline: hot("w13.reject", btn("Reject…", { kind: "sec", sm: true })),
        affirm: hot("w13.approve", btn("Approve", { kind: "pri", sm: true })),
      })}
${banner("Work cards name the commitment they fulfil; the approval rails themselves are unchanged.", "stone")}`,
    );
  } else {
    inner = acard(
      "Confirm Queue",
      `<div class="t-meta">Each row names the authority that lets you act; a protocol row never grants wider access to that garden.</div>
${commitmentRow({
        title: "Prune the north beds",
        chips: `${chip("Offer", "offer")}${chip("Ready", "warn", { dot: true })}${chip("Garden Fallback", "err")}`,
        meta: "Maria → João · Rocinha · nobody local can confirm",
        hotId: "w13.row",
        chevron: true,
      })}
${commitmentRow({
        title: "Field survey ride",
        chips: `${chip("Request", "request")}${chip("Ready", "warn", { dot: true })}${chip("Team Fallback", "ink")}`,
        meta: "TAS → Awka Hub · Awka · 0 of 1 confirmed",
        hotId: "w13.protocol-row",
        chevron: true,
      })}
${commitmentRow({
        title: "Repair the tool handles",
        chips: `${chip("Support", "ink")}${chip("Under Review", "warn", { dot: true })}${chip("Needs You", "err")}`,
        meta: "Maria → João · Rocinha · frozen until resolved",
        hotId: "w13.disputed-row",
        chevron: true,
      })}`,
    );
  }
  const header = pageHeader({ title: "Hub", description: "Review and confirm work flowing through your gardens." });
  return deskWin(
    "admin.greengoods.app/hub",
    adminCanvas("hub", "hub", { screenId: "W13", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W13_HOTS: HifiDef["hots"] = {
  "w13.row": { l: "Garden fallback row", to: "screen:W10@detail-fallback-eligible", info: "The row is present only after indexed eligibility proves the ordinary path cannot reach threshold. The detail keeps the mandatory reason and PoolFallback provenance visible." },
  "w13.protocol-row": { l: "Green Goods team fallback row", to: "screen:W10@protocol-fallback-confirm", info: "Cross-garden row appears only because the commitment carries protocolFallbackEnabled (the pilot default) and this account currently wears a protocol-pool steward/owner Hat." },
  "w13.disputed-row": { l: "Under-review row", to: "screen:W10@resolve-dispute", info: "A commitment frozen for steward review lands in this queue; opening it offers the eligible resolution outcomes with their required reason (CS:144). Members only ever read “under review by stewards”." },
  "w13.chip": { l: "Commitment-context chip (W13b)", info: "Work cards show which commitment they fulfill; approval rails untouched (UX:285)." },
  "w13.new-assessment": { l: "Create assessment", to: "screen:W14", info: "Opens the existing Create Assessment flow, which §6.6 extends rather than forks." },
  "w13.approve": { l: "Approve work", info: "Uses the existing WorkApproval rail; the context chip only links this work back to its commitment." },
  "w13.reject": { l: "Reject work", info: "Uses the existing work-rejection rail with its normal reason capture." },
};

// ---------------------------------------------------------------------------
// W14 — assessment v3 additions (uiux-spec §6.6)
// ---------------------------------------------------------------------------

const W14_STATES = [
  ["baseline", "For the garden — starting record"], ["delta", "For the season — at the close"],
  ["kernel", "2 · Strategy Kernel"], ["harvest", "3 · Actions & Harvest"],
  ["discard", "Discard changes?"],
] as const;
type W14State = (typeof W14_STATES)[number][0];

// The REAL Create Assessment rail (useCreateAssessmentController stepConfigs) —
// §6.6 is "extend, not fork": the v3 additions are two fields on the existing
// first step, so the rail must draw the shipping steps, not invented ones.
const ASSESS_STEPS: FlowStep[] = [
  { title: "Domain & Context", desc: "domain selection, title, and location" },
  { title: "Strategy Kernel", desc: "diagnosis, outcomes, and complexity" },
  { title: "Actions & Harvest", desc: "select actions and reporting period" },
];

// Dimmed Hub route behind the assessment flow, hotspot-free.
const hubBehind = () =>
  adminCanvas("hub", "hub", {
    screenId: "W14",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Hub", description: "Review and confirm work flowing through your gardens." }),
    tabRail: hubRail(1),
    body: acard("Assess", kv("Season of First Rains", "1 assessment waiting")),
  });

// Timing-first capture (2026-08-16 review decision): the steward-facing form
// speaks attribution + timing — "For [cycle or the garden] · at the start / at
// the close" — and the wire kind (Baseline / Delta) plus the comparison
// pointer derive underneath. The fine-print line carries the derived on-chain
// terms; authorship still rides on the derived kind (Decision 8), and the
// schema is untouched — cycleId already exists in assessment v3.
function w14(state: W14State): string {
  if (state === "discard")
    return deskWin(
      "admin.greengoods.app/hub/assess",
      discardDialog(hubBehind(), "hub", "w14.keep-editing", "w14.discard-confirm", "This assessment hasn't been recorded yet"),
    );
  let inner: string;
  let current: number;
  let next: string;
  let back: string | undefined;
  if (state === "kernel") {
    current = 1;
    inner = `${field("Diagnosis", input("Compacted beds after the first rains", { textarea: true }))}
${field("Outcomes sought", input("Soil structure recovers before planting", { textarea: true }))}
${field("Complexity", radio([{ label: "Simple", on: true }, { label: "Complicated" }, { label: "Complex" }], { interactive: true, name: "assessment-complexity" }))}
${banner("The existing Create Assessment steps continue unchanged from here — nothing on this step is new to v3.", "stone")}`;
    back = "w14.back-kernel";
    next = hot("w14.continue-kernel", btn("Continue", { kind: "pri" }));
  } else if (state === "harvest") {
    current = 2;
    inner = `${field("Actions", `<div class="arow"><div class="grow">Pruning sessions</div>${chip("Selected", "ok", { dot: true })}</div><div class="arow"><div class="grow">Composting</div>${chip("Selected", "ok", { dot: true })}</div>`)}
${field("Reporting period", `<div class="arow"><div class="grow">${input("Jun 1", { ariaLabel: "Reporting period start" })}</div><div class="grow">${input("Aug 30", { ariaLabel: "Reporting period end" })}</div></div>`)}
${banner("Attesting records the assessment with its cycle reference and timing; the KarmaGAP milestone mirrors it.", "stone")}`;
    back = "w14.back-harvest";
    next = hot("w14.attest", btn("Attest Assessment", { kind: "pri" }));
  } else {
    current = 0;
    const forField = hot(
      "w14.for",
      state === "delta"
        ? field("For", input("Season of First Rains", { select: true }))
        : field("For", input("This garden overall", { select: true })),
    );
    const whenRadio = hot(
      "w14.when",
      field("When", radio([
        { label: "At the start", meta: state === "baseline" ? "before the first season opens" : "as a cycle opens", on: state === "baseline" },
        { label: "At the close", meta: "as the cycle winds down", on: state === "delta" },
      ], { interactive: true, name: "assessment-when" })),
    );
    const derived = hot(
      "w14.kind",
      state === "delta"
        ? kv("Records as", "Re-assessment (delta) — compared with the starting record · AGRO · Jul 2 · Evaluator Hat attests")
        : kv("Records as", "Starting record (baseline) — the first measurement for this garden and domain · evaluator or steward attests"),
    );
    const compare =
      state === "delta"
        ? field("Compared with", input("Starting record — AGRO — Jul 2", { select: true }))
        : banner("One starting record per garden, cycle, and domain — a duplicate attempt points at the existing one.", "stone");
    inner = `${field("Domain", input("AGRO", { select: true }))}${field("Title", input("Rains-season soil recovery"))}${forField}${whenRadio}${derived}${compare}`;
  }
  return deskWin(
    "admin.greengoods.app/hub/assess",
    flowDialog(hubBehind(), "hub", {
      context: "Rocinha · assessment",
      title: "Create assessment",
      steps: ASSESS_STEPS,
      current,
      body: inner,
      back,
      cancelHot: "w14.cancel",
      next: state === "kernel" || state === "harvest" ? next! : hot("w14.continue", btn("Continue", { kind: "pri" })),
    }),
  );
}

const W14_HOTS: HifiDef["hots"] = {
  "w14.for": { l: "Assessment attribution", info: "Attributes the assessment to a season, a campaign cycle, or the garden overall — the schema's existing cycleId field, populated and read (0 = garden-scoped)." },
  "w14.when": { l: "Assessment timing", info: "Start/close is the steward-facing frame; it rides with the reporting period. The wire keeps kind + baselineUID — timing and lineage are different axes (a season's starting assessment after the first is still a delta against the previous close)." },
  "w14.kind": { l: "Derived on-chain record", info: "The wire kind derives from attribution + history: first measurement for a (garden, domain) records as Baseline, later ones as Delta with the comparison pointer auto-picked. Authorship rides on the derived kind — Baseline: evaluator or steward; Delta: Evaluator Hat only (CS:760-761)." },
  "w14.continue": { l: "Continue to Strategy Kernel", to: "screen:W14@kernel", info: "Domain & Context → the existing Strategy Kernel step." },
  "w14.back-kernel": { l: "Back to Domain & Context", to: "screen:W14", info: "Steps back with everything entered so far retained; this fixture returns to the starting-record cast of step one." },
  "w14.continue-kernel": { l: "Continue to Actions & Harvest", to: "screen:W14@harvest", info: "Strategy Kernel → the existing Actions & Harvest step." },
  "w14.back-harvest": { l: "Back to Strategy Kernel", to: "screen:W14@kernel", info: "Steps back with everything entered so far retained." },
  "w14.attest": { l: "Attest assessment", to: "screen:W13@assess", info: "Records the EAS attestation with its derived kind, comparison pointer, cycle reference, and reporting period, then returns to the Hub Assess stage." },
  "w14.cancel": { l: "Cancel assessment", to: "screen:W14@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w14.keep-editing": { l: "Keep editing", to: "screen:W14", info: "Returns to the assessment flow with the entered values intact." },
  "w14.discard-confirm": { l: "Discard", to: "screen:W13@assess", info: "Leaves the assessment flow and returns to the Hub Assess stage the flow opened over — not the Confirm stage." },
};

// ---------------------------------------------------------------------------
// HUBWORK — existing Work stage (approval rails untouched). The full decision
// arc is drawn (2026-08-16 review): queue → confirm dialog → visible outcome,
// plus the reject branch with its reason — the earlier single state rendered
// two byte-identical journey frames and taught no outcome at all.
// ---------------------------------------------------------------------------

const HUBWORK_STATES = [
  ["pending", "Queue — 2 waiting"],
  ["approve-confirm", "Approve — confirm"],
  ["approved", "Approved — 1 of 2 counted"],
  ["reject-reason", "Reject — reason"],
  ["rejected", "Both decided"],
] as const;
type HubworkState = (typeof HUBWORK_STATES)[number][0];

// Decision rows: approving and rejecting are paired opposites, so the queue
// shows both until the row is decided, then the outcome replaces the pair.
function hubworkQueue(state: "pending" | "approved" | "rejected"): string {
  const joao = decisionRow({
    title: "Pruning session",
    chips: `${chip("Work", "ink")}${state === "pending" ? chip("Waiting", "warn", { dot: true }) : chip("Approved", "ok", { dot: true })}`,
    meta: "João · 2 photos · submitted Jul 8 · fulfils Prune the north beds",
    outcome: state === "pending" ? undefined : `<span class="t-meta">counted toward the commitment</span>`,
    decline: state === "pending" ? hot("hub.reject-joao", btn("Reject…", { kind: "sec", sm: true })) : undefined,
    affirm: state === "pending" ? hot("hub.approve", btn("Approve", { kind: "pri", sm: true })) : undefined,
  });
  const ana = decisionRow({
    title: "Compost turning",
    chips: `${chip("Work", "ink")}${state === "rejected" ? chip("Rejected", "plain", { dot: true }) : chip("Waiting", "warn", { dot: true })}`,
    meta: "Ana · 1 photo · submitted Jul 8 · fulfils Turn the east pile",
    outcome: state === "rejected" ? `<span class="t-meta">reason recorded</span>` : undefined,
    decline: state === "rejected" ? undefined : hot("hub.reject", btn("Reject…", { kind: "sec", sm: true })),
    affirm: state === "rejected" ? undefined : hot("hub.approve-ana", btn("Approve", { kind: "pri", sm: true })),
  });
  const note =
    state === "pending"
      ? banner("The existing Work stage — approval rails untouched. Work rows name the commitment they fulfil.", "stone")
      : state === "approved"
        ? `<div class="quietok">${icon("check-line")}Approved work counted · 1 of 2 toward the commitment's requirement.</div>`
        : `<div class="quietok">${icon("check-line")}Both decided — only approved work counts toward the commitment.</div>`;
  return acard("Work Queue", `${joao}${ana}${note}`);
}

// Hotspot-free Hub Work clone behind the decision dialogs.
const hubworkBehind = (state: "pending" | "approved") =>
  adminCanvas("hub", "hub", {
    screenId: "HUBWORK",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Hub", description: "Review and triage work submitted across your gardens." }),
    tabRail: hubRail(0),
    body: acard(
      "Work Queue",
      state === "pending"
        ? `<div class="arow"><div class="grow"><b>Pruning session — Prune the north beds</b> <span class="t-meta num">2 photos · João · Jul 8</span></div></div>
<div class="arow"><div class="grow"><b>Compost turning — Turn the east pile</b> <span class="t-meta num">1 photo · Ana · Jul 8</span></div></div>`
        : `<div class="arow"><div class="grow"><b>Pruning session — Prune the north beds</b> <span class="t-meta num">2 photos · João · Jul 8</span></div>${chip("Approved — counted", "ok", { dot: true })}</div>
<div class="arow"><div class="grow"><b>Compost turning — Turn the east pile</b> <span class="t-meta num">1 photo · Ana · Jul 8</span></div></div>`,
    ),
  });

function hubwork(state: HubworkState): string {
  if (state === "approve-confirm")
    return deskWin(
      "admin.greengoods.app/hub",
      adminDialogM3(hubworkBehind("pending"), "hub", {
        title: "Approve this work",
        body: `${kv("Work", "Pruning session — 2 photos · João · Jul 8")}${kv("Fulfils", "Prune the north beds")}${banner(
          "The existing WorkApproval rails decide; approval takes no reason and counts once toward the commitment's requirement while it stays unfrozen.",
          "stone",
        )}`,
        actions: `${hot("hub.approve-dismiss", btn("Not Yet", { kind: "ghost" }))}${hot("hub.approve-confirm", btn("Approve Work", { kind: "pri" }))}`,
        closeHot: "hub.approve-dismiss",
      }),
    );
  if (state === "reject-reason")
    return deskWin(
      "admin.greengoods.app/hub",
      adminDialogM3(hubworkBehind("approved"), "hub", {
        title: "Reject this work",
        body: `${kv("Work", "Compost turning — 1 photo · Ana · Jul 8")}${reasonChips(["Photos don't show the work", "Wrong area", "Needs another pass"])}${field("Reason (required)", input("photos show the west pile, not the east"))}${banner(
          "The reason is recorded with the decision and Ana can read it. A rejection that replaces earlier approved credit reverses that credit too.",
          "stone",
        )}`,
        actions: `${hot("hub.reject-dismiss", btn("Keep in the Queue", { kind: "ghost" }))}${hot("hub.reject-confirm", btn("Reject Work", { kind: "pri" }))}`,
        closeHot: "hub.reject-dismiss",
      }),
    );
  const header = pageHeader({ title: "Hub", description: "Review and triage work submitted across your gardens." });
  return deskWin(
    "admin.greengoods.app/hub",
    adminCanvas("hub", "hub", { screenId: "HUBWORK", garden: "Rocinha", header, tabRail: hubRail(0, "hubwork"), body: hubworkQueue(state) }),
  );
}

const HUBWORK_HOTS: HifiDef["hots"] = {
  "hub.approve": { l: "Approve João's session", to: "screen:HUBWORK@approve-confirm", info: "Existing WorkApproval rails → onWorkDecision → ApprovedWorkCounted while the linked commitment is Accepted and unfrozen." },
  "hub.approve-dismiss": { l: "Not yet", to: "screen:HUBWORK", info: "Closes the confirmation; the submission stays in the queue undecided." },
  "hub.approve-confirm": { l: "Approve work (confirm)", to: "screen:HUBWORK@approved", info: "The approval decision reaches onWorkDecision and the counted credit appears on the queue row — no reason is stored for an approval." },
  "hub.approve-ana": { l: "Approve Ana's work", info: "Equally legal — the storyboard walks the rejection path for the second row; approval mirrors João's." },
  "hub.reject-joao": { l: "Reject João's session", info: "Equally legal and symmetric to approving it — the storyboard walks the approval for this row and the rejection for Ana's, so both acts are drawn once each." },
  "hub.reject": { l: "Reject Ana's work (reason)", to: "screen:HUBWORK@reject-reason", info: "The existing rejection rail with its normal reason capture; a newer rejection replacing active pre-freeze credit emits ApprovedWorkReversed." },
  "hub.reject-dismiss": { l: "Keep in the queue", to: "screen:HUBWORK@approved", info: "Closes the dialog without deciding; Ana's submission stays pending." },
  "hub.reject-confirm": { l: "Reject work (confirm)", to: "screen:HUBWORK@rejected", info: "Records the rejection with its required reason; only approved work counts toward the commitment's requirement." },
};

// ---------------------------------------------------------------------------
// W7M — Garden Pool tab on the phone. Below 1024px the shipping console hides
// the header action row and the same ViewAction set rides the FabButton speed
// dial; AdminDialog presents as a bottom sheet below 620px. These frames draw
// that contract (2026-08-16 review decision) — the desktop screens carry the
// interactive journey graph, so this set keeps its own minimal hotspots.
// ---------------------------------------------------------------------------

const W7M_STATES = [
  ["pool", "Pool tab — phone"], ["fab-open", "Speed dial"], ["seed-sheet", "Seed — bottom sheet"],
] as const;
type W7MState = (typeof W7M_STATES)[number][0];

// Read-only condensed content: chips carry state; the speed dial carries the
// view actions, so rows draw no buttons here.
const w7mContent = () =>
  `${hdr("Garden")}${tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3)}
${statRow([
    { n: "2", label: "Claims Waiting" },
    { n: "2", label: "Needs Recovery" },
    { n: "0", label: "Failed Payouts" },
  ])}
${objectCard({
    title: "Season of First Rains",
    chips: `${chip("Season", "ink")}${chip("Open", "ok", { dot: true })}`,
    meta: `${SEASON_LIVE.made} commitments · ${SEASON_LIVE.kept} kept`,
    body: `${cardSection("Campaigns · 2 open")}
${commitmentRow({ title: "Market rides", chips: `${chip("Campaign", "request")}${chip("Open", "ok", { dot: true })}`, meta: "16 commitments · 6 kept" })}
${commitmentRow({ title: "Tool library", chips: `${chip("Campaign", "request")}${chip("Reviewing", "warn", { dot: true })}`, meta: "8 commitments · 8 kept" })}`,
  })}
${acard(
    "Commitments",
    `${commitmentRow({ title: "Prune the north beds", chips: `${chip("Offer", "offer")}${chip("Accepted", "request", { dot: true })}`, meta: "Maria → João · 6 hours · due Aug 12" })}
${commitmentRow({ title: "Market ride", chips: `${chip("Request", "request")}${chip("Offered", "offer", { dot: true })}`, meta: "João · 1 ride · due Aug 20" })}`,
  )}
${acard(
    "Pool Status",
    `<div class="t-meta">The container your seasons and campaigns run in.</div>${kv("Commitment limit", "24 per person at once")}
<div class="actstack">${hot("w7m.rail-season", btn("Edit Pool", { kind: "sec", sm: true }))}</div>`,
    chip("Taking commitments", "ok", { dot: true }),
  )}`;

// The workspace dock, drawn preview-only (navigation is the desktop graph's job).
const w7mDock = () =>
  `<nav class="navdock" aria-label="Workspaces">${navItems("garden")
    .map(
      ([id, l, ic]) =>
        `<button type="button" class="nditem${id === "garden" ? " on" : ""}" disabled aria-label="${l} workspace — preview only"${id === "garden" ? ' aria-current="page"' : ""}><span class="ndic">${icon(ic)}</span><span>${l}</span></button>`,
    )
    .join("")}</nav>`;

function w7m(state: W7MState): string {
  // Primary sits nearest the trigger, mirroring the desktop row's
  // primary-rightmost emphasis (useViewActions speed-dial sort).
  // The speed dial carries the VIEW's stable action set (View public · Seed ·
  // Edit garden), primary nearest the trigger; the cycle doors live in the
  // stacked Pool card content, exactly as they do in the desktop rail.
  const doors = `${hot("w7m.dial-view-public", `<button type="button" class="fabdoor">View public</button>`)}${hot("w7m.dial-edit", `<button type="button" class="fabdoor">Edit garden</button>`)}${hot("w7m.dial-seed", `<button type="button" class="fabdoor">Seed a commitment</button>`)}`;
  if (state === "seed-sheet")
    return phoneFrame(
      sheetOver(
        `${w7mContent()}${w7mDock()}`,
        "Seed a commitment",
        `${field("Type", radio([{ label: "Season / campaign commitment", meta: "the pool offers or requests", on: true }, { label: "Support / service" }]))}
${field("Title", input("Market rides"))}
${banner("The same seed flow as the desktop dialog — below 620px it presents as this bottom sheet.", "stone")}
<div class="actrow">${hot("w7m.sheet-cancel", btn("Cancel", { kind: "ghost" }))}${hot("w7m.sheet-continue", btn("Continue", { kind: "pri" }))}</div>`,
      ),
      { appBar: false },
    );
  const overlay =
    state === "fab-open"
      ? `<div class="fabscrim"></div><div class="fabwrap open">${doors}${hot("w7m.fab-close", fabButton(true))}</div>`
      : `<div class="fabwrap">${hot("w7m.fab", fabButton(false))}</div>`;
  return phoneFrame(`${w7mContent()}${w7mDock()}`, { appBar: false, overlay });
}

const W7M_HOTS: HifiDef["hots"] = {
  "w7m.fab": { l: "Workspace actions (FAB)", to: "screen:W7M@fab-open", info: "Below 1024px the page header's action row hides and the same ViewAction set rides the FabButton speed dial (packages/admin Shell/FabButton + useViewActions)." },
  "w7m.fab-close": { l: "Close the speed dial", to: "screen:W7M@pool", info: "The opener flips to a close affordance while the dial is open." },
  "w7m.dial-seed": { l: "Seed a commitment", to: "screen:W7M@seed-sheet", info: "Seed sits nearest the trigger; it opens the same seed flow, presented as a bottom sheet on the phone." },
  "w7m.dial-view-public": { l: "View public", info: "The view's stable action set rides the dial unchanged — View public opens the garden's client page in a new tab, exactly as the desktop header action does." },
  "w7m.dial-edit": { l: "Edit garden", info: "The stable primary — the shipped garden settings dialog, presenting as a bottom sheet on the phone." },
  "w7m.rail-season": { l: "Edit Pool", info: "The same pool settings the desktop card opens — how it works and the commitment limit; on the phone it presents as a bottom sheet." },
  "w7m.sheet-cancel": { l: "Cancel", to: "screen:W7M@pool", info: "Dismisses the sheet without seeding; the dirty-flow guard applies exactly as on desktop." },
  "w7m.sheet-continue": { l: "Continue", info: "Continues the same four-step seed flow drawn on W8 — one dialog, two presentations." },
};

// ---------------------------------------------------------------------------

// Frames (2026-08-16 round 7): 31 states, eight frames. Eight of the states are
// confirmations — a steward is not learning eight screens, they are answering
// "are you sure" about eight different acts — and five are the setup ladder a
// pool climbs exactly once.
const W7_WINDING_DOWN = new Set<string>(["reconciled", "cycle-composted", "close-blocked-live"]);
const W7_RUNNING = new Set<string>([
  "open", "empty", "claims", "claim-declined", "claim-outcomes", "expiry-queue", "due-live", "series-view",
]);
const W7_SETTING_UP = new Set<string>([
  "not-ready", "preflight-complete", "ready", "seeded", "open-no-cycle",
]);

const w7Group = (state: W7State): string => {
  if (state === "loading") return "Loading";
  if (state === "edit-pool") return "Settings";
  if (state.endsWith("-confirm")) return "Are you sure?";
  if (state === "pool-closed" || state === "pool-composted") return "After the pool closes";
  if (state.startsWith("paused")) return "Paused";
  if (W7_WINDING_DOWN.has(state)) return "Winding a season down";
  if (W7_SETTING_UP.has(state)) return "Setting up";
  if (W7_RUNNING.has(state)) return "The running pool";
  return "The running pool";
};

const w7Facts = (state: W7State): StateFacts | undefined => {
  if (state === "not-ready" || state === "preflight-complete") return { pool: "NotReady" };
  if (state === "ready") return { pool: "Ready" };
  if (state === "open-no-cycle") return { pool: "Open" };
  // A Seeded cycle holds NO commitments — createCommitment rejects any cycle
  // that is not Open (CreationChecksLib.sol:72), and cancelCycle's zero-live
  // guard assumes the same. So this state is preparation with an empty pool,
  // and opening is the moment it fills.
  if (state === "seeded") return { pool: "Open", cycle: "Seeded", cycleLiveCommitments: "Zero" };
  if (state === "paused" || state === "paused-season-menu") return { pool: "Paused", cycle: "Open" };
  if (state === "paused-cycle-cancelled") return { pool: "Paused", cycle: "Cancelled" };
  if (state === "paused-cancel-cycle-confirm")
    return { pool: "Paused", cycle: "Open", cycleLiveCommitments: "Zero" };
  if (state === "paused-cycle-composted" || state === "paused-close-pool-confirm")
    return {
      pool: "Paused",
      cycle: "Composted",
      poolLiveCommitments: "Zero",
      poolNonTerminalCycles: "Zero",
    };
  if (state === "pool-closed" || state === "compost-pool-confirm") return { pool: "Closed", cycle: "Composted" };
  if (state === "pool-composted" || state === "reopen-confirm") return { pool: "Composted", cycle: "Composted" };
  if (state === "reconciled") return { pool: "Open", cycle: "Reconciled" };
  if (state === "cycle-composted" || state === "close-pool-confirm")
    return {
      pool: "Open",
      cycle: "Composted",
      poolLiveCommitments: "Zero",
      poolNonTerminalCycles: "Zero",
    };
  if (state === "close-blocked-live")
    return {
      pool: "Open",
      cycle: "Composted",
      poolLiveCommitments: "NonZero",
      poolNonTerminalCycles: "Zero",
    };
  if (state === "loading") return undefined;
  if (["claims", "decline-claim-confirm", "claim-declined"].includes(state))
    return { pool: "Open", cycle: "Open", commitment: "Requested", kind: "SupportService" };
  if (state === "funded-claim")
    return { pool: "Open", cycle: "Open", commitment: "Offered", kind: "SupportService", funding: "None", settlementAccount: "Active" };
  if (state === "claim-outcomes")
    return { pool: "Open", cycle: "Open", commitment: "Accepted", kind: "SupportService" };
  if (state === "due-live")
    return { pool: "Open", cycle: "Open", commitment: "Accepted", kind: "SeasonCampaign" };
  if (state === "cancel-cycle-confirm")
    return { pool: "Open", cycle: "Open", cycleLiveCommitments: "Zero" };
  return { pool: "Open", cycle: "Open" };
};

const w10Facts = (state: W10State): StateFacts | undefined => {
  if (state === "not-found") return undefined;
  const context = { pool: "Open" as const, cycle: "Open" as const };
  if (["contributor-allocation", "queue-settlement-garden"].includes(state))
    return {
      ...context,
      commitment: "Fulfilled",
      kind: "DomainImpact",
      settlementAccount: "Active",
    };
  if (["external-fulfilled", "fulfilled", "contributor-allocation", "record-payout", "garden-fulfilled", "queue-settlement-garden"].includes(state))
    return { ...context, commitment: "Fulfilled", kind: "DomainImpact" };
  if (["detail", "detail-fallback-eligible", "fallback-confirm", "protocol-fallback-confirm", "raise-dispute", "garden-ready"].includes(state))
    return { ...context, commitment: "ReadyForConfirmation", kind: "DomainImpact" };
  if (state === "resolve-dispute") return { ...context, commitment: "Disputed", kind: "DomainImpact" };
  if (state === "attach-assessment") return { ...context, commitment: "PartiallyApproved", kind: "DomainImpact" };
  if (["accepted", "mark-ready-override"].includes(state))
    return { ...context, commitment: "EvidenceSubmitted", kind: "SupportService" };
  if (state === "edit-declared-value")
    return { ...context, commitment: "Requested", kind: "SupportService" };
  if (state === "cancel") return { ...context, commitment: "Accepted", kind: "SupportService" };
  return undefined;
};

const w11Facts = (state: W11State): StateFacts =>
  // The setup flow runs entirely before any write: the pool is still NotReady
  // on every one of its steps, and its last step submits the whole sequence.
  state.startsWith("setup-")
    ? { pool: "NotReady" }
    : state === "details" || state === "campaign-details"
      ? { pool: w11IsCampaign(state) ? "Open" : "Ready" }
      : { pool: w11IsCampaign(state) ? "Open" : "Ready", cycle: "Seeded" };

const w8Facts = (_state: W8State): StateFacts => ({ pool: "Open", cycle: "Open" });

export const ADMIN_DEFS: HifiDef[] = [
  { screen: { id: "W7", title: "W7 · Garden Pool tab (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: groupStates(W7_STATES.map(([id, label]) => ({ id, label, group: w7Group(id), facts: w7Facts(id), html: w7(id) }))) }, hots: { ...adminChromeHots("w7", "garden"), ...W7_HOTS } },
  { screen: { id: "W7M", title: "W7m · Garden Pool tab — phone (admin)", surface: "admin", frame: "phone", group: "Admin console",
    states: W7M_STATES.map(([id, label]) => ({ id, label, facts: { pool: "Open", cycle: "Open" } satisfies StateFacts, html: w7m(id) })) }, hots: W7M_HOTS },
  { screen: { id: "W8", title: "W8 · Seeding console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W8_STATES.map(([id, label]) => ({ id, label, facts: w8Facts(id), html: w8(id) })) }, hots: W8_HOTS },
  { screen: { id: "W9", title: "W9 · Analog capture", surface: "admin", frame: "desktop", group: "Admin console",
    states: W9_STATES.map(([id, label]) => ({
      id,
      label,
      facts:
        id === "capture-fallback"
          ? ({ pool: "Open", cycle: "Open", commitment: "ReadyForConfirmation", kind: "StewardCaptured" } satisfies StateFacts)
          : undefined,
      html: w9(id),
    })) }, hots: W9_HOTS },
  { screen: { id: "W10", title: "W10 · Commitment dialog (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W10_STATES.map(([id, label]) => ({ id, label, facts: w10Facts(id), html: w10(id) })) }, hots: W10_HOTS },
  { screen: { id: "W11", title: "W11 · Open-cycle allocation", surface: "admin", frame: "desktop", group: "Admin console",
    states: W11_STATES.map(([id, label]) => ({ id, label, facts: w11Facts(id), html: w11(id) })) }, hots: W11_HOTS },
  { screen: { id: "W13", title: "W13 · Hub Confirm stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: W13_STATES.map(([id, label]) => ({ id, label, html: w13(id) })) }, hots: { ...adminChromeHots("w13", "hub"), ...hubRailHots("w13"), ...W13_HOTS } },
  { screen: { id: "W14", title: "W14 · Assessment v3 additions", surface: "admin", frame: "desktop", group: "Admin console",
    states: W14_STATES.map(([id, label]) => ({ id, label, html: w14(id) })) }, hots: W14_HOTS },
  { screen: { id: "HUBWORK", title: "Existing Hub Work stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: HUBWORK_STATES.map(([id, label]) => ({ id, label, html: hubwork(id) })) }, hots: { ...adminChromeHots("hubwork", "hub"), ...hubRailHots("hubwork"), ...HUBWORK_HOTS } },
];
