# Voucher booking experience Plan

**Feature Slug**: `voucher-booking-experience`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-11-19T23:04:34.193Z`
**Last Updated**: `2026-11-19T23:10:00.000Z`
**Linear Issue**: PRD-1574
**Linear Project**: Cosmo-Local Integration
**Linear Source**: source:plans

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Booking progress uses `FormProgress`, markers Book, Deposit, Service, Done, with a waiting state (DL-191) | One tracker across the app; one word set for every service |
| 2 | A member's booking page is one status, current facts, a details disclosure, one act; bookings only (DL-192) | 2,411px and three status displays fell to 876px in the render |
| 3 | Three member moments: Book, Deposit, Confirm Your Visit (DL-192) | Five return trips for one hub day |
| 4 | The steward's Accept also sends the start; the member's start is a fallback (DL-193) | The chain allows any sender once accepted |
| 5 | Needs you on booking rows in the wallet and Your Promises; no new channel (DL-194) | The member must come back twice |
| 6 | Review Promises is the one queue; the list folds copies; the reserve leads with three numbers; queue first on phones (DL-195) | One booking appeared twice; twenty rows for twenty hub days |
| 7 | Offer and Request; Ask to Take Up; Ask to Join; Book; English plus the Portuguese join and take-up strings (DL-196) | How people are spoken to; the website already says it |
| 8 | C and D build in parallel side sessions; E and F follow in this session | Disjoint files; E is critical tier |

## Pull Requests

| PR | What | Who | Status |
|---|---|---|---|
| A | Ledger rows DL-191 to DL-196 | orchestrator | open, #1724 |
| B | This hub, the walkthroughs, the proposal stories, `FormProgress` waiting state | orchestrator | this branch |
| C | App booking page, tracker, sheets, Needs you | side session | building |
| D | Hub queue, folded list, reserve card, phone order | side session | building |
| E | Accept and Start; one Confirm Your Visit sheet | orchestrator | after C and D |
| F | Offer and Request wording sweep | orchestrator | last |
| G | Protocol scoping note (RESR-119), folded into B: `.plans/backlog/cosmo-local-credit-interop/research/voucher-booking-protocol-changes-2026-11-19.md` | orchestrator | written |
| H | Live Report Visit and Your Reserve: visit read, a write recording the visit as evidence, reserve read (critical tier) | orchestrator | after E |

## Coordination

The 2.1.0 release runs other work beside this hub. The Hub phone work (PRD-1491) owns Hub sign-in,
install, gutters and the Promises "+" entry, and reviewed D's phone-width changes. Any
`FormProgress` restyle and Home's join notice belong to PRD-1505 and PRD-1522. PRD-957 and the
event-tracking issues (PRD-1571, PRD-1561) change the Shared executor, so E starts only after
they are checked. Merge `origin/develop` before every push; never touch `vercel.json`.

## Requirements Coverage

| Requirement | Lane | PR | Status |
|---|---|---|---|
| Tracker and waiting state | `ui` | B, C | ⏳ |
| Booking page and sheets | `ui` | C | ⏳ |
| Needs you on booking rows | `ui` | C | ⏳ |
| Hub queue, list, reserve, phone order | `ui` | D | ⏳ |
| Accept and Start; fallback start | `state_api` | E | ⏳ |
| One Confirm Your Visit sheet | `state_api` | E | ⏳ |
| Live Report Visit and Your Reserve | `state_api` | H | ⏳ |
| Wording | `ui` | F | ⏳ |

## TDD / Proof Order

- [ ] Each behavior PR writes or selects its failing test first, records RED and GREEN in its
      handoff, and runs `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] E runs the critical gate (`node scripts/dev/ci-local.js --intent push --risk critical`) and
      gets a fresh agent review

## Validation

- [ ] Focused tests per PR, then `node scripts/dev/ci-local.js --intent push`
- [ ] Storybook proof at 375 and 1280: hub day from Book to Kept on both apps, the cut-short
      path, every recovery and cross-chain wait state; Earn, Exchange and Setup unchanged
