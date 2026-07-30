# App Profile Avatars Plan

**Linear Issue**: PRD-762  
**Linear Project**: Commitment Pooling  
**Linear Source**: source:plans  
**Feature Slug**: `profile-avatars`  
**Status**: ACTIVE  
**Created**: 2026-07-29  
**Last Updated**: 2026-07-29

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Client and admin can edit the same record | Avoids identity drift between authenticated apps. |
| 2 | Automatic 512×512 WebP center crop, at most 1 MB | Small behavior-complete normalization without a cropper dependency. |
| 3 | Durable unsigned IndexedDB drafts | Preserves offline work without persisting expiring signatures. |
| 4 | App avatar → ENS → local fallback | Preserves current ENS behavior while making the app pointer authoritative. |
| 5 | SQLite tombstones and atomic version checks | Prevents stale or replayed writes from restoring old avatars. |
| 6 | One PR and one Linear parent | Keeps the prerequisite reviewable without multiplying tracker records. |

## Requirements Coverage

| Requirement | Planned step | Status |
|-------------|--------------|--------|
| Public versioned avatar record | Shared protocol + agent API | Complete |
| Signed wallet, embedded, and passkey mutations | Shared state + agent verification | Complete |
| Replay-safe create, replace, and clear | Agent API | Complete |
| Durable offline normalized drafts | Shared state | Complete |
| Client Profile editor | Client UI | Complete |
| Admin desktop and mobile editor | Admin UI | Complete |
| App → ENS → fallback display | Shared state + both UIs | Complete |
| Targeted, build, and Brave proof | QA | Automated proof complete; authenticated Brave blocked |

## Implementation Steps

1. [x] Add shared public contracts, canonical message construction, validation, and query keys with tests.
2. [x] Add agent SQLite persistence, compare-and-swap mutations, signature verification, routes, protection, and tests.
3. [x] Add shared transport, resolver/editor hooks, image normalization, durable draft storage, and tests.
4. [x] Add the client Profile editor and localized states with targeted tests.
5. [x] Add the admin Profile editor and AppBar avatar support with tests and stories.
6. [ ] Finish QA. Targeted tests, typechecks, deterministic builds, Repo Quick Gate, design/vocabulary/story checks, and test-quality checks pass. Authenticated Brave is blocked by local HTTPS trust and runtime credential requirements; the full Ship Gate is also blocked by unchanged missing contract submodules and sandbox-denied indexer loopback listeners.

## Validation

See `eval.md`. Contracts and indexer lanes are explicitly not applicable.
