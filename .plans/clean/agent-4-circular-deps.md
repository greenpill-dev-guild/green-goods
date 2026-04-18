# Agent 4 — Circular Dependency Assessment (Re-run)

Mode: **DRY-RUN** (research + assessment, no source files edited).
Scope: **admin, shared, client, contracts** (agent / indexer / ops OUT OF SCOPE).
Root: `/Users/afo/Code/greenpill/green-goods`, branch `develop`, commit `6a4187cd`.

---

## 1. Executive summary

- **Raw madge count (3-package scope)**: **6 cycles**. Madge double-counts one shared spine, so the underlying **logical cycles are 5**, clustering into **3 cycle groups**. **Zero change vs prior run** — no cycles resolved, no new cycles introduced.
- **Affected packages**: **only `packages/shared`**. `contracts` (Solidity, not madge-traversed), `client`, `admin` all show zero intra-package cycles and zero cross-package upward imports.
- **Cycle groups** (unchanged from prior report):
  1. `config/query-keys/*` ↔ `config/query-keys/index.ts` — barrel self-reference (3 madge hits, 2 logical).
  2. `utils/work/offline.ts` ↔ `hooks/work/useWorks.ts` — utils layer reaches into hooks layer (2 madge hits, 1 logical spine).
  3. `modules/data/hypercerts-attestations.ts` ↔ `modules/data/hypercerts-fetch.ts` — one side static, other lazy (1 madge hit).
- **Cross-package upward imports**: **0 production cases** (`@green-goods/client` / `@green-goods/admin` never imported from anywhere).
- **Deep-path `@green-goods/shared/*` imports in product code**: **0**. Only test-only entry points (`/testing`, `/mocks`, `/i18n/en.json`, `/__tests__/setupTests.base`). **8 lines total, all legitimate.**
- **Barrel adherence** (admin + client): 266 bare-barrel imports vs 8 deep-path test-only → **~97% barrel-pure** (Grade A).
- **Solidity**: contracts compile fine (Foundry, not madge). 6 cross-layer imports found — all descending (resolver→registry, module→strategy, token→module/registry). No upward cycles.

### Verbatim madge output (3-package scope)

```
Processed 1177 files (11.9s) (130 warnings)

✖ Found 6 circular dependencies!

1) shared/src/config/query-keys/index.ts > shared/src/config/query-keys/invalidation.ts
2) shared/src/config/query-keys/index.ts > shared/src/config/query-keys/invalidation.ts > shared/src/config/query-keys/invalidation-finance.ts
3) shared/src/config/query-keys/index.ts > shared/src/config/query-keys/types.ts
4) shared/src/hooks/work/useWorks.ts > shared/src/modules/job-queue/index.ts > shared/src/config/index.ts > shared/src/config/query-persistence.ts > shared/src/utils/index.ts > shared/src/utils/work/offline.ts
5) shared/src/modules/job-queue/index.ts > shared/src/config/index.ts > shared/src/config/query-persistence.ts > shared/src/utils/index.ts > shared/src/utils/work/offline.ts
6) shared/src/modules/data/hypercerts-attestations.ts > shared/src/modules/data/hypercerts-fetch.ts
```

### Madge shared-package fan-in (top 15, unchanged)

```
164 hooks/index.ts
 53 utils/index.ts
 41 components/index.ts
 25 modules/index.ts
 20 hooks/garden/useGardenDetailData.ts
 20 hooks/work/useWorkMutation.ts
 18 components/Canvas/index.ts
 17 modules/work/wallet-submission/submit-approval.ts
 17 modules/work/wallet-submission/submit-batch-approval.ts
 16 hooks/garden/useCreateGardenWorkflow.ts
 16 modules/work/wallet-submission/submit-work.ts
 15 hooks/hypercerts/useMintHypercert.ts
 15 hooks/work/useWorkApproval.ts
 15 types/index.ts
 14 hooks/hypercerts/useCreateListing.ts
```

`hooks/index.ts` (164 inbound) is expected for a 164-hook barrel — not in any cycle.

---

## 2. HIGH-CONFIDENCE fixable cycles

### H1 — `config/query-keys/types.ts` ↔ `config/query-keys/index.ts` (madge #3)

- **Cycle**: `index.ts` exports types from `./types`; `types.ts:1` does `import type { queryKeys } from "./index"`. Graph-level loop.
- **Status today**: `types.ts` uses `import type`, so types are erased at runtime → **runtime-safe**. Madge doesn't distinguish type imports.
- **File reference**: `packages/shared/src/config/query-keys/types.ts:1`
  ```ts
  import type { queryKeys } from "./index";
  ```
- **Fix (cosmetic)**: re-home the `QueryKey` / `WorksQueryKey` / `QueueQueryKey` unions directly over leaf key modules (`./work`, `./vault`, `./garden`…). Then `types.ts` imports from leaves, not from the barrel. ~60 LOC rewrite, zero behavior change.
- **Classification**: HIGH (graph hygiene, not functional).

### H2 — `invalidation.ts` ↔ `index.ts` (madge #1)

- **Cycle**: `index.ts:48` re-exports `queryInvalidation` from `./invalidation`; `invalidation.ts:1` does `import { queryKeys } from "./index"` (runtime import, not type).
- **File reference**: `packages/shared/src/config/query-keys/invalidation.ts:1`
  ```ts
  import { queryKeys } from "./index";
  import { financeInvalidation } from "./invalidation-finance";
  ```
- **Why real**: `queryKeys` is defined before the `export { queryInvalidation }` line in `index.ts`, so the module factory happens to see a defined binding — but this is brittle module-initialization ordering.
- **Fix**: extract the composed `queryKeys` const to a new `config/query-keys/keys.ts`. `index.ts` re-exports it; `invalidation.ts`, `invalidation-finance.ts`, and `types.ts` all change import source from `./index` to `./keys`. 3 import-line edits + 1 new file. Zero API surface change.
- **Classification**: HIGH (clean mechanical extract).

### H3 — `invalidation-finance.ts` ↔ `index.ts` (madge #2)

- Identical shape to H2. `packages/shared/src/config/query-keys/invalidation-finance.ts:1`:
  ```ts
  import { queryKeys } from "./index";
  ```
- **Subsumed by H2's fix** — the same `keys.ts` extraction resolves both.
- **Classification**: HIGH (no additional work).

### H4 — `hypercerts-attestations.ts` ↔ `hypercerts-fetch.ts` (madge #6)

- **Cycle**: `hypercerts-attestations.ts:7` imports `getGardenHypercerts` from `./hypercerts-fetch` (used by `checkAttestationsBundled`). The reverse edge was already patched: `hypercerts-fetch.ts:400` uses `await import("./hypercerts-attestations")` with a "Lazy import to avoid circular dependency" comment. **Only one side was resolved.**
- **File references**:
  - `packages/shared/src/modules/data/hypercerts-attestations.ts:7` — static import
  - `packages/shared/src/modules/data/hypercerts-fetch.ts:400` — dynamic workaround
- **Fix options** (pick one):
  1. **Relocate** `checkAttestationsBundled` from `hypercerts-attestations.ts` into `hypercerts-fetch.ts`. It only needs `getGardenHypercerts` + a `Set` lookup. Lets us delete the lazy-import workaround and stale comment. (~40 LOC.)
  2. Extract `getGardenHypercertsLite` into a new `hypercerts-query.ts`; both files import from there.
- **Classification**: HIGH (preferred option 1 = ~40 LOC relocation).

---

## 3. MEDIUM cycles (judgment required)

### M1 — `utils/work/offline.ts` ↔ `hooks/work/useWorks.ts` (madge #4 and #5 share this spine)

- **Full cycle**: `utils/index.ts` → `utils/work/offline.ts:9` (`import { jobToWork } from "../../hooks/work/useWorks"`) → `modules/job-queue/index.ts` → `config/index.ts` → `config/query-persistence.ts:3` (`import { debugWarn } from "../utils"`) → back to `utils/index.ts`. Cycle.
- **File references**:
  - `packages/shared/src/utils/work/offline.ts:9` — layer inversion
  - `packages/shared/src/config/query-persistence.ts:3` — barrel overreach
- **Two violations knotted together**:
  1. **Layer inversion**: `utils/work/offline.ts:9` pulls `jobToWork` out of a hook file. `jobToWork` is a **pure function** (no React APIs) that only maps `Job<WorkJobPayload>` → `Work`; it does not belong in `hooks/`.
  2. **Barrel overreach**: `config/query-persistence.ts:3` does `import { debugWarn } from "../utils"` — pulling the entire utils barrel (and transitively, `utils/work/offline.ts`) just to get one debug helper.
- **Fix** (two edits):
  1. Move `jobToWork` from `hooks/work/useWorks.ts` into `utils/work/offline.ts` (or a new `utils/work/job-to-work.ts`). `useWorks.ts` imports it back. Update test path at `packages/shared/src/__tests__/hooks/work/useWorks.test.ts:96`:
     ```ts
     const { useWorks, jobToWork } = await import("../../../hooks/work/useWorks");
     ```
     This dynamic import is still present and currently exports both from `useWorks`.
  2. Change `config/query-persistence.ts:3` from `import { debugWarn } from "../utils"` to `import { debugWarn } from "../utils/debug"` (direct file, no barrel traversal).
- **Classification**: MEDIUM (two moves + one test-path update).

### M2 — Deprecation shim still in the graph

- `packages/shared/src/utils/query-invalidation.ts` remains a 10-line `@deprecated` re-export of `config/query-keys/schedule`. Grep confirms:
  - Only mention in product code: `packages/shared/src/utils/index.ts:285` re-exports `InvalidationDelay` / `ProgressiveInvalidationOptions` types from it.
  - MODULES.md line 169 still flags it as "candidate to live closer to query keys/config."
  - **Zero runtime callers** in `packages/shared/src/`, `packages/admin/src/`, or `packages/client/src/`.
- **Fix**: delete `utils/query-invalidation.ts`, move the two type re-exports in `utils/index.ts:285` to pull directly from `config/query-keys/schedule`. Not a cycle per se, but contributes graph noise in this same subtree.
- **Classification**: MEDIUM (overlaps Agent 3 dead-code / Agent 7 legacy-cleanup).

---

## 4. LOW / legitimate co-dependencies

**None.** All 5 logical cycles are resolvable with ≤ 40 LOC edits each. No cycle is structurally required.

---

## 5. Layer-violation imports

### 5a. Cross-package upward imports

```
$ grep -rn '@green-goods/client\|@green-goods/admin' packages/ --include='*.ts' --include='*.tsx'
(no matches)
```

**Zero.** Architecture discipline holds: shared never imports client/admin; client/admin never import each other.

```
$ grep -rn "from ['\"].*packages/client" packages/admin/src packages/shared/src
(no matches)
$ grep -rn "from ['\"].*packages/admin" packages/client/src packages/shared/src
(no matches)
```

### 5b. Intra-shared upward layer violations

Layer tree: `types/` → `utils/` → `config/` → `modules/` → `hooks/` → `components/` → `providers/`.

Scan: `grep -rEn "from ['\"]\.\./\.\./hooks|from ['\"]\.\./hooks" packages/shared/src/utils packages/shared/src/config packages/shared/src/modules packages/shared/src/types` → **1 hit**:

- `packages/shared/src/utils/work/offline.ts:9` — `import { jobToWork } from "../../hooks/work/useWorks"` (root cause of M1; see §3).

No other upward imports detected across utils/config/modules/types.

### 5c. Deprecated re-export

- `packages/shared/src/utils/query-invalidation.ts` — orphaned `@deprecated` shim (see M2).

---

## 6. Deep-path import violations

```
$ grep -rEn "from ['\"]@green-goods/shared['\"]" packages/admin/src packages/client/src | wc -l
266   # barrel imports

$ grep -rEn "from ['\"]@green-goods/shared/" packages/admin/src packages/client/src | wc -l
  8   # deep-path imports (all test-only)
```

**Ratio: 266:8 → ~97% barrel-pure (Grade A).**

### All 8 deep-path imports — every one is legitimate (test entry points / JSON asset)

```
packages/admin/src/__tests__/test-utils.tsx:16            → @green-goods/shared/testing
packages/admin/src/__tests__/test-utils.tsx:23            → @green-goods/shared/testing
packages/admin/src/__tests__/setup.ts:8                   → @green-goods/shared/testing
packages/admin/src/__tests__/setup.ts:33                  → @green-goods/shared/mocks
packages/admin/src/__tests__/components/HubWorkCard.test.tsx:13 → @green-goods/shared/i18n/en.json
packages/client/src/__tests__/test-utils.tsx:16           → @green-goods/shared/testing
packages/client/src/__tests__/test-utils.tsx:23           → @green-goods/shared/testing
packages/client/src/__tests__/setupTests.ts:12            → @green-goods/shared/__tests__/setupTests.base
```

These use purpose-built test subpaths (`/testing`, `/mocks`, `/__tests__/setupTests.base`); JSON i18n imports must be deep by necessity.

### Docstring `@example` blocks (not real imports, doc-only)

```
packages/shared/src/__tests__/test-utils/shared-barrel-mock.ts:11 → @green-goods/shared/testing (correct, test doc)
```

The three `@green-goods/shared/hooks` doc examples flagged in the prior report (`useAuth.ts`, `usePrimaryAddress.ts`, `useSuspenseBaseLists.ts`) should be re-checked — they would still contradict the barrel rule if present. Cosmetic doc-only; out of Agent 4 scope.

**Production deep-path violations: 0.**

---

## 7. Solidity cross-imports worth noting

Contracts use Foundry, not madge. Scanning `grep -rn "^import " packages/contracts/src/ --include='*.sol'` for `"../<layer>/..."` patterns, excluding the safe descending targets (`errors/`, `interfaces/`, `vendor/`, `lib/`).

### Descending cross-layer imports (normal Solidity layering)

```
resolvers/Work.sol:11           → registries/Action.sol      (ActionRegistry)
resolvers/WorkApproval.sol:13   → registries/Action.sol      (ActionRegistry)
modules/Octant.sol:12           → strategies/AaveV3ERC4626.sol (AaveV3ERC4626)
tokens/Garden.sol:14            → modules/Octant.sol         (OctantModule)
tokens/Garden.sol:17            → registries/Deployment.sol  (Deployment)
tokens/Garden.sol:18            → registries/Action.sol      (ActionRegistry)
```

All 6 are descending layer imports (higher-abstraction contract pulling a concrete implementation from below). **No upward imports. No cycles.**

### Mocks (test-only, do not ship)

- `mocks/GardensV2.sol:16` → `mocks/CVStrategy.sol` (`MockCVStrategy`) — mock-to-mock, intentional.
- Other `mocks/*.sol` pull only from `../interfaces` or `../errors` or npm deps — safe.

**No Solidity cycle or layering concern.**

---

## 8. Recommended fix order (if user greenlights a follow-up PR)

1. **H2 + H3** — extract `config/query-keys/keys.ts`. Unblocks 3 madge hits, no behavior change. (~30 LOC + 3 import swaps + 1 new file.)
2. **M1** — move `jobToWork` into `utils/work/` and narrow `query-persistence.ts` debug import. Unblocks madge #4 and #5. (~40 LOC + 1 test dyn-import path update.)
3. **H4** — relocate `checkAttestationsBundled` into `hypercerts-fetch.ts`; delete lazy-import workaround + stale comment. (~40 LOC.)
4. **H1** (optional polish) — re-home `QueryKey` union directly over leaf key modules. Clears the last madge flag.
5. **M2** — delete `utils/query-invalidation.ts` shim (coordinate with Agent 3 dead-code / Agent 7 legacy-cleanup).

After steps (1)-(3): `npx madge --circular` should print `✔ No circular dependency found!`. After (4)-(5): pure DAG + one dead file removed.

---

## 9. Delta vs prior report

- **Cycles resolved**: **0** — all 6 madge hits still present.
- **New cycles introduced**: **0**.
- **New layer violations**: **0**.
- **Deep-path imports**: same 8 (all test-only).
- **New finding vs prior report**: Solidity cross-layer audit completed (§7). All imports descend correctly, no cycles.

---

## 10. Scope note

Dry-run: no source files edited. Re-ran prior analysis verbatim; walked each cycle file end-to-end (madge output + grep + file reads) to confirm state. All three HIGH cycles remain mechanical extracts; M1 still needs one judgment call (where `jobToWork` lives — proposal: `utils/work/job-to-work.ts`).
