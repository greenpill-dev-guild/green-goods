# Documentation Gaps — Remaining Work

**Branch**: `fix/contracts-crosspackage`
**Status**: IN PROGRESS
**Created**: 2026-03-08
**Last Updated**: 2026-03-08

---

## Current State (Post Phase 7)

| Metric | Value |
|--------|-------|
| Total pages | 103 MDX (41 community + 62 builders) |
| Mermaid diagrams | 70 across 56 files |
| Screenshots | 9 images → 15 placements across 13 pages |
| IMAGE PLACEHOLDER | **0 remaining** |
| Custom components | 12 components used across 83/103 pages |
| Pages with no visuals | **45** |
| Integration stubs | **12** (23 lines each) |
| Build | Passing, zero broken references |

---

## Phase 8: Authenticated App Screenshots (via Chrome)

Capture from the user's live, logged-in Chrome browser using
`mcp__claude-in-chrome__javascript_tool` + local Bun receiver server.

### Strategy
1. Start Bun server on port 9876 accepting POST `{ filename, data }`
2. Navigate Chrome to target page (user is already authenticated)
3. Run html2canvas in page context, POST base64 PNG to server
4. Server writes to `docs/static/img/screenshots/`

```js
// Capture script (run via javascript_tool)
(async () => {
  if (!window.html2canvas) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const canvas = await html2canvas(document.body, { useCORS: true });
  const data = canvas.toDataURL('image/png').split(',')[1];
  const resp = await fetch('http://localhost:9876', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'TARGET.png', data })
  });
  return await resp.json();
})()
```

### Fallback: Playwright + Chrome CDP
If html2canvas approach fails, connect Playwright to user's Chrome:
```bash
# User launches Chrome with debugging port
open -a "Google Chrome" --args --remote-debugging-port=9222
# Playwright connects
const browser = await chromium.connectOverCDP('http://localhost:9222');
```

### 8.1 Client PWA Screenshots (mobile 390×844)
Capture from localhost:3001 (user is logged in):
- [x] `client-garden-home.png` — Garden home with action cards
- [x] `client-action-list.png` — Available actions in a garden
- [ ] `client-mdr-media.png` — MDR Step 1: photo/audio capture
- [ ] `client-mdr-details.png` — MDR Step 2: form fields
- [ ] `client-mdr-review.png` — MDR Step 3: review before submit
- [ ] `client-work-success.png` — Submission confirmation
- [x] `client-profile.png` — Profile page with badges/settings
- [ ] `client-offline-indicator.png` — Offline mode banner

**Placement**:
| Screenshot | Target docs |
|-----------|-------------|
| client-garden-home | gardener/joining-a-garden, community/how-it-works |
| client-action-list | gardener/joining-a-garden |
| client-mdr-media/details/review | gardener/uploading-your-work |
| client-work-success | gardener/track-status-and-attestations |
| client-profile | builders/packages/client |
| client-offline-indicator | gardener/offline-sync-and-drafts |

### 8.2 Admin Dashboard Screenshots (desktop 1280×800)
Capture from localhost:3002 (user is logged in):
- [x] `admin-create-garden.png` — Garden creation form
- [x] `admin-create-action.png` — Action creation form
- [x] `admin-work-detail.png` — Single work submission review view
- [ ] `admin-create-assessment.png` — Assessment creation form
- [ ] `admin-hypercerts.png` — Hypercert minting interface
- [ ] `admin-vault-manage.png` — Vault deposit/withdraw modal

**Placement**:
| Screenshot | Target docs |
|-----------|-------------|
| admin-create-garden | operator/creating-a-garden |
| admin-create-action | operator/managing-actions |
| admin-work-detail | operator/reviewing-work |
| admin-create-assessment | operator/making-an-assessment |
| admin-hypercerts | operator/creating-impact-certificates |
| admin-vault-manage | operator/managing-endowments |

---

## Phase 9: Integration Page Content

Fill 12 stub pages (23 lines each → full content).
Template: Why We Love [X] → Product Use Cases → How We Integrate → Resources.

### Priority (by codebase usage depth):
- [ ] `hats.mdx` — Core RBAC, deeply integrated (HatsModule, hat tree, 6 roles)
- [ ] `hypercerts.mdx` — Impact certificates (mint, marketplace, fractions)
- [ ] `octant.mdx` — Vault infrastructure (Yearn V3, yield splitting, strategies)
- [ ] `tokenbound.mdx` — ERC-6551 garden accounts (GardenAccount.sol)
- [ ] `passkey.mdx` — WebAuthn smart accounts (P256, account abstraction)
- [ ] `gardens.mdx` — Gardens V2 conviction voting (signal pools, strategies)
- [ ] `karma.mdx` — Karma GAP impact reporting (attestation aggregation)
- [ ] `ens.mdx` — ENS resolution for gardens (auto-wiring in deploy)
- [ ] `cookie-jar.mdx` — Cookie Jar petty cash (stacked jars, claim limits)
- [ ] `greenwill.mdx` — Planned integration (stub OK for now)
- [ ] `unlock.mdx` — Planned integration (stub OK for now)
- [ ] `silvi.mdx` — Planned integration (stub OK for now)

Source: Read actual integration code from packages/, write docs grounded
in real implementation. Never speculate about code you haven't opened.

---

## Phase 10: Gardener Guide Enrichment

After Phase 8 screenshots, enrich the 4 mobile-UI guides:

- [ ] `uploading-your-work.mdx` — Add MDR walkthrough with 3 screenshots,
      expand StepFlow with field-level detail
- [ ] `offline-sync-and-drafts.mdx` — Add offline indicator screenshot,
      explain IndexedDB draft persistence, background sync queue
- [ ] `track-status-and-attestations.mdx` — Add work status screenshot,
      explain attestation chain verification flow
- [ ] `common-errors.mdx` — Add error state screenshots, expand
      troubleshooting steps with actual error messages from codebase

---

## Phase 11: Quick-Win Mermaid Additions (no dependencies)

15 pages that need only Mermaid diagrams (no screenshots):

### 11.1 Quality & CI Pages
- [x] `gh-actions.mdx` — CI pipeline workflow diagram
- [x] `husky.mdx` — Pre-commit hook flow diagram
- [x] `test-cases.mdx` — Test coverage matrix diagram
- [x] `regression.mdx` — Regression test decision flow
- [x] `agentic-eval.mdx` — Evaluation pipeline diagram

### 11.2 Spec Pages
- [x] `v1-0.mdx` — System architecture + module dependency graph
- [x] `v0-4.mdx` — Feature comparison table vs v0.1
- [x] `v0-1.mdx` — Original architecture diagram

### 11.3 Evaluator Reference Pages
- [x] `query-eas.mdx` — EAS query flow diagram
- [x] `query-indexer.mdx` — GraphQL query example with response
- [x] `cross-framework-mapping.mdx` — Mapping table diagram
- [x] `export-and-analysis.mdx` — Export pipeline diagram
- [x] `troubleshooting.mdx` — Common error flow diagram

### 11.4 Remaining Community Pages
- [x] `funder-guide/earning-recognition.mdx` — Badge earning flow
- [x] `funder-guide/funding-a-garden.mdx` — Funding decision flow

---

## Priority Matrix

| Phase | Impact | Effort | Dependency | Quick Win? |
|-------|--------|--------|------------|------------|
| **8** Authenticated screenshots | **High** | Medium | User's Chrome sessions | No |
| **9** Integration content | **High** | High | Codebase research | No |
| **10** Gardener guide enrichment | **High** | Low | Phase 8 screenshots | No |
| **11** Mermaid additions | Medium | **Low** | None | **Yes** |

**Recommended execution order**:
1. Phase 11 (quick wins — Mermaid only, no dependencies)
2. Phase 8 (authenticated screenshots via Chrome)
3. Phase 10 (gardener enrichment, needs Phase 8)
4. Phase 9 (integration content — biggest effort, can parallelize)

---

## Verification Checklist

- [x] Zero IMAGE PLACEHOLDER comments remaining
- [x] All 15 screenshot references resolve to existing files
- [x] `bun run build` passes (Node 22)
- [x] Phase 8: 6 authenticated screenshots captured and placed (3 client + 3 admin)
- [ ] Phase 9: All integration stubs replaced with full content
- [ ] Phase 10: All gardener guides enriched with screenshots + detail
- [x] Phase 11: All 15 pages get Mermaid diagrams
- [ ] Final: 0 pages with no visual content (excluding reference pages)
