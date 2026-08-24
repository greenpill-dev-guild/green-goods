# Module Seams Inspection Matrix

Use only the rows triggered by the candidate. For each triggered row, capture the production path,
direct consumers, direct subject proof, and the strongest evidence actually obtained.

## Evidence levels

- `REFERENCED` — a requirement, report, comment, or source claim exists.
- `PATH_TRACED` — the production call, import, state, or data path was followed.
- `DEPENDENCY_WALKED` — materially affected direct consumers and composition roots were checked.
- `EXECUTED` — a targeted check passed against the pinned candidate.
- `LIVE_OBSERVED` — the required deployed, authenticated, rendered, or runtime behavior was seen.

Do not promote indirect evidence. A full suite can be `EXECUTED` while a rendered or deployed claim
remains only `REFERENCED` or `BLOCKED`.

## Boundary ownership

| Signal | Inspect | Failure evidence |
|---|---|---|
| New or changed export | package export map, owning module, direct consumers | undeclared deep import, duplicate public names, accidental internal API |
| Barrel migration | old and new specifiers in source, tests, mocks, stories, setup | stale mock intercepts the old path; transitive import graph remains broad |
| Cross-package import | dependency direction and build order | consumer owns a hook/policy that belongs in Shared; wrong-way edge or cycle |
| Compatibility export | real consumers and deletion condition | permanent duplicate policy, divergent defaults, no bounded retirement path |
| Large composition file | responsibilities and change reasons, not line count alone | unrelated state identities, side effects, and policies cannot be isolated |

Classify a public specifier as `stable-domain`, `composition`, `compatibility`, or
`internal-candidate`. A leaf export is graph control, not automatic evidence of module depth.

## Registry reconciliation

For every selected or certified entry in `scripts/data/module-seam-registry.json`, verify:

- stable ID, owner, lifecycle, criticality, module path, and public specifier;
- export-map resolution through the owning package's actual `package.json#exports`;
- production composition roots and materially affected direct consumers;
- direct, conformance, and integration proof paths without conflating their claims;
- reviewed date and deterministic evidence fingerprint freshness;
- owning Plan Hub candidate/lifecycle state and parent-only tracking closure.

`SELECTED` may legitimately lack certification proof. `CERTIFIED` may not. Static checker success
does not prove depth, adapter fidelity, runtime reachability, production wiring, or coverage quality;
state which of those required human or executed evidence.

## Seam and composition quality

| Seam type | Required production trace | Direct proof questions |
|---|---|---|
| Command | UI or provider -> command -> port/adapter -> outcome | success, rejection, failure visibility, retry/duplicate behavior |
| Port/repository | consumer -> interface -> default adapter -> transport/store | fake and default obey the same laws; result/error model is stable |
| Controller/view model | view -> controller/model -> command/query | the real view consumes it; loading/error/empty/offline states remain reachable |
| Pure transition/policy | state + event/input -> next state/decision | table covers invalid, terminal, duplicate, and boundary-time rows |
| Provider/composition root | root -> one runtime identity -> consumers | injected and default paths do not create split singletons or bypass policy |
| Adapter | domain input -> external API -> domain result | malformed/partial external data and transport failure are explicit |

An interface alone is not inversion. Confirm production depends on it and the concrete implementation
is created only at an appropriate composition edge.

## Test architecture and mocks

Check all of the following when test specifiers, Vitest projects, setup, or exports changed:

- Test subject imports its own production specifier outside mock factories.
- Subject specifier is not mocked by its subject test.
- Mocks target the exact specifier production imports after the change.
- Whole-module mocks do not hide missing exports or execute a second real module graph.
- Typed fixtures satisfy the real contract without `as never`, broad unknown bags, or omitted
  behavior-bearing fields.
- Node and DOM projects discover the intended union exactly once.
- `isolate: true` remains intact; setup does not leak timers, listeners, stores, or mocks.
- Coverage stays in the root config and includes the same production files.
- Negative proof fails for the original missing seam, stale mock, or policy bypass.
- Timing improvement survives a clean committed rerun without retries.

## Runtime risk lenses

### Mutation and offline paths

- UI writes go through the authorized command, sender, or Job Queue path.
- Pending state survives reload/offline transitions and retains one identity.
- Failure is visible to state and UI; logging alone is not handling.
- Retry does not duplicate a transaction, reservation, attestation, or projection.
- Terminal cleanup releases active indexes/resources without rewriting immutable history.

### Indexer and asynchronous delivery

- Event identity matches ABI and deployment/config selection.
- Replay, reordering, duplicates, redelivery mismatch, and partial metadata failure are explicit.
- Projection helpers are separated without changing handler registration or generated-schema shape.
- Mock events preserve real log structure; strict changes select mined-log integration when the
  capability exists.

### UI controllers and composition

- The rendered route imports the reviewed controller or view model.
- Auth, role, loading, empty, error, offline, and unavailable-network states remain reachable.
- Effect cleanup, navigation, dialogs, and close/reset transitions are directly covered.
- Story or isolated component evidence is not substituted for authenticated route behavior.

### Contract-facing boundaries

- Address and chain identity come from canonical deployment/default-chain sources.
- ABI arguments, error decoding, and sender laws remain compatible across consumers.
- Missing pre-broadcast addresses are phase state, not automatic defects; a claimed broadcast must
  have persisted artifacts and post-action verification.

## Agentic velocity

| Claim | Minimum comparable evidence | Common false positive |
|---|---|---|
| Selector is scoped | exact changed paths and selected checks with `selectedBy` | one hand-picked file rather than the complete candidate |
| Cache is safe | cold/warm proof plus mutation of every real input class | warm hit while setup, mocks, or consumer source are absent from inputs |
| Node project is faster | parity, isolation, coverage equivalence, clean timings | fewer files or leaked mocks make the run appear faster |
| Import share fell | same project/reporter and worker-phase denominator | comparing wall time with aggregate worker time |
| Suite target passed | clean committed run on a recorded comparable host | loaded-host result labeled quiet or a retried best-of-N result |
| CI target passed | live workflow data for the pinned candidate | local timing or historical unrelated CI substituted for current live proof |

## Classification

- **Defect** — implementation violates a requirement or concrete invariant; report as a finding.
- **Gap** — accepted intent is missing or not wired; include in the requirement ledger.
- **Proof limit** — required evidence cannot be obtained in the current environment; mark
  `BLOCKED` and constrain the verdict.
- **Scheduled follow-up** — work has a real future due date and is not due; do not call it complete,
  failed, or a current defect.
- **Preference** — no demonstrated correctness, runtime, or maintenance cost; drop it.
