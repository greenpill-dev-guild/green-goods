# Agent 5 — Type Strengthening

## Summary
- Worktree branch: `worktree-agent-af0188664937e3e92`
- Production-code weak-type instances scanned: ~60 (excluding tests, mocks, stories, generated code)
- Strengthened (HIGH): **27 redundant assertions removed across 17 files**, plus 2 unused `Address` imports cleaned up, plus 1 `as any` removal in Toast viewport
- Skipped (boundary-correct or library-required): see "Skipped" section
- Build: PASS — `bunx tsc --noEmit -p .` in shared, admin, and client all back to baseline (2 pre-existing unrelated errors in `src/hooks/yield/useGardenYieldSummary.ts`)
- Tests: PASS — `bun run test` in shared shows **same 12 pre-existing failures** as baseline (verified by `git stash` + re-run); admin baseline of 20 failed test files is identical to the post-change run (failures are pre-existing source-map / setup issues, unrelated to types)

## Critical finding (read this first)

**`Address` in this codebase is `string`, not `0x${string}`.**

`@safe-global/types-kit` (transitive dep via the Safe SDK chain) augments `abitype.Register`:

```ts
declare module 'abitype' {
    interface Register {
        AddressType: string;
    }
}
```

That augmentation cascades — viem re-exports `Address` from `abitype`, so `Address = ResolvedRegister['addressType'] = string` everywhere in the project. The local `packages/shared/src/types/domain.ts` re-exports `ViemAddress as Address`, so the project-level `Address` type is also `string`.

What this means in practice:
- `addr as Address` where the source is already `Address`-typed → genuinely a no-op (string→string). Safe to remove.
- `addr as 0x${string}` where the source is `Address` (= string) → **load-bearing**. The literal-template type `0x${string}` is narrower than `string`. Removing this assertion will fail tsc the moment the target wants `0x${string}` (which is what some local interfaces and viem helpers like `estimateCCIPFee` declare).
- `(addr as 0x${string})` cast itself is idiomatic noise produced by codebase authors who think viem's `Address` is `0x${string}` — but it is not, in this project.

Because of this, the natural "type strengthening" framing does not apply: there is no widening to fix here that an `as Address` assertion is hiding. What I cleaned up is **redundant noise**, not "weakness."

The actual type-strengthening opportunity (removing the `@safe-global` augmentation, or wrapping their types so the rest of the code can use a real `0x${string}`-typed `Address`) is **architectural**, multi-package, and out of scope for a `/clean` agent. See "MEDIUM (NOT implemented)" below.

## HIGH-confidence strengthenings (implemented)

### Cluster 1: Redundant `contracts.X as Address` (NetworkContracts already typed)

`getNetworkContracts(chainId)` returns `NetworkContracts` from `packages/shared/src/types/contracts.ts`, where every field is declared as `Address`. Casting a value already typed `Address` to `Address` is pure noise.

Files edited (assertion removed, no semantic change):
1. `packages/shared/src/hooks/ens/useSlugAvailability.ts:34` — `contracts.greenGoodsENS as Address` → `contracts.greenGoodsENS`. Also dropped now-unused `Address` import from viem.
2. `packages/shared/src/hooks/ens/useENSClaim.ts:56` — same pattern. Dropped unused `Address` import.
3. `packages/shared/src/hooks/ens/useProtocolMemberStatus.ts:25` — same pattern. (Kept `Address` import since the function signature still uses it.)
4. `packages/shared/src/hooks/ens/useENSRegistrationStatus.ts:98` — same pattern. (`Address` still used elsewhere in the file.)
5. `packages/shared/src/hooks/garden/useSetGardenDomains.ts:43` — `contracts.actionRegistry as Address` → `contracts.actionRegistry`.
6. `packages/shared/src/hooks/garden/useOpenMinting.ts:19,45` — both occurrences. Dropped now-unused `Address` import.
7. `packages/shared/src/hooks/hypercerts/useCreateListing.ts:65` — `contracts.hypercertsModule as Address`.
8. `packages/shared/src/hooks/hypercerts/useBatchListForYield.ts:64` — same.
9. `packages/shared/src/hooks/hypercerts/useCancelListing.ts:41` — same.
10. `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:342` — `contracts.gardensModule as Address`.
11. `packages/shared/src/modules/marketplace/approvals.ts:81-83, 143-145` — six instances (`hypercertExchange`, `transferManager`, `hypercertMinter`, twice each).
12. `packages/shared/src/modules/data/marketplace.ts` — eight instances of `contracts.marketplaceAdapter as Address` and one of `contracts.hypercertsModule as Address` (replaced via `replace_all`).

### Cluster 2: Redundant `contracts.X as ` 0x${string}` ` where the local consumer type is `Address`

When the downstream parameter is also typed `Address` (which is `string` in this project), the literal-template assertion is still pure noise.

Files edited:
13. `packages/shared/src/hooks/blockchain/useDeploymentRegistry.ts:93,100,169` — three occurrences. The signature `address: contracts.deploymentRegistry` flows into wagmi `readContract` whose `address` param accepts `Address`/`string` here.
14. `packages/admin/src/views/Deployment/index.tsx:727` — `contracts.deploymentRegistry as 0x${string}`.
15. `packages/shared/src/hooks/garden/useGardenDomains.ts:20,23` — `contracts.actionRegistry as 0x${string}` and `gardenAddress as 0x${string}` where `gardenAddress: Address | undefined` is the param signature.
16. `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:223,237,257,417` — four `contracts.gardenToken as 0x${string}` (kept the two that feed `estimateCCIPFee`, which has a literal-template parameter — see "Reverted").

### Cluster 3: One real `as any` removal in shared

17. `packages/shared/src/components/Toast/ToastViewport.tsx:60-62` — three `as any` cast off `iconTheme` access. The cast was used to silence narrowing on optional `IconTheme | undefined` fields; replaced with optional chaining (`overrides.iconTheme?.primary` etc), preserving identical runtime behavior.

## Reverted during the pass (kept the original assertion)

These were touched, found to be load-bearing, and restored to the original `as 0x${string}` form. Each one targets a literal-template-typed parameter that does not accept `string` (= `Address` in this project):

- `packages/shared/src/hooks/action/useActionOperations.ts:155` — `contractAddress: contracts.actionRegistry as 0x${string}`. The local `ActionOpDeps.contractAddress: 0x${string}` field requires the literal type.
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:216,411` — `contracts.greenGoodsENS as 0x${string}`. `estimateCCIPFee(slug, ensAddress: 0x${string}, account: 0x${string}, chainId)` declares a literal-template signature.
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:190,390` — `currentAddress as 0x${string}` (assigned to `accountAddress`). `currentAddress` resolves to `Address` (= `string`) post `isAddress()` narrowing, but the consuming function signatures need `0x${string}`.

Tsc caught all three categories on first build; no runtime breakage was possible.

## MEDIUM (NOT implemented — needs a wider judgment call)

### M1. The `@safe-global/types-kit` augmentation downgrades `Address` to `string` everywhere

This is the root cause of why so many `as 0x${string}` assertions sprinkle the codebase: code authors know "addresses should be `0x${string}`" but their `Address` type doesn't agree, so they reach for the literal cast to silence tsc when interacting with viem helpers that require the literal template.

Options for a future pass:
1. Pin / patch `@safe-global/types-kit` to remove the augmentation (likely upstream issue — may break safe-sdk usage elsewhere).
2. Define a project `StrictAddress = 0x${string}` and use it explicitly at the call sites that need it. Loses ergonomics but documents intent.
3. Wrap viem with a thin local `gg-viem` re-export that re-asserts `Address = 0x${string}`.

Out of scope for `/clean`. Recommended for an architecture pass / ADR.

### M2. `packages/shared/src/utils/blockchain/contracts.ts:42-57` — `Record<string, Record<string, any>>` for deployment configs

```ts
const DEPLOYMENT_CONFIGS: Record<string, Record<string, any>> = {
  "42161": deployment42161 as Record<string, any>,
  "42220": deployment42220 as Record<string, any>,
  "11155111": deployment11155111 as Record<string, any>,
};
```

The deployment JSONs have heterogeneous shape — `eas` is an object on Sepolia (`{ address, schemaRegistry }`), a flat string elsewhere; mainnet has `ensRegistry`/`ensResolver`/`nameWrapper` keys absent on Sepolia; only Arbitrum has `hypercertExchange`/`hypercertMinter`/`transferManager`/`strategyHypercertFractionOffer`. A union type covering all three would be 3× the size of `NetworkContracts` and would force every consumer to runtime-check missing keys. The current `asAddress(unknown): Address` helper that funnels every read through `getNetworkContracts` is the right defensive shape; the `Record<string, any>` only lives at the deserialization seam.

Skipping. Rewriting this would be a feature, not a cleanup.

### M3. `appkit.ts:72-73, 100, 116` — documented viem-version-mismatch `as any`

Comment in `packages/shared/src/config/appkit.ts:97-99` says:
> // Type assertion needed due to viem version mismatch between main dependency
> // and @reown/appkit-common's bundled viem. Runtime compatible.

Confirmed: the `chains as any`, `defaultNetwork: getChain(...) as any`, and the SSR-fallback `null as any` are intentional. Leaving alone.

### M4. `useTransactionSender.ts:58 writeContractAsync as any`, `useVaultPreview.ts:40 contracts as any`, `useBatchConvertToAssets.ts:44 contracts as any`

Wagmi's `useReadContracts` and `useWriteContract` infer extremely tight tuple/template types from the ABI. Wrapping a local typed builder for the inferred shape would touch many hooks. Library-boundary; skipping per task rules ("Some libraries (wagmi, viem, EAS SDK) export weak types — wrap with a local strong type rather than using `any`" — that wrap is itself a meaningful refactor).

### M5. `toast.service.tsx:602` — `resolved.icon as any` to bridge `ReactNode → Renderable`

`react-hot-toast`'s `Renderable = React.ReactElement | string | null` is narrower than React's `ReactNode` (which includes arrays, fragments, booleans). The codebase exposes `icon?: ReactNode` to callers because `ReactNode` is the conventional React surface; coercing to `Renderable` safely would mean rejecting array/fragment icons at the public boundary. Behavior-changing. Skipping.

## Skipped (boundary-correct `unknown`, intentional, or test mock)

- All `: any` in `packages/shared/src/__mocks__/**` and `packages/shared/src/__tests__/**` — task rules permit and there is no productive shape to assert.
- All `(state: any) => any` selector mocks for `useUIStore`, `useReadContract`, `useQuery` — same.
- `packages/shared/src/utils/eas/encoders.ts` `as 0x${string}` (~10 occurrences) on `easConfig.EAS.address` and `easConfig.WORK.schema` — the `easConfig.*` source is JSON-loaded `string`. The assertion is the *narrowing* that bridges `string → 0x${string}` for viem `encodeFunctionData` etc. Load-bearing.
- `packages/shared/src/utils/blockchain/vaults.ts:16-17` — `"0x..." as Address` literal table. The string is hand-typed and the cast is the documented literal narrowing. Load-bearing in spirit (semantically a static address registry).
- `packages/shared/src/utils/blockchain/garden-modules.ts:34`, `packages/shared/src/utils/blockchain/garden-hats.ts:30` — `moduleAddress as Address` after `isZeroAddress` / typeof checks; structurally similar to `asAddress` helper. Could route through `asAddress` but that's a refactor, not a strengthening.
- `packages/shared/src/utils/blockchain/ens.ts:128,195` — `address as Address` after a `isAddress(address)` narrowing. Same pattern as MintHypercert.
- `packages/shared/src/utils/blockchain/contracts.ts:50` — `value as Address` inside `asAddress(value: unknown): Address`. This is the boundary that converts `unknown` from JSON to typed; the cast is the entire point of the function.
- `packages/shared/src/hooks/roles/useGardenRoles.ts:65`, `useHasRole.ts:54` — `gardenAddress as Address, userAddress as Address` after `enabled` boolean guard. The cast strips nullability that tsc cannot infer through TanStack Query's `enabled` field. Common idiom; not strengthening.
- `packages/shared/src/providers/Work.tsx:337,381` — `workForm.feedback as string`. RHF gives `string | undefined`, and the surrounding code has already guarded. Could use a non-null assertion instead but this is RHF idiom in this codebase.
- `packages/shared/src/hooks/app/useUrlFilters.ts:38,43,56,58` — `key as string`, `result as Record<...>` for generic URL-search-params plumbing. The signature is intentionally loose (`<TFilters>`); strengthening would add 30+ lines of type plumbing for marginal value.
- `packages/shared/src/utils/eas/encoders.ts:361` — `(data as unknown as Record<string, unknown>).clientWorkId as string` — ASCII narrowing through the EAS SDK's loose typing. Boundary-correct.
- `packages/shared/src/stores/useHypercertWizardStore.ts:99` — `BigInt(e.units as string | number | bigint)` — IndexedDB-deserialized union narrowing. Boundary-correct.
- `packages/shared/src/hooks/ens/useENSRegistrationStatus.ts:76` — `(import.meta as any).env?.VITE_ALCHEMY_API_KEY` — Vite client/server typing gap. Lots of `(import.meta as any).env` in the codebase under the same pattern. Touched by another agent (legacy/AI-slop) more often than by this one.
- `packages/shared/src/utils/app/recursive-clone-children.tsx:30` — `(child as React.ReactElement<any>).props` — needed because `ReactElement` props default to `unknown` in newer React types and this util genuinely doesn't know the prop shape.
- `packages/shared/src/components/Form/Select/FormSelect.tsx:151` — `forwardRef<..., FormSelectProps<any>>` — generic component erasure for the forward-ref. Can't be strengthened without breaking the generic surface.

## Verification

- `bunx tsc --noEmit -p .` in `packages/shared`: 2 errors (both pre-existing in `src/hooks/yield/useGardenYieldSummary.ts`, unrelated to my edits — `getGardenYieldAllocations` rename and missing `gardenSummary` query key).
- `bunx tsc --noEmit` in `packages/admin`: 0 errors.
- `bunx tsc --noEmit` in `packages/client`: 0 errors.
- `bun run test` in `packages/shared`: 12 failed tests (identical to baseline `git stash` run — failures are in `useGardenYieldSummary`, `useProtocolYieldSummary`, `useFunderLeaderboard`, `useGardenRoles`, `useFilteredGardens`, `useVaultOperations`, `usePrimaryAddress` — none are files I touched).
- `bun run test` in `packages/admin`: 20 failed test files (identical to baseline — root cause is missing `@storacha/client` source-maps in this worktree's `node_modules`, an env issue, not type-related).
- Storybook coverage warnings filtered out as agreed (the worktree has no `@storybook/react`, `@remixicon/react`, `tailwind-variants` typings due to a partial `bun install` that hit a `sharp` post-install gyp failure; those errors are absent in the parent repo's normal install).
