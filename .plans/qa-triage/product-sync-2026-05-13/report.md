# /qa-triage report — Product Sync 2026-05-13

## Source
[Product Sync - 2026/05/13 10:03 PDT - Notes by Gemini](https://docs.google.com/document/d/1gAytbl1rsgCyZ6BVwMW6uGiSkehHMcjY3NxU_h4DDdw/edit) · file id `1gAytbl1rsgCyZ6BVwMW6uGiSkehHMcjY3NxU_h4DDdw`
Attendees: Afolabi Aiyeloja (host), Guilherme Ferreira, Matt Strachman, Caue Tomaz, Nansel Rimsah

## Locked Scope
- **All 26 extracted items + 1 meta-finding (M1)** accepted in Phase 4 (user reply: "All of them").
- Assignee overrides:
  - **gferreira525** (Gui): items #7, #8, #9, #10, #11, #13 — PWA standard fixes, non-architectural
  - **Afo**: everything else
- Extra labels: `agent:codex` on #25 (delegated). M1 carries `agent:claude` (delegated).
- 6 items originally classified "Need only" required attach-Issues to file (Linear API requires Customer Needs to link to an Issue or Project). Those got lightweight `activity:maintenance` Issues in `Backlog`.

## Filed in Linear

**27 Issues + 27 linked Customer Needs (PRD-496 through PRD-522)**

### Issues with active fix path

| # | PRD | Title | Assignee | Priority | Status |
|---|---|---|---|---|---|
| 1 | [PRD-496](https://linear.app/greenpill-dev-guild/issue/PRD-496) | Cached old landing page redirects users away from /fund | Afo | High | Todo |
| 2 | [PRD-497](https://linear.app/greenpill-dev-guild/issue/PRD-497) | **Connect Wallet button persists after wallet connected** | **Afo** | **Urgent (P0)** | **Todo** |
| 6 | [PRD-498](https://linear.app/greenpill-dev-guild/issue/PRD-498) | Cookie Jar balance requires manual page refresh | Afo | Medium | Todo |
| 7 | [PRD-499](https://linear.app/greenpill-dev-guild/issue/PRD-499) | Brave install creates browser shortcut, not real PWA install | **Gui** | High | Todo |
| 8 | [PRD-500](https://linear.app/greenpill-dev-guild/issue/PRD-500) | "Updating" state hangs 3+ minutes after Update App click | **Gui** | High | Todo |
| 9 | [PRD-501](https://linear.app/greenpill-dev-guild/issue/PRD-501) | "Update App" button shows even when on latest version | **Gui** | Medium | Todo |
| 10 | [PRD-502](https://linear.app/greenpill-dev-guild/issue/PRD-502) | After uninstall, Chrome refuses to re-install PWA | **Gui** | High | Todo |
| 11 | [PRD-503](https://linear.app/greenpill-dev-guild/issue/PRD-503) | Browser version stuck on "Open the app" page after install | **Gui** | High | Todo |
| 13 | [PRD-504](https://linear.app/greenpill-dev-guild/issue/PRD-504) | Profile page columns break on long garden names | **Gui** | Medium | Todo |
| 14 | [PRD-505](https://linear.app/greenpill-dev-guild/issue/PRD-505) | Passkey created in browser doesn't transfer to PWA | Afo | High | Backlog |
| 16 | [PRD-506](https://linear.app/greenpill-dev-guild/issue/PRD-506) | "Log in with Google" errors on first attempt | Afo | High | Todo |
| 17 | [PRD-507](https://linear.app/greenpill-dev-guild/issue/PRD-507) | Cannot log back in after passkey logout | Afo | High | Backlog |
| 18 | [PRD-508](https://linear.app/greenpill-dev-guild/issue/PRD-508) | **Admin garden switch hangs the entire UI** | **Afo** | **Urgent (P0)** | **Todo** |
| 19 | [PRD-509](https://linear.app/greenpill-dev-guild/issue/PRD-509) | Joining a garden redirects to Green Goods Garden | Afo | High | Todo |
| 20 | [PRD-510](https://linear.app/greenpill-dev-guild/issue/PRD-510) | URL updates when switching gardens but UI doesn't | Afo | High | Todo |
| 21 | [PRD-511](https://linear.app/greenpill-dev-guild/issue/PRD-511) | No visible scrollbar on Admin Dashboard tabs | Afo | Medium | Todo |
| 22 | [PRD-512](https://linear.app/greenpill-dev-guild/issue/PRD-512) | Admin Dashboard layout doesn't use full screen | Afo | Medium | Todo |
| 23 | [PRD-513](https://linear.app/greenpill-dev-guild/issue/PRD-513) | Media uploads show as link only, not displayed | Afo | High | Todo |
| 24 | [PRD-514](https://linear.app/greenpill-dev-guild/issue/PRD-514) | Domains button doesn't open pop-up | Afo | High | Todo |
| 25 | [PRD-516](https://linear.app/greenpill-dev-guild/issue/PRD-516) | ENS names not resolving on Admin — regression | Afo `agent:codex` | High | Todo |
| M1 | [PRD-515](https://linear.app/greenpill-dev-guild/issue/PRD-515) | PostHog $exception captured with null type/message | Afo | High | Todo |

### Backlog Issues (lightweight attach-points for what was originally "Need only")

| # | PRD | Title | Priority | Status |
|---|---|---|---|---|
| 3 | [PRD-517](https://linear.app/greenpill-dev-guild/issue/PRD-517) | Bring back public-site Positions UI | Medium | Backlog |
| 4 | [PRD-518](https://linear.app/greenpill-dev-guild/issue/PRD-518) | Improve /fund copy (Donate vs Endow) | Medium | **Todo** (aligned action item) |
| 5 | [PRD-519](https://linear.app/greenpill-dev-guild/issue/PRD-519) | Allow wrapped-ether input on endow flow | Medium | Backlog |
| 12 | [PRD-520](https://linear.app/greenpill-dev-guild/issue/PRD-520) | PWA install confirmation toast | Low | Backlog |
| 15 | [PRD-521](https://linear.app/greenpill-dev-guild/issue/PRD-521) | Cross-device account recovery (strategic) | High | Backlog |
| 26 | [PRD-522](https://linear.app/greenpill-dev-guild/issue/PRD-522) | Admin Members tab scope labeling | Low | Backlog |

## QA Sheet writes

Apps Script Web App POST returned `{"ok": true}`:

- **Defects tab**: 21 rows appended (starting at row 2 — Defects tab was empty before this run)
- **Test tabs** — `Defect Link` cells filled (single-column-precise, no other columns touched):
  - Public Website: 3 rows updated (PUB-001, PUB-004, PUB-008)
  - PWA Android: 5 rows updated (PWA-AND-001 ×3, PWA-AND-002 ×2)
  - Cross Surface: 3 rows updated (XPLAT-001, XPLAT-003 ×2)
  - PWA iOS: 1 row updated (PWA-IOS-003)
  - Admin Dashboard: 8 rows updated (ADM-001 ×2, ADM-002 ×3, ADM-011 ×3)

**Privacy posture**: `PostHog Session ID` and `PostHog Replay URL` columns are empty on all rows. The privacy exception (Sheet permission tightened to greenpill.builders domain writers) is met but unused this run because the upstream telemetry has null exception payload (see PRD-515).

## Surface breakdown

- Public Website: 6 records (1, 2, 6, 3, 4, 5 — items 3/4/5 in Backlog as attach-Issues)
- PWA: 7 records (7-13 — all Gui except #12 backlogged)
- Auth (cross-surface): 4 records (14-17 — architectural)
- Admin Dashboard: 9 records (18-26)
- Cross-cutting (meta): 1 record (M1)

## Codex pass

**Skipped this run** by Claude's judgment to keep the interactive flow tight. Codex worktree was never created — nothing to clean up. Future runs can either fire Codex automatically (the skill's default) or pass `--no-codex` explicitly. The skill defaults to dispatch; this run skipped because manual extraction was thorough enough to proceed without a parallel pass.

## Linear-API constraints encountered (worth noting for the skill)

1. **`agent:*` is a single-value group**. Can't apply both `agent:claude` AND `agent:codex` to the same Issue. Resolution: for #25 we kept only `agent:codex` and noted Claude provenance in the body.
2. **`package:*` is also single-value group**. Can't apply both `package:admin` and `package:indexer` to the same Issue. Resolution: kept `package:admin` (primary surface), noted indexer involvement in the body.
3. **Customer Needs require either an Issue or Project link** — the skill design (mirroring `bug-intake` docs) assumed standalone "raw signal" Customer Needs were filable, but Linear's API enforces `Exactly one of projectId or issueId must be defined`. Resolution: created 6 lightweight attach-Issues (`activity:maintenance`, `Backlog`) for the originally "Need-only" items so the Customer Needs could attach.

**Skill change to make** before the next run: update `.claude/skills/qa-triage/SKILL.md` and `qa-triage-pulse.md` to reflect these three constraints (single-value label groups + Customer-Need-must-link).

## Next steps

1. **Triage the P0 blockers first**: PRD-497 (Connect Wallet on public site) and PRD-508 (Admin garden switch hang).
2. **Spawn implementation sessions**:
   - For PRD-515 (M1 — PostHog instrumentation): start a Claude Code session against `packages/shared/src/modules/app/analytics-events.ts` to fix the `captureException` payload.
   - For PRD-516 (ENS resolution regression): dispatch a Codex session to investigate the ENS path across `package:admin` + the indexer.
3. **Ping Gui** about his 6 assigned bugs (PRD-499 through PRD-504). Suggest he start with PRD-504 (CSS-only, smallest scope) and PRD-501 (UI gating, related to PRD-500 he'll already be looking at).
4. **`/qa-triage qa-sync:2026-05-13`** is the resume command if you want to re-enter this batch.
5. The workspace at `.plans/qa-triage/product-sync-2026-05-13/` is the durable record of this run — committed to git.

## Files in this workspace

- `notes.md` — (not committed; source remains the Drive doc)
- `extraction.md` — 26 items + 1 meta-finding, with verbatim quotes
- `cross-ref.md` — PostHog + Linear + Sheet dedupe analysis
- `triage.md` — locked scope (`all 27 + assignee overrides`)
- `payloads.md` — full Linear body templates
- `sheet-rows.csv` — 21 Defects rows (now with real Linear URLs in Evidence Link + Linear URL columns)
- `sheet-test-backfill.csv` — 20 Test-tab Defect Link cell updates (Linear URLs)
- `report.md` — this file
