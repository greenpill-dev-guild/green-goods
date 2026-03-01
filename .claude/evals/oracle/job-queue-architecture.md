# Oracle Eval: Job Queue Architecture Question

## Question

Why does the job queue use IndexedDB instead of localStorage? What are the tradeoffs, and what would break if we switched to localStorage?

## Context

A developer is proposing to simplify the job queue by replacing the IndexedDB-based storage (`idb` library, `packages/shared/src/modules/job-queue/db.ts`) with a simpler localStorage wrapper. They argue that localStorage is easier to debug (visible in DevTools Application tab) and doesn't require the `idb` library dependency. They want to understand the architectural reasoning before proceeding.

## Expected Answer

The oracle should identify and explain the architectural decision with these key findings:

### Why IndexedDB was chosen:

1. **Binary data storage**: The job queue stores `File` objects (images, audio recordings) alongside job metadata. localStorage only supports strings (max ~5MB total), while IndexedDB handles binary blobs natively. Work submissions include media files that can be several MB each.

2. **Structured data with indexes**: The `db.ts` file creates multiple object stores (`jobs`, `job_images`, `cached_work`, `client_work_id_mappings`) with indexes on `kind`, `synced`, `createdAt`, `attempts`, and compound indexes like `kind_synced`. These enable efficient querying (e.g., "get all unsynced work jobs ordered by creation date"). localStorage would require loading all data into memory and filtering in JS.

3. **Storage quota**: IndexedDB typically has access to 50%+ of available disk space (varies by browser), while localStorage is hard-capped at ~5-10MB. The `getStorageQuota()` utility in `packages/shared/src/utils/storage/quota.ts` monitors IndexedDB usage. A single work submission with 5 high-res photos could exceed localStorage limits.

4. **Transactional integrity**: IndexedDB supports transactions, so a job and its associated images are saved atomically. With localStorage, a crash between saving the job metadata and the image data would leave orphaned records.

5. **Service worker access**: IndexedDB is accessible from service workers (for background sync), while localStorage is not available in service worker context.

### What would break with localStorage:

- **Media storage**: All `File` objects would need to be base64-encoded (33% size increase), and the combined storage would quickly hit the 5-10MB localStorage limit
- **Query performance**: Listing pending jobs by kind would require deserializing all jobs and filtering in memory
- **Background sync**: Service worker-based sync would lose access to the queue
- **Concurrent access**: Multiple tabs could corrupt localStorage without manual locking (IndexedDB handles this)
- **Migration path**: Existing users' queued jobs in IndexedDB would be lost

### Key source files:

- **`packages/shared/src/modules/job-queue/db.ts`**: IndexedDB schema with stores and indexes
- **`packages/shared/src/modules/job-queue/index.ts`**: Job processing logic that depends on DB queries
- **`packages/shared/src/modules/job-queue/media-resource-manager.ts`**: Media file lifecycle management
- **`packages/shared/src/utils/storage/quota.ts`**: Storage quota monitoring
- **`packages/shared/src/utils/storage/file-serialization.ts`**: File serialization utilities
- **`packages/shared/src/types/job-queue.ts`**: Type definitions including `JobQueueDBImage` with `file: File` field
