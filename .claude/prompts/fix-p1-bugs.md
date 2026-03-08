# Fix P1 Bugs — Browser-Assisted Debugging

You are fixing the 3 critical P1 bugs from the Mar 4 product sync. Use Chrome DevTools via MCP to visually verify each fix in the running app.

## Prerequisites

Before starting:
1. Ensure dev servers are running: `bun dev` (client: https://localhost:3001, admin: https://localhost:3002)
2. Chrome is open and accessible via MCP tools
3. Read each issue on GitHub for full root cause analysis

## Bug Order (fix sequentially — each builds confidence for the next)

### Bug 1: "Garden failed to load" on completed work (#405)

**Root Cause**: `WorkViewSection.tsx:31` restricts `effectiveStatus` to 3 values, but `WorkDisplayStatus` has 7. Offline statuses ("syncing", "sync_failed", "uploading", "offline") pass the `!== "pending"` guard at `Work.tsx:757` and hit unhandled code paths.

**Fix Steps**:
1. Read `packages/client/src/views/Home/Garden/WorkViewSection.tsx` — widen `effectiveStatus` type at line 31 to `WorkDisplayStatus`
2. Read `packages/client/src/views/Home/Garden/Work.tsx` — fix the footer guard at line ~757:
   ```typescript
   const isResolved = effectiveStatus === "approved" || effectiveStatus === "rejected";
   const successFooter = viewingMode === "operator" && isResolved ? ( ... ) : null;
   ```
3. In `WorkViewSection`, ensure `getTitle()` and `getInfo()` handle all 7 statuses (add cases for syncing/uploading/sync_failed/offline with appropriate messages)
4. Import `WorkDisplayStatus` from `@green-goods/shared` (barrel import, not deep path)

**Verify in Chrome**:
- Navigate to client app → any garden → tap a completed work item
- Confirm the work detail renders without error
- Check Console tab for any React errors
- If you can trigger offline status: verify syncing/offline work items also render cleanly

**Tests**: Run `bun run test --filter client` to check for regressions. Consider adding a test for each `WorkDisplayStatus` rendering.

---

### Bug 2: IPFS images fail to load (#404)

**Root Cause**: Dual gateway inconsistency + pin expiry.
- `ipfs.ts:19` defaults to `https://w3s.link`
- `eas.ts:16` hardcodes `https://storacha.link`
- Storacha pins may have expired for older CIDs

**Fix Steps**:
1. Read `packages/shared/src/modules/data/ipfs.ts` — understand `resolveIPFSUrl()` at lines 305-335 and `gatewayUrl` at line 19
2. Read `packages/shared/src/modules/data/eas.ts` — find `GATEWAY_BASE_URL` at line 16
3. **Unify gateways**: Remove `GATEWAY_BASE_URL` from `eas.ts`. Instead, import and use `resolveIPFSUrl` without passing a custom gateway (it will use the module-level `gatewayUrl`)
4. Read `packages/shared/src/components/Display/ImageWithFallback.tsx` — understand current error handling
5. **Add gateway fallback**: In `ImageWithFallback`, on image load error, retry with alternate gateway URLs before showing the fallback icon. Implement a small retry chain:
   ```typescript
   const FALLBACK_GATEWAYS = ["https://w3s.link", "https://storacha.link", "https://dweb.link"];
   ```
   On error, try the next gateway by rewriting the URL's base and setting it as the new src.
6. Ensure `VITE_STORACHA_GATEWAY` env var is respected (check `initializeIpfsFromEnv()`)

**Verify in Chrome**:
- Navigate to admin dashboard → any garden → check if garden banner images load
- Navigate to Actions → verify action images load
- Open Network tab → filter by image requests → confirm gateway URLs are consistent
- If images still fail: check if CIDs are valid by manually testing `https://w3s.link/ipfs/{CID}` vs `https://dweb.link/ipfs/{CID}` in the browser
- If ALL gateways fail for a CID, the content is truly unpinned — document which CIDs are affected

**Tests**: Run `bun run test --filter shared` — especially any IPFS-related tests. Add a unit test for `resolveIPFSUrl` ensuring it no longer produces different URLs for the same CID when called from different modules.

---

### Bug 3: Work approval fails with unhelpful errors (#406)

**Root Cause**: No pre-flight validation before contract call. Contract reverts (`NotGardenOperator`, `ActionExpired`) show as generic "Transaction failed."

**Fix Steps**:
1. Read `packages/shared/src/hooks/work/useWorkApproval.ts` — understand the mutation flow
2. Read `packages/shared/src/utils/errors/` — find `USER_FRIENDLY_ERRORS` map and `parseContractError()`
3. **Add contract error mappings**: Add these to `USER_FRIENDLY_ERRORS`:
   ```typescript
   NotGardenOperator: "You don't have permission to review work for this garden. Please contact the garden operator.",
   ActionExpired: "This action has ended and work can no longer be reviewed.",
   ActionMismatch: "This approval doesn't match the submitted work. Please try again.",
   NotInWorkRegistry: "The work submission could not be found. It may have been removed.",
   ```
4. **Add pre-flight checks** in the approval UI (client Work.tsx and/or admin WorkDetail.tsx):
   - Check if user has operator role before showing approval form (use existing `useHasRole` or similar hook)
   - Check if action `endTime > Date.now() / 1000` before enabling submit
   - Show clear disabled state with explanation if checks fail
5. **Tighten Zod validation** for `verificationMethod`: change from `z.number()` to `z.number().min(0).max(15)`

**Verify in Chrome**:
- This is harder to test without a specific reproduction scenario
- Navigate to client app → find pending work → attempt approval flow
- Check Console for any errors during the flow
- If you can simulate a non-operator attempting approval: verify the pre-flight check prevents submission with a clear message
- Check Network tab during approval to see the transaction request

**Tests**: Run `bun run test --filter shared` — look for approval-related tests. Add test for `validateApprovalDraft()` with edge cases (expired action, out-of-range verificationMethod).

---

## Workflow for Each Bug

1. **Read** — Read all files mentioned in the fix steps
2. **Fix** — Make the minimal changes needed
3. **Test** — Run relevant tests (`bun run test --filter {package}`)
4. **Verify in Chrome** — Follow the Chrome verification steps above
5. **Commit** — One commit per bug: `fix(scope): description` referencing the issue number
   - `fix(client): widen WorkDisplayStatus handling in work detail view (#405)`
   - `fix(shared): unify IPFS gateway and add fallback chain (#404)`
   - `fix(shared): add pre-flight validation and error mapping for work approval (#406)`

## Important Constraints

- ALL hooks MUST live in `@green-goods/shared` — do NOT create hooks in client or admin
- Use barrel imports: `import { x } from "@green-goods/shared"` not deep paths
- Use `logger` from shared, not `console.log`
- Use `Address` type for Ethereum addresses, not `string`
- Never swallow errors — use `parseContractError()` + `USER_FRIENDLY_ERRORS`
- Run `bun format && bun lint` before committing

## Validation

After all 3 bugs are fixed:
```bash
bun format && bun lint && bun run test && bun build
```

All must pass before pushing.
