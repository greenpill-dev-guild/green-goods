# Admin Design Revamp — Handoffs

## Lane Order

```
tier_0_audit    →  tier_1_tokens  →  tier_2_atoms     →  tier_3_organisms
                                                              ↓
                                                       tier_4_screens
                                                              ↓
                                                       tier_5_wiring
                                                              ↓
                                                          cleanup
```

Each tier strictly depended on the prior one (tokens before atoms; atoms before organisms; organisms before screens; screens before wiring). Tiers 0–5 ran sequentially in a single delivery window (2026-05-02 / 2026-05-03) and are recorded in the commit log on `develop`. The cleanup lane is the only open lane; it is partially blocked on a sibling feature (`signal-pool-yield-wiring`).

## Active Handoffs

| Handoff | Status | Surface |
|---|---|---|
| [`claude-cleanup.md`](claude-cleanup.md) | ready | open follow-ups: tests, FAB wiring, pool-config consumption, client-test cleanup |

## Cross-Agent Coordination

This hub publishes coordination contracts into sibling plans rather than maintaining its own inbound queue. The live coordination is:

- **`signal-pool-yield-wiring`** (UI lane, `claude/ui/signal-pool-yield-wiring`):
  Coordination section landed in `.plans/active/signal-pool-yield-wiring/plan.todo.md` ("Coordination — Tier 5 Conviction Wiring (2026-05-03)") + a "Read first" callout in `handoffs/claude-ui.md`. Maps the GovernancePanel adjacency, flags opportunistic pickup items (pool-config reads, per-member breakdown, threshold formula), and confirms no scope conflict with the wiring UI's `GardenCommunityCard` work.

When the UI lane lands, the cleanup tier here picks up the unblocked items (see `claude-cleanup.md` § "Pool config consumption").

## Historical Lane Records

The completed tier lanes have no separate handoff files — they ran inside a single solo session. The audit doc + commit messages carry the equivalent record:

| Lane | Anchor commit | Anchor doc |
|---|---|---|
| `tier_0_audit` | `c228fa12` (audit committed) | [`docs/admin-revamp/audit.md`](../../../../docs/admin-revamp/audit.md) |
| `tier_1_tokens` | `c228fa12` | audit §1 + §5.1 + §5.2 + §5.5 |
| `tier_2_atoms` | `bfa0d28b` | audit §2 |
| `tier_3_organisms` | `822499d1` | audit §2 (Conviction* rows) |
| `tier_4_screens` | `48d09470` | audit §3 + IA-Garden + IA-Community |
| `tier_5_wiring` | `1b054239` (Members) + `a8586c26` (conviction wiring) | audit §5.3 + audit-then-ship report (in commit message) |

If a future lane needs a written handoff (e.g., a second-agent picks up cleanup), follow the `signal-pool-yield-wiring` template: `claude/<lane>/admin-design-revamp` branch, dependency notes, validation commands, UX guardrails.
