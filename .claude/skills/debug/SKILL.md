---
name: debug
user-invocable: false
description: Debugging & Troubleshooting — fires passively when the user describes a bug, pastes an error or stack trace, reports unexpected behavior, mentions failing tests or builds, or signals an incident. Routes to user_bug_triage when an external party (user / gardener / operator / customer / team member / partner) reports broken product behavior, incident_hotfix on urgency signals, tdd_bugfix on red-test signals, default on general bug reports.
argument-hint: "[error-description]"
---

# Debug Skill

Systematic debugging: find root causes before fixes, verify with evidence before completion.

**References**: See `CLAUDE.md` for codebase patterns and `.claude/context/*.md` for per-package invariants.

---

## Activation

This skill is **passive-only**. There is no `/debug` slash command. Fire automatically when the user's prompt matches any signal below.

### Bug signals → Default root-cause mode

- "debug this", "why is X failing?", "what's wrong with Y?"
- Pasted stack trace, error message, or log snippet
- Reported unexpected behavior ("X should do Y but does Z")
- User-visible UI regressions: cannot click/select/tap, missing selected state, missing border,
  collapsed/blank cards, invisible content, broken scroll/refresh, or visible-but-unusable controls
- Test failures or build failures without a clear pattern

### Incident signals → incident_hotfix mode

- "production is down", "incident", "hotfix", "emergency", "urgent"
- "we're bleeding", "customers can't..."
- Focus: minimal stabilizing fix, not ideal root cause

### Red-test signals → tdd_bugfix mode

- "this test is failing", paste of red test output with a clear failing assertion
- "write a failing test for X then fix it"
- Focus: test-first loop — reproduce in a test, then fix

### External-party report signals → user_bug_triage mode

Fires when any external party reports broken product behavior — regardless of phrasing, role, or
channel. Pattern-match semantically, not lexically: `a gardener said`, `the Hypercert team can't`,
`Afolabi got an error`, `operator reports`, `someone is hitting`, `a user said`, forwarded support
message, attached user screenshot, paraphrased complaint — they all engage this mode.

- Focus: reproduce locally first, identify the failing layer, probe the boundary with the user's
  exact inputs, disambiguate opaque errors, then confirm scale/root-cause context with PostHog/Sentry (never the other way).
- See the User-Facing Bug Triage Protocol in Part 1 — it gates the choice between UI Regression
  and Data/API/Contract protocols.

### Verification signals

- "verify this works", "prove completion", "evidence this is done"
- Focus: evidence-based checks after implementation

---

## Safety Rules

- Non-destructive recovery only — never `git checkout -- .`, repo deletion, or forced resets in debug flow
- Save a patch snapshot before risky edits: `git diff > /tmp/green-goods-debug.patch`
- Use a work-based safety branch for experiments: `git switch -c fix/incident-$(date +%Y%m%d-%H%M%S)`
- In docs and examples, prefer `node -e 'fetch(...)'` over `curl`/`wget` (blocked in this environment)

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Evidence before claims, always.
> For user-observed UI bugs, start from the rendered surface before tracing data flow.

---

## Part 1: Root Cause Investigation

### Phase 1: Choose the entrypoint

**DO NOT attempt any fixes yet.** Reproduce with exact steps, read the full error, check `git log --oneline -20` for recent changes — then route:

- External-party bug report: run the **User-Facing Bug Triage Protocol** first — it's the gating frame that decides which deeper protocol applies.
- User-visible UI regression: inspect the rendered component first (DOM, geometry, computed styles, event target, state change).
- Data/API/contract symptom: trace data flow backward from the failing output.

### User-Facing Bug Triage Protocol

Fires for `user_bug_triage` mode. Use this as the gating frame whenever any external party
(user, gardener, operator, customer, team member, partner) reports broken product behavior —
regardless of phrasing or role. Apply this BEFORE choosing UI Regression or Data/API/Contract
protocols; this decides which one fits.

1. **Reproduce, with the user's exact inputs.** Drive the real surface (authenticated Brave QA profile against
   `localhost` or prod in Brave, real auth mode, real garden, real entry path). Target: trigger the failure
   yourself within 5 minutes. Do not open PostHog or Sentry yet. If reproducing is impossible, document why
   and proceed with explicit caveat.
2. **Identify the failing layer** before going deeper: UI render, fetch boundary, server response,
   contract call, indexer drift, deployment artifact. Pick by where the symptom surfaces, not
   where you suspect.
3. **Probe the boundary with the user's exact inputs.** For a fetch boundary failure, send the
   actual HTTP request with the user's `Origin`/auth/headers; read raw status, headers, and body.
   For UI, inspect the rendered DOM at the failing moment. For contract, `cast call` against the
   deployed address. One round-trip beats a hundred metric reads.
4. **Treat opaque runtime errors as categories, not causes.** `TypeError: Failed to fetch`,
   `NotReadableError`, `DOMException`, `Error: Network error` — disambiguate before committing:
     - `Failed to fetch` → one `fetch('/health', {mode:'no-cors'})` against the same host.
       Succeeds → it's CORS or app-layer. Fails → real connectivity.
     - `NotReadableError` on a `File` → File handle invalidated (mobile background/foreground
       cycle); test with a fresh pick.
     - `DOMException` from React reconciliation → check for stale chunk / SW version skew
       (cross-bundle callback going undefined) before chasing component logic.
5. **State ONE hypothesis in one sentence.** If you can't, you don't have one — go back to (3).
6. **Run the cheapest test that would *falsify* the hypothesis.** Not the test that confirms it.
   If you can't refute it cheaply, the hypothesis is too vague.
7. **Only now use PostHog/Sentry** — PostHog measures scale, version range, regional distribution, and session patterns. Sentry supplies stack, release, and suspect-code context. Neither replaces the boundary proof above.
8. **Anti-patterns to refuse:**
   - Conflating multiple user sessions with similar symptoms as the same bug without independent
     proof — different sessions are separate threads until evidence ties them.
   - Building a narrative from telemetry before reproducing the failure.
   - Discounting user firsthand observation in favor of a single metric (downlink, geoip, etc.).
   - Accepting an opaque category (`Failed to fetch`, etc.) as a diagnosis.
9. **After fix, if the symptom→cause mapping is reusable**, persist it as a project memory
   (e.g., `project_<subsystem>_known_failures.md`) so the next session resolves it faster.

### User-Observed UI Regression Protocol

When the user describes what they can see or touch in the UI, do not start with providers,
queries, auth, or indexer hypotheses. First prove the rendered surface.

1. **Reproduce or simulate the exact visible symptom** using the real component path when possible.
   Click/tap the real element, not a mocked child component.
2. **Inspect rendered DOM geometry and styles**: bounding rect, width/height, opacity, display,
   pointer-events, z-index, overflow, disabled state, selected classes, and computed border/ring.
3. **Verify whether interaction state changes**: component state, Zustand store, router state,
   form state, or DOM data attributes after click/tap.
4. **Trace the component stack outward-in**: visible element → card/button/input → wrapper
   (carousel/sheet/dialog) → state setter. Only then inspect hooks/providers/query/data.
5. **Check recent component history** with `git log --follow` or focused `git show` on the
   visible component and wrapper files before proposing a fix.
6. **For shared-component layout bugs, check the Tailwind v4 shared JSX scanning gotcha**
   in `CLAUDE.md` before chasing data-layer hypotheses.
7. **Separate rendered-but-unusable from missing data**. If text/data exists in the DOM but the
   control is collapsed, invisible, untappable, or lacks visual selected state, treat it as a
   component/CSS regression until browser or DOM evidence proves otherwise.

### Data/API/Contract Regression Protocol

When the symptom is missing or wrong data, failed writes, failed reads, RPC errors, indexer drift,
deployment artifacts, or contract behavior, do not spend the first pass on CSS or component
geometry. Start at the failing output and trace backward through the data path.

1. **Capture the failing evidence**: request/response body, query key, log line, tx hash, receipt,
   revert reason, deployment artifact, failing test, or build output.
2. **Classify the failing layer** before proposing a fix: component state/query cache, shared hook,
   shared module, API/indexer, RPC/provider, deployment config, contract ABI/address, or on-chain
   contract state.
3. **Trace the data path backward**: visible output or failing assertion → hook/query key → shared
   module → provider/indexer/RPC → contract address/ABI/event/schema.
4. **Verify environment truth first**: chain ID, deployment JSON, indexer config, schema UID,
   contract address, RPC URL, and package guide for the touched surface.
5. **Use repo wrappers for contract/indexer checks**. Do not invoke Forge directly for build
   or test commands; use the bun scripts in `CLAUDE.md` and the package guides.
6. **Do not convert confirmed data/API/contract failures into UI styling investigations** unless
   the data is present and the rendered control is still collapsed, invisible, or unusable.

### Phase 2: Hypothesis Testing

Form one specific hypothesis ("X calls Y with null", not "something is wrong with the API"), test one variable at a time. After 3 failed fixes, STOP fixing — question the architecture and your assumptions before trying a fourth.

---

## Part 2: Fix Sizing

Simple fixes (<10 lines, single file, root cause proven) apply directly. Complex or architectural fixes (multi-file, pattern change, needs new tests) go through plan mode first — present root cause + evidence + smallest fix, get approval, then implement.

---

## Part 3: Verification Before Completion

CLAUDE.md § Verify Before Claiming Success is the contract: evidence in the same turn, no "should work / probably / seems to". Standard proofs: `bun run test` (never `bun test`), `bun build`, `bun lint`, `npx tsc --noEmit` in the touched package.

---

## Part 4: Green Goods Reference

The by-domain command reference (offline sync, contracts, frontend devtools, indexer, build/type)
and the end-to-end pipeline trace (IndexedDB → job queue → IPFS → contract → indexer → GraphQL
cache) live in [health-diagnostics.md](./health-diagnostics.md) — load it when you need commands,
not routing. Hook-location complaints: `bash .claude/scripts/validate-hook-location.sh`.

### Common Debug Scenarios

| Symptom | Likely Cause | Diagnostic |
|---------|-------------|------------|
| "Invalid hook call" | Hook defined outside `@green-goods/shared` | Run `validate-hook-location.sh` |
| Stale query data | Missing query invalidation after mutation | Check TanStack Query DevTools |
| Transaction silently fails | Wrong auth mode (wallet vs passkey) | Log `authMode` before contract call |
| Indexer missing events | Contract address mismatch in config | Compare `deployments/*.json` with `config.yaml` |
| Storage quota errors | Too many offline photos | Check `getStorageQuota()` |
| Service worker not updating | Aggressive caching | Check `Cache-Control` headers for `/sw.js` |

---

## Output

After debugging provide:

### Summary
- Symptom and scope
- Mode used

### Root Cause
- Evidence-backed cause statement

### Actions
- Fix applied (or recommended if report-only)

### Verification
- Commands executed and outcomes
- Contract-touching fixes should also run: `bun run verify:contracts:fast`

### Next Step
- `DONE`, `NEEDS_INPUT`, or `ESCALATE`

## Reference Files

- **[health-diagnostics.md](./health-diagnostics.md)** -- Domain command reference + end-to-end pipeline trace, service worker health, storage quotas, indexer sync lag, Web Vitals, error boundaries
- **[monitoring.md](./monitoring.md)** -- Production monitoring: transaction tracking, job queue health, on-chain verification
- **[posthog.md](./posthog.md)** -- PostHog + Sentry setup, event/error tracking integration, feature flags. Also covers Linear routing for accepted bugs (Customer Need for raw signal, Issue for accepted work) and the PostHog/Sentry↔Linear privacy boundary.

## Linear Routing

This skill is read-only on Linear while debugging. The shared routing core (team routing,
`.plans`/`source:plans`, projects, labels, privacy, prompt-before-create) lives at
[`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md).

Debug-specific deltas, applied after a bug is reproduced and root-caused:

- Raw user/telemetry signal → Linear **Customer Need** (Product team) using the structured body shape (Source / Customer type / Need statement / Evidence / Disposition).
- Accepted fixes, QA follow-ups, or product investigations → Product Issue with `activity:qa` + relevant `package:*` + `protocol:*`.
- The PostHog/Sentry↔Linear privacy specifics live in [posthog.md](./posthog.md).

## Related Skills

- `review` — post-fix review of the change (regressions, gaps, validation)
- [docs/routines/posthog-questions.md](../../../docs/routines/posthog-questions.md) — curated telemetry question library when scale/impact context is needed
- Error-handling and testing invariants live in `.claude/context/shared.md` and `.claude/context/testing.md`
