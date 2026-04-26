# Agent 5 — Type Strengthening (Dry Run, Re-run)

**Scope:** production code in **admin · shared · client · contracts/script** only.
Excludes `**/__tests__/**`, `**/__mocks__/**`, `**/*.stories.tsx` (flagged separately as low-risk), `**/node_modules/**`, `**/generated/**`, `**/dist/**`, `**/lib/**`, `**/cache/**`, `**/artifacts/**`. agent/indexer/ops are **out of scope** for this re-run and have been dropped.

## 1. Executive summary

Overall verdict: **type hygiene remains strong in production**. Raw `: any` is absent (the only match is a prose `defaultMessage` in `DepositModal.tsx:292`), `Record<string, any>` is zero, and there are no unexplained `@ts-ignore`. The debt is concentrated in:

1. **`as unknown as X` double-casts** (50 total in scope) — mostly working around real library gaps (XState v5 `provide()`, AppKit/viem version skew, experimental browser APIs, wagmi action-signature mismatches, Storacha SDK shape).
2. **5 previously-unflagged `as any`** in `shared` (wagmi `useReadContracts` contract-array typing, toast icon type, job-executor draft shape).
3. **~24 non-null `!` assertions** — mostly the standard TanStack Query `enabled:` gate convention or load-bearing invariants. Defensible, could collapse to a helper.
4. **1 `@ts-expect-error`** — well-annotated iOS Safari `navigator.standalone`.

### Category counts (production, 4 in-scope packages)

| Category | Count | Status |
| --- | ---: | --- |
| `: any` (real type annotations) | **0** | clean |
| `as any` | **5** | new finding — all in `shared`; wagmi generics + toast icon + executor draft (see §2) |
| `Record<string, any>` | **0** | clean |
| `Record<string, unknown>` | ~93 | mostly legitimate boundary |
| `as unknown as X` (double-cast) | **50** | mixed; ~21 reducible without library work (H1–H6) |
| `@ts-ignore` | **0** | clean |
| `@ts-expect-error` | **1** | `Media.tsx:46` — well-annotated, iOS Safari standalone |
| `: unknown` (type position) | ~176 | legitimate, JSON/error boundaries |
| Non-null `!` assertions | **~24** | ~15 query-enabled gates, ~7 invariant-safe, 2 non-obvious |
| `: Function`, `as Function`, `any[]`, `Array<any>` | **0** | clean |

### Top offending files (by `as unknown as` density)

1. `packages/shared/src/workflows/mintHypercert.ts` — **7** (XState `assign` event-output casts)
2. `packages/shared/src/modules/translation/diagnostics.ts` — **4** (experimental `self.ai`/`self.translation` APIs)
3. `packages/shared/src/modules/app/posthog.ts` — **4** (posthog internals, `navigator.connection`)
4. `packages/shared/src/utils/eas/encoders.ts` — **2** (navigator.connection + WorkDraft clientWorkId)
5. `packages/shared/src/modules/transactions/embedded-sender.ts` — **2** (wagmi signature mismatch)
6. `packages/shared/src/modules/translation/browser-translator.ts` — **2** (experimental `self.ai`)
7. `packages/shared/src/modules/app/error-categories.ts` — **2** (navigator/posthog internals)
8. `packages/shared/src/hooks/translation/useActionTranslation.ts` — **2** (WorkInput[]↔Record coercion)
9. `packages/shared/src/hooks/hypercerts/useMintHypercert.ts` — **2** (XState `provide()` typing)
10. `packages/shared/src/modules/job-queue/index.ts` — **2** (payload sniffing)

---

## 2. HIGH-CONFIDENCE — safe to strengthen

Redundant or straightforward to tighten without touching external type boundaries.

### H1. `work as unknown as Work` — redundant double-cast
- **`packages/client/src/components/Features/Garden/Work.tsx:55`** — `work` already typed `Work` in scope. Drop cast.
- **`packages/client/src/views/Home/WorkDashboard/Uploading.tsx:281`** — same pattern, `work` from `uploadingWork: Work[]`. Drop cast.

**Proposed:** `work={work}`. Zero risk.

### H2. Tuple-destructure on viem `readContract` result
- **`packages/shared/src/utils/blockchain/garden-hats.ts:20`**
  `const [, tokenContract] = tokenResult as unknown as [bigint, Address, bigint];`
  If `GARDEN_ACCOUNT_TOKEN_ABI.token()` is typed `as const`, viem infers the tuple directly. Verify; drop cast or reduce to `as readonly [...]`.

### H3. XState `mintHypercert` machine — type actors once at `setup()`
- **`packages/shared/src/workflows/mintHypercert.ts:150,152,155,158,160,179,181`** — 7 casts of `event.output`.
  Root cause: machine's `actors` aren't declared at `setup()`, so XState loses `actor.done` narrowing. Fix: `setup({ actors: { uploadAllowlist: fromPromise<{ cid: string; merkleRoot: Hex }, Input>(...) } })`. All 7 casts collapse. Contained to one file, mechanical, internal.

### H4. `uploadJSONToIPFS` signature — accept `object` or make generic
- **`packages/shared/src/hooks/hypercerts/services/upload-metadata.ts:31`**
- **`packages/shared/src/hooks/hypercerts/services/upload-allowlist.ts:36`**
  Both cast to `Record<string, unknown>`. Either make `uploadJSONToIPFS<T extends object>(json: T, ctx)` or accept `object`. Eliminates 2 casts.
- **`packages/shared/src/hooks/work/useWorkForm.ts:129`** — `getValues() as unknown as Record<string, unknown>`; RHF already returns an object. Replace with single `as Record<string, unknown>`.

### H5. Viem `decodeEventLog` args narrowing
- **`packages/shared/src/hooks/ens/useENSClaim.ts:111`** — `(decoded.args as unknown as { messageId: Hex }).messageId`.
  If `GreenGoodsENSABI` is exported `as const`, viem narrows `decoded.args` inside the `eventName === "NameRegistrationSent"` branch. Verify and drop cast.

### H6. Redundant Work context default cast
- **`packages/shared/src/providers/Work.tsx:124`** — `} as unknown as WorkDataProps);`
  The object literal already satisfies `WorkDataProps`; the inner `form` already uses typed casts (`as UseFormSetValue<WorkFormData>`, `as Control<WorkFormData>`). Drop the outer `as unknown as` — a single `as WorkDataProps` at most.

### H7. `useHypercertWizardStore` logger payload
- **`packages/shared/src/stores/useHypercertWizardStore.ts:376`** — `(draft as unknown as Record<string, unknown>)?.id`.
  `draft` is the unvalidated input (`validateDraft` returned null). Typing `loadDraft(draft: unknown)` makes the `?.id` access require no cast (use `typeof draft === "object" && draft && "id" in draft ? draft.id : "unknown"`). Trivial rewrite; removes the cast.

### H8. `client` Carousel keyboard-to-mouse event cast
- **`packages/client/src/components/Display/Carousel/Carousel.tsx:191`** — `handleClick(e as unknown as React.MouseEvent<HTMLDivElement>)`.
  `handleClick` is invoked from both `onClick` and `onKeyDown`. Clean fix: widen the handler's param type to `React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>` and branch on `'key' in e`. One handler, zero casts.

**Subtotal H1–H8:** ~16 casts removable, ~4 more reduced to single casts.

---

## 3. MEDIUM — needs research into library types

External-constraint escapes working around real upstream gaps. Flag for review.

### M1. AppKit + viem version skew
- **`packages/shared/src/config/appkit.ts:109`** — `chains as unknown as Parameters<typeof createAppKit>[0]["networks"]`
  Explicitly commented as "viem version mismatch between main dependency and @reown/appkit-common's bundled viem". Fix = dep alignment or a workspace `.d.ts` declaring `AppKitChain = Chain`. Mark **external-constraint**.

### M2. XState `provide()` exact-type mismatch
- **`packages/shared/src/hooks/hypercerts/useMintHypercert.ts:156`** — `as unknown as typeof mintHypercertMachine.implementations`
  XState v5 `fromPromise` typing gap (noted in adjacent comment lines 151–155). Fix = upgrade XState when available, or author a small `provideActors<TMachine>` helper in `packages/shared/src/types/xstate-provide.ts`.

### M3. Wagmi `writeContract` vs `TransactionSenderOptions["writeContractAsync"]`
- **`packages/shared/src/hooks/blockchain/useTransactionSender.ts:62`**
- **`packages/shared/src/modules/transactions/embedded-sender.ts:45`**
- **`packages/shared/src/modules/transactions/embedded-sender.ts:47`**
- **`packages/shared/src/modules/transactions/wallet-sender.ts:63`**
  The local `TransactionSender*` types are near-duplicates of wagmi's. Re-export `Parameters<typeof writeContract>[1]` and `Parameters<typeof waitForTransactionReceipt>[1]` directly from `packages/shared/src/modules/transactions/types.ts`. Removes 4 casts.

### M4. Viem `readContract` struct return
- **`packages/shared/src/hooks/ens/useENSRegistrationStatus.ts:153`** — struct return from `readContract`.
  Same fix as H5 (ABI as `const` → viem narrows the struct). Quick local verification may promote this to HIGH.

### M5. `navigator.connection` / `self.ai` / `self.translation` / `window.__DEV__` experimental APIs
- `packages/shared/src/utils/eas/encoders.ts:13`
- `packages/shared/src/components/Toast/toast.service.tsx:96` (`window.__DEV__`)
- `packages/shared/src/modules/job-queue/job-analytics.ts:75`
- `packages/shared/src/modules/app/posthog.ts:246,380,383`
- `packages/shared/src/modules/app/error-categories.ts:42`
- `packages/shared/src/modules/translation/browser-translator.ts:47,51`
- `packages/shared/src/modules/translation/diagnostics.ts:34,45,65,118`
- `packages/client/src/views/Garden/Media.tsx:46` (`@ts-expect-error` for `navigator.standalone`)

All legitimate **external-constraint** — these aren't in lib.dom.d.ts. Fix = single workspace ambient file (`packages/shared/src/types/experimental-browser-apis.d.ts`) declaring `Navigator.connection?`, `Navigator.standalone?`, `Window.__DEV__?`, `ExperimentalAI`, `ExperimentalTranslation` once. **Converts 12 casts + 1 `@ts-expect-error` to direct property access.** Highest-ROI medium-complexity win.

### M6. Posthog internals
- **`packages/shared/src/modules/app/posthog.ts:130`**
- **`packages/shared/src/modules/app/error-categories.ts:147`**
  `(posthog as unknown as { config?: { api_host?: string } }).config` — reading a private field. Low stakes; consider augmenting `posthog-js` via module-declaration merging.

### M7. Wagmi `useReadContracts` contracts-array variance
- **`packages/shared/src/hooks/vault/useVaultPreview.ts:40`** — `contracts: contracts as any`
- **`packages/shared/src/hooks/vault/useBatchConvertToAssets.ts:51`** — `contracts: contracts as any`
  wagmi's `useReadContracts` generic requires a readonly homogeneous contract-config tuple. When `contracts` mixes function names (like `useVaultPreview`) or is built dynamically (like `useBatchConvertToAssets`), the variance breaks. Safer fix than `as any`:
  - cast to `as Parameters<typeof useReadContracts>[0]["contracts"]` (preserves shape), or
  - supply explicit generic args `useReadContracts<typeof contracts>({ contracts, ... })`.
  Eliminates 2 `as any`.

### M8. Job-executor draft-shape `as any`
- **`packages/shared/src/modules/job-queue/job-executors.ts:44,67`** — `} as any` on a draft literal fed to `simulateWorkSubmission` and `encodeWorkData`.
  Root cause: the literal's shape differs slightly from `WorkDraft` (optional field spreads). Fix = type the intermediate literal as `Partial<WorkDraft>` or make the callee parameter `Pick<WorkDraft, "actionUID" | "title" | …>`. Eliminates 2 `as any`.

### M9. Toast icon type
- **`packages/shared/src/components/Toast/toast.service.tsx:602`** — `toastOptions.icon = resolved.icon as any`.
  `resolved.icon` is our domain icon; `react-hot-toast`'s `ToastOptions["icon"]` is `Renderable`. Fix = narrow `resolved.icon` to a type that matches `Renderable` (React node / string / undefined), or add a tiny `toIconRenderable()` converter. Eliminates 1 `as any`.

### M10. Work mutation-form boundary
- **`packages/admin/src/views/Garden/SubmitWork.tsx:261,279,336`**
  `formData: Record<string, unknown>` is the RHF-produced dynamic shape tied to an action's `WorkInput[]`. A proper fix = generate a zod schema per action and type `formData` as its `z.infer`. Scope-creep for this sweep; flag.

---

## 4. LOW / Intentional / external-constraint

### L1. Legitimate boundary `unknown`
- `packages/shared/src/types/job-queue.ts:25,48,60,61` — `Job.meta`, `WorkJobPayload.metadata/details`. Offline-persisted per-kind extras; correct shape.
- `packages/shared/src/types/domain.ts:380,425,530` — `Work.details`, `WorkApproval.details`, `Assessment.metrics`. Dynamic action/metric payloads; domain deliberately doesn't promise a schema.
- `packages/shared/src/modules/data/graphql-client.ts:73,84,113,121` — GQL variables generic, matches graphql-request.
- `packages/shared/src/modules/app/analytics-events.ts` — snake_case transform helper.
- `packages/shared/src/utils/errors/mutation-error-handler.ts` — `metadata?: Record<string, unknown>` for error tracking.

### L2. Contracts/script JSON-read boundaries (11 hits)
All `JSON.parse(readFileSync(...)) as Record<string, unknown>` or declared struct-loose types:
- `packages/contracts/script/deploy/octant-factory.ts:139`
- `packages/contracts/script/deploy-repair-event-arbitrum.ts:58,82`
- `packages/contracts/script/utils/release-gate.ts:57`
- `packages/contracts/script/utils/ipfs-uploader.ts:107,133`
- `packages/contracts/script/utils/update-instructions.ts:71`
- `packages/contracts/script/utils/update-action-metadata.ts:95`
- `packages/contracts/script/utils/docs-updater.ts:21`
- `packages/contracts/script/upgrade.ts:111,146`

Standard deployment-artifact read. Could narrow to a typed `Deployment` interface alongside `deploy.ts` for self-documenting addresses — non-blocking.

### L3. Contracts/script Storacha SDK shape
- **`packages/contracts/script/deploy-repair-event-arbitrum.ts:307`**
- **`packages/contracts/script/utils/ipfs-uploader.ts:269`**
- **`packages/contracts/script/utils/update-action-metadata.ts:205`**
  All `return client as unknown as StorachaClient;`. The `@web3-storage/w3up-client` typing shape doesn't exactly match the project's local `StorachaClient` alias. **External-constraint** — flag upstream to the Storacha team or refactor locally to use the vendored type directly. No action required.

### L4. Well-annotated escapes
- `packages/shared/src/utils/app/recursive-clone-children.tsx:30` — `React.ReactElement<any>`; adjacent eslint-disable + justification.
- `packages/shared/src/components/Form/Select/FormSelect.tsx:151` — `FormSelectProps<any>` in a generic forwardRef; standard React typing workaround.
- `packages/shared/src/modules/auth/session.ts:253` — `raw: undefined as unknown as PublicKeyCredential`; documented ("raw is undefined, which is fine for smart account creation") — single cast required because `P256Credential.raw` is non-nullable in the viem type.

### L5. Stories files (not production)
- `packages/shared/src/components/Vault/AssetSelector.stories.tsx:46` — `as unknown as GardenVault[]` for mock data. Storybook-only; not counted.

### L6. Admin `Record<string, unknown>` (6 hits — all dynamic form plumbing)
- `packages/admin/src/views/Garden/CreateAssessment.tsx:172,178`
- `packages/admin/src/views/Garden/WorkDetail/ReviewForm.tsx:113`
- `packages/admin/src/views/Garden/SubmitWork.tsx:261,279,336`

These are the RHF-dynamic boundaries. Tied to M10; intentional today.

---

## 5. `@ts-ignore` / `@ts-expect-error` inventory (production, in-scope)

| File:Line | Directive | Context | Verdict |
| --- | --- | --- | --- |
| `packages/client/src/views/Garden/Media.tsx:46` | `@ts-expect-error iOS Safari standalone mode` | Reads `window.navigator.standalone` not in lib.dom.d.ts | **Keep (but move under M5)** — correct today; if M5's ambient `.d.ts` lands, delete the directive. |

All other `@ts-*` directives in scope are in test files (`@ts-expect-error` for negative-path assertions in `pwa.test.ts:214`, `compression.test.ts:100,102`, `browser.test.ts:324`, `aggregation.test.ts:134`) — not flagged.

---

## 6. Non-null `!` inventory (production, in-scope)

~24 non-null-assertion sites. Bucketed:

### 6a. Invariant-safe (9) — guarded by preceding check or invariant
- `packages/shared/src/utils/scheduler.ts:43,44` — `let resolve!: (…) => void; let reject!: (…) => void;` — **definite-assignment pattern**; both are set synchronously inside the Promise constructor callback. TypeScript can't prove this, `!` is the idiomatic escape. **Keep.**
- `packages/shared/src/utils/scheduler.ts:96` — `window.scheduler!` inside `if (isSchedulerSupported())`.
- `packages/shared/src/modules/app/service-worker.ts:177` — `db.name!` after `.filter(db => db.name?.includes(...))`.
- `packages/shared/src/hooks/utils/useMutationLock.ts:46,47` — `listeners!` set in same function above.
- `packages/shared/src/modules/transactions/passkey-sender.ts:35` — `this.client.account!` — class invariant.
- `packages/shared/src/modules/transactions/passkey-sender.ts:64` — `lastResult!` after non-empty batch guard (line 53 throws on empty).
- `packages/shared/src/modules/transactions/embedded-sender.ts:100` — same pattern.
- `packages/shared/src/modules/work/passkey-submission.ts:139,215` — `smartClient.account!` — passkey-mode invariant.
- `packages/shared/src/hooks/ens/useENSClaim.ts:72` — `smartAccountClient.account!`.
- `packages/shared/src/modules/job-queue/event-bus.ts:56` — `this.listenerRegistry.get(id)!` directly after a `.set(id, …)` branch above.
- `packages/shared/src/components/Progress/ENSProgressTimeline.tsx:76` — `data.submittedAt!` inside an effect guarded by `data`.

**Verdict:** defensible. Could collapse to an `assertDefined(x, "reason")` helper for audit-grade clarity, but not required.

### 6b. TanStack Query `enabled:`-gate convention (10)
All inside `queryFn` where `enabled: !!x` gates execution:
- `packages/shared/src/hooks/gardener/useRole.ts:81` — `normalizedAddress!`
- `packages/shared/src/hooks/blockchain/useDeploymentRegistry.ts:136` — `normalizedAddress!`
- `packages/shared/src/hooks/hypercerts/useTradeHistory.ts:30` — `hypercertId!`
- `packages/shared/src/hooks/hypercerts/useHypercertListings.ts:26,29` — `gardenAddress!`
- `packages/shared/src/hooks/work/useWorkApprovals.ts:94` — `attesterAddress!`
- `packages/shared/src/hooks/yield/usePendingYield.ts:43` — `gardenAddress!`
- `packages/shared/src/hooks/analytics/useAnalyticsIdentity.ts:84` — `current.primaryAddress!`
- `packages/shared/src/utils/eas/encoders.ts:348,349` — `options.domain!`, `options.actionSlug!` inside `isV2` branch gated by `options.domain !== undefined && options.actionSlug !== undefined`.

**Verdict:** established convention. Could eliminate workspace-wide via either a `useGuardedQuery` utility or TanStack Query v5 `skipToken`.

### 6c. Non-obvious (2)
- `packages/admin/src/views/Actions/EditAction.tsx:181` — `id!.split("-")[1]` where `id` is `useParams()`. Route guarantees `id`, but an `if (!id) return ...` or `invariant(id)` at the top of the component would remove the `!`.
- `packages/shared/src/utils/eas/encoders.ts:310` — `data.audioNotes!.length` inside `if (data.audioNotes && data.audioNotes.length > 0)`. TS should already narrow `data.audioNotes` to non-null after the preceding guard; verify — may drop the `!`.

### 6d. IPFS upload null-check shortcuts
- `packages/shared/src/modules/data/ipfs/upload.ts:181,245` — `(await getStorachaClient()!).uploadFile(...)`. `getStorachaClient()` returns `StorachaClient | null`. Safer = early throw with a clear error (`if (!client) throw new Error("Storacha unavailable")`). Converts silent-crash-on-null into a typed error surface. Small behavior improvement.

---

## 7. Per-package density table (in-scope only)

| Package | `: any` | `as any` | `as unknown as` | `Record<string,unknown>` | `@ts-ignore/expect` | Non-null `!` | Density verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **shared** | 0 | 5 | 44 | ~74 | 0 | ~17 | **Moderate**. Most `as unknown as` concentrated in `workflows/mintHypercert.ts` (7), translation (6), posthog/errors (6), transactions (4). Clean up M5 (experimental browser APIs) + H3 (mintHypercert machine typing) cuts ~13 at once. New: 5 `as any` (M7 + M8 + M9) all tractable. |
| **client** | 0 | 0 | 3 | 2 | 1 | 0 | **Clean**. Two redundant `work as unknown as Work` (H1), one Carousel event cast (H8), one justified `@ts-expect-error` (folds into M5). |
| **admin** | 0 | 0 | 0 | 6 | 0 | 1 | **Clean**. All `Record<string, unknown>` are dynamic RHF form boundaries (M10). One `id!` in `EditAction.tsx` (6c). |
| **contracts/script** | 0 | 0 | 3 | 11 | 0 | 0 | **Clean**. 3 `as unknown as StorachaClient` (L3, external). 11 `Record<string, unknown>` are deployment-artifact JSON reads (L2, standard). |

---

## 8. Recommended sweep order

If the user wants to action this:

1. **M5 (one-file win, ~12 casts + 1 `@ts-expect-error` gone)**: ambient `packages/shared/src/types/experimental-browser-apis.d.ts`. Highest ROI.
2. **H1 (zero-risk, 2 casts gone)**: drop `as unknown as Work` in client garden/uploading views.
3. **H3 (one-file win, 7 casts gone)**: type `mintHypercert` machine actors at `setup()`.
4. **H4 (3 casts gone)**: adjust `uploadJSONToIPFS` signature + `useWorkForm` return.
5. **H6 + H7 + H8 (3 more casts gone)**: Work provider default cast + wizard-store draft logger + Carousel event handler.
6. **M7 (2 `as any` gone)**: type wagmi `useReadContracts` contracts via `Parameters<typeof …>`.
7. **M8 + M9 (3 `as any` gone)**: job-executor literal typing + toast icon converter.
8. **H5 + M4 (verify + strengthen)**: confirm ABIs are `as const` and drop viem return casts.
9. **M3 (unify TransactionSender types)**: medium refactor, 4 casts + ergonomics.
10. **6d (IPFS upload)**: early-throw on null Storacha client.

After steps 1–7: `as unknown as` drops from 50 → ~22 (rest genuinely external-constraint), `as any` drops from 5 → 0. Non-null `!` stays (TanStack-Query convention established).

**No other type debt was found in scope**: no `Record<string, any>`, no `any[]`, no `: Function`, no unexplained `@ts-ignore`, no raw `: any` annotations outside i18n strings.
