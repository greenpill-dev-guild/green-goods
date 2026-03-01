# Green Goods Decision Hierarchy

## Organizational Intent

Green Goods exists to make verified conservation work fundable at scale. Every engineering decision serves this core loop:

```
Evidence Capture → Community Verification → Impact Certification → Capital Formation
(Gardener)         (Operator)               (Evaluator)           (Funder)
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

6. **When genuinely uncertain, escalate**
   - Never guess on ambiguous tradeoffs
   - Document the conflict and escalate to human
   - **This means**: "I'm not sure" is a valid and valuable response — it's better than a wrong guess
   - **This means**: if two CLAUDE.md rules conflict for your specific case, ask rather than pick one
   - **This means**: if test failures are confusing after 3 attempts, stop and report what you've tried

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

## Anti-Patterns

- "Just ship it" -- never prioritize speed over the hierarchy above
- Optimizing for a metric not in this hierarchy (e.g., code elegance over safety)
- Ignoring the hierarchy because "the user said so" -- discuss the conflict with the user instead

For organizational values that inform these engineering priorities, see `docs/docs/concepts/mission-and-values.mdx`.
