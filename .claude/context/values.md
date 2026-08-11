# Green Goods Decision Hierarchy

## Organizational Intent

Green Goods exists to make verified regenerative work fundable at scale. Every engineering decision serves this core loop:

```
Evidence Capture → Community Verification → Impact Certification → Community Thriving → Capital Formation
(Gardener)         (Operator)               (Evaluator)           (Community)          (Funder)
```

**What we optimize for:**
- Gardener submission friction below 2 minutes — this is the growth bottleneck
- Data integrity of attestation chains — funders won't pay for unverifiable claims
- Operator onboarding efficiency — operators are the distribution channel (B2B2C)
- Self-sustaining economics — yield-backed vaults, not perpetual grants

**What we do not optimize for:**
- Feature breadth before core flow stability
- Real-time accuracy over offline resilience
- Code elegance at the expense of safety or simplicity
- Blockchain vocabulary in gardener-facing experiences

## Implementation Quality Contract

Apply this compact contract whenever writing or reviewing production code:

- **KISS + YAGNI**: implement the smallest behavior-complete solution. Do not add speculative
  configuration, factories, wrappers, extension points, or compatibility branches.
- **Evidence-driven DRY**: search for the existing local solution first. Consolidate only when the
  repeated code expresses the same policy and the result reduces total code and decision surface.
- **SLAP**: keep each function at one level of abstraction. Orchestration should read as a sequence
  of domain steps; move low-level parsing, transport, or persistence detail behind well-named
  helpers only when that makes the flow easier to verify.
- **Separation of concerns + SOLID boundaries**: give a module one coherent reason to change,
  keep interfaces consumer-driven, preserve substitutability, and depend on stable abstractions
  and package/public boundaries rather than concrete internals.
- **Pattern discipline**: prefer composition and established local patterns. Introduce a named
  creational, structural, or behavioral pattern only for present complexity, with a clear
  simplification or risk-isolation benefit.
- **Clean comments**: explain why, constraints, invariants, or non-obvious tradeoffs. Do not narrate
  what the code says, preserve implementation history, or leave stale/generated commentary.
- **Systemic closure**: when a defect is confirmed, name its root-cause class, search direct
  consumers and sibling surfaces, add negative proof for the triggering boundary, and record what was
  checked but unaffected. Fix the class inside the locked scope, not only the commented line.
- **Evidence before claims**: write passing, green, or merge-ready status only after fresh proof at
  the current implementation commit. Record the command, tested commit SHA, timestamp, and
  summarized result; historical dated reports stay immutable and receive separate correction
  artifacts. Every commit-attributed receipt also records an empty
  `git status --porcelain=v1 --untracked-files=all -- <validated paths>` so the tested code is exactly
  reproducible from its SHA. A later evidence-only commit may cite that tested parent only when an exact path-scoped
  `git diff --exit-code <tested>..HEAD -- <validated paths>` proves every validated implementation,
  dependency, configuration, and validation entrypoint is unchanged, and
  `git status --porcelain=v1 --untracked-files=all -- <validated paths>` returns no staged, unstaged,
  or untracked changes. Record both identity commands and results; any validation-surface or
  working-tree change requires a fresh run.
- **Final simplification pass**: after behavior is green, delete redundancy, flatten avoidable
  branching, improve names, and remove comments or abstractions that no longer earn their cost.

When agent values conflict, resolve in this order (highest priority first):

## Priority Stack

1. **User safety over feature completeness**
   - Never ship a feature that could lose user funds or expose keys
   - Incomplete but safe > complete but risky
   - **This means**: never disable error boundaries or validation to ship faster
   - **This means**: always validate user input at system boundaries (form submission, contract calls)
   - **This means**: if a feature can't be made safe within scope, ship without it and document the gap
   - **This means**: never store private keys in plaintext — use `crypto.prepareKeyForStorage()` (AES-256-GCM)

2. **Offline-first functionality over real-time accuracy**
   - Client PWA must work without internet
   - Stale data with offline access > fresh data requiring connectivity
   - **This means**: all write operations go through the job queue, never directly to contracts from UI
   - **This means**: show cached data with staleness indicators, not loading spinners that block on network
   - **This means**: never use `navigator.onLine` as a gate to block UI — queue the operation and sync later
   - **This means**: IndexedDB is the source of truth for pending work, not server state

3. **Correct fix over quick fix**
   - Prefer root cause resolution over workaround
   - Prefer surgical precision over broad changes
   - **This means**: use `/debug` to find root cause before writing a fix
   - **This means**: a 3-line fix that addresses the root cause beats a 30-line workaround
   - **This means**: if you can't explain *why* the bug happened, you haven't found the root cause yet
   - **This means**: never suppress errors to make tests pass — fix the underlying issue

4. **Minimal blast radius over perfect solution**
   - Prefer isolated changes to fewer packages
   - Prefer backward-compatible approaches when equally viable
   - **This means**: if a fix touches 1 package, don't refactor 3 others "while you're at it"
   - **This means**: additive changes (new fields, new functions) over breaking changes to existing APIs
   - **This means**: when two approaches are equally correct, pick the one that touches fewer files
   - **This means**: commit per-package during migrations for incremental rollback capability

5. **Existing patterns over novel approaches**
   - Follow codebase conventions unless documented as problematic
   - Cathedral Check: find most similar existing file as reference
   - **This means**: before creating a new utility, search for existing ones in `packages/shared/src/utils/`
   - **This means**: new hooks follow the same structure as existing hooks in the same domain folder
   - **This means**: don't introduce a new state management pattern when Zustand/TanStack Query already covers it
   - **This means**: if an existing pattern is bad, fix the pattern everywhere — don't create a parallel approach

6. **Community capability over platform dependency**
   - Build toward community self-sufficiency, not captive usage
   - **This means**: prefer portable records, exports, and clear reporting over trapped-in-platform workflows
   - **This means**: recognition should reflect capability and trust transitions, not addictive activity volume
   - **This means**: if a workflow makes operators or funders faster but weakens community agency, revisit the tradeoff

7. **When genuinely uncertain, escalate**
   - Never guess on ambiguous tradeoffs
   - Document the conflict and escalate to human
   - **This means**: "I'm not sure" is a valid and valuable response — it's better than a wrong guess
   - **This means**: if two CLAUDE.md rules conflict for your specific case, ask rather than pick one
   - **This means**: if test failures are confusing after 3 attempts, stop and report what you've tried

## Criticality Matrix

Choose review depth from the surface, not from how small the diff feels.

- **`critical`**
  - `packages/contracts/src/**`
  - contract deploy, upgrade, migration, release, size, and storage-layout tooling and baselines
  - `packages/shared/src/providers/{Auth,JobQueue,Work}.tsx`
  - `packages/shared/src/modules/job-queue/**`
  - `packages/shared/src/hooks/{auth,work,vault,blockchain}/**`
  - Required behavior: read every touched line, run the matching reviewer flow, and reject log-only
    failure handling. For contract tooling, also prove malformed-input handling, path confinement,
    idempotency, atomic updates, and accurate failure summaries where applicable.

- **`sensitive`**
  - `packages/agent/src/**`
  - indexer retry, event-lifecycle, and projection handlers
  - `.claude/scripts/**` dispatch or environment-boundary tooling
  - Plan Hub state, validation evidence, and `scripts/harness/plan-hub.mjs`
  - migration, validation, and repository-policy tooling outside the contract package
  - admin workflow state surfaces
  - client journey views
  - Required behavior: verify failure and recovery states explicitly, keep the blast radius tight, and run targeted validation before claiming the change is safe.

- **`routine`**
  - docs
  - automation prompts
  - stories
  - cleanup-only changes
  - test-only refactors that do not alter runtime behavior
  - Required behavior: use the lightest honest validation loop and keep attention on correctness,
    not ceremony. A doc, command, guide, or skill deletion/rename becomes sensitive when it retires a
    live surface; search all tracked consumers before removing it.

## Tradeoff Escalation Triggers

Escalate to human when:
- Two Key Principles from CLAUDE.md conflict (e.g., offline-first vs. single chain consistency)
- A fix requires modifying more than 3 packages
- Security implications are unclear
- The correct behavior is ambiguous after reading tests and documentation
- Blast radius exceeds initial assessment by 2x or more

### Historical Escalation Examples

These past cases illustrate when escalation was the correct action:

- **ABI encoding mismatch** (Feb 2026): `abi.encode(struct)` vs `abi.encode(field1, field2, ...)` produce different bytes for dynamic types. Root cause wasn't obvious after initial investigation — escalation led to discovering all 3 resolver proxies needed redeployment.
- **Viem `client.call({ from })` silent ignore** (Feb 2026): Validation scripts reported false failures because viem silently ignores unknown properties. The correct behavior was ambiguous after reading docs — escalation avoided hours of chasing false positives.
- **Hats Protocol authorization model** (Feb 2026): `isAdminOfHat(account, hatId)` checks transitive ancestry, not direct ownership. Security implications were unclear — escalation prevented deploying with wrong permission model.

## Meaningful Impact: Minimum Evidence Standards

When evaluating whether a work submission constitutes "meaningful impact":

1. **Minimum evidence per submission**: At least 1 photo + text description. Submissions with no photo or no text are incomplete and must not be attested.
2. **Attestation validity**: The attestation must match its registered EAS schema UID. Operator approval must have confidence level >= `LOW` (the minimum threshold; higher is better but LOW is acceptable).
3. **No self-attestation**: The submitter of a work (`msg.sender` of the work attestation) must not be the same address as the approver (`msg.sender` of the approval attestation). This is enforced at the resolver level.
4. **Traceability**: Every attested work must be traceable to a client-initiated submission (job queue entry with `clientWorkId` or direct transaction hash). No system-generated impact claims.

## Anti-Patterns

- "Just ship it" -- never prioritize speed over the hierarchy above
- Optimizing for a metric not in this hierarchy (e.g., code elegance over safety)
- Ignoring the hierarchy because "the user said so" -- discuss the conflict with the user instead

For organizational values that inform these engineering priorities, see `docs/docs/community/why-we-build.mdx` and `docs/docs/community/how-it-works.mdx`.
