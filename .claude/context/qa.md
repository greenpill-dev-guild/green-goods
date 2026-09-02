# QA Contract

Canonical contract for how Green Goods defines, records, reads, triages, and closes product
experience QA. The [`qa-session`](../skills/qa-session/SKILL.md) and
[`qa-triage`](../skills/qa-triage/SKILL.md) skills own their interactive loops. The
[Product Experience QA](../../docs/docs/builders/quality/product-experience-qa.mdx) page owns the
public journey matrices, evidence hierarchy, and release standard. This file owns the system that
connects them.

## The six layers

1. **Definitions** — [`scripts/data/qa-test-catalog.json`](../../scripts/data/qa-test-catalog.json)
   versions the test cases and owns their lifecycle: every case is `active` or `retired` per the
   catalog's `statuses` list; IDs are never reused — every issued id stays registered in the
   append-only [`qa-test-id-ledger.json`](../../scripts/data/qa-test-id-ledger.json) — and a
   retirement carries `retiredOn`, `retiredReason`, and, when active successors exist,
   `replacedBy`. The contract test in
   [`qa-app-build.test.ts`](../../scripts/agents/qa-app-build.test.ts) enforces all of it at one
   revision, [`check-qa-id-ledger.mjs`](../../scripts/quality/check-qa-id-ledger.mjs) rejects any
   id removed since the merge-base, and the public
   [Test Cases](../../docs/docs/builders/quality/test-cases.mdx) page renders it.
   [`packages/qa/build.mjs`](../../packages/qa/build.mjs) projects active cases into the deployed
   app; retired cases remain in git as audit history.
2. **Recording** — the wallet-authenticated [QA app](../../packages/qa/README.md) records one private
   shard per allowlisted signing address in the Blob store. Testers enter verdicts and notes there.
3. **Session** — [`qa-session`](../skills/qa-session/SKILL.md) runs the live, paired, or transcript
   loop: pre-flight, observation capture, bounded fix-now work, revalidation, deferred handoff, and
   receipt preparation.
4. **Pull** — `bun run qa:pull --slug <slug>` reads the live shards into gitignored
   `tmp/qa-session/<slug>/results.csv` and `qa-state.json`. It is the private close-out artifact,
   not a public coverage report. `bun run qa:report --slug <slug>` then derives `report.md` from
   that pull — results by priority and by kind, the fail/blocked list, coverage gaps, standing
   state, and per-tester coverage, private and attributed — and, with `--public`,
   `report.public.md` under the `qa:status` projection rule. The public file exists only for the
   docs example and the Discord lede; every session record embeds the private one.
5. **Triage** — [`qa-triage`](../skills/qa-triage/SKILL.md) enriches and scope-locks accepted
   findings, then writes safe Issue and Customer Need records to Linear and appends private defect
   rows to the Green Goods v1.1 QA Sheet. After a team QA call, the
   [`qa-call-report`](../../docs/routines/qa-call-report.md) routine (or `/qa-triage --call`)
   writes the session to Linear instead: one `QA session YYYY-MM-DD` parent issue carrying the
   report, with slice sub-issues sized one slice = one branch = one PR.
6. **Decisions** — only user-locked design decisions enter
   [`design/decision-log.md`](../skills/design/decision-log.md). Observations and verdicts do not
   become design policy by implication.

## Fix posture

QA fixing is repair, not feature building. Any agent picking up a QA slice — from Linear, a
deferred handoff, or a live session — works in this order:

1. **History first.** `git log --follow` the files the defect implicates, find the PR that
   shipped the behavior and its plan hub or Linear issue, and say whether the feature is new or
   established. A defect in week-old code is usually an unfinished edge; a defect in year-old
   code usually means an assumption changed around it. Code proves what exists, not why it was
   chosen — the history carries the why.
2. **Map before editing.** List the modules, seams, and components that make up the feature —
   owning module, public entry points, direct consumers, where state lives (vocabulary:
   [`codebase-architecture.md`](codebase-architecture.md)). Map, don't certify: two or three
   lines that place the defect inside the feature's real structure.
3. **Update or remove over add.** The default fix edits or deletes existing code. Before any new
   file, hook, or component, run the Cathedral Check in
   [`values.md § Implementation Quality Contract`](values.md#implementation-quality-contract):
   find the most similar existing code and extend it, never a parallel approach. A fix that
   seems to require a new module or component is a redesign wearing a fix's clothes — stop and
   surface it instead of building it.
4. **Repair to the acceptance criteria, no further.** The slice's catalog Test IDs and their
   expected results are the whole scope. The fix is done when those re-record as pass — never
   expanded because the neighborhood looked improvable on the way through.

## Artifact ownership

| Artifact | Durable location | Writer |
| --- | --- | --- |
| Test-case definitions | `scripts/data/qa-test-catalog.json` in git | Product or engineering change, reviewed like code |
| Verdicts and notes | QA app private Blob store | The allowlisted signing address through the app |
| Session log, pulled results, generated report, local handoff | `tmp/qa-session/<slug>/` | `qa-session`, `qa:pull`, and `qa:report`; local and gitignored — only `report.public.md` may leave, for the docs example or the Discord lede |
| Coverage report | Standard output from `bun run qa:status` | Read-only command; nothing is persisted |
| Defect tracking | Linear plus the private Green Goods v1.1 QA Sheet | `qa-triage`, after explicit scope and write confirmation |
| Session report and fix slices | Linear Product team — `QA session YYYY-MM-DD` parent plus slice sub-issues | [`qa-call-report`](../../docs/routines/qa-call-report.md) after a team call, or `/qa-triage --call` interactively |
| Session receipts and cleared evidence | Restricted Drive QA folder | `qa-session`, after content inspection |
| Locked design decisions | `.claude/skills/design/decision-log.md` in git | `qa-session`, after the decision lock gate |

## Public-repository boundary

This repository is public. QA results, notes, wallet addresses, the address allowlist, and the identity
attached to a tester's results never enter it. `QA_ALLOWLIST` lives in the deployment environment;
display names live inside private address-owned shards. Operational artifacts stay under gitignored
`tmp/` until cleared receipts and evidence move to the restricted Drive QA folder.

`qa:status` is safe to print because it projects only catalog IDs, aggregate verdict counts, entry
timestamps, and optional Linear issue keys. It never prints notes or shard-owner names. Do not add a
notes, attribution, or per-person flag.

Linear receives only the public-safe issue narrative allowed by
[`linear-routing-rules.md`](linear-routing-rules.md). The private QA Sheet is the one narrow
exception that may hold a PostHog session ID and replay URL after its permissions are verified.
Distinct IDs, wallet addresses, and reporter identifiers stay out of both. Media must be inspected
visually before upload; a text scan cannot clear pixels.

## Wallet authentication and trust boundary

The signing address is the authorization identity. `GET /api/auth` issues an origin-bound ERC-4361
challenge, `POST /api/auth` verifies the signature and creates a 12-hour authenticated cookie, and
`DELETE /api/auth` expires that cookie. `GET` and `POST /api/state` reject callers without a valid
session and recheck that the session address remains in `QA_ALLOWLIST` before reading or writing.
The state endpoint derives the shard path from that address; a request body cannot select another
tester's shard.

The allowlist contains addresses only. On first sign-in, a tester declares the display name stored in
their own shard. That name is attribution, not authentication, and is not verified as a real-world
identity. Colliding names are disambiguated with shortened addresses in merged views so one shard
cannot hide another. The private pull artifact retains this attribution; `qa:status` must continue to
discard it.

Nonces carry an HMAC-authenticated five-minute expiry. After signature and allowlist verification,
`POST /api/auth` hashes the nonce and performs a create-only write to the private Blob store. The
first request creates the marker; a replay is refused. An unavailable or uncertain marker write
returns `503` without minting a session. The marker contains no address, message, or signature.
Sessions are HMAC-authenticated and held in an `HttpOnly; Secure; SameSite=Lax` cookie. Auth and state
mutations also require the exact app `Origin`, because `SameSite` does not distinguish a sibling
subdomain. This model does not support
ERC-1271 contract-wallet signatures, verify a tester's chosen name, protect a compromised allowlisted
wallet or browser origin, or hide the shared run from another allowlisted tester.

Local rehearsal deliberately bypasses wallets. `packages/qa/dev.mjs` binds to `127.0.0.1` and accepts
`?as=Afo`, `?as=Nansel`, or `?as=Gui` as a local identity. That bypass is not a deployed API import and
is not copied into `dist/`. Loopback prevents remote network access; it does not authenticate other
processes or users on the same machine, so local state remains disposable.

## Verdict and severity rules

A case's standing verdict is the most severe valid verdict any tester recorded:

```text
fail > blocked > pass > n/a
```

The private notes remain attributed so disagreement stays visible. A note without a verdict counts
as walked but not judged.

Case priority and defect severity are different decisions. Catalog priority says how important it
is to walk a case. Severity says how badly a particular failure affects the product. Severity is
assigned during triage and is never derived from catalog priority. The call-report path seeds a
slice's Linear *priority* from case priority plus verdict — a queue-ordering default the fix
session re-judges at take-up, not a severity judgment; Sheet severity stays independently
assigned.

## Roster and attribution

The deployed roster is the unique address list in `QA_ALLOWLIST`; it is discovered at runtime and is
never mirrored in source. A signing address with no shard appears by shortened address until its owner
sets a display name. Changing the display name does not move or re-key the shard.

The UI shows the signed session identity and does not offer a *testing as* selector. If a tester
switches wallet accounts, the existing cookie remains bound to the address that signed in; they must
sign out before starting as another allowlisted address. When a session expires with unsent work, the
page keeps the address-keyed outbox locally and requires the same wallet before it will resume that
work.

## Reading current state

Use two queries for two different questions:

- `bun run qa:status` answers what has been walked in the live store. It reports per-surface
  walked/total and verdict counts, never-walked cases, stale cases, and failing or blocked Test IDs.
  Staleness defaults to 30 days and can be changed with `--stale-days <N>`. It uses each case's
  newest `entry.at` timestamp because the store has no build SHA; the result is recency evidence,
  not build-aware coverage.
- Open Linear Issues carrying `activity:qa` answer what work remains outstanding. Resolve the
  Product team and labels live rather than hardcoding workspace IDs.

The repository intentionally has no Linear credential. To render open work beside failing cases:

1. Use the Linear MCP to list open Product Issues carrying `activity:qa`, read their Test ID source
   lines, and write only the reverse lookup to a gitignored temporary file:

   ```json
   {
     "ADM-012": ["PRD-1234"],
     "PWA-021": ["PRD-1250", "PRD-1272"]
   }
   ```

2. Run `bun run qa:status --issues tmp/qa-status-issues.json`.

The command validates that the file contains only Test IDs and Linear-style issue keys. The agent
must include only open issues; `qa:status` does not query Linear or infer workflow state.

## Test ID linkage

Every Issue filed from a `qa-session` handoff, and every accepted `[derived:test-fail]` item, carries
its exact catalog Test ID in the Issue source line. The same ID fills the QA Sheet's `Linked Test ID`
field. An OBS number or Defect ID is not a substitute.

If a session-derived item has no exact Test ID, pause that item before the write and ask the user to
select the catalog case. Do not invent or fuzzy-guess an ID. This makes the loop reversible: a
failing case can find its open Issue through `qa:status --issues`, and the Issue can return to the
case definition.

## Workbook exception

`bun run qa:workbook` is the exception path for production passes, installed-device passes, and
work that needs a Sheet-compatible file. Generated workbooks carry private QA state, belong in the
restricted Drive QA folder, and never enter git. The QA app remains the default recording surface
for networked sessions.
