# Agent 5: Type Strengthening Report

## Scope
Production source files only (tests and mocks excluded per rules).
Excludes: `packages/contracts/lib/`, `packages/indexer/generated/`

---

## HIGH-CONFIDENCE (safe to fix)

### H1. `packages/shared/src/utils/blockchain/contracts.ts` — `Record<string, any>` x6
Deployment JSON shapes are well-known (flat key-value with string addresses + nested objects).
**Fix**: Create `DeploymentConfig` interface matching the JSON shape, replace `Record<string, any>`.

### H2. `packages/shared/src/hooks/assessment/useCreateAssessmentForm.ts` — `z.any()` x2
`attachments: z.array(z.any())` — attachments are `File` objects.
**Fix**: Replace `z.any()` with `z.instanceof(File)`.

### H3. `packages/shared/src/utils/app/recursive-clone-children.tsx` — `React.ReactElement<any>`
The `any` generic for `ReactElement.props` can be replaced with `Record<string, unknown>`.
**Fix**: `React.ReactElement<Record<string, unknown>>`.

### H4. `packages/contracts/script/utils/docs-updater.ts` — `[key: string]: any`
`DeploymentArtifact` has an index signature `[key: string]: any`.
**Fix**: Replace with `[key: string]: string | Record<string, unknown> | undefined`.

### H5. `packages/shared/src/config/appkit.ts` — `null as any` x2
Server-side fallback returns `{ appKit: null as any, wagmiConfig: null as any }`.
**Fix**: Type the return explicitly as `{ appKit: null; wagmiConfig: null }` or use proper return type.

### H6. `packages/shared/src/__mocks__/browser/crypto.ts` — `any` x2
`digest` and `getRandomValues` use `any` for parameters.
**Fix**: Use `ArrayBuffer | ArrayBufferView` for digest data, `Uint8Array` for getRandomValues.

---

## MEDIUM (likely fixable, needs careful verification)

### M1. `packages/shared/src/config/appkit.ts` — `chains as any` and `defaultNetwork as any`
Library type mismatch between viem versions. Comment explains this.
**Fix**: Could use explicit type annotation, but risk of breaking if library types change.

### M2. `packages/shared/src/hooks/vault/useBatchConvertToAssets.ts` — `contracts as any`
### M3. `packages/shared/src/hooks/vault/useVaultPreview.ts` — `contracts as any`
wagmi `useReadContracts` expects specific contract tuple types. The `as any` bypasses strict
array-to-tuple inference. Removing requires `as const satisfies` or explicit typing.

### M4. `packages/shared/src/hooks/blockchain/useTransactionSender.ts` — `writeContractAsync as any`
wagmi's `useWriteContract` returns a function with a complex overloaded type that doesn't match
the simpler `TransactionSenderOptions.writeContractAsync` signature.
**Fix**: The factory already defines `writeContractAsync` type. Cast to that type instead of `any`.

### M5. `packages/shared/src/modules/job-queue/index.ts` — `} as any` x2 (lines 115, 138)
Partial `WorkDraft`/`WorkApprovalDraft` objects cast to `any` to satisfy the `simulateWorkSubmission`
and `encodeWorkData` interfaces. The job payload has optional fields that `WorkDraft` requires.

### M6. `packages/shared/src/modules/translation/diagnostics.ts` — `(self as any).ai` x3
### M7. `packages/shared/src/modules/translation/browser-translator.ts` — `(self as any).ai` x2
Browser Translation API (Chrome-specific) has no standard types. These access `self.ai.translator`.
**Fix**: Declare module-local interface for the experimental API and cast to it.

### M8. `packages/shared/src/modules/app/service-worker.ts` — `(window.ServiceWorkerRegistration.prototype as any)`
Checking for Background Sync support. No standard type for `sync` on prototype.

---

## LOW (risky or legitimately weak)

### L1. `import.meta as any` pattern (6 occurrences across service-worker.ts, event-bus.ts, index.ts, useENSRegistrationStatus.ts)
Used for optional env var access with safe `?.` chaining. `import.meta.env` IS typed via vite-env.d.ts
but `DEV`/`PROD` may not be available in all TypeScript contexts.
**Risk**: Breaking these casts could cause compile errors in test/node environments.

### L2. `packages/shared/src/components/Form/Select/FormSelect.tsx` — `FormSelectProps<any>`
Generic component — the `any` allows any field values type in the form. Strengthening would
require callers to explicitly parameterize, which is invasive.

### L3. `packages/shared/src/modules/translation/diagnostics.ts` — `(window as any).checkTranslation`
Debug-only global registration. No standard type for custom window properties.

### L4. Test file `any` usage (~100+ instances across all test files)
Test mocks use `any` extensively for mock shapes. Per rules, this is acceptable.
