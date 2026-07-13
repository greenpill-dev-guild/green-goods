// Builds the "Commitment Pooling — Flow Prototypes" claude.ai artifact from the
// sibling prototypes.md. Three tabs:
//   1) Walk the journeys — click-through storyboards on the locked ASCII frames:
//      the canonical control advances, real decision points are on-frame choices,
//      every other drawn control answers via the inspector or jumps elsewhere.
//   2) Screens — free-roam: browse every frame, tap any control, navigate the
//      screen graph; each frame lists the journeys that walk it.
//   3) Reference — the full rendered prototypes.md document.
//
// Rebuild:  bun .plans/active/commitment-pooling/prototypes-artifact.build.ts
//           (or OUT=/path/out.html bun … )
// Republish via the Claude Code Artifact tool with
//   url: https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c
// Build FAILS if any hotspot/alt/mark string is missing from its frame, any
// branch target is invalid, or a frame is missing from the Screens groups.
// One-shot op per CLAUDE.md scripts policy — lives in .plans, not scripts/.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = `${import.meta.dir}/prototypes.md`;
const OUT = process.env.OUT ?? "/tmp/commitment-pooling-prototypes.html";

const md = readFileSync(SRC, "utf8");
const lines = md.split("\n");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- Reference-tab document pipeline (unchanged) ----------
function inline(raw: string): string {
  let s = esc(raw);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "" + (codes.length - 1) + ""; });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\b(CI-W\d+|MF-\d+[ab]?|W\d+a?|SB-\d+(?:\.\d+[ab]?(?:–\d+)?)?)\b/g, (m) => {
    if (m.startsWith("SB-")) {
      const sec = m.match(/^SB-(\d+)/)![1];
      return `<a class="chip sb" href="#sb-${sec}">${m}</a>`;
    }
    if (m.startsWith("MF-")) return `<a class="chip mf" href="#sec-15">${m}</a>`;
    return `<span class="chip w">${m}</span>`;
  });
  s = s.replace(/(\d+)/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}

type Sec = { id: string; title: string; html: string[] };
const secs: Sec[] = [];
let cur: Sec | null = null;
let front: string[] = [];
let i = 0;
let h1 = "Commitment Pooling — Flow Prototypes";

function push(html: string) { (cur ? cur.html : front).push(html); }

function slug(t: string): string {
  const sb = t.match(/^SB-(\d+)/);
  if (sb) return `sb-${sb[1]}`;
  const num = t.match(/^(\d+)\./);
  if (num) return `sec-${num[1]}`;
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function flowHtml(code: string[]): string {
  const labels: Record<string, string> = {};
  const edges: { f: string; t: string; l: string }[] = [];
  for (const ln of code) {
    const m = ln.match(/^\s*(\w+)(?:\["([^"]*)"\])?\s*-->\|"([^"]*)"\|\s*(\w+)(?:\["([^"]*)"\])?/);
    if (!m) continue;
    if (m[2]) labels[m[1]] = m[2];
    if (m[5]) labels[m[4]] = m[5];
    edges.push({ f: m[1], t: m[4], l: m[3] });
  }
  const rows = edges.map(e =>
    `<div class="fr"><span class="fn">${esc(labels[e.f] ?? e.f)}</span><span class="fe"><span class="fl">${esc(e.l)}</span><span class="fa" aria-hidden="true"></span></span><span class="fn">${esc(labels[e.t] ?? e.t)}</span></div>`
  ).join("");
  const srcCode = esc(code.join("\n"));
  return `<div class="flow">${rows}</div><details class="msrc"><summary>mermaid source</summary><pre>${srcCode}</pre></details>`;
}

while (i < lines.length) {
  const ln = lines[i];
  if (ln.startsWith("# ") && !cur && front.length === 0) { h1 = ln.slice(2).replace(/ \(.*\)$/, ""); i++; continue; }
  if (ln.startsWith("## ")) {
    const title = ln.slice(3);
    cur = { id: slug(title), title, html: [] };
    secs.push(cur);
    i++; continue;
  }
  if (ln.startsWith("```mermaid")) {
    const buf: string[] = []; i++;
    while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
    i++; push(flowHtml(buf)); continue;
  }
  if (ln.startsWith("```text") || ln === "```") {
    const buf: string[] = []; i++;
    while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
    i++;
    const proposed = buf.some(b => b.includes("NEW — proposed"));
    push(`<div class="framewrap${proposed ? " proposed" : ""}">${proposed ? '<div class="ptag">NEW — proposed lo-fi, not locked</div>' : ""}<pre class="frame">${esc(buf.join("\n"))}</pre></div>`);
    continue;
  }
  if (ln.startsWith("|")) {
    const rows: string[] = [];
    while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++; }
    const cells = (r: string) => r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
    let bodyStart = 1;
    if (rows.length > 1 && /^[\s|:-]+$/.test(rows[1])) bodyStart = 2;
    const head = cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join("");
    const body = rows.slice(bodyStart).map(r => {
      const warn = r.includes("⚠");
      return `<tr${warn ? ' class="warn"' : ""}>${cells(r).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`;
    }).join("");
    push(`<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
    continue;
  }
  if (ln.startsWith("- ")) {
    const items: string[] = [];
    while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
    push(`<ul>${items.map(it => `<li>${inline(it)}</li>`).join("")}</ul>`);
    continue;
  }
  if (ln === "---" || ln.trim() === "") { i++; continue; }
  const buf: string[] = [ln];
  i++;
  while (i < lines.length && lines[i].trim() !== "" && !/^(#|```|\||- |---)/.test(lines[i])) { buf.push(lines[i]); i++; }
  push(`<p>${inline(buf.join(" "))}</p>`);
}

const sbSecs = secs.filter(s => s.id.startsWith("sb-"));
const refSecs = secs.filter(s => !s.id.startsWith("sb-"));
const groupsDoc: [string, Sec[]][] = [
  ["Member journeys", sbSecs.slice(0, 7)],
  ["Operator journeys", sbSecs.slice(7, 10)],
  ["Settlement", sbSecs.slice(10, 12)],
  ["Protocol + September", sbSecs.slice(12, 14)],
];
const navSb = groupsDoc.map(([g, ss]) =>
  `<div class="ng">${g}</div>` + ss.map(s => {
    const m = s.title.match(/^(SB-\d+) — (.*)$/);
    const label = m ? `<b>${m[1]}</b> ${esc(m[2].replace(/\*\*/g, ""))}` : esc(s.title);
    return `<a href="#${s.id}">${label}</a>`;
  }).join("")
).join("");
const navRef = `<div class="ng">Reference</div>` + refSecs.map(s =>
  `<a href="#${s.id}">${esc(s.title.replace(/ \(.*\)$/, "").replace(/ —.*$/, ""))}</a>`
).join("");

const statusNote = `<aside class="status"><h2>Status — decisions folded 2026-07-11 (plan.todo.md #34–#35)</h2>
<p><strong>Adopted</strong>: pool open/close on the pool status card + open-cycle guard prompt (MF-1) · member pre-acceptance withdraw (MF-2a) · <code>waiting_for_hat</code> covers the five pool job kinds in August (MF-5) · admin expiry queue + member "offer again" ship in August, keeper cron is a post-launch backstop (MF-3/MF-4) · pilot operators hold the executor role with a visible missing-role guard state · read-only delivery-gate status row on W21/W12 · testimony is September-realized (MF-12) · the dry run rehearses payout with a real minimal Cookie Jar withdrawal.</p>
<p><strong>Still open</strong>: steward-cancel placement (MF-2b) · Cancelled-disbursement member copy (§17.5). <strong>Join-request queue</strong> design is canonical in <code>../community-interface/join-queue-spec.md</code>; implementation remains gated on RESR-64's operating record.</p></aside>`;

const sections = secs.map(s => {
  const m = s.title.match(/^(SB-\d+) — (.*)$/);
  const heading = m
    ? `<h2><span class="sbnum">${m[1]}</span> ${inline(m[2])}</h2>`
    : `<h2>${inline(s.title.replace(/^\d+\. /, ""))}</h2>`;
  return `<section id="${s.id}">${heading}${s.html.join("\n")}</section>`;
}).join("\n");

// ---------- Frames (verbatim lo-fi) ----------
const F: Record<string, string> = {
W1: `┌──────────────────────────────────────────────┐
│ ←  Rocinha Community Garden                  │
│  Work · Insights · Gardeners · ◉Pool         │
├──────────────────────────────────────────────┤
│ Season of First Rains is open                │
│ ┌──────────────────────────────────────────┐ │
│ │ Season of First Rains        (season)    │ │
│ │ Seeded ─ ◉Open ─ In progress ─ Reviewing │ │
│ │ ▓▓▓▓▓▓▓▓▓░░░░░  62% of promised units    │ │
│ │ runs through Aug 30                      │ │
│ └──────────────────────────────────────────┘ │
│ Campaigns (2 open)                           │
│ ≡ Market rides (campaign) · Open · 6/16     │
│ ≡ Tool library (campaign) · Reviewing · 8/8 │
│ Scope: [All current] [Season] [Market rides] │
│ ┌───────────────────┐ ┌───────────────────┐  │
│ │ 12 offered        │ │ 7 fulfilled       │  │
│ └───────────────────┘ └───────────────────┘  │
│                                              │
│ [ Offer support ]      [ Request help ]      │
│                                              │
│ (All)(Offers)(Requests)(Matched)(Mine)       │
│ ┌──────────────────────────────────────────┐ │
│ │ (Offer)(AGRO)  Prune the north beds      │ │
│ │ 6 hours · due Aug 12                     │ │
│ │ anyone in this garden may take this up   │ │
│ │                       [ Take this up ]   │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ (Request)  Ride to the market on Sat     │ │
│ │ 1 ride · runs with the season            │ │
│ │ stewards review who takes this up        │ │
│ │                 [ Ask to take this up ]  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ My commitments                            ▸  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │(Offered) │ │(Accepted)│ │··queued··│       │
│ └──────────┘ └──────────┘ └──────────┘       │
├──────────────────────────────────────────────┤
│    Home         Garden         Profile       │
└──────────────────────────────────────────────┘`,
W1P: `PENDING                              DECLINED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ Waiting for steward          │     │ Steward declined this request │
│ Individual · requested Jul 9 │     │ Reason: provider context …     │
│ Provider: myself             │     │ [Ask again] [Back to browse]   │
└──────────────────────────────┘     └────────────────────────────────┘`,
W1S: `SUPERSEDED                           ACCEPTED
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ No longer available          │     │ Your request was accepted      │
│ This is not a sync failure.  │     │ Provider garden: Rocinha       │
│ [Back to browse]             │     │ [Open commitment]              │
└──────────────────────────────┘     └────────────────────────────────┘`,
W2: `┌──────────────────────────────────────────────┐
│ ←  Prune the north beds                      │
│ (Offer)(AGRO)(Accepted)  6 hours · due Aug 12│
│ anyone in this garden may take this up       │
│ (recorded by your operator on your behalf)   │
├──────────────────────────────────────────────┤
│ Timeline                                     │
│ ● Offered      — Maria · Jul 2               │
│ ● Accepted     — João took this up · Jul 3   │
│ ● Work linked  — pruning session · Jul 8     │
│ ● Ready        — steward note: "confirmed    │
│                  on site visit" (override)   │
├──────────────────────────────────────────────┤
│ Evidence                          [ + Add ]  │
│ ≡ photo — north beds after (Jul 8)           │
│ ≡ note — "two beds left for next week"       │
├──────────────────────────────────────────────┤
│ Work for this promise                        │
│ ≡ Pruning session       (Approved)           │
│ [ Submit work for this promise ]             │
│ [ Link existing work ]                       │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ [ Confirm: promise kept ]                │ │
│ └──────────────────────────────────────────┘ │
│ Reward: 20 DAI from the garden jar · pending │
│ recorded on Arbitrum                         │
└──────────────────────────────────────────────┘`,
W3: `┌──────────────────────────────────────────────┐   Step 2 — How much
│ ✕  Make an offer              ● ● ○ ○        │   ┌────────────────────────┐
├──────────────────────────────────────────────┤   │ Unit  [ hours        ▾ ]│
│ Step 1 — What                                │   │ suggestions: hours,     │
│ direction   ◉ Offer support  ○ Request help  │   │ tasks, meals, rides,    │
│ type        ◉ Garden work (impact)           │   │ plants                  │
│             ○ Support / service              │   │ How many  [ 6 ]         │
│   (season/campaign + on-behalf capture are   │   │ Due  {DatePicker}       │
│    console-seeded only — not shown here)     │   │  or ◉ selected deadline │
│ cycle scope [Season: First Rains ▾]          │   └────────────────────────┘
│ title  [ Prune the north beds            ]   │   Step 3 — Anchors
│ note   [ optional                        ]   │   (DomainImpact only)
├──────────────────────────────────────────────┤   action cards: ◉Prune ○Plant
│                        [ Continue ]          │
└──────────────────────────────────────────────┘
Step 4 — Review and promise
┌──────────────────────────────────────────────┐
│ summary card (all fields)                    │
│ [ Make this offer ]                          │
│  → enqueues commitment job, returns to the   │
│    pool tab with optimistic card + queued    │
└──────────────────────────────────────────────┘`,
W4: `┌──────────────────────────────────────────────┐
│ Promise kept?                                │
│ Prune the north beds — Maria · 6 hours       │
│ Offer · provider Maria · recipient confirms  │
│ evidence: 2 items · linked work: 1 approved  │
├──────────────────────────────────────────────┤
│ Confirmations   ▓▓▓▓▓▓▓░░░  2 of 3           │
│ ≡ João ✓        ≡ Ana ✓       ≡ you ○        │
│ Provider Maria cannot confirm this delivery. │
├──────────────────────────────────────────────┤
│ [ Confirm — promise kept ]                   │
│ [ Not yet — tell the stewards why ]          │
└──────────────────────────────────────────────┘`,
W5: `┌──────────────────────────────────────────────┐
│ Wallet            ○ jar  ○ vault  ◉ pools +2 │
├──────────────────────────────────────────────┤
│ Waiting on you                               │
│ ≡ Maria — Prune the north beds   (Rocinha) ▸ │
│ ≡ TAS Hub — Field survey ride    (Awka)    ▸ │
├──────────────────────────────────────────────┤
│ My commitments                               │
│ Rocinha Community Garden                     │
│ ≡ ··queued·· Compost workshop    (Offered)   │
│ ≡ Ride to market                 (Accepted) ▸│
│ Muizenberg                                   │
│ ≡ Beach cleanup Saturday         (Fulfilled)▸│
└──────────────────────────────────────────────┘`,
W6: `┌──────────────────────────────────────────────┐
│ Promises kept this cycle                     │
│ 7 of 9 due across your gardens            ▸  │
└──────────────────────────────────────────────┘`,
W7: `┌────────────────────────────────────────────────────────────────────────┐
│ Garden ▸ Rocinha        overview · activity · ◉pool · settings         │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ Pool ─────────────────────────────────────────────────────────────┐ │
│ │ (Open) charter ✓ baseline ✓ cap 24     [ Pause… ] [ Edit charter ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Cycles console ───────────────────────────────────────────────────┐ │
│ │ SEASON · First Rains · Open                                        │ │
│ │ Seeded ─ ◉Open ─ InProgress ─ Reviewing ─ Reconciled ─ Composted   │ │
│ │ [ Close Season ] [ Cancel… ]  [ Open Season disabled: one exists ]│ │
│ │ CAMPAIGNS (2 open)                                  [ New Campaign ]│ │
│ │ ≡ Market rides · Open · 6/16                [ Close ] [ Cancel… ] │ │
│ │ ≡ Tool library · Reviewing · 8/8            [ Review ] [ Cancel… ]│ │
│ │ History: ≡ Winter campaign (Reconciled) — scoped report ▸          │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Commitments ──────────────────────────────────────────────────────┐ │
│ │ [search………] (state ▾)(type ▾)(direction ▾)  sort: newest ▾         │ │
│ │ ≡ Prune the north beds   (Offer)(Accepted)   6h    Maria         ▸ │ │
│ │ ≡ Market ride            (Request)(Ready)    1     João          ▸ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Claims waiting (approval-gated) ──────────────────────────────────┐ │
│ │ Field survey · request terms                                       │ │
│ │ ≡ claimant 0x12…9a · requested by same · individual · Jul 9       │ │
│ │                                      [ Accept ] [ Decline… ]       │ │
│ │ ≡ claimant Awka Hub · requested by 0x45…2b · garden · Jul 10      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                        (+) seed        │
└────────────────────────────────────────────────────────────────────────┘`,
W7X: `DECLINE A                            ACCEPT B
┌──────────────────────────────┐     ┌────────────────────────────────┐
│ A · Declined · reason…       │     │ B · Accepted · stored terms   │
│ B · Pending (unchanged)      │     │ A · Superseded                │
└──────────────────────────────┘     │ other pending · Superseded    │
                                     └────────────────────────────────┘`,
W8: `┌── Seed a commitment ── ● ● ● ○ ──────────────────────────┐
│ Step 1 — Type and scope                                  │
│ type   ◉ Season/campaign  ○ Support  ○ Impact  ○ Capture │
│ direction  ◉ the pool offers   ○ the pool requests       │
│ cycle  [ Season: First Rains ▾ ]                         │
│ title  [                              ]  note [        ] │
├──────────────────────────────────────────────────────────┤
│ Step 2 — Requirements                                    │
│ unit [ hours ▾ ]  target [ 12 ]  approved works [ 2 ]    │
│ assessment required  ○ yes ◉ no   due [ cycle deadline ] │
├──────────────────────────────────────────────────────────┤
│ Step 3 — Confirmation rule and reward                    │
│ confirmers  [ + add address ]  ≡ Maria ✕  ≡ João ✕       │
│ threshold   N = [ 2 ] of 2                               │
│ claim mode  ◉ open   ○ steward-reviewed                  │
│ reward      source [ garden jar ▾ ] token [DAI] amt [20] │
├──────────────────────────────────────────────────────────┤
│ Step 4 — Review              [ Seed this commitment ]    │
└──────────────────────────────────────────────────────────┘`,
W9: `┌── Record on a member's behalf ───────────────────────────┐
│ "Recorded by {operator} on your behalf.                  │
│  The promise stays yours."                               │
├──────────────────────────────────────────────────────────┤
│ Step 0 — Who and what kind                               │
│ member   [ search members… ▾ ]                           │
│ capture  ◉ their offer  ○ their request  ○ confirmation  │
│          (captured confirmations always carry a reason)  │
├──────────────────────────────────────────────────────────┤
│ … steps continue as W8 steps 2–4 …                       │
└──────────────────────────────────────────────────────────┘`,
W10: `┌── Prune the north beds ──────────────── (Offer)(Ready) ──┐
│ Maria → João · 6 hours · due Aug 12 · open claim         │
│ Timeline: Offered → Accepted → Work linked → Ready       │
│ Evidence (2)  ≡ photo  ≡ note                            │
│ Linked work (1)  ≡ Pruning session (Approved)            │
│ Provider: Maria (cannot confirm)                          │
│ Eligible: João ✓ · Ana ○ · you ○   (1 of 2 required)     │
├──────────────────────────────────────────────────────────┤
│ Reward: 20 DAI · garden jar · unpaid   [ Record payout ] │
│ [ Confirm as fallback… ]  [ Raise dispute… ]             │
│ Provider address can never use fallback confirmation.    │
│ Resolve dispute → ( Restore previous / Fulfilled /       │
│                     Cancelled / Expired ) + reason        │
└──────────────────────────────────────────────────────────┘`,
W11: `┌── Open cycle: allocation policy ─────────────────────────┐
│ preset  ◉ Garden-led (default)  ○ Balanced  ○ Custom     │
│ gardeners [6000] treasury [1500] operator [1000]         │
│ evaluator [ 500] community [ 500] funder   [ 500]        │
│ sum: 10000 ✓                                             │
│ ⚠ shows if treasury < 1500 bps (guidance floor)          │
│                          [ Open cycle ]                  │
└──────────────────────────────────────────────────────────┘`,
W12: `┌────────────────────────────────────────────────────────────────────────┐
│ Community ▸ Pools        ◉ Protocol pool · ○ Gardens                   │
├────────────────────────────────────────────────────────────────────────┤
│ PROTOCOL POOL (root garden)                                            │
│ ├─ Funding view ─────────────────────────────────────────────────────┤ │
│ │ ≡ 20 DAI · protocol treasury → Field survey (co-funded w/ Awka)    │ │
│ ├─ Claims across gardens ────────────────────────────────────────────┤ │
│ │ ≡ Awka Hub (garden claim) → Methodology survey    [ Accept ]       │ │
│ ├─ Confirmations queue ──────────────────────────────────────────────┤ │
│ │ ≡ Field survey — 1 of 2 confirmed                              ▸   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ GARDENS tab: one row per garden — alphabetical, never ranked           │
│ ≡ Awka Hub   Season: InProgress · 2 campaigns   kept 8/9  exposure 14  │
└────────────────────────────────────────────────────────────────────────┘`,
W13: `┌────────────────────────────────────────────────────────────────────────┐
│ Hub      work (3) · assess (1) · certify (2) · ◉confirm (2) · history  │
├────────────────────────────────────────────────────────────────────────┤
│ Ready for confirmation — where you are named or fallback-eligible      │
│ ≡ Maria — Prune the north beds   (Rocinha)   ▓▓▓░░ 2 of 3          ▸   │
│ ≡ TAS — Field survey ride        (Awka)      ░░░░░ 0 of 1          ▸   │
└────────────────────────────────────────────────────────────────────────┘`,
W14: `┌── Create assessment — step 1 additions ──────────────────┐
│ cycle    [ Season of First Rains ▾ ]        NET-NEW      │
│ kind     ◉ Baseline   ○ Re-assessment (delta)            │
│ baseline [ pick prior baseline… ▾ ]   (delta only)       │
│ ⚠ one baseline per garden/cycle/domain — duplicate       │
│   attempts point at the existing record                  │
└──────────────────────────────────────────────────────────┘`,
W15: `│ … field notes (existing, untouched) …        │
├──────────────────────────────────────────────┤
│ PROMISES                                     │
│ This garden is midway through its Season     │
│ of First Rains.                              │
│ ▓▓▓▓▓▓▓▓▓░░░░  runs through Aug 30           │
│ 9 promises made, 7 kept so far               │
│ Fulfilled promises from this cycle are       │
│ anchored in the certificates below.          │
├──────────────────────────────────────────────┤
│ … impact certificates (existing) …           │`,
W16: `├──────────────────────────────────────────────┤
│ PROMISES                                     │
│ Work that starts as a promise kept           │
│ 11 gardens with live pools · 43 promises     │
│ fulfilled this season                        │
│ A promise is offered, taken up, worked,      │
│ witnessed, and confirmed by the person it    │
│ was made to.                                 │
│ [ See the gardens ▸ ]                        │
└──────────────────────────────────────────────┘`,
W21: `┌─ Settlement (Celo) ────────────────────────────────────────────────────┐
│ no settlement account yet   [ Set up settlement account ]              │
│                                                                        │
│  — once registered —                                                   │
│ Safe celo:0x9a…4f (active) · balance 1,240 G$ · allowance 500 G$/wk    │
│ member delivery: enabled · changed by 0x9a…4f · Jul 30 · evidence ↗    │
│ Functions: subscription funded · DON healthy · last callback 4m ago    │
│ Disbursements                                                          │
│ ≡ Maria — 20 G$    (Queued)                        [ add to batch ]    │
│ ≡ João — 15 G$     (Failed: reason ▸) [ Requeue ] [ Cancel… ]          │
│ ≡ Ana — 20 G$      (Reported · checking receipt) [ request details ]   │
│ ≡ Kofi — 20 G$     (Verified ↗ Celo tx)                                │
│ [ Create batch (2) ]                                                   │
└────────────────────────────────────────────────────────────────────────┘`,
W22: `┌── Execute batch #12 — Rocinha ───────────────────────────┐
│ 2 of max 24 immutable members · 35 G$ · Safe 0x9a…4f     │
│ ≡ Maria — 20 G$ → 0x12…9a                                │
│ ≡ João — 15 G$ → 0x77…3c                                 │
│ [ Open in Safe app ↗ ]                                   │
│ [ Mark executing ]                                       │
│ then [ Report Celo transaction hash… ]                   │
│      [ Request receipt verification ]                    │
│ or   [ Record failed — reason… ]                         │
├──────────────────────────────────────────────────────────┤
│ Reported · checking finalized Celo receipt               │
│ request 0x71…c2 · Chainlink Functions                    │
│ Infrastructure timeout: [ Request again ]                │
│ Receipt invalid: batch stays immutable; for each member  │
│                   [ Requeue ] [ Cancel with reason… ]     │
└──────────────────────────────────────────────────────────┘`,
W23: `├──────────────────────────────────────────────┤
│ Support received (G$ · Celo)          128 G$ │
│ ≡ +20 G$ — Prune the north beds  (arrived ↗) │
│ [ Send G$ ]                                  │
├──────────────────────────────────────────────┤
│ Send G$                                      │
│ to [ address or member… ]  amount [    ] G$  │
│ "Sent from your account on Celo.             │
│  No gas needed."                             │
│ [ Send ]                                     │
└──────────────────────────────────────────────┘`,
W23G: `┌─ G$ member delivery ─────────────────────────┐
│ Planned · not available yet                  │
│ The Celo account and sponsored-send path has │
│ not passed its round-trip check. Safe-to-Safe│
│ garden funding may continue, but member      │
│ delivery and Send G$ stay unavailable.       │
│ [ View technical status ]                    │
└──────────────────────────────────────────────┘`,
MF1: `┌─ Pool ─────────────────────────────────────────────────────────────┐
│ (Ready) charter ✓ baseline ✓ cap 24                                │
│ [ Open pool ]                    [ Edit charter ] [ Pause… ]       │
│  — once Open —                                                     │
│ [ Close pool… ]  after the last cycle composts                     │
└────────────────────────────────────────────────────────────────────┘`,
MF3: `┌──────────────────────────────────────────────┐
│ (Expired)  This promise ran through Aug 12.  │
│ The season moved on — you can offer it again.│
│ [ Offer again ]                              │
└──────────────────────────────────────────────┘`,
MF4: `┌─ Lapsed this cycle ────────────────────────────────────────────────────┐
│ ≡ Field survey  (Request)(Expired)  due Jul 2 · 0 of 1 taken up        │
│                                  [ Re-seed… ]  [ View history ]        │
└────────────────────────────────────────────────────────────────────────┘`,
MF5: `│ ≡ ··waiting·· Compost workshop   (Offered)   │
│   waiting for your garden membership —       │
│   will send once you're welcomed in          │`,
MF6: `┌──────────────────────────────────────────────┐
│ Evidence attached: 1 · no work required      │
│ [ Send for confirmation ]                    │
│ the person this promise was made to          │
│ confirms it was kept                         │
└──────────────────────────────────────────────┘`,
MF8: `┌──────────────────────────────────────────────┐
│ Take this up…                                │
│ ◉ as myself                                  │
│ ○ for Awka Hub (you steward this garden)     │
│ Working for the garden: its account makes    │
│ the promise; you remain the requester.       │
│ [ Continue ]                      [ Cancel ] │
└──────────────────────────────────────────────┘`,
MF9: `┌── Season of First Rains — report ────────────────────────────────┐
│ 14 promises · 11 kept · 2 expired · 1 cancelled                  │
│ units: 61 of 74 promised                                         │
│ [ Compost this season ]                    [ Export… flagged ]   │
└──────────────────────────────────────────────────────────────────┘`,
MF10: `┌──────────────────────────────────────────────┐
│ Season of First Rains — season closed        │
│ 11 of 14 promises kept · 61 units            │
│ ready for the next season                    │
└──────────────────────────────────────────────┘`,
MF13: `┌── Attach assessment ─────────────────────────┐
│ provider garden: AgroforestDAO               │
│ ◉ Baseline — AGRO — Jul 2   (v3)             │
│ ○ Delta — AGRO+EDU — Jul 9  (v3)             │
│ [ Attach ]                        [ Cancel ] │
└──────────────────────────────────────────────┘`,
WFLOW: `┌──────────────────────────────────────────────┐
│ ✕  Submit work        Intro ● Media ● Rev ◉  │
├──────────────────────────────────────────────┤
│ Review                                       │
│ ≡ 2 photos · pruning session                 │
│ fulfills: Plant 200 seedlings (Offer · AGRO) │
│ [ Submit work ]                              │
└──────────────────────────────────────────────┘
existing Garden-tab work flow — only the
"fulfills:" row is new (MF-7, UX:174)`,
HUBWORK: `┌──────────────────────────────────────────────────────────┐
│ Hub   ◉work (3) · assess · certify · confirm · history   │
├──────────────────────────────────────────────────────────┤
│ ≡ Pruning session — Plant 200 seedlings                  │
│   [ Approve ]  [ Reject ]                                │
└──────────────────────────────────────────────────────────┘
existing Work stage — approval rails untouched (UX:285)`,
C1: `┌──────────────────────────────────────────────┐
│ Rocinha Community Garden                    │
│ This season · promises and progress         │
├──────────────────────────────────────────────┤
│ Needs                             [Explore] │
│ [All] [Requests] [Offers] [Initiatives]     │
├──────────────────────────────────────────────┤
│ REQUEST · THIS MONTH                         │
│ Elders need reliable market rides           │
│ Better: two rides each market day           │
│ Agro · Education · 8 neighbors agree        │
│ Acknowledged · In progress                  │
│                          [View] [Agree]      │
├──────────────────────────────────────────────┤
│    Needs          ＋ Create          Profile │
└──────────────────────────────────────────────┘`,
C3: `┌──────────────────────────────────────────────┐
│ Create                                1 of 3 │
│ What are you bringing to the community?     │
├──────────────────────────────────────────────┤
│ ◉ I need help                               │
│   Ask for something the community can meet. │
│ ○ I can offer something                     │
│ ○ I want to organize something              │
├──────────────────────────────────────────────┤
│ Tell us in your words                        │
│ [● Record]  or  [Type here…                ]│
│ Audio is kept · transcript can be edited    │
├──────────────────────────────────────────────┤
│ [Save and leave]                 [Continue] │
└──────────────────────────────────────────────┘`,
C4: `┌──────────────────────────────────────────────┐
│ Review                                3 of 3 │
│ REQUEST · THIS MONTH                         │
│ Elders need reliable market rides           │
│ Better: two rides each market day           │
│ Audio 0:42 · 2 photos                        │
├──────────────────────────────────────────────┤
│ SAVED ON THIS DEVICE                         │
│ Waiting for garden membership. No send      │
│ attempts have been used.                    │
│ [About membership] [Edit] [Cancel] [Delete]│
├──────────────────────────────────────────────┤
│ [Share with my garden]                       │
└──────────────────────────────────────────────┘`,
C5: `┌──────────────────────────────────────────────┐
│ ← Elders need reliable market rides          │
│ REQUEST · THIS MONTH                         │
│ Moderation: Acknowledged                     │
│ Progress: In progress                        │
├──────────────────────────────────────────────┤
│ Your neighbor's words                        │
│ “Market days are hard for elders…” [▶ audio]│
├──────────────────────────────────────────────┤
│ What followed                                │
│ ✓ Need acknowledged                         │
│ ✓ Promise: 16 market rides this season      │
│ ● Work: 6 rides approved                    │
│ ○ Assessment and eligible confirmation      │
│ ○ Fulfillment and community testimony       │
├──────────────────────────────────────────────┤
│ Funding context                              │
│ 120 G$ funding attribution verified         │
│ Funding supports the garden; it is not escrow│
├──────────────────────────────────────────────┤
│ [Agree]                       [Add testimony]│
└──────────────────────────────────────────────┘`,
C6: `┌──────────────────────────────────────────────┐
│ Profile                                      │
├──────────────────────────────────────────────┤
│ Garden membership                            │
│ Rocinha · Waiting for operator approval     │
│ [How this works] [Cancel request]*           │
├──────────────────────────────────────────────┤
│ Saved and sending                            │
│ Need · Waiting for membership       [Edit]  │
│ Signal · Offline                    [Retry] │
│ Testimony · Upload failed            [Retry]│
├──────────────────────────────────────────────┤
│ Needs your confirmation                      │
│ Market rides · work is ready to review      │
│ You are the eligible Request creator        │
│ [Review evidence] [Confirm fulfillment]     │
└──────────────────────────────────────────────┘`,
C9: `┌──────────────────────────────────────────────────────────────┐
│ Community / For the gathering                               │
│ [Fresh Needs] [Confirmations] [Recent changes] [Print]      │
├──────────────────────────────────────────────────────────────┤
│ REQUEST · WEEK · Moderation: none · Progress: open          │
│ Water is pooling beside the school path                     │
│ Better: the path stays passable after rain                  │
│ Domains [Waste ×] [＋ Add domain]                            │
│ [Acknowledge] [Merge…] [Decline…] [Hide…]                  │
├──────────────────────────────────────────────────────────────┤
│ OFFER · SEASON · Acknowledged · Open                        │
│ Tool library for weekend work days                          │
│ No domain assigned                     [Seed a commitment]  │
└──────────────────────────────────────────────────────────────┘`,
C10: `┌──────────────────────────────────────────────────────────────┐
│ Community / Seed commitment                                 │
│ From Need: Water beside the school path                     │
├──────────────────────────────────────────────────────────────┤
│ Need UID              [0x91…]  linked, read-only            │
│ Pool / cycle          [Choose…]                             │
│ Offer or Request      [Choose…]                             │
│ Units and target      [________] [________]                  │
│ Domains suggested    [Waste ×] [＋ Add]                     │
│ Confirmer rule       [____________________]                  │
├──────────────────────────────────────────────────────────────┤
│ Suggestions are not saved until you review every field.     │
│ [Cancel]                       [Review commitment]           │
└──────────────────────────────────────────────────────────────┘`,
};

const FT: Record<string, string> = {
  W1: "W1 · Pool tab (garden detail)", W1P: "W1 · claim-request panels (pending/declined)", W1S: "W1 · claim-request panels (superseded/accepted)",
  W2: "W2 · Commitment detail", W3: "W3 · Offer/request creation", W4: "W4 · Confirmation sheet", W5: "W5 · WalletDrawer pools panel",
  W6: "W6 · Home summary card", W7: "W7 · Garden Pool tab (admin)", W7X: "W7 · claim outcomes", W8: "W8 · Seeding console",
  W9: "W9 · Analog capture", W10: "W10 · Commitment dialog (admin)", W11: "W11 · Open-cycle allocation", W12: "W12 · Community → Pools",
  W13: "W13 · Hub Confirm stage", W14: "W14 · Assessment v3 additions", W15: "W15 · Garden pool story (public)", W16: "W16 · /impact promises (public)",
  W21: "W21 · Settlement section (admin)", W22: "W22 · Batch + oracle console", W23: "W23 · Wallet G$ + send", W23G: "W23 · delivery blocked",
  MF1: "MF-1 · Pool lifecycle actions (proposed)", MF3: "MF-3 · Expired band (proposed)", MF4: "MF-4 · Expiry queue (proposed)",
  MF5: "MF-5 · Membership-wait chrome (proposed)", MF6: "MF-6 · Send for confirmation (proposed)", MF8: "MF-8 · Provider-context chooser (proposed)",
  MF9: "MF-9 · Reconciliation report (proposed)", MF10: "MF-10 · Cycle summary card (proposed)", MF13: "MF-13 · Attach-assessment picker (proposed)",
  WFLOW: "Existing work flow (+ fulfills row)", HUBWORK: "Existing Hub Work stage",
  C1: "CI-W1 · Needs board (Sept)", C3: "CI-W3 · Create — intent + words (Sept)", C4: "CI-W4 · Review + queue state (Sept)",
  C5: "CI-W5 · Need detail (Sept)", C6: "CI-W6 · Profile (Sept)", C9: "CI-W9 · Gathering + triage (Sept)", C10: "CI-W10 · Seed from Need (Sept)",
};

// ---------- Hotspot registry: every drawn control answers ----------
type Hot = { m: string; l: string; to?: string; info?: string };
const HOTMAP: Record<string, Hot[]> = {
W1: [
  { m: "[ Offer support ]", l: "Offer support", to: "frame:W3", info: "Starts the creation flow with direction = offer (UX:120). Walked in SB-1." },
  { m: "[ Request help ]", l: "Request help", to: "frame:W3", info: "Creation flow with direction = request. Walked in SB-2." },
  { m: "[ Take this up ]", l: "Take this up (open claim)", to: "frame:W2", info: "Open mode: claim job → optimistic Accepted (UX:129). Walked in SB-1." },
  { m: "[ Ask to take this up ]", l: "Ask to take this up (steward-reviewed)", to: "frame:W1P", info: "Approval-gated: creates a claim request with stored terms; the commitment stays available to others (UX:99). Walked in SB-3." },
  { m: "Scope: [All current] [Season] [Market rides]", l: "Scope control", info: "Filters the list; every aggregate names its scope — Season and Campaigns never blur (UX:127)." },
  { m: "(All)(Offers)(Requests)(Matched)(Mine)", l: "Filter chips", info: "Client-local filter chips (admin AdminFilterChip is admin-only)." },
  { m: "My commitments", l: "My commitments strip", to: "frame:W5", info: "Your own promises across gardens live in the WalletDrawer pools panel (UX:186)." },
  { m: "Home         Garden         Profile", l: "AppBar", info: "Unchanged three-tab AppBar; the Garden tab is the existing work-submission flow (UX:116)." },
],
W1P: [
  { m: "[Ask again]", l: "Ask again", info: "Creates a FRESH request while the commitment is claimable — never retries the declined row (UX:105)." },
  { m: "[Back to browse]", l: "Back to browse", to: "frame:W1", info: "Declined/superseded exits return to browse." },
],
W1S: [
  { m: "[Open commitment]", l: "Open commitment", to: "frame:W2", info: "Acceptance names the counterparty / provider garden (UX:104)." },
  { m: "[Back to browse]", l: "Back to browse", to: "frame:W1" },
],
W2: [
  { m: "[ + Add ]", l: "Add evidence", info: "W2a attach sheet: photo / link / note → one evidence job per submit; fully offline (UX:159)." },
  { m: "[ Submit work for this promise ]", l: "Submit work for this promise", to: "frame:WFLOW", info: "Deep-links the existing Garden-tab work flow with commitment context (UX:174). DomainImpact only." },
  { m: "[ Link existing work ]", l: "Link existing work", info: "Picker of your approved/pending works → workLink job (UX:140)." },
  { m: "[ Confirm: promise kept ]", l: "Confirm", to: "frame:W4", info: "Visible only to eligible confirmers while ReadyForConfirmation — the provider never sees it (UX:142)." },
  { m: "Reward: 20 DAI from the garden jar · pending", l: "Declared reward row", info: "Reference only — no custody. When a G$ disbursement exists, settlement status replaces this line (SS:532)." },
  { m: "recorded on Arbitrum", l: "Chain phrasing", info: "Chain vocabulary lives on the detail engage layer only — never on browse cards (UX:436)." },
],
W3: [
  { m: "[ Continue ]", l: "Continue", info: "Four steps: what + cycle scope → how much → anchors (DomainImpact only) → review (UX:150-153)." },
  { m: "[ Make this offer ]", l: "Make this offer", to: "frame:W1", info: "Enqueues the commitment job; returns to the pool tab with an optimistic queued card (UX:212)." },
],
W4: [
  { m: "[ Confirm — promise kept ]", l: "Confirm — promise kept", to: "frame:W2", info: "Positive-only confirmation job; the Nth confirmation flips Fulfilled (CS:139)." },
  { m: "[ Not yet — tell the stewards why ]", l: "Not yet", to: "frame:W10", info: "Requires a reason → online raiseDispute. It never cancels the promise (UX:167)." },
  { m: "Provider Maria cannot confirm this delivery.", l: "Provider exclusion", info: "Provider self-confirmation is blocked everywhere, including steward fallback (UX:32)." },
],
W5: [
  { m: "Maria — Prune the north beds   (Rocinha) ▸", l: "Pending confirmation", to: "frame:W4", info: "Inbox of promises waiting on YOUR confirmation, across gardens (UX:185)." },
  { m: "Ride to market", l: "My commitment", to: "frame:W2" },
  { m: "··queued··", l: "Queued row", info: "Offline-queued job chrome; syncs when connected (UX:237)." },
],
W6: [
  { m: "Promises kept this cycle", l: "Home summary card", info: "At most one card on /home; absolute numbers below the small-community threshold (UX:191)." },
],
W7: [
  { m: "[ Pause… ]", l: "Pause pool (reason)", info: "pausePool with mandatory reason CID; members keep evidence/linkage + recovery (UX:60)." },
  { m: "[ Edit charter ]", l: "Edit charter", info: "setPoolCharter — one of the three readiness inputs (UX:269)." },
  { m: "[ Close Season ]", l: "Close Season", info: "closeCycle — the reconcile act; commitments derive Reconciled (CS:118). Walked in SB-9." },
  { m: "[ New Campaign ]", l: "New Campaign", info: "seedCycle — any number of concurrent Campaigns; a second Season is blocked (UX:66)." },
  { m: "[ Accept ]", l: "Accept claim", to: "frame:W7X", info: "Consumes the stored request terms; other pending rows become Superseded (CS:733)." },
  { m: "[ Decline… ]", l: "Decline claim (reason)", to: "frame:W7X", info: "Clears exactly one request; the claimant may ask again (CS:734)." },
  { m: "(+) seed", l: "Seed a commitment", to: "frame:W8" },
  { m: "scoped report ▸", l: "Cycle report", to: "frame:MF9", info: "Reconciliation report — proposed frame MF-9 (UX:75)." },
  { m: "≡ Prune the north beds", l: "Commitment row", to: "frame:W10" },
],
W7X: [
  { m: "A · Superseded", l: "Supersession", info: "Indexer side-effect of acceptance/cancel/expiry — never a user action, never a sync failure (DG:696)." },
],
W8: [
  { m: "[ Seed this commitment ]", l: "Seed this commitment", to: "frame:W7", info: "Console seeding — SeasonCampaign and OperatorCaptured exist only here (UX:150)." },
  { m: "claim mode  ◉ open   ○ steward-reviewed", l: "Claim mode", info: "Set at seeding; prefilled by context — protocol pool gated, garden campaigns open (decision #19)." },
  { m: "confirmers  [ + add address ]", l: "Confirmer rule", info: "Named any-N group; the accepted provider is excluded before threshold validation (UX:280)." },
],
W9: [
  { m: "search members", l: "Pick the member", info: "The member is the social source; the operator is only the recorder (UX:437)." },
  { m: "◉ their offer  ○ their request  ○ confirmation", l: "Capture kind", info: "Captured confirmations always carry a reason (UX:291)." },
],
W10: [
  { m: "[ Record payout ]", l: "Record payout", info: "AdminConfirmDialog captures the executed rail reference → RewardPaid; no value moves here (UX:302). August G$ rewards relabel this Queue disbursement (SS:535)." },
  { m: "[ Confirm as fallback… ]", l: "Confirm as fallback", info: "Steward fallback with mandatory reason — provider-steward blocked on-chain (CS:744)." },
  { m: "[ Raise dispute… ]", l: "Raise dispute", info: "Steward dispute entry, Accepted through Expired (UX:300)." },
  { m: "Resolve dispute", l: "Resolve dispute", info: "RestorePrevious / Fulfilled / Cancelled / Expired, each with a required reason; Expired can never resolve Fulfilled (CS:144)." },
],
W11: [
  { m: "[ Open cycle ]", l: "Open cycle", to: "frame:W7", info: "Emits the six-class bps snapshot; sum must equal 10000 (UX:322-330)." },
  { m: "preset  ◉ Garden-led (default)", l: "Allocation presets", info: "Presets prefill an editable bps editor; soft warning under 1500 treasury bps." },
],
W12: [
  { m: "[ Accept ]", l: "Accept a garden claim", info: "Protocol steward accepts stored terms; providerGarden derives (CS:733). Walked in SB-13." },
  { m: "Field survey — 1 of 2 confirmed", l: "Confirmations queue", to: "frame:W10" },
  { m: "20 DAI · protocol treasury", l: "Funding view", info: "Reward references only; co-funded entries name the owning garden (UX:313). Route queueing control is MF-11 (undrawn)." },
  { m: "alphabetical, never ranked", l: "No-ranking invariant", info: "Cross-garden rows sort alphabetically; no rank column ever (UX:314)." },
],
W13: [
  { m: "Maria — Prune the north beds", l: "Confirm queue row", to: "frame:W10", info: "Queue of promises where you are named or fallback-eligible (UX:318)." },
],
W14: [
  { m: "◉ Baseline   ○ Re-assessment (delta)", l: "Assessment kind", info: "Baseline: evaluator or operator. Delta: Evaluator Hat only (CS:760-761)." },
],
W15: [
  { m: "9 promises made, 7 kept so far", l: "Counts-only sentence", info: "Percentages render publicly only at ≥5 due commitments and ≥3 promisers (UX:350)." },
],
W16: [
  { m: "[ See the gardens ▸ ]", l: "See the gardens", info: "Links to /gardens; no per-garden table on /impact — comparison drifts toward ranking (UX:354)." },
],
W21: [
  { m: "[ Set up settlement account ]", l: "Set up settlement account", info: "registerSettlementAccount — Celo 42220, 2-of-3 recovery, no owner/executor overlap (SS:169)." },
  { m: "member delivery: enabled", l: "Delivery-gate status row", info: "Read-only (#34f): enabled/disabled · changed by · date · evidence. The flip is owner-only ops (SS:172)." },
  { m: "[ add to batch ]", l: "Add to batch", info: "Batches hold 1–24 immutable members (SS:116)." },
  { m: "[ Requeue ]", l: "Requeue", info: "Failed → Queued; clears the old batchId, attempts++ (SS:182)." },
  { m: "[ Cancel… ]", l: "Cancel disbursement", info: "Queued/Failed → Cancelled; frees the commitment for a fresh queue (SS:183)." },
  { m: "[ request details ]", l: "Verification request", info: "Reported + active request = the derived 'checking receipt' (DG:666)." },
  { m: "[ Create batch (2) ]", l: "Create batch", to: "frame:W22" },
],
W22: [
  { m: "[ Open in Safe app ↗ ]", l: "Open in Safe app", info: "The value leg happens in the Safe app — Roles-scoped G$ transfer, outside Green Goods (WF settlement notes)." },
  { m: "[ Mark executing ]", l: "Mark executing", info: "Executor-only (SS:176). Pilot operators hold the role (#34e); a missing role shows a visible guard state." },
  { m: "[ Report Celo transaction hash… ]", l: "Report tx hash", info: "Executor-only; ref mandatory and globally unused. Reported is never member-visible proof (SS:177)." },
  { m: "[ Request receipt verification ]", l: "Request verification", info: "Pinned Chainlink Functions request; only its callback can produce Verified (SS:178-179)." },
  { m: "[ Request again ]", l: "Request again", info: "Infrastructure timeout: expire the stale request, then a fresh one — no state loss (SS:180)." },
  { m: "[ Cancel with reason… ]", l: "Cancel member", info: "Receipt-invalid recovery is per-member; the batch itself stays immutable (SS:394)." },
],
W23: [
  { m: "[ Send G$ ]", l: "Send G$", info: "Online-only wallet action, sponsored gas — never enters the offline queue (UX:219)." },
  { m: "[ Send ]", l: "Send", info: "Wallet-pending → confirmed; failure surfaces inline with retry (UX:219)." },
],
W23G: [
  { m: "[ View technical status ]", l: "Technical status", info: "AA/paymaster gate failed: member delivery + sends stay off; Safe-to-Safe garden funding continues (SS:425)." },
],
MF1: [
  { m: "[ Open pool ]", l: "Open pool", info: "openPool → PoolOpened. Adopted per #34a — closes the Ready→Open deadlock (CS:100, CS:727)." },
  { m: "[ Close pool… ]", l: "Close pool", info: "After the last cycle composts (CS:102); then Compost/Reopen per §4.1." },
],
MF3: [{ m: "[ Offer again ]", l: "Offer again", to: "frame:W3", info: "Per-cycle renewal — a fresh commitment, prefilled (UX:94)." }],
MF4: [{ m: "[ Re-seed… ]", l: "Re-seed", to: "frame:W8", info: "Lapsed seeded promises re-enter the seeding console prefilled (UX:94)." }],
MF5: [{ m: "··waiting··", l: "Membership wait", info: "waiting_for_hat — no retries consumed; resumes when the hat lands (#34c). The join-request approval (#35) is the trigger." }],
MF6: [{ m: "[ Send for confirmation ]", l: "Send for confirmation", to: "frame:W4", info: "Evidence-only kinds; DomainImpact is rejected on-chain (CS:138b)." }],
MF8: [
  { m: "[ Continue ]", l: "Continue", to: "frame:W1P", info: "Garden claim: claimant = GardenAccount, requestedBy = you (CS:581)." },
  { m: "[ Cancel ]", l: "Cancel", info: "No custody, no member-delivery fallback via garden claims (AM:38-39)." },
],
MF9: [
  { m: "[ Compost this season ]", l: "Compost this season", info: "compostCycle → archived under pool history (CS:119)." },
  { m: "[ Export… flagged ]", l: "Export (flagged)", info: "Flagged, not designed — §9 pattern: flag missing primitives, never invent them." },
],
MF13: [
  { m: "[ Attach ]", l: "Attach assessment", info: "Only non-revoked v2/v3 with recipient = providerGarden appear (UX:287)." },
  { m: "[ Cancel ]", l: "Cancel" },
],
WFLOW: [
  { m: "fulfills: Plant 200 seedlings (Offer · AGRO)", l: "fulfills row (NEW)", info: "The only delta to the existing flow — commitment context on Review (MF-7, UX:174)." },
  { m: "[ Submit work ]", l: "Submit work", to: "frame:W2", info: "Existing work job + meta.commitmentId; the queue auto-links after sync (UX:220)." },
],
HUBWORK: [
  { m: "[ Approve ]", l: "Approve", info: "Existing WorkApproval rails → onWorkApproved → ApprovedWorkCounted (CS:737)." },
],
C1: [
  { m: "[View] [Agree]", l: "View / Agree", to: "frame:C5", info: "Agree = a NeedSignal; board order is recency + status, never funding (CI-SPEC:257)." },
  { m: "＋ Create", l: "Create", to: "frame:C3" },
  { m: "[Explore]", l: "Explore", info: "Global read-only discovery — no signal buttons outside your garden (CI-WF:64)." },
],
C3: [
  { m: "[Continue]", l: "Continue", to: "frame:C4" },
  { m: "[● Record]", l: "Record", info: "Voice-first capture; transcript editable; typing fallback always present (CI-WF:122)." },
],
C4: [
  { m: "[Share with my garden]", l: "Share with my garden", to: "frame:C1", info: "Offline-queueable Need; waiting_for_hat consumes no send attempts (CI-WF:153)." },
  { m: "[About membership]", l: "About membership", info: "Join submission + membership queue stay gated on RESR-64 (CI-WF:260); decision #35 designs the garden-side queue." },
  { m: "[Edit] [Cancel] [Delete]", l: "Draft controls", info: "S6 verbs: edit/retry/cancel/delete with media retained (LAP:191)." },
],
C5: [
  { m: "[Agree]", l: "Agree", info: "NeedSignal — same-garden Community Hat members only (CI-WF:64)." },
  { m: "[Add testimony]", l: "Add testimony", info: "Community-Hat EAS attestation — September-realized (#34g; CS:762)." },
  { m: "[▶ audio]", l: "Play audio", info: "The neighbor's own words stay primary; protocol evidence renders separately (CI-WF:162)." },
],
C6: [
  { m: "[Review evidence] [Confirm fulfillment]", l: "Eligible confirmation", info: "Author-confirm consumes the shared confirmation primitive; a provider never sees a self-confirm CTA (CI-WF:222)." },
  { m: "[Cancel request]*", l: "Cancel request", info: "Shown only after RESR-64 locks a transport with a defined cancellation API (CI-WF:222)." },
],
C9: [
  { m: "[Acknowledge]", l: "Acknowledge", info: "Typed moderation; moderation and progress are separate axes (CI-SPEC:267)." },
  { m: "[Merge…]", l: "Merge", info: "Typed same-garden canonical-Need picker + separate rationale (CI-WF:311)." },
  { m: "[Seed a commitment]", l: "Seed a commitment", to: "frame:C10" },
],
C10: [
  { m: "[Review commitment]", l: "Review commitment", info: "Suggestions are not saved until the operator reviews every field; unreachable-threshold errors surface before acceptance (CI-WF:335-340)." },
  { m: "[Cancel]", l: "Cancel", to: "frame:C9" },
],
};

// ---------- Scenes ----------
type Scene = {
  f: string; hot?: { m: string; l: string } | null; alts?: { m: string; l: string; to: string }[];
  marks?: string[]; who?: string; surface?: string;
  st?: string; ev: string; cite?: string; note?: string;
  br?: { l: string; to?: string }[]; mf?: boolean;
};
type SB = { id: string; n: number; title: string; persona: string; scen: string; surface: string; steps: Scene[] };

const SBS: SB[] = [
{ id: "sb1", n: 1, title: "Offer → promise kept", persona: "Gardener (Maria) + recipient", scen: "S1 · TAS workshop", surface: "Client PWA", steps: [
  { f: "W1", hot: { m: "[ Offer support ]", l: "Offer support" }, who: "Maria", st: "Pool Open · cycle Open", ev: "routes to /home/:id/pool/new?direction=offer", cite: "WF:79 · UX:120" },
  { f: "W3", hot: { m: "[ Make this offer ]", l: "Make this offer" }, who: "Maria", st: "Draft (local)", ev: "commitment job queued · optimistic card + ··queued·· badge", cite: "UX:212", br: [{ l: "Offline / retry lanes", to: "sb7:2" }] },
  { f: "W1", hot: null, marks: ["··queued··"], st: "Offered (on-chain)", ev: "sync → CommitmentCreated · SyncStatusBar clears", cite: "CS:132" },
  { f: "W1", hot: { m: "[ Take this up ]", l: "Take this up" }, alts: [{ m: "[ Ask to take this up ]", l: "steward-reviewed variant", to: "sb3:0" }], who: "João (recipient)", st: "Offered", ev: "claim job → CommitmentAccepted + UnitsCommitted · provider = Maria (Offer creator) · confirmer default = João", cite: "CS:133 · AM:34" },
  { f: "W2", hot: { m: "[ + Add ]", l: "Add evidence" }, who: "either party", st: "Accepted → Active", ev: "evidence job (W2a photo/note) → EvidenceAttached", cite: "CS:739" },
  { f: "MF6", hot: { m: "[ Send for confirmation ]", l: "Send for confirmation" }, st: "EvidenceSubmitted", ev: "confirmation{submit} → CommitmentReadyForConfirmation (evidence-only SupportService, count 0)", cite: "UX:141 · CS:138b", mf: true },
  { f: "W4", hot: { m: "[ Confirm — promise kept ]", l: "Confirm — promise kept" }, alts: [{ m: "[ Not yet — tell the stewards why ]", l: "Not yet → dispute", to: "sb5:0" }], who: "João", st: "ReadyForConfirmation", ev: "ConfirmationRecorded 1 of 1 → CommitmentFulfilled + UnitsFulfilled", cite: "CS:139", note: "the sheet names the flip: Offer · provider Maria · recipient confirms — provider excluded" },
  { f: "W2", hot: null, marks: ["Reward: 20 DAI from the garden jar · pending"], st: "Fulfilled", ev: "hero fires once, on sync completion (client only)", cite: "UX:197-199" },
  { f: "W15", hot: null, surface: "editorial", marks: ["9 promises made, 7 kept so far"], st: "aggregate", ev: "pool story counts tick — counts-only below the small-community threshold", cite: "UX:350" },
]},
{ id: "sb2", n: 2, title: "Request → help arrives", persona: "Gardener (Ana) + helper", scen: "S2 · evidence-only", surface: "Client PWA", steps: [
  { f: "W1", hot: { m: "[ Request help ]", l: "Request help" }, who: "Ana", ev: "routes to /pool/new?direction=request", cite: "WF:79" },
  { f: "W3", hot: { m: "[ Make this offer ]", l: "Ask for this help" }, who: "Ana", st: "Draft → Requested", ev: "commitment job → CommitmentCreated · anchors step skipped (SupportService)", cite: "UX:153 · WF:199", note: "frame drawn for the offer direction; the request wording is 'Ask for this help'" },
  { f: "W1", hot: { m: "[ Ask to take this up ]", l: "I can help (open mode)" }, who: "João", st: "Requested", ev: "claim → CommitmentAccepted · provider = João (claimant) · confirmer = Ana (Request creator)", cite: "UX:85 · AM:34", note: "drawn card shows the steward-reviewed helper; this walk runs open-claim" },
  { f: "W2", hot: { m: "[ + Add ]", l: "Add evidence" }, who: "João", st: "EvidenceSubmitted", ev: "evidence job → EvidenceAttached", cite: "UX:214" },
  { f: "MF6", hot: { m: "[ Send for confirmation ]", l: "Send for confirmation" }, st: "EvidenceSubmitted", ev: "confirmation{submit} → ReadyForConfirmation (creator, counterparty, or steward may send)", cite: "CS:741", mf: true },
  { f: "W4", hot: { m: "[ Confirm — promise kept ]", l: "Confirm — promise kept" }, alts: [{ m: "[ Not yet — tell the stewards why ]", l: "Not yet → dispute", to: "sb5:0" }], who: "Ana (creator)", st: "ReadyForConfirmation", ev: "ConfirmationRecorded → CommitmentFulfilled", cite: "CS:139", note: "claimant provides · request creator confirms (WF:224)" },
]},
{ id: "sb3", n: 3, title: "Steward-reviewed claim", persona: "Ana + João + Operator (David)", scen: "S3 · scarce crew slots", surface: "PWA + Admin", steps: [
  { f: "W1", hot: { m: "[ Ask to take this up ]", l: "Ask to take this up" }, who: "Ana", st: "request Pending", ev: "claim job → ClaimRequested — terms stored: claimant · requestedBy · kind · gardenContext · requestedAt", cite: "CS:133 · UX:99", br: [{ l: "network fails pre-event → ordinary retry, never Declined (UX:108)" }] },
  { f: "W1P", hot: null, who: "Ana", st: "Pending", ev: "'Waiting for steward' — no claimant-cancel exists; the commitment stays browseable to others", cite: "WF:112 · UX:103" },
  { f: "W1", hot: { m: "[ Ask to take this up ]", l: "João asks too" }, who: "João", st: "Pending ×2", ev: "second request row indexed", cite: "DG:684" },
  { f: "W7", hot: { m: "[ Decline… ]", l: "Decline Ana's row (reason)" }, alts: [{ m: "[ Accept ]", l: "or accept João now", to: "sb3:5" }], who: "David", surface: "admin", ev: "declineClaim + reason → ClaimDeclined — only Ana's row changes; João stays Pending", cite: "CS:734 · UX:105" },
  { f: "W1P", hot: { m: "[Ask again]", l: "Ask again" }, who: "Ana", st: "Declined", ev: "a fresh request record — never a retry of the declined row", cite: "UX:105" },
  { f: "W7", hot: { m: "[ Accept ]", l: "Accept João's row" }, who: "David", surface: "admin", ev: "acceptClaim consumes João's stored terms → CommitmentAccepted · every other pending row → Superseded", cite: "CS:733 · DG:696" },
  { f: "W1S", hot: null, who: "Ana", st: "Superseded", ev: "'Taken up by another provider' — resolution code names the cause; never a sync failure", cite: "UX:106 · DG:706" },
  { f: "W2", hot: null, who: "João", st: "Accepted", ev: "continues to work and evidence", br: [{ l: "Continue in SB-4", to: "sb4:0" }] },
]},
{ id: "sb4", n: 4, title: "Evidence, work linkage, assessment", persona: "Gardener + Evaluator (Dr. Chen) + Operator", scen: "S4 · AGRO+EDU", surface: "PWA + Admin", steps: [
  { f: "W2", hot: { m: "[ Submit work for this promise ]", l: "Submit work for this promise" }, alts: [{ m: "[ Link existing work ]", l: "or link existing work", to: "sb4:2" }], who: "provider", st: "Accepted", ev: "deep-links into the existing Garden-tab work flow with commitment context", cite: "UX:174" },
  { f: "WFLOW", hot: { m: "[ Submit work ]", l: "Submit work" }, marks: ["fulfills: Plant 200 seedlings (Offer · AGRO)"], ev: "work job (existing, + meta.commitmentId) → dependent workLink after sync", cite: "UX:174,220", mf: true },
  { f: "W2", hot: { m: "[ Link existing work ]", l: "Link existing work (post-hoc alt)" }, st: "Active", ev: "workLink job → WorkLinked", cite: "CS:735" },
  { f: "HUBWORK", hot: { m: "[ Approve ]", l: "Approve (existing rails)" }, who: "operator", surface: "admin", st: "PartiallyApproved 1 of 2", ev: "WorkApproval attest → onWorkApproved → ApprovedWorkCounted", cite: "CS:737" },
  { f: "HUBWORK", hot: { m: "[ Approve ]", l: "Approve the second work" }, who: "operator", surface: "admin", ev: "count reaches requiredApprovedWorkCount — assessment still declared", cite: "CS:138a" },
  { f: "W14", hot: null, who: "Dr. Chen", surface: "admin", marks: ["◉ Baseline   ○ Re-assessment (delta)"], ev: "delta assessment attested — extends Create Assessment; delta renders only for Evaluator-hat holders", cite: "WF:447-455" },
  { f: "MF13", hot: { m: "[ Attach ]", l: "Attach assessment" }, who: "operator or evaluator", surface: "admin", ev: "attachAssessment → auto-Ready re-run → CommitmentReadyForConfirmation", cite: "CS:740 · UX:287", mf: true },
  { f: "W2", hot: null, st: "ReadyForConfirmation", ev: "confirmation proceeds as SB-1", br: [{ l: "Confirm walk", to: "sb1:6" }] },
]},
{ id: "sb5", n: 5, title: "“Not yet” → dispute → resolutions", persona: "Recipient + Operator", scen: "S5", surface: "PWA + Admin", steps: [
  { f: "W4", hot: { m: "[ Not yet — tell the stewards why ]", l: "Not yet — tell the stewards why" }, who: "confirmer", st: "ReadyForConfirmation", ev: "required reason focuses → online raiseDispute → CommitmentDisputed (preDisputeState stored)", cite: "CS:143 · UX:426", br: [{ l: "tx fails → stays ReadyForConfirmation, inline retry (UX:217)" }] },
  { f: "W2", hot: null, st: "Disputed", ev: "banner 'under review by stewards' — CTAs frozen; never surfaced publicly", cite: "UX:95" },
  { f: "W10", hot: { m: "Resolve dispute", l: "Resolve dispute (4 outcomes + reason)" }, who: "David", surface: "admin", ev: "resolveDispute — RestorePrevious / Fulfilled / Cancelled / Expired; an Expired prior can never resolve Fulfilled", cite: "CS:144" },
  { f: "W2", hot: null, st: "restored", ev: "RestorePrevious returns the exact stored state — no unit movement", cite: "LAP:186" },
  { f: "W2", hot: null, ev: "every reason renders in the member timeline too", cite: "UX:300", note: "#34b: member pre-acceptance withdraw adopted (MF-2a); steward cancel placement still open (MF-2b)" },
]},
{ id: "sb6", n: 6, title: "Expiry → offer again", persona: "Owner + Operator + anyone", scen: "S1/S5 edge", surface: "PWA + Admin", steps: [
  { f: "W2", hot: null, st: "past due", ev: "expireCommitment is permissionless — admin sweep in August, keeper cron later (#34d)", cite: "CS:746" },
  { f: "MF3", hot: { m: "[ Offer again ]", l: "Offer again" }, who: "owner", st: "Expired", ev: "units released exactly once · pending claim requests → Superseded (COMMITMENT_EXPIRED)", cite: "CS:142", mf: true },
  { f: "W3", hot: { m: "[ Make this offer ]", l: "Make this offer (prefilled)" }, ev: "a fresh commitment — per-cycle renewal re-entry, not a state rewind", cite: "UX:94" },
  { f: "MF4", hot: { m: "[ Re-seed… ]", l: "Re-seed" }, who: "David", surface: "admin", ev: "lapsed seeded promise re-enters W8 prefilled", cite: "UX:94", mf: true },
]},
{ id: "sb7", n: 7, title: "Offline → queued → synced / waiting", persona: "Gardener", scen: "S6 · pt-BR proof", surface: "Client PWA", steps: [
  { f: "W3", hot: null, st: "offline mid-flow", ev: "draft persists locally (WorkDraftRecord semantics)", cite: "UX:155" },
  { f: "W3", hot: null, ev: "re-entry offers resume (DraftDialog pattern)", cite: "UX:155" },
  { f: "W1", hot: null, marks: ["··queued··"], st: "queued (optimistic)", ev: "submit offline → ··queued·· badge + SyncStatusBar + polite announcement", cite: "UX:237,427" },
  { f: "W1", hot: null, st: "Offered (on-chain)", ev: "connectivity returns → CommitmentCreated · 'N promises synced'", cite: "UX:427" },
  { f: "W1", hot: null, st: "Failed (local)", ev: "5 attempts exhausted → Failed chip · retry / discard · parseContractError", cite: "UX:240", br: [{ l: "Retry re-enters sync", to: "sb7:3" }] },
  { f: "MF5", hot: null, st: "waiting_for_hat", ev: "pre-flight membership check — no retries consumed; resumes on membership (#34c; join-request approval #35 is the trigger)", cite: "LAP:191", mf: true },
]},
{ id: "sb8", n: 8, title: "Analog capture + fallback", persona: "Operator (David) + member", scen: "S7 · device-free member", surface: "Admin + PWA", steps: [
  { f: "W9", hot: { m: "search members", l: "pick member + capture kind" }, who: "David", surface: "admin", ev: "capturedFor set · captured confirmations always carry a reason", cite: "WF:354-357" },
  { f: "W8", hot: { m: "[ Seed this commitment ]", l: "Record it" }, surface: "admin", ev: "commitment job (OperatorCaptured, onBehalfOf) → CommitmentCreated(creator = member, recordedBy = operator)", cite: "CS:730 · DG:236" },
  { f: "W2", hot: null, who: "member", st: "Offered", marks: ["(recorded by your operator on your behalf)"], ev: "chip: 'recorded by your operator on your behalf' — the promise stays the member's", cite: "WF:138 · UX:437" },
  { f: "W2", hot: { m: "[ + Add ]", l: "member adds evidence (offline ok)" }, who: "member", ev: "evidence job → EvidenceAttached", cite: "UX:214" },
  { f: "MF6", hot: { m: "[ Send for confirmation ]", l: "Send for confirmation" }, ev: "confirmation{submit} → ReadyForConfirmation (count 0 path)", cite: "CS:138b", mf: true },
  { f: "W4", hot: { m: "[ Confirm — promise kept ]", l: "counterparty confirms" }, alts: [{ m: "[ Not yet — tell the stewards why ]", l: "Not yet → dispute", to: "sb5:0" }], st: "ReadyForConfirmation", ev: "ConfirmationRecorded → CommitmentFulfilled — provider still excluded", cite: "CS:139" },
  { f: "W10", hot: { m: "[ Confirm as fallback… ]", l: "Confirm as fallback (reason)" }, who: "David", surface: "admin", ev: "variant: fallback with mandatory reason — provider-steward blocked (SelfConfirmation); overrides render visible markers", cite: "CS:744 · UX:287,301" },
]},
{ id: "sb9", n: 9, title: "Pool readiness → cycles", persona: "Operator", scen: "S5/S13 admin side", surface: "Admin (+ member echo)", steps: [
  { f: "W7", hot: null, st: "NotReady", ev: "checklist: charter · exposure cap · qualifying Baseline", cite: "UX:57,269" },
  { f: "W7", hot: { m: "[ Edit charter ]", l: "Edit charter + set cap" }, ev: "setPoolCharter · setProviderExposureCap (required before Ready)", cite: "CS:723,751" },
  { f: "W7", hot: null, st: "Ready", ev: "markPoolReady — spec-placed control (UX:269)", cite: "CS:724" },
  { f: "MF1", hot: { m: "[ Open pool ]", l: "Open pool" }, st: "Pool Open", ev: "openPool → PoolOpened — adopted onto the card (#34a); was the deadlock finding (openCycle needs pool Open, CS:727)", cite: "CS:100", mf: true },
  { f: "W7", hot: { m: "[ New Campaign ]", l: "Seed the Season (console flow)" }, ev: "seedCycle (pool Ready or Open) → CycleSeeded", cite: "CS:726" },
  { f: "W11", hot: { m: "[ Open cycle ]", l: "Open cycle" }, st: "Cycle Open", ev: "openCycle → CycleOpened — six-class bps snapshot, sum must equal 10000", cite: "CS:114 · UX:322" },
  { f: "W1", hot: null, surface: "pwa", marks: ["Seeded ─ ◉Open ─ In progress ─ Reviewing"], ev: "member echo: Season card live · derived InProgress/Reviewing overlays follow activity", cite: "CS:115-117" },
  { f: "W7", hot: { m: "[ Pause… ]", l: "Pause (reason)" }, st: "Paused", ev: "pausePool(reason) — member banner; create/claim/Ready-submit/confirm disabled, recovery stays available", cite: "UX:60" },
  { f: "W7", hot: null, st: "Open", ev: "resumePool clears the indexed reason", cite: "CS:725" },
  { f: "W7", hot: { m: "[ Close Season ]", l: "Close Season (reconcile)" }, st: "Reconciled", ev: "closeCycle → CycleClosed — commitments derive Reconciled", cite: "CS:118,140" },
  { f: "MF9", hot: { m: "[ Compost this season ]", l: "Compost this season" }, st: "Composted", ev: "reconciliation report → compostCycle → CycleComposted", cite: "UX:75", mf: true },
  { f: "MF10", hot: null, surface: "pwa", ev: "client cycle summary card + the medium hero, once", cite: "UX:200", mf: true },
  { f: "W7", hot: { m: "[ Cancel… ]", l: "variant: Cancel a cycle (reason)" }, ev: "cancelCycle → quiet member banner with reason · pool coda: close → compost → reopen (#34a)", cite: "UX:77 · CS:104" },
]},
{ id: "sb10", n: 10, title: "Declared reward → payout", persona: "Operator + Gardener", scen: "S13 · July's only rail", surface: "Admin + PWA", steps: [
  { f: "W8", hot: { m: "reward      source", l: "Declare reward (step 3)" }, who: "David", surface: "admin", ev: "reference only — the module never custodies funds", cite: "WF:339 · UX:280" },
  { f: "W2", hot: null, surface: "pwa", marks: ["Reward: 20 DAI from the garden jar · pending"], ev: "member reward row: '20 DAI from the garden jar · pending'", cite: "WF:159" },
  { f: "W13", hot: { m: "Maria — Prune the north beds", l: "open the confirm row" }, who: "David", surface: "admin", st: "ReadyForConfirmation", ev: "Hub Confirm stage — where you are named or fallback-eligible", cite: "WF:433" },
  { f: "W10", hot: null, surface: "admin", st: "Fulfilled", ev: "confirmFulfillment (ordinary named path — provider excluded)", cite: "CS:743" },
  { f: "W10", hot: { m: "[ Record payout ]", l: "Record payout" }, surface: "admin", ev: "AdminConfirmDialog captures the rail reference → recordRewardPaid → RewardPaid", cite: "CS:749", note: "#34h — the dry run runs this with a real minimal Cookie Jar withdrawal" },
  { f: "W2", hot: null, surface: "pwa", marks: ["Reward: 20 DAI from the garden jar · pending"], ev: "member row flips to 'reward released' — quiet admin confirmation only, celebration already fired client-side", cite: "UX:143,202" },
]},
{ id: "sb11", n: 11, title: "G$ support arrives (member)", persona: "Gardener", scen: "S8/S9 · TAS", surface: "Client PWA", steps: [
  { f: "W2", hot: null, marks: ["Reward: 20 DAI from the garden jar · pending"], st: "Queued/Executing", ev: "reward row: 'support on its way'", cite: "SS:532" },
  { f: "W2", hot: null, st: "Reported", ev: "'transfer reported; awaiting receipt check' — Reported is never member-visible proof", cite: "SS:177,532" },
  { f: "W2", hot: null, st: "Reported + request", ev: "'transfer reported; checking receipt' (active Functions request)", cite: "SS:532" },
  { f: "W2", hot: null, st: "Verified", ev: "'support arrived ↗' + Celo ref — the oracle callback is the only producer", cite: "SS:398 · AM:22" },
  { f: "W23", hot: { m: "[ Send G$ ]", l: "Send G$" }, marks: ["(arrived ↗)"], ev: "online transfer — sponsored gas, never enters the offline queue", cite: "UX:219 · SS:433" },
  { f: "W23", hot: { m: "[ Send ]", l: "Send" }, ev: "wallet-pending → confirmed; failure surfaces inline with retry", cite: "UX:219" },
  { f: "W2", hot: null, st: "Failed (disbursement)", ev: "'still arranging support — your promise is recorded' — the commitment stays Fulfilled", cite: "SS:532 · DG:666", br: [{ l: "Operator recovery", to: "sb12:7" }] },
  { f: "W23G", hot: null, st: "delivery blocked", ev: "AA gate failed → no balance or send; Safe-to-Safe garden funding continues · #34f makes the gate legible admin-side", cite: "SS:425" },
]},
{ id: "sb12", n: 12, title: "Batch execution + receipt check", persona: "Operator/Executor (one human, #34e)", scen: "S8/S9 · first execution", surface: "Admin + Safe app", steps: [
  { f: "W21", hot: { m: "[ Set up settlement account ]", l: "Set up settlement account" }, ev: "registerSettlementAccount — Celo 42220 · 2-of-3 recovery · no owner/executor overlap", cite: "SS:169" },
  { f: "W12", hot: null, ev: "queueFunding — WorkingCapitalToProtocol then ProtocolToGarden, the only two routes (control undrawn — MF-11)", cite: "SS:174,536" },
  { f: "W10", hot: { m: "[ Record payout ]", l: "Queue disbursement (August relabel)" }, ev: "queueDisbursement — gated on memberDeliveryEnabled + Fulfilled", cite: "SS:173 · WF:520" },
  { f: "W21", hot: { m: "[ Create batch (2) ]", l: "Create batch" }, marks: ["member delivery: enabled"], ev: "createBatch — 1..24 immutable members, one executorGarden/source/token", cite: "SS:175" },
  { f: "W22", hot: { m: "[ Open in Safe app ↗ ]", l: "Open in Safe app (value leg)" }, surface: "safe", ev: "Roles-scoped G$ transfer from the garden Safe — outside Green Goods", cite: "WF:552" },
  { f: "W22", hot: { m: "[ Mark executing ]", l: "Mark executing → report hash" }, ev: "markBatchExecuting → reportBatchExecution (ref mandatory, reportedBy persisted) · missing role → visible guard state", cite: "SS:176-177" },
  { f: "W22", hot: { m: "[ Request receipt verification ]", l: "Request receipt verification" }, st: "Reported + request", ev: "pinned Functions request — state stays Reported, 'checking receipt' derived", cite: "SS:178" },
  { f: "W22", hot: null, marks: ["Infrastructure timeout: [ Request again ]"], ev: "oracle: Valid → BatchVerified ('support arrived') · ReceiptInvalid → Failed, per-member recovery · timeout → Request again · stale callback ignored", cite: "DG:586-644" },
  { f: "W21", hot: { m: "[ Requeue ]", l: "Requeue a failed member" }, ev: "requeue clears the old batchId, attempts++ · or cancel with reason", cite: "SS:182-183" },
]},
{ id: "sb13", n: 13, title: "Cross-garden protocol claim", persona: "Garden Operator (Leila)", scen: "S14", surface: "PWA + Admin", steps: [
  { f: "W1", hot: { m: "[ Ask to take this up ]", l: "Ask to take this up" }, who: "Leila", ev: "protocol commitment in garden context — steward-reviewed default (#19)", cite: "UX:129" },
  { f: "MF8", hot: { m: "[ Continue ]", l: "for Awka Hub → Continue" }, ev: "Garden claim: claimant = GardenAccount · requestedBy = Leila", cite: "CS:577-589", mf: true },
  { f: "W1P", hot: null, st: "Pending", ev: "canonical claimant + requested-by + provider context shown", cite: "UX:99" },
  { f: "W12", hot: { m: "[ Accept ]", l: "protocol steward: Accept" }, who: "protocol steward", ev: "accept consumes the stored terms → providerGarden derived · other pending rows Superseded", cite: "CS:733" },
  { f: "W2", hot: null, st: "Accepted", ev: "the garden works and proves — EAS recipient = providerGarden; the commitment stays owned by the root pool", cite: "CS:772" },
  { f: "W12", hot: { m: "Field survey — 1 of 2", l: "confirmations queue" }, ev: "protocol confirmations queue mirrors the Hub Confirm grammar", cite: "WF:417" },
  { f: "W10", hot: null, st: "Fulfilled", ev: "named confirmer (or reasoned fallback) confirms · co-funded reward references stay with the owning garden · never custody or member-delivery via garden claims", cite: "UX:313 · AM:38-39" },
]},
{ id: "sb14", n: 14, title: "Need → triage → seeded promise", persona: "Community (Kwame) + Operator", scen: "S10 · September", surface: "Community PWA + Admin", steps: [
  { f: "C3", hot: { m: "◉ I need help", l: "I need help (voice or text)" }, who: "Kwame", ev: "intent → NeedKind.REQUEST · words captured by voice or typing", cite: "CI-WF:96" },
  { f: "C4", hot: { m: "[Share with my garden]", l: "Share with my garden" }, marks: ["Waiting for garden membership. No send"], ev: "offline-queueable Need — may wait for membership without consuming sends", cite: "CI-WF:150" },
  { f: "C1", hot: { m: "[View] [Agree]", l: "neighbors View + Agree" }, ev: "board orders by recency + status, never funding", cite: "CI-SPEC:257" },
  { f: "C9", hot: { m: "[Acknowledge]", l: "Acknowledge" }, who: "David", surface: "admin", ev: "typed moderation — moderation and progress are separate axes", cite: "CI-SPEC:267" },
  { f: "C9", hot: { m: "[Seed a commitment]", l: "Seed a commitment" }, surface: "admin", ev: "opens the seed-from-Need form", cite: "CI-WF:307" },
  { f: "C10", hot: { m: "[Review commitment]", l: "Review commitment" }, surface: "admin", ev: "needUID linked read-only · every suggested field operator-confirmed · unreachable-threshold error before acceptance", cite: "CI-WF:340" },
  { f: "C5", hot: null, marks: ["✓ Promise: 16 market rides this season"], ev: "the thread: neighbor's words → promise → work → proof · funding supports the garden, never escrow", cite: "CI-WF:165" },
  { f: "C5", hot: { m: "[Add testimony]", l: "author confirm + testimony" }, who: "Kwame", ev: "consumes the shared confirmation/testimony primitives — September-realized (#34g)", cite: "CI-SPEC:259", note: "membership queue slice stays gated on RESR-64" },
]},
];

// ---------- Screens groups + walked-in map ----------
const GROUPS: [string, string[]][] = [
  ["Client PWA", ["W1", "W1P", "W1S", "W2", "W3", "W4", "W5", "W6", "MF3", "MF5", "MF6", "MF8", "MF10", "W23", "W23G", "WFLOW"]],
  ["Admin console", ["W7", "W7X", "W8", "W9", "W10", "W11", "W12", "W13", "W14", "W21", "W22", "MF1", "MF4", "MF9", "MF13", "HUBWORK"]],
  ["Public pages", ["W15", "W16"]],
  ["Community PWA (Sept)", ["C1", "C3", "C4", "C5", "C6", "C9", "C10"]],
];
const walkedIn: Record<string, { sb: string; n: number; ix: number }[]> = {};
for (const sb of SBS) sb.steps.forEach((s, ix) => {
  (walkedIn[s.f] ??= []);
  if (!walkedIn[s.f].some(w => w.sb === sb.id)) walkedIn[s.f].push({ sb: sb.id, n: sb.n, ix });
});

// ---------- Build-time validation ----------
let bad = 0;
const err = (m: string) => { console.error(m); bad++; };
const validTo = (to?: string) => {
  if (!to) return true;
  if (to.startsWith("frame:")) return !!F[to.slice(6)];
  const [tid, tix] = to.split(":");
  const t = SBS.find(x => x.id === tid);
  return !!t && +tix < t.steps.length;
};
for (const sb of SBS) sb.steps.forEach((sc, s) => {
  if (!F[sc.f]) return err(`MISSING FRAME ${sc.f} (${sb.id}:${s})`);
  if (sc.hot && !F[sc.f].includes(sc.hot.m)) err(`HOT MISS "${sc.hot.m}" ∉ ${sc.f} (${sb.id}:${s})`);
  for (const a of sc.alts ?? []) {
    if (!F[sc.f].includes(a.m)) err(`ALT MISS "${a.m}" ∉ ${sc.f} (${sb.id}:${s})`);
    if (!validTo(a.to)) err(`ALT TARGET ${a.to} (${sb.id}:${s})`);
  }
  for (const mk of sc.marks ?? []) if (!F[sc.f].includes(mk)) err(`MARK MISS "${mk}" ∉ ${sc.f} (${sb.id}:${s})`);
  for (const b of sc.br ?? []) if (!validTo(b.to)) err(`BRANCH TARGET ${b.to} (${sb.id}:${s})`);
});
for (const [fid, hots] of Object.entries(HOTMAP)) {
  if (!F[fid]) { err(`HOTMAP frame ${fid} missing`); continue; }
  for (const h of hots) {
    if (!F[fid].includes(h.m)) err(`HOTMAP MISS "${h.m}" ∉ ${fid}`);
    if (!validTo(h.to)) err(`HOTMAP TARGET ${h.to} (${fid})`);
  }
}
{
  const grouped = new Set(GROUPS.flatMap(g => g[1]));
  for (const k of Object.keys(F)) if (!grouped.has(k)) err(`FRAME ${k} not in any Screens group`);
  for (const k of grouped) if (!F[k]) err(`GROUP frame ${k} missing from F`);
  for (const k of Object.keys(F)) if (!FT[k]) err(`FRAME ${k} missing a title`);
}
if (bad > 0) { console.error(`${bad} validation errors — not writing output`); process.exit(1); }

const PLAYER_DATA = JSON.stringify({ frames: F, titles: FT, sbs: SBS, hotmap: HOTMAP, groups: GROUPS, walkedIn });

const sbCards = SBS.map(sb =>
  `<button class="sbcard" data-sb="${sb.id}"><span class="sbn">SB-${sb.n} <span class="tick"></span></span><span class="sbt">${esc(sb.title)}</span><span class="sbm">${esc(sb.persona)}</span><span class="sbm">${esc(sb.scen)} · ${esc(sb.surface)} · ${sb.steps.length} steps</span></button>`
).join("");

const screenCards = GROUPS.map(([g, ids]) =>
  `<div class="ng2">${esc(g)}</div><div class="grid">` + ids.map(id =>
    `<button class="sbcard sc" data-frame="${id}"><span class="sbt">${esc(FT[id])}</span><span class="sbm">${(walkedIn[id] ?? []).map(w => "SB-" + w.n).join(" · ") || "not walked in a journey"}</span></button>`
  ).join("") + `</div>`
).join("");

// ---------- Page ----------
const html = `<title>Commitment Pooling — Flow Prototypes</title>
<style>
:root{
  --canvas:#FAF8F4; --panel:#F2EFE7; --ink:#2B2924; --stone:#6B675E; --line:#E4E0D6;
  --accent:#3E7A4E; --accent-ink:#2E5C3B; --amber:#8A6D1F; --amber-bg:#F7F0DC;
  --chipw:#EDE9DD; --code:#54504A;
}
@media (prefers-color-scheme: dark){:root{
  --canvas:#1C1B18; --panel:#24221E; --ink:#ECE8DF; --stone:#A39E92; --line:#35332C;
  --accent:#7FBF8E; --accent-ink:#9BD1A8; --amber:#D4B45A; --amber-bg:#2E2A1D;
  --chipw:#2C2A24; --code:#C9C4B8;
}}
:root[data-theme="dark"]{
  --canvas:#1C1B18; --panel:#24221E; --ink:#ECE8DF; --stone:#A39E92; --line:#35332C;
  --accent:#7FBF8E; --accent-ink:#9BD1A8; --amber:#D4B45A; --amber-bg:#2E2A1D;
  --chipw:#2C2A24; --code:#C9C4B8;
}
:root[data-theme="light"]{
  --canvas:#FAF8F4; --panel:#F2EFE7; --ink:#2B2924; --stone:#6B675E; --line:#E4E0D6;
  --accent:#3E7A4E; --accent-ink:#2E5C3B; --amber:#8A6D1F; --amber-bg:#F7F0DC;
  --chipw:#EDE9DD; --code:#54504A;
}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);
  font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.tabs{display:flex;gap:4px;padding:10px 16px;border-bottom:1px solid var(--line);
  position:sticky;top:0;background:var(--canvas);z-index:5;align-items:center;flex-wrap:wrap}
.tabs .tt{font-weight:700;font-size:13px;margin-right:12px}
.tab{border:1px solid var(--line);background:var(--panel);color:var(--stone);border-radius:8px;
  padding:5px 14px;font:600 13px inherit;cursor:pointer}
.tab.on{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
#tab-doc,#tab-play,#tab-screens{display:none}
#tab-doc.on,#tab-play.on,#tab-screens.on{display:block}

#play,#screens{max-width:1080px;margin:0 auto;padding:26px 20px 120px}
#play h1,#screens h1{font-size:21px;margin:0 0 4px;text-wrap:balance}
#play .sub,#screens .sub{color:var(--stone);font-size:13px;margin:0 0 18px;max-width:78ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:8px}
.ng2{margin:18px 0 8px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--stone)}
.sbcard{text-align:left;border:1px solid var(--line);background:var(--panel);border-radius:10px;
  padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:3px;color:var(--ink)}
.sbcard:hover{border-color:var(--accent)}
.sbn{font:700 11.5px ui-monospace,Menlo,monospace;color:var(--accent-ink)}
.tick{color:var(--accent-ink);font-weight:700}
.sbt{font-weight:650;font-size:14px}
.sbm{font-size:11.5px;color:var(--stone)}
#stage,#expstage{display:none}
#stage.on,#expstage.on{display:block}
.stagebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.stagebar .back{border:1px solid var(--line);background:var(--panel);color:var(--ink);
  border-radius:8px;padding:4px 12px;cursor:pointer;font:600 12.5px inherit}
.stagebar .ti{font-weight:700;font-size:15px}
.pill{font-size:11px;border:1px solid var(--line);border-radius:99px;padding:1px 9px;color:var(--stone)}
.pill.sur{border-color:var(--accent-ink);color:var(--accent-ink)}
.pill.link{cursor:pointer;background:var(--panel)}
.device{border:1px solid var(--line);border-radius:14px;background:var(--panel);
  padding:14px 16px;overflow-x:auto;position:relative}
.device.mf{border-color:var(--amber)}
.device .mftag{position:absolute;top:0;right:0;background:var(--amber-bg);color:var(--amber);
  font:700 10px inherit;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:0 13px 0 8px}
.device pre{margin:0;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink)}
.hspot{display:inline;font:inherit;padding:0;margin:0;border:0;background:transparent;color:inherit;
  cursor:pointer;white-space:pre;border-radius:3px}
.hspot.primary{background:color-mix(in srgb, var(--accent) 18%, transparent);
  outline:1px dashed var(--accent);outline-offset:1px}
@media (prefers-reduced-motion: no-preference){
  .hspot.primary{animation:hotpulse 1.6s ease-in-out infinite}
  @keyframes hotpulse{0%,100%{outline-color:var(--accent)}50%{outline-color:transparent}}
}
.hspot.choice{background:color-mix(in srgb, var(--accent) 10%, transparent);
  outline:1px solid var(--accent-ink);outline-offset:1px}
.hspot.quiet{border-bottom:1px dotted transparent}
.device:hover .hspot.quiet,.hspot.quiet:focus-visible{border-bottom-color:var(--stone)}
.hspot.nav2{background:color-mix(in srgb, var(--accent) 10%, transparent);
  outline:1px solid var(--accent-ink);outline-offset:1px}
.hspot.info2{border-bottom:1px dotted var(--stone)}
.marked{background:color-mix(in srgb, var(--amber) 22%, transparent);border-radius:3px}
.hint{margin:10px 0 0;font-size:12.5px;color:var(--accent-ink);font-weight:600}
.hint .kbd{color:var(--stone);font-weight:400}
#insp{margin:10px 0 0;border:1px solid var(--line);border-left:3px solid var(--accent-ink);
  background:var(--panel);border-radius:8px;padding:8px 12px;font-size:12.5px;display:none}
#insp.on{display:block}
#insp b{display:block;margin-bottom:2px}
#insp .ia{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
#insp .ia button{border:1px solid var(--accent-ink);background:transparent;color:var(--accent-ink);
  border-radius:7px;padding:2px 10px;font:600 12px inherit;cursor:pointer}
.meta{margin:12px 0 0;display:flex;flex-direction:column;gap:6px;font-size:13px}
.meta .row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.stchip{font:600 11px ui-monospace,Menlo,monospace;background:var(--chipw);border:1px solid var(--line);
  border-radius:5px;padding:1px 7px;white-space:nowrap}
.ev{color:var(--ink)}
.cite{font:11px ui-monospace,Menlo,monospace;color:var(--stone)}
.note{font-size:12.5px;color:var(--stone);border-left:3px solid var(--line);padding-left:10px}
.brs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.br{border:1px solid var(--amber);background:var(--amber-bg);color:var(--amber);border-radius:8px;
  padding:3px 10px;font:600 12px inherit;cursor:pointer}
.br.info{cursor:default}
.ctr{display:flex;align-items:center;gap:10px;margin-top:14px}
.ctr button{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;
  padding:6px 16px;cursor:pointer;font:600 13px inherit}
.ctr button.primary{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
.ctr button:disabled{opacity:.4;cursor:default}
.dots{display:flex;gap:5px;flex:1;justify-content:center;flex-wrap:wrap}
.dot{width:8px;height:8px;border-radius:99px;background:var(--line);border:0;padding:0;cursor:pointer}
.dot.on{background:var(--accent)}
.who{font-size:12px;color:var(--stone)}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0 0;font-size:11.5px;color:var(--stone)}
.legend .k{display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:4px}

.wrap{display:flex;min-height:100vh}
nav.doc{width:248px;flex:none;border-right:1px solid var(--line);padding:20px 14px 40px;
  position:sticky;top:46px;height:calc(100vh - 46px);overflow-y:auto;font-size:12.5px}
nav.doc .brand{font-weight:700;font-size:13px;letter-spacing:.02em;margin:0 8px 14px;color:var(--ink)}
nav.doc .brand small{display:block;font-weight:400;color:var(--stone);margin-top:2px}
.ng{margin:14px 8px 4px;font-size:10.5px;font-weight:600;letter-spacing:.09em;
  text-transform:uppercase;color:var(--stone)}
nav.doc a{display:block;padding:4px 8px;border-radius:6px;color:var(--stone);text-decoration:none;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
nav.doc a b{color:var(--ink);font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
nav.doc a:hover{background:var(--panel);color:var(--ink)}
nav.doc a.on{background:var(--panel);color:var(--accent-ink)}
main{flex:1;min-width:0;padding:36px 44px 120px;max-width:960px}
main h1{font-size:23px;line-height:1.25;margin:0 0 6px;text-wrap:balance}
main .sub{color:var(--stone);margin:0 0 22px;font-size:13.5px}
section{margin:0 0 44px;scroll-margin-top:64px}
h2{font-size:17.5px;margin:34px 0 12px;padding-top:18px;border-top:1px solid var(--line);text-wrap:balance}
section:first-of-type h2{border-top:0;padding-top:0}
.sbnum{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;
  color:var(--accent-ink);background:var(--panel);border:1px solid var(--line);
  border-radius:6px;padding:2px 7px;margin-right:6px;vertical-align:2px}
p{margin:10px 0;max-width:74ch}
ul{margin:8px 0;padding-left:22px;max-width:74ch}
li{margin:4px 0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;color:var(--code);
  background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:0 4px}
strong{font-weight:650}
.chip{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;border-radius:5px;
  padding:0 5px;text-decoration:none;border:1px solid var(--line)}
.chip.w{background:var(--chipw);color:var(--ink)}
.chip.sb{background:var(--panel);color:var(--accent-ink);border-color:var(--accent-ink)}
.chip.mf{background:var(--amber-bg);color:var(--amber);border-color:var(--amber)}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:8px;margin:14px 0}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:640px}
th{background:var(--panel);text-align:left;font-size:11px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--stone);padding:7px 10px;border-bottom:1px solid var(--line)}
td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;
  font-variant-numeric:tabular-nums}
tbody tr:last-child td{border-bottom:0}
tr.warn td{background:var(--amber-bg)}
.framewrap{margin:14px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.framewrap.proposed{border-color:var(--amber)}
.ptag{background:var(--amber-bg);color:var(--amber);font-size:10.5px;font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;padding:4px 12px}
pre.frame{margin:0;padding:12px 14px;overflow-x:auto;
  font:12px/1.42 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink)}
.flow{margin:14px 0;border:1px solid var(--line);border-left:3px solid var(--accent);
  border-radius:8px;padding:10px 14px;background:var(--panel)}
.fr{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:3px 0;font-size:12.5px}
.fn{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;background:var(--canvas);
  border:1px solid var(--line);border-radius:6px;padding:2px 8px;white-space:nowrap}
.fe{display:flex;align-items:center;gap:4px;color:var(--stone);font-style:italic;min-width:0}
.fl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34ch}
.fa{flex:none;width:18px;height:1px;background:var(--stone);position:relative}
.fa::after{content:"";position:absolute;right:-1px;top:-3px;border:3.5px solid transparent;
  border-left-color:var(--stone)}
details.msrc{margin:-6px 0 14px}
details.msrc summary{font-size:11.5px;color:var(--stone);cursor:pointer}
details.msrc pre{font:11.5px/1.4 ui-monospace,Menlo,monospace;background:var(--panel);
  border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto}
.status{border:1px solid var(--accent);border-left-width:3px;background:var(--panel);
  border-radius:8px;padding:4px 16px 10px;margin:0 0 26px}
.status h2{border:0;padding:0;margin:10px 0 4px;font-size:13px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--accent-ink)}
.status p{font-size:13px;margin:6px 0}
a{color:var(--accent-ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
@media (max-width:900px){
  .wrap{display:block}
  nav.doc{position:static;width:auto;height:auto;border-right:0;border-bottom:1px solid var(--line);
    display:flex;flex-wrap:wrap;gap:2px;padding:12px}
  nav.doc .brand{width:100%}
  .ng{width:100%;margin:8px 4px 2px}
  main{padding:20px 18px 80px}
  table{min-width:560px}
}
@media (prefers-reduced-motion: no-preference){html{scroll-behavior:smooth}}
</style>
<div class="tabs" role="tablist">
  <span class="tt">Commitment Pooling</span>
  <button class="tab on" id="tabbtn-play" role="tab" aria-selected="true">Walk the journeys</button>
  <button class="tab" id="tabbtn-screens" role="tab" aria-selected="false">Screens</button>
  <button class="tab" id="tabbtn-doc" role="tab" aria-selected="false">Reference</button>
</div>

<div id="tab-play" class="on">
<div id="play">
  <div id="home">
    <h1>Walk the journeys — lo-fi, click-through</h1>
    <p class="sub">Pick a journey. Each screen is the locked lo-fi wireframe. The <b>pulsing control</b> advances the canonical path; <b>solid-outlined controls</b> are real choices at that moment; every other drawn control is tappable too — it answers with a note or takes you where its story lives. Swipe or use ←/→. Amber chips are failure/recovery branches.</p>
    <div class="legend"><span><span class="k" style="background:color-mix(in srgb,var(--accent) 18%,transparent);outline:1px dashed var(--accent)"></span>advances</span><span><span class="k" style="background:color-mix(in srgb,var(--accent) 10%,transparent);outline:1px solid var(--accent-ink)"></span>a choice</span><span><span class="k" style="border-bottom:1px dotted var(--stone)"></span>tap to inspect</span><span><span class="k" style="background:color-mix(in srgb,var(--amber) 22%,transparent)"></span>look here</span></div>
    <div class="grid" style="margin-top:14px">${sbCards}</div>
  </div>
  <div id="stage" role="region" aria-live="polite">
    <div class="stagebar">
      <button class="back" id="backbtn">← All journeys</button>
      <span class="ti" id="st-title"></span>
      <span class="pill" id="st-persona"></span>
      <span class="pill" id="st-scen"></span>
      <span class="pill sur" id="st-surface"></span>
    </div>
    <div class="device" id="device"><pre id="screen"></pre></div>
    <p class="hint" id="hint"></p>
    <div id="insp"></div>
    <div class="meta">
      <div class="row"><span class="stchip" id="st-state"></span><span class="who" id="st-who"></span></div>
      <div class="row"><span class="ev" id="st-ev"></span></div>
      <div class="row"><span class="cite" id="st-cite"></span></div>
      <div class="note" id="st-note" hidden></div>
      <div class="brs" id="st-brs"></div>
    </div>
    <div class="ctr">
      <button id="prevbtn">← Back</button>
      <div class="dots" id="dots"></div>
      <button class="primary" id="nextbtn">Next →</button>
    </div>
  </div>
</div>
</div>

<div id="tab-screens">
<div id="screens">
  <div id="exphome">
    <h1>Screens — free-roam the wireframes</h1>
    <p class="sub">Every locked frame, every drawn control live. Outlined controls navigate between screens; dotted ones explain themselves. Each screen lists the journeys that walk it.</p>
    ${screenCards}
  </div>
  <div id="expstage">
    <div class="stagebar">
      <button class="back" id="expall">▦ All screens</button>
      <button class="back" id="expback">← Back</button>
      <span class="ti" id="exp-title"></span>
      <span id="exp-walked"></span>
    </div>
    <div class="device" id="expdevice"><pre id="expscreen"></pre></div>
    <div id="expinsp" class="" style="margin:10px 0 0"></div>
  </div>
</div>
</div>

<div id="tab-doc">
<div class="wrap">
<nav class="doc" aria-label="Sections">
  <div class="brand">Reference<small>prototypes.md · 2026-07-11</small></div>
  ${navSb}
  ${navRef}
</nav>
<main>
<h1>${esc(h1)}</h1>
<p class="sub">Fourteen storyboards composing the locked wireframes (W1–W23 + community CI-W frames), the missing-frame index, the action inventory, and the state-coverage matrix. Every claim cites file:line in the repo specs. Source of truth: <code>.plans/active/commitment-pooling/prototypes.md</code>.</p>
${statusNote}
${front.join("\n")}
${sections}
</main>
</div>
</div>

<script>
var DATA = ${PLAYER_DATA};
(function(){
  function $(id){ return document.getElementById(id); }
  var tabs = { play: [$("tab-play"), $("tabbtn-play")], screens: [$("tab-screens"), $("tabbtn-screens")], doc: [$("tab-doc"), $("tabbtn-doc")] };
  function setTab(name){
    Object.keys(tabs).forEach(function(k){
      tabs[k][0].classList.toggle("on", k === name);
      tabs[k][1].classList.toggle("on", k === name);
      tabs[k][1].setAttribute("aria-selected", String(k === name));
    });
  }
  $("tabbtn-play").addEventListener("click", function(){ setTab("play"); });
  $("tabbtn-screens").addEventListener("click", function(){ setTab("screens"); });
  $("tabbtn-doc").addEventListener("click", function(){ setTab("doc"); });

  var SURFACE = { pwa: "Client PWA", admin: "Admin console", editorial: "Public page", community: "Community PWA", safe: "Safe app (external)" };
  var walked = {};
  try { walked = JSON.parse(localStorage.getItem("gg-proto-walked") || "{}"); } catch (e) {}
  function paintTicks(){
    document.querySelectorAll(".sbcard[data-sb]").forEach(function(c){
      var t = c.querySelector(".tick");
      if (t) t.textContent = walked[c.getAttribute("data-sb")] ? "✓ walked" : "";
    });
  }
  paintTicks();

  // ---- shared segment renderer: spans = [{m, cls, label, fn}] in priority order
  function renderSegments(pre, text, spans){
    pre.textContent = "";
    var claimed = [];
    spans.forEach(function(s){
      var from = 0, idx;
      while ((idx = text.indexOf(s.m, from)) !== -1) {
        var end = idx + s.m.length;
        var clash = claimed.some(function(c){ return idx < c.e && end > c.s; });
        if (!clash) { claimed.push({ s: idx, e: end, sp: s }); break; }
        from = end;
      }
    });
    claimed.sort(function(a, b){ return a.s - b.s; });
    var pos = 0;
    claimed.forEach(function(c){
      if (c.s > pos) pre.appendChild(document.createTextNode(text.slice(pos, c.s)));
      var el;
      if (c.sp.cls === "mark") {
        el = document.createElement("span"); el.className = "marked";
      } else {
        el = document.createElement("button"); el.type = "button";
        el.className = "hspot " + c.sp.cls;
        el.setAttribute("aria-label", c.sp.label);
        el.addEventListener("click", c.sp.fn);
      }
      el.textContent = text.slice(c.s, c.e);
      pre.appendChild(el);
      pos = c.e;
    });
    if (pos < text.length) pre.appendChild(document.createTextNode(text.slice(pos)));
  }

  function goTarget(to){
    if (to.indexOf("frame:") === 0) { setTab("screens"); openScreen(to.slice(6), true); return; }
    var p = to.split(":"); setTab("play"); start(p[0], +p[1]);
  }

  // ---------- journey player ----------
  var curSb = null, curI = 0;
  function findSb(id){ for (var k = 0; k < DATA.sbs.length; k++) if (DATA.sbs[k].id === id) return DATA.sbs[k]; return null; }
  function defSurface(sb){
    if (sb.surface.indexOf("Community") === 0) return "community";
    if (sb.surface.indexOf("Admin") === 0) return "admin";
    return "pwa";
  }
  function showHome(){
    curSb = null;
    $("stage").classList.remove("on");
    $("home").style.display = "";
    paintTicks();
    if (history.replaceState) history.replaceState(null, "", "#play");
  }
  function start(id, ix){
    var sb = findSb(id); if (!sb) return;
    curSb = sb; curI = Math.min(Math.max(ix || 0, 0), sb.steps.length - 1);
    $("home").style.display = "none";
    $("stage").classList.add("on");
    render();
  }
  function inspect(label, info, to){
    var el = $("insp");
    el.classList.add("on");
    el.textContent = "";
    var b = document.createElement("b"); b.textContent = label; el.appendChild(b);
    if (info) el.appendChild(document.createTextNode(info));
    var ia = document.createElement("div"); ia.className = "ia";
    if (to) {
      var go = document.createElement("button");
      go.textContent = to.indexOf("frame:") === 0 ? "Open this screen" : "Walk it";
      go.addEventListener("click", function(){ goTarget(to); });
      ia.appendChild(go);
    }
    var x = document.createElement("button"); x.textContent = "Dismiss";
    x.addEventListener("click", function(){ el.classList.remove("on"); });
    ia.appendChild(x);
    el.appendChild(ia);
  }
  function render(){
    var sb = curSb; if (!sb) return;
    var sc = sb.steps[curI];
    $("insp").classList.remove("on");
    $("st-title").textContent = "SB-" + sb.n + " · " + sb.title;
    $("st-persona").textContent = sb.persona;
    $("st-scen").textContent = sb.scen;
    $("st-surface").textContent = SURFACE[sc.surface || defSurface(sb)] || sb.surface;
    var device = $("device");
    device.classList.toggle("mf", !!sc.mf);
    var old = device.querySelector(".mftag"); if (old) old.remove();
    if (sc.mf) {
      var tag = document.createElement("div");
      tag.className = "mftag"; tag.textContent = "proposed lo-fi";
      device.appendChild(tag);
    }
    var spans = [];
    if (sc.hot) spans.push({ m: sc.hot.m, cls: "primary", label: sc.hot.l + " — advance", fn: next });
    (sc.alts || []).forEach(function(a){
      spans.push({ m: a.m, cls: "choice", label: a.l, fn: function(){ goTarget(a.to); } });
    });
    (sc.marks || []).forEach(function(mk){ spans.push({ m: mk, cls: "mark", label: "" }); });
    (DATA.hotmap[sc.f] || []).forEach(function(h){
      spans.push({ m: h.m, cls: "quiet", label: h.l, fn: function(){ inspect(h.l, h.info || "", h.to); } });
    });
    renderSegments($("screen"), DATA.frames[sc.f] || "frame missing", spans);
    var hint = $("hint");
    if (sc.hot) { hint.innerHTML = ""; hint.appendChild(document.createTextNode("tap: ")); var bb = document.createElement("b"); bb.textContent = sc.hot.l; hint.appendChild(bb); var kk = document.createElement("span"); kk.className = "kbd"; kk.textContent = "  (or →) · everything else on the frame is tappable too"; hint.appendChild(kk); }
    else { hint.innerHTML = ""; hint.appendChild(document.createTextNode("system step ")); var k2 = document.createElement("span"); k2.className = "kbd"; k2.textContent = "(→ to continue) · frame controls stay tappable"; hint.appendChild(k2); }
    $("st-state").textContent = sc.st || "—";
    $("st-who").textContent = sc.who ? "acting: " + sc.who : "";
    $("st-ev").textContent = sc.ev;
    $("st-cite").textContent = sc.cite || "";
    var noteEl = $("st-note");
    if (sc.note) { noteEl.hidden = false; noteEl.textContent = sc.note; } else { noteEl.hidden = true; }
    var brs = $("st-brs"); brs.textContent = "";
    (sc.br || []).forEach(function(b){
      var el = document.createElement(b.to ? "button" : "span");
      el.className = "br" + (b.to ? "" : " info");
      el.textContent = (b.to ? "↳ " : "ⓘ ") + b.l;
      if (b.to) el.addEventListener("click", function(){ goTarget(b.to); });
      brs.appendChild(el);
    });
    var dots = $("dots"); dots.textContent = "";
    for (var d = 0; d < sb.steps.length; d++) (function(dd){
      var el = document.createElement("button");
      el.className = "dot" + (dd === curI ? " on" : "");
      el.setAttribute("aria-label", "step " + (dd + 1));
      el.addEventListener("click", function(){ curI = dd; render(); });
      dots.appendChild(el);
    })(d);
    $("prevbtn").disabled = curI === 0;
    $("nextbtn").textContent = curI === sb.steps.length - 1 ? "Done ✓" : "Next →";
    if (history.replaceState) history.replaceState(null, "", "#" + sb.id + "/" + curI);
  }
  function next(){
    if (!curSb) return;
    if (curI < curSb.steps.length - 1) { curI++; render(); }
    else {
      walked[curSb.id] = true;
      try { localStorage.setItem("gg-proto-walked", JSON.stringify(walked)); } catch (e) {}
      showHome();
    }
  }
  function prev(){ if (curSb && curI > 0) { curI--; render(); } }
  $("backbtn").addEventListener("click", showHome);
  $("nextbtn").addEventListener("click", next);
  $("prevbtn").addEventListener("click", prev);

  // ---------- screens explorer ----------
  var expCur = null, expStack = [];
  function openScreen(id, push){
    if (!DATA.frames[id]) return;
    if (push && expCur) expStack.push(expCur);
    expCur = id;
    $("exphome").style.display = "none";
    $("expstage").classList.add("on");
    $("exp-title").textContent = DATA.titles[id] || id;
    var walkedEl = $("exp-walked"); walkedEl.textContent = "";
    (DATA.walkedIn[id] || []).forEach(function(w){
      var p = document.createElement("button");
      p.className = "pill link"; p.textContent = "walk SB-" + w.n;
      p.addEventListener("click", function(){ setTab("play"); start(w.sb, w.ix); });
      walkedEl.appendChild(p);
    });
    var isMf = id.indexOf("MF") === 0;
    var dev = $("expdevice");
    dev.classList.toggle("mf", isMf);
    var old = dev.querySelector(".mftag"); if (old) old.remove();
    if (isMf) { var tag = document.createElement("div"); tag.className = "mftag"; tag.textContent = "proposed lo-fi"; dev.appendChild(tag); }
    var spans = (DATA.hotmap[id] || []).map(function(h){
      return { m: h.m, cls: h.to ? "nav2" : "info2", label: h.l, fn: function(){
        if (h.to && h.to.indexOf("frame:") === 0) { expInspect(h.l, h.info || "", null); openScreen(h.to.slice(6), true); }
        else expInspect(h.l, h.info || "", h.to);
      } };
    });
    renderSegments($("expscreen"), DATA.frames[id], spans);
    $("expback").style.visibility = expStack.length ? "visible" : "hidden";
    expInspectClear();
    if (history.replaceState) history.replaceState(null, "", "#screens/" + id);
  }
  function expInspect(label, info, to){
    var el = $("expinsp");
    el.className = "on"; el.id = "expinsp";
    el.textContent = "";
    el.setAttribute("style", "margin:10px 0 0;border:1px solid var(--line);border-left:3px solid var(--accent-ink);background:var(--panel);border-radius:8px;padding:8px 12px;font-size:12.5px");
    var b = document.createElement("b"); b.textContent = label + "  "; el.appendChild(b);
    el.appendChild(document.createTextNode(info));
    if (to) {
      var go = document.createElement("button"); go.textContent = "Walk it";
      go.setAttribute("style", "margin-left:8px;border:1px solid var(--accent-ink);background:transparent;color:var(--accent-ink);border-radius:7px;padding:2px 10px;font:600 12px inherit;cursor:pointer");
      go.addEventListener("click", function(){ goTarget(to); });
      el.appendChild(go);
    }
  }
  function expInspectClear(){ var el = $("expinsp"); el.textContent = ""; el.removeAttribute("style"); }
  function expHome(){
    expCur = null; expStack = [];
    $("expstage").classList.remove("on");
    $("exphome").style.display = "";
    if (history.replaceState) history.replaceState(null, "", "#screens");
  }
  $("expall").addEventListener("click", expHome);
  $("expback").addEventListener("click", function(){
    var prevId = expStack.pop();
    if (prevId) { expCur = null; openScreen(prevId, false); }
    else expHome();
    $("expback").style.visibility = expStack.length ? "visible" : "hidden";
  });
  document.querySelectorAll(".sbcard.sc").forEach(function(el){
    el.addEventListener("click", function(){ expStack = []; openScreen(el.getAttribute("data-frame"), false); });
  });
  document.querySelectorAll(".sbcard[data-sb]").forEach(function(el){
    el.addEventListener("click", function(){ start(el.getAttribute("data-sb"), 0); });
  });

  // keyboard + swipe
  document.addEventListener("keydown", function(e){
    if (!tabs.play[0].classList.contains("on") || !curSb) return;
    if (e.key === "ArrowRight") { next(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { prev(); e.preventDefault(); }
    if (e.key === "Escape") showHome();
  });
  var tx = null;
  $("stage").addEventListener("touchstart", function(e){ tx = e.changedTouches[0].clientX; }, { passive: true });
  $("stage").addEventListener("touchend", function(e){
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) next(); else prev();
  }, { passive: true });

  // hash routing
  var h = location.hash.replace("#", "");
  if (h) {
    var mPlay = h.match(/^(sb\\d+)\\/(\\d+)$/);
    var mScr = h.match(/^screens\\/(\\w+)$/);
    if (mPlay && findSb(mPlay[1])) { setTab("play"); start(mPlay[1], +mPlay[2]); }
    else if (mScr && DATA.frames[mScr[1]]) { setTab("screens"); openScreen(mScr[1], false); }
    else if (h === "screens") setTab("screens");
    else if (h !== "play") { setTab("doc"); var t = document.getElementById(h); if (t) t.scrollIntoView(); }
  }

  if ("IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(document.querySelectorAll("nav.doc a[href^='#']"));
    var map = {};
    links.forEach(function(a){ map[a.getAttribute("href").slice(1)] = a; });
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting) {
          links.forEach(function(a){ a.classList.remove("on"); });
          var a = map[en.target.id]; if (a) a.classList.add("on");
        }
      });
    }, { rootMargin: "0px 0px -75% 0px" });
    document.querySelectorAll("#tab-doc section[id]").forEach(function(s){ obs.observe(s); });
  }
})();
</script>`;

writeFileSync(OUT, html);
const hotCount = Object.values(HOTMAP).reduce((a, b) => a + b.length, 0);
console.log("sections:", secs.length, "| journeys:", SBS.length,
  "| scenes:", SBS.reduce((a, b) => a + b.steps.length, 0),
  "| frames:", Object.keys(F).length, "| hotmap controls:", hotCount,
  "| bytes:", html.length);
