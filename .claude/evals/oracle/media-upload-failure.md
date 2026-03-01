# Oracle Eval: Mobile Media Upload Intermittent Failure

## Bug Report

**Title**: Media uploads fail intermittently on mobile Safari and Chrome

**Reporter**: QA team testing on iPhone 15 and Pixel 8

**Symptoms**:

When a gardener submits work with photos on a mobile device, the images sometimes appear as broken/empty in the submitted attestation. The work submission itself succeeds (EAS attestation is created), but the IPFS upload for media files silently fails and the attestation contains empty or placeholder CIDs.

This happens approximately 30-40% of the time on mobile, but rarely on desktop. It seems more likely to occur when:
- The user switches away from the app briefly during upload
- The user's phone locks the screen during submission
- Multiple large images are being uploaded simultaneously

The job queue shows the job as `synced: true` with a valid txHash, but the on-chain attestation's media CIDs point to non-existent IPFS content.

**What we've tried**:

- Verified IPFS upload function works correctly in isolation
- Verified the EAS attestation data is well-formed
- Checked that the blob URLs for images are valid at the time of form submission
- No errors in the console on mobile (uploads appear to succeed)

**Question for oracle**: What is the root cause of intermittent media upload failures on mobile, and what is the fix?

## Expected Root Cause

The root cause is **blob URL lifecycle invalidation** when the browser revokes object URLs:

1. **Blob URL creation**: When the user selects photos, the client creates blob URLs via `URL.createObjectURL()` for preview rendering. These blob URLs are stored in the form state and passed to the job queue.

2. **Blob URL revocation**: Mobile browsers aggressively reclaim memory. When the user switches apps, locks the screen, or the page is backgrounded, the browser may revoke blob URLs or garbage-collect the underlying `Blob` objects. This is part of the Page Lifecycle API behavior on mobile.

3. **Delayed consumption**: The job queue processes jobs asynchronously. By the time the job queue attempts to read the blob URL to upload to IPFS, the blob URL may have been revoked. The `fetch(blobURL)` call returns an empty response or throws, but this error is caught and the upload proceeds with empty/placeholder data.

4. **The media resource manager** (`packages/shared/src/modules/job-queue/media-resource-manager.ts`) is designed to handle this, but the issue is that blob URLs created in the form context are not persisted to IndexedDB as actual `File` objects before the page is backgrounded.

### The fix involves:

- **Eagerly persist `File` objects to IndexedDB** when media is selected (not when the job is submitted), so the binary data survives page lifecycle events
- Use the `media-resource-manager.ts` to manage file lifecycle: acquire on selection, release after successful IPFS upload
- Never pass blob URLs across the form -> job queue boundary; pass serialized file references instead
- The `file-serialization.ts` utilities (`serializeFile`, `deserializeFile`) already exist for this purpose

### Key source files:

- **`packages/shared/src/modules/job-queue/media-resource-manager.ts`**: Media file lifecycle management
- **`packages/shared/src/modules/job-queue/db.ts`**: `job_images` store where files should be persisted
- **`packages/shared/src/modules/job-queue/index.ts`**: `executeWorkJob()` which reads images from DB
- **`packages/shared/src/utils/storage/file-serialization.ts`**: `serializeFile()` / `deserializeFile()`
- **`packages/shared/src/utils/app/normalizeToFile.ts`**: Blob-to-File normalization
- **`packages/shared/src/hooks/work/useWorkImages.ts`**: Hook that manages image selection in the form

### Key insight:

The issue is a timing/lifecycle problem, not a bug in any single function. Each individual piece (blob URL creation, IPFS upload, job queue processing) works correctly in isolation. The failure occurs at the boundary between synchronous form state (blob URLs) and asynchronous background processing (job queue), exacerbated by mobile browser memory management.
