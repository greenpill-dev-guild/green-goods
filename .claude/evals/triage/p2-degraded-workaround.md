# Triage Eval: P2 Degraded Experience with Workaround

## Issue Report

**Title**: Work submission photos not syncing from client PWA after coming back online

**Reporter**: Gardener via community Discord

**Body**:

When I submit work with photos while offline and then come back online, the work attestation syncs successfully but the photos are missing. The work appears in the admin dashboard with the text description and metadata but the photo attachments show as broken image placeholders.

Here's what happens step by step:

1. I go into the field (no cell service) and take photos of my garden work
2. I fill out the work submission form in the client PWA, attach 2-3 photos, and submit
3. The app shows "Queued for sync" which is expected offline behavior
4. When I get back to wifi, the sync indicator shows the job processing
5. The work attestation appears on-chain with the correct text fields
6. But the media CIDs in the attestation point to empty/missing IPFS content — the photos never uploaded

The job queue in `packages/shared/src/modules/job-queue/index.ts` processes the work attestation correctly but the photo attachment handling in the sync flow drops the files. Looking at the `executeWorkJob` function, it reads images from `jobQueueDB.getImagesForJob(jobId)` but the images were never written to the `job_images` IndexedDB store during offline submission — only blob URL references were stored in the job payload, and those blob URLs are invalid after the PWA was backgrounded/resumed.

**Workaround**: After the work syncs without photos, go to the admin dashboard > find the work submission > click "Edit media" > re-upload the photos from the device gallery. The photos upload correctly when done directly (not through the offline queue). This is clunky but functional.

**Labels**: bug, client, shared, offline, media

**Reproduction**:

1. Enable airplane mode on a mobile device
2. Open the client PWA (should work offline)
3. Submit a work with 2+ photo attachments
4. Wait 30+ seconds, then disable airplane mode
5. Watch the sync indicator process the job
6. Check the work in admin — photos are missing

**Impact**: Affects all gardeners who submit work with photos while offline, which is the primary use case (field work documentation). The workaround (manual re-upload) exists but defeats the purpose of the offline-first PWA — gardeners expect photos to sync automatically.

## Expected Classification

### Classification
- **Severity**: `P2`
- **Type**: `bug`
- **Complexity**: `medium`

### Affected Packages
- `client` (PWA offline submission flow, media capture)
- `shared` (job queue sync logic, media resource manager, file serialization)

### Rationale

This is P2 because:
1. **Core workflow degraded**: Offline work submission with photos is a primary use case, but text-only submission works fine
2. **Workaround exists**: Gardeners can manually re-upload photos after sync via the admin dashboard edit flow
3. **No data loss**: The work attestation itself syncs correctly — only the media attachment is affected
4. **Not P1**: The feature partially works (text syncs, workaround for photos exists). It's degraded, not broken
5. **Not P3**: This affects a core use case (offline photo documentation) and the workaround is significantly worse than the expected experience

### Expected Route
- Entry point: `/debug` with `data-layer`, `testing` skills
- This requires understanding the blob URL lifecycle and the media resource manager's role in persisting files to IndexedDB before sync
- Fix involves eager file persistence at selection time, not at sync time

### Context for Next Agent
The media sync failure is a timing/lifecycle issue: blob URLs stored in the job payload become invalid after the PWA is backgrounded. The fix is to persist `File` objects to the `job_images` IndexedDB store at the time of media selection (not at sync time). The `media-resource-manager.ts` and `file-serialization.ts` utilities in shared already support this pattern. Key files: `packages/shared/src/modules/job-queue/index.ts` (executeWorkJob), `packages/shared/src/modules/job-queue/media-resource-manager.ts`, `packages/shared/src/hooks/work/useWorkImages.ts`.

## Passing Criteria

- Severity MUST be `P2` (not P1 — workaround exists; not P3 — core use case is degraded)
- Type MUST be `bug`
- Must identify BOTH `client` and `shared` as affected packages
- Must recognize the workaround (manual photo re-upload) as a mitigating factor
- Must route to debug/investigation mode (not enhancement or refactor)
- Should identify the offline-first context as relevant to severity assessment

## Common Failure Modes

- Classifying as P1 (missing the workaround — manual re-upload after sync is functional)
- Classifying as P3 (underestimating the impact — offline photo sync IS the core PWA value proposition)
- Identifying only `client` or only `shared` (both packages are involved in the failure chain)
- Classifying type as "enhancement" (this is a regression/bug in existing functionality, not a new feature request)
- Routing to `/plan` instead of `/debug` (this needs investigation, not design)
