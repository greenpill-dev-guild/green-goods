# Offline experience investigation

**Verdict: REQUEST_CHANGES.** The expanded investigation confirms additional image-cache and work-display gaps. The exact cause of the missing banner on the reported device remains unverified. The five findings from the [submission review](/private/tmp/gg-offline-review/review.md) also remain open.

Reviewed on 2026-09-12, against `develop` at `6eef3575931d437f36889e15acb57559a9004eb8`. This addendum covers the user's device observations, the offline banner, published profile photos, app image caching, garden work reads, loading states, and the policy for downloading data before losing connectivity. It extends the PRD-900/896/867 review; it does not replace the earlier evidence or authorize implementation.

## Additional confirmed findings

### 6. Published profile photos have incomplete offline coverage — P2

The [ENS avatar cache](/Users/afo/Code/greenpill/green-goods/packages/shared/src/utils/storage/avatar-cache.ts:14) stores a URL and timestamp, not image bytes. The profile-avatar query likewise persists the photo's location. Rendering that photo offline depends on a separate service-worker or browser cache.

The production [runtime image rules](/Users/afo/Code/greenpill/green-goods/packages/client/vite.config.ts:360) match a filename extension at the end of the entire URL or an IPFS path on three named gateways. Executing the generated worker's actual route registrations confirmed that ordinary `.png` and canonical Pinata IPFS URLs match, while `.png?size=96`, extensionless ENS-provider images, and raw IPFS subdomain URLs do not. These are representative URL cases, not the unidentified URL of the user's missing photo. App-avatar IPFS URLs that the resolver canonicalizes onto a covered gateway can be cached normally once requested through a controlling worker.

The default `/images/avatar.png` is also absent from both the generated precache and prepared shell asset manifest. It can enter the runtime image cache after a controlled request, but preparing the shell does not itself save it. The authenticated desktop profile rendered this default image at 96×96 with opacity 1; that proves its current layout, not survival after the user's device loses connectivity.

The [profile image element](/Users/afo/Code/greenpill/green-goods/packages/client/src/components/Features/Profile/ProfileAvatarEditor.tsx:217) has no load-error fallback. A stored URL with missing bytes can therefore leave a broken photo. Other cards use `ImageWithFallback`, which has placeholders and gateway racing, but its remembered gateway is an in-memory URL map. It does not independently persist image bytes. Optimized previews, full images and alternate gateways also use different request URLs.

**Closure:** prepare the current profile photo and local fallback deliberately; use consistent request matching and image fallbacks across avatar, garden, action and work surfaces; distinguish a downloaded preview from its full attachment. A request-based image rule avoids extension-only matching, as described in [Workbox's runtime caching guidance](https://developer.chrome.com/docs/workbox/caching-resources-during-runtime). Match accepted media sources and retain meaningful variants rather than stripping every query parameter. Verify fresh install, restart, changed photo, optimized URL, gateway fallback and cache eviction.

This concerns published photos. The separate avatar-draft migration in finding 5 remains a different requirement.

### 7. Local work rendering waits for a remote approvals request — P2

The [offline merge](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useWorks.ts:227) always awaits `getWorkApprovals`, before producing either cached work or locally queued work. [useMerged](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/app/useMerged.ts:61) runs that merge with `networkMode: "always"`, so this remote dependency runs even when connectivity is known to be offline.

A diagnostic using the real `useWorks`, real `useMerged` and real QueryClient seeded a downloaded work record, then held the approvals boundary pending. The hook returned no work while the request remained pending. The real GraphQL wrapper normally times out after 12 seconds; this is avoidable waiting, not a claim that the production request hangs forever. Existing merged data may stay visible, but freshly reconstructed data and queued additions still depend on this request finishing.

**Closure:** render the local projection immediately from persisted records, queued jobs and known review status. Fetch approvals separately when connectivity permits. Preserve the current status-overlay behavior; an unavailable approvals read must not reset reviewed work to pending. Exercise both a restarted app and a new queue item while offline.

### 8. Garden work conflates unavailable data, empty results and refresh errors — P2

There are two verified manifestations of the missing availability state:

- With no downloaded work and the device reported offline, the real work hook's first remote request failed and its retry became paused. The merged query then succeeded with `[]`, while the hook exposed `isLoading: false` and `isError: false`. The [garden route](/Users/afo/Code/greenpill/green-goods/packages/client/src/views/Home/Garden/index.tsx:324) translates those flags into `success`, and the list says there is no work. No successful empty response was received.
- When a refresh does reach error state, [GardenWork](/Users/afo/Code/greenpill/green-goods/packages/client/src/components/Features/Garden/Work.tsx:174) renders an error screen and suppresses nonempty work passed to it. A rendered component diagnostic confirmed that downloaded work disappears from the list. Retry is controlled by fetching state alone, with no explanation that the data is unavailable offline.

`offlineFirst` is not a prohibition on network requests: TanStack runs the first attempt and pauses subsequent retries after a cache miss. Paused and fetching are different states. [TanStack network-mode documentation](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).

The adjacent [work metadata hook](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useWorkMetadata.ts:84) also starts an IPFS request with a 30-second timeout without exposing offline availability. Its effect depends on metadata identity and manual retry, so reconnect alone does not rerun a failed read. This was traced in source; physical-device timing was not measured.

**Closure:** expose cache presence, completeness, fetch state and last successful refresh separately. Preserve available rows during failures. Reserve “No work yet” for a successfully downloaded empty collection. Show “This garden's work hasn't been downloaded” when offline without a snapshot, and an explicit placeholder for unavailable details or media. Reconnect should refresh failed reads without requiring a page reload.

### 9. The garden list can hide a different gardener's queued submission — P2

The [garden deduplication heuristic](/Users/afo/Code/greenpill/green-goods/packages/shared/src/hooks/work/useWorks.ts:262) matches only action and nearby timestamps. It compares timestamps in seconds against `5 * 60 * 1000`, making the effective window roughly 83 hours, rather than five minutes. It does not compare gardener or submission identity.

The real-hook diagnostic supplied an indexed work from gardener A and a queued work from gardener B, of the same action, one hour apart. Only A's work remained in the displayed collection. The queued job is not deleted by this code; it becomes invisible in this garden view. Git history shows that the heuristic predates the recent offline fixes, so this is a surviving gap rather than a newly introduced regression.

**Closure:** use the existing stable submission identity/deduplication approach already used by `useMyWorks`. A queued item should disappear only when its corresponding indexed submission is identified. Cover repeated work of the same action by the same person and by different people.

## Missing banner on the device: still an open diagnosis

The current [indicator](/Users/afo/Code/greenpill/green-goods/packages/client/src/components/Communication/Offline/OfflineIndicator.tsx:54) gives offline status first priority. Installed/mobile detection only controls the install suggestion; it does not suppress the offline message. The banner is mounted by the signed-in AppShell.

Its entire connectivity input is [the shared store](/Users/afo/Code/greenpill/green-goods/packages/shared/src/stores/connectivity.ts:5): `navigator.onLine`, browser online/offline events, and a visibility-change reread. Failed requests do not update it. Browser/OS connectivity heuristics can differ from actual internet reachability, so this signal alone cannot establish successful access to Green Goods. That is a platform limitation, not yet the proven explanation for this phone. [MDN on navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine).

A conditional diagnostic exposed another weakness: after receiving an offline event, mounting a new subscriber resets the shared store to true if `navigator.onLine` still says true. The implementation behavior is reproduced; whether that event/property disagreement happens on the reported device is unknown. It should not be presented as the device's established root cause.

Authenticated Brave DOM inspection found the desktop banner container mounted, empty and zero-height, with opacity 0, fixed positioning and z-index 30. It was choosing no message in that environment. Local backend requests failed because those services were unavailable; the computer was not put into airplane mode. This observation cannot distinguish the phone's signal, lifecycle or layout problem. The banner also has no top safe-area inset despite `viewport-fit=cover`; device cutout overlap needs actual installed-device geometry before it is classified as a visual defect.

**Required device evidence:** device/OS and app origin, installed PWA versus browser, app build and controlling worker version; foreground → airplane mode, background → airplane mode → resume, and cold offline launch. Capture the connectivity value and events alongside rendered banner text, computed style and rectangle. Check a current build and an upgraded existing install. The user's optional device/version clarification had not arrived when this report was written.

**Direction:** retain a shared connectivity signal, make resume handling reliable, and distinguish “offline” from “service unavailable.” Do not flip the entire app offline because one endpoint fails, or declare “Back online” solely because one transport hint changes. Local drafting and queuing must remain usable while reachability is uncertain.

## What is cached today

| Content | Current storage and preparation | Practical limitation |
| --- | --- | --- |
| Signed-in app shell | Service-worker precache plus generated shell assets for routes | Routes being available does not mean their data or images were downloaded; default profile image is missing from shell preparation. |
| Gardens, actions, gardeners | Baseline warmup into TanStack Query; persisted in `gg-react-query` | Provides list records, not each garden's work history or referenced image bytes. |
| Garden work | Persisted queries for each garden that was actually fetched | No deliberate download of work from all joined/other gardens; no completeness marker or explicit history budget. |
| My Work | Separate user query; default display limit 50 | Cached under a different key from garden work; fetching one's own work does not prepare another garden's complete collection. The limit is applied after the remote read. |
| Profile identity and photo location | Query persistence; ENS also has a URL cache of up to 100 entries for 7 days | URLs can survive while photo bytes are absent. |
| General images | Cache-first runtime cache, 100 entries, 30 days | Only covered request URLs, after a controlled fetch; extensionless/query-string cases can miss. |
| IPFS metadata/media | Cache-first runtime cache, 500 entries, 365 days, on three gateway URL patterns | Populated on demand; metadata and images share the budget. General image rule runs first, so filename-style IPFS images may receive the shorter general policy. No garden-completion record. |
| Work details | Inline metadata travels with work; IPFS metadata is fetched on opening and can use the runtime cache | Resolving a work record does not prepare all details/media. Hook state itself is not persisted independently. |
| Work drafts and unsynced attachments | Durable IndexedDB records and independent bytes | Stronger durability path than browsing caches; pending submission correctness still has findings 1–4. |
| Avatar drafts | Separate IndexedDB database containing draft bytes | Still outside the unified draft schema required by PRD-896. |

The [query persistence policy](/Users/afo/Code/greenpill/green-goods/packages/client/src/PwaApp.tsx:26) includes populated `greengoods` queries except the `queue` group and active demo pooling reads. The maximum restored snapshot age is seven days, with a schema-based version that survives ordinary deployments. This is a client-snapshot age, not a guarantee that every individual record was refreshed within seven days. There is no explicit total record or byte budget for the browsing snapshot.

[Storage cleanup](/Users/afo/Code/greenpill/green-goods/packages/shared/src/utils/storage/quota.ts:142) can delete entire image/IPFS caches under pressure. It avoids draft and job media stores, but does not protect the current avatar or a selected garden's downloaded images. Query persistence failures are logged; they do not produce a user-visible indication that the next offline restart may have less data. Consequently, “I saw it online” is not currently an app-level promise that it is available offline.

## Proposed offline policy for scope discussion

These are proposed starting limits, not existing behavior or previously accepted requirements. Keep the promise understandable: **your work and selected gardens are prepared; other gardens show what has been downloaded and clearly identify what is missing.**

| Tier | Proposed preparation | Suggested initial bound |
| --- | --- | --- |
| Essential | Current profile and photo, local fallback art, action catalogue, joined-garden identity/permissions, navigation shell | Prepare after a successful online session; track completion separately from a fetch beginning. |
| Own work | Drafts, queue entries, attachment bytes and submission checkpoints | Never evict unsynced work to make room for browsing caches; retain existing admission limits and explicit deletion controls. |
| Joined/selected gardens | Recent work rows, known approval state, work metadata and thumbnails | Latest 50 work records per garden, capped at 500 across automatic downloads; prioritize selected and recently used gardens. Show where history is truncated. |
| Other gardens | Garden overview; preserve work already viewed | Optionally retain latest 20 work records for up to 5 recently visited gardens; avoid downloading every garden's full history. |
| Large media/history | Original photos, video/audio and older work | Download deliberately when needed; a thumbnail must not imply the original file is available. |

Use a starting **50 MiB budget for optional previews/metadata**, separate from drafts and unsynced evidence, then tune against real media sizes and device storage. These values need product agreement and measurement; they are not a capacity claim. A selected garden can offer an explicit offline download, with progress, last update and partial/missing status. Recheck availability after restart and eviction rather than trusting an old “downloaded” label.

Build on existing Shared query, work and storage modules. Reuse query identities and status resolution; remove the network dependency from local merge rather than adding another competing cache or work projection.

## Screen-state contract

| Actual condition | Required presentation |
| --- | --- |
| Offline, cached collection available | Keep records visible; indicate offline and last successful refresh. |
| Offline, collection never downloaded | Explain that this garden's work is unavailable offline; no empty-garden claim or active network spinner. |
| Offline, only some data/media available | Show available content and specific unavailable details/photos. |
| Successfully downloaded empty collection | “No work yet” is appropriate, with offline/stale context if applicable. |
| Online refresh fails with cached data | Keep the data; show a refresh problem and an appropriate retry. |
| Connectivity returns | Refresh affected remote data and failed details; preserve local changes, scroll and submission identity. |
| Work is locally queued | Show it immediately, including its previews and explicit submission state. |

New product copy must be localized in English, Spanish and Portuguese. Storage/network internals belong in diagnostic evidence; normal screens should explain what is available and what the user can do.

## Combined repair outline

1. **Submission integrity:** repair failed UserOperation handling, signer/account fencing, duplicate draft-to-queue admission and retry eligibility. These remain the highest-risk blockers from findings 1–4.
2. **Draft durability:** finish the avatar schema migration from finding 5, preserving existing work and avatar evidence.
3. **Connectivity and banner:** obtain the device evidence above, fix the established cause, and cover foreground, resume and cold launch. Keep service reachability distinct from OS network hints.
4. **Image availability:** close URL coverage and default-avatar preparation gaps, cache the current photo deliberately, and use consistent unavailable-image behavior.
5. **Local work projection:** remove the approvals dependency from offline merging and replace the garden deduplication heuristic with stable submission identity.
6. **Fetching and empty states:** expose downloaded/partial/missing states, preserve cached work on failure, and recover metadata on reconnect.
7. **Download and storage policy:** agree the garden/history/media limits, add completion and freshness evidence, and make eviction or persistence failure visible without discarding unsynced work.
8. **Device acceptance:** prove the resulting promise on installed Android and iOS, including an upgraded install and successful wallet/passkey reconnect. Browser simulations support these checks but do not replace them.

These are bounded candidate work units for scope lock. No Linear records, application source or dependency files were changed.

## Verification and limits

The diagnosis selector ran before these checks with explicit Shared/Client paths. It selected focused Shared and Client tests (`selectedBy: focused-test:shared/client`), at critical risk. Temporary configurations extend the existing repository configurations so diagnostics can live outside the source tree. Existing dependencies were used.

At 2026-09-12 21:48 UTC, these commands completed with exit code 1, as expected for deliberately failing regression demonstrations:

```sh
bun run --filter @green-goods/shared test -- --config /private/tmp/gg-offline-review/vitest.config.ts /private/tmp/gg-offline-review/experience.test.ts /private/tmp/gg-offline-review/connectivity.test.ts
bun run --filter @green-goods/client test -- --config /private/tmp/gg-offline-review/client.config.ts
```

- Shared: three failed expectations, one passing observation. Covered blocked local work, incorrect deduplication, conditional connectivity reset, and the paused/cold-cache state. [Log](/private/tmp/offline-experience-shared.log), [work diagnostics](/private/tmp/gg-offline-review/experience.test.ts), [connectivity diagnostic](/private/tmp/gg-offline-review/connectivity.test.ts).
- Client: five failed expectations, one passing route control. Covered three uncached URL forms, absent fallback precache, and work hidden on refresh error. These are six checks, not six separate production bugs. The worker test evaluates built route configuration; it does not install a worker or prove real-device storage. [Log](/private/tmp/offline-experience-client.log), [cache diagnostics](/private/tmp/gg-offline-review/cache.test.ts), [rendered component diagnostic](/private/tmp/gg-offline-review/garden.test.tsx).
- `bun run agentic:guidance` completed successfully and current primary browser/Workbox/TanStack guidance informed the review.
- Authenticated Brave was accessed through the existing extension/profile. Home/banner and Profile DOM were inspected. The local frontend was running, while backend reads failed. No network setting, account setting, wallet transaction or stored user data was changed.
- HEAD remained unchanged and the source tree was clean. The earlier full test/build evidence is recorded in the original review; it was not rerun or presented as new device proof here.

**Safety fact:** available local work must render independently of network-only reads and unrelated submissions. Consumers: Shared `useWorks/useMerged`, Client garden list and local queue display. **Proof: DEPENDENCY_WALKED, contradicted by executed diagnostics.** The network boundary and queue source were controlled; no device or chain mutation was performed.

**Safety fact:** an offline availability label must correspond to data and bytes actually prepared. Consumers: profile photo, garden work/details and runtime caches. **Proof: PATH_TRACED plus executed route checks.** Current storage layers do not establish that combined promise. The exact reported photo-loss and banner failure remain blocked on device evidence.

See the [extended coverage ledger](/private/tmp/gg-offline-review/experience-coverage.md) for reviewed batches and remaining device proof. None of this evidence establishes production readiness yet.
