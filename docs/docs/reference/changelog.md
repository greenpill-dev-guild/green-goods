# Changelog / Release Notes

Major updates and feature releases for Green Goods.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## 2026

### v0.4.0 - January 2026 🎉

**First Official Release**

This is the first official release of Green Goods — an offline-first platform for documenting conservation work and proving impact on-chain.

**Release Stats:**
- 765 files changed
- ~42,000 lines added, ~33,000 lines removed
- 8 packages unified at version 0.4.0

---

#### ✨ Highlights

**Offline-First Architecture**
- ✅ Complete offline support with IndexedDB-backed job queue
- ✅ Draft management system with local persistence
- ✅ Optimistic UI updates for work submissions and approvals
- ✅ Service worker with intelligent caching strategies
- ✅ Automatic sync when connectivity is restored

**Passkey Authentication (WebAuthn)**
- ✅ Pimlico passkey server integration replacing Privy
- ✅ Android and iOS WebAuthn compatibility improvements
- ✅ Unified Auth state machine (XState) consolidating all auth flows
- ✅ Wallet fallback via Reown AppKit for advanced users

**Comprehensive E2E Testing**
- ✅ 9 new Playwright test suites with 83% pass rate
- ✅ Client: auth, navigation, smoke, offline-sync, work-submission, work-approval
- ✅ Admin: auth, smoke
- ✅ Performance benchmarks and regression tests

---

#### 📦 Package Changes

<details>
<summary><strong>@green-goods/client (PWA)</strong></summary>

**Added:**
- `useDrafts` hook — local draft persistence with IndexedDB
- `OfflineIndicator` component — real-time connectivity status
- `DraftDialog` / `DraftCard` — draft management UI
- View transitions API integration for smooth navigation
- Loading timeout and retry mechanism for resilient connectivity
- Debug mode functionality (`?debug=true`)

**Changed:**
- `WorkDashboard` — new tabbed interface (Drafts, Pending, Completed, Uploading)
- `Login` view — redesigned with passkey-first flow
- `TopNav` — operator-specific functionality and media upload improvements
- `ImagePreviewDialog` — enhanced gallery with swipe gestures
- Form components — improved accessibility with proper ARIA labels
- All card components refactored for consistency

**Infrastructure:**
- Vite 7.3 with React Compiler (babel-plugin-react-compiler)
- Workbox PWA with optimized caching strategies
- PostHog analytics integration

</details>

<details>
<summary><strong>@green-goods/admin (Operator Dashboard)</strong></summary>

**Added:**
- `RequireOperatorOrDeployer` route guard with role-based access
- Work approval UI with optimistic status updates
- Dynamic feedback indicators for pending operations

**Changed:**
- Action configuration sections (Details, Media, Review) — enhanced forms
- `MembersModal` — improved invite management
- `StepIndicator` — better visual feedback
- Package renamed from `admin` to `@green-goods/admin`

**Removed:**
- Legacy integration tests (replaced with E2E)
- URQL mock utilities (migrated to MSW)

</details>

<details>
<summary><strong>@green-goods/shared (Common Code)</strong></summary>

**Added:**
- `graphql-client.ts` — new GraphQL client with timeout and retry
- `draft-db.ts` — IndexedDB schema for draft persistence
- `compression.ts` — image compression utilities
- `scheduler.ts` — task scheduling with priorities
- `analytics-events.ts` — standardized event tracking
- `query-keys.ts` — centralized React Query key management
- `domain.ts`, `job-queue.ts`, `offline.ts`, `temporal.d.ts` — new type definitions
- `useUserWithEns` hook — ENS resolution for user addresses
- `useAutoJoinRootGarden` — automatic garden membership

**Changed:**
- `useWorkApproval` — complete rewrite with optimistic updates
- `useWorkMutation` — enhanced error handling and retry logic
- `wallet-submission.ts` — major refactor
- `time.ts` — expanded time utilities
- `contract-errors.ts` — improved error recovery patterns
- `theme.css` — expanded design tokens
- i18n files — 113+ new translation keys per language

**Removed:**
- `urql.ts` — replaced with custom GraphQL client
- Legacy blockchain type definitions

</details>

<details>
<summary><strong>@green-goods/contracts (Solidity)</strong></summary>

**Changed:**
- `Garden.sol` — enhanced access control and membership logic
- `GreenGoods.sol` resolver — improved validation
- `WorkApproval.sol` — better status tracking
- All interfaces — stricter typing and NatSpec documentation
- Modules (Hats, Octant, Unlock) — cleaner integration patterns

**Infrastructure:**
- Foundry test improvements
- Deploy scripts with Envio integration
- Gas optimization in hot paths

</details>

<details>
<summary><strong>@green-goods/indexer (Envio GraphQL)</strong></summary>

**Changed:**
- Package renamed from `indexer` to `@green-goods/indexer`
- Optimized queries for common access patterns
- Improved entity relationships

</details>

<details>
<summary><strong>@green-goods/agent (Multi-Platform Bot)</strong></summary>

**Added:**
- `bunfig.toml` — test preload configuration
- Enhanced media service with Storacha/IPFS

**Changed:**
- Test setup improvements
- Handler context patterns

</details>

---

#### 🧪 Testing Infrastructure

**New E2E Test Suites (Playwright):**

| Suite | Focus |
|-------|-------|
| `client.auth.spec.ts` | Passkey + wallet auth flows |
| `client.navigation.spec.ts` | Route guards, deep linking |
| `client.offline-sync.spec.ts` | Offline queue, sync recovery |
| `client.smoke.spec.ts` | Critical path validation |
| `client.work-submission.spec.ts` | MDR workflow, drafts |
| `client.work-approval.spec.ts` | Operator approval flow |
| `admin.auth.spec.ts` | Operator authentication |
| `admin.smoke.spec.ts` | Dashboard functionality |
| `performance.spec.ts` | Load times, memory, FPS |

**Test Documentation:**
- `ARCHITECTURE.md` — 730-line test architecture guide
- `E2E_TEST_GUIDE.md` — step-by-step test writing
- `TESTING_GUIDE.md` — coverage targets and patterns

---

#### 📚 Documentation

**Migration:** GitBook → Docusaurus 3.9

**New Sections:**
- `/docs/developer/releasing.md` — release process guide
- `/docs/developer/cursor-workflows.md` — AI-assisted development
- `/docs/developer/n8n-automation.md` — workflow automation
- `/docs/developer/docs-contributing.md` — contribution guide
- `/docs/developer/docs-deployment.md` — deployment process
- `/docs/developer/architecture/diagrams.md` — Mermaid architecture diagrams
- `/docs/evaluators/` — evaluator guides

---

#### 🛠 Developer Experience

**Dev Containers:**
- Full `.devcontainer/` setup with Dockerfile
- Firewall initialization script
- Post-create automation
- VS Code workspace configuration

**Scripts:**
- `scripts/ci-local.js` — local CI simulation
- `scripts/fix-multiformats.js` — dependency patching
- `scripts/storacha-upload.js` — IPFS deployment helper
- `scripts/test-e2e.js` — E2E test runner with filtering

**CI/CD:**
- `.github/workflows/e2e-tests.yml` — comprehensive E2E pipeline
- `.github/workflows/deploy-docs.yml` — Docusaurus deployment
- `.github/workflows/deploy-ipfs.yml` — Storacha integration
- Shared Bun setup action

**Tooling:**
- `CLAUDE.md` — AI assistant context
- `AGENTS.md` — agent orchestration guide
- `.cursor/rules/` — 7 rule files for AI-assisted development

---

#### 🔧 Dependencies Updated

| Package | Version |
|---------|---------|
| React | 19.2.3 |
| TypeScript | 5.9.3 |
| Vite | 7.3.0 |
| Vitest | 4.0.16 |
| Playwright | 1.54.2 |
| Tailwind CSS | 4.1.11 |
| viem | 2.43.4 |
| wagmi | 2.19.5 |

**New Dependencies:**
- `@storacha/client` — IPFS storage
- `browser-image-compression` — client-side image optimization
- `posthog-js` / `posthog-node` — analytics
- `xstate` / `@xstate/react` — state machines
- `embla-carousel-react` — image galleries

**Removed:**
- `pnpm-lock.yaml` — consolidated to `bun.lock`
- Privy dependencies — replaced with Pimlico
- `@urql/core` — replaced with custom client

---

#### 📋 Migration Notes

**For Developers:**
1. Run `bun install` to update dependencies
2. Copy new `.env.example` entries (Storacha keys)
3. Update any URQL imports to use `graphql-client`
4. Test passkey flows on Android devices

**For Operators:**
- No breaking changes to attestation schemas
- Work approval UI has new optimistic behavior
- Dashboard requires Reown AppKit wallet connection

---

#### 🔗 Links

- **Documentation**: https://docs.greengoods.app
- **GitHub Release**: [v0.4.0](https://github.com/greenpill-dev-guild/green-goods/releases/tag/v0.4.0)
- **Testnet**: Sepolia (chain ID: 11155111)
- **Mainnets**: Arbitrum One, Celo

---

## 2024

### Q1 2024 - Initial Launch 🚀

**Core Platform**:
- ✅ Client PWA with offline support
- ✅ Admin dashboard for operators
- ✅ Passkey authentication (WebAuthn + Pimlico)
- ✅ MDR workflow (Media → Details → Review)
- ✅ EAS attestations for work and approvals
- ✅ Envio GraphQL indexer
- ✅ Smart contracts (Garden, Action, Resolvers)

**Deployments**:
- Sepolia testnet

### Q2 2024 - Multi-Chain Expansion 🌍

**Networks Added**:
- ✅ Arbitrum One (mainnet)
- ✅ Celo (mainnet)

**Features**:
- ✅ Karma GAP integration (automatic impact reporting)
- ✅ Dual authentication (passkey + wallet)
- ✅ Enhanced analytics dashboards
- ✅ Multi-language support (en, es, pt)
- ✅ Real-time GraphQL subscriptions
- ✅ Export capabilities (CSV/JSON)

**Improvements**:
- Performance optimizations
- Mobile UX refinements
- Operator workflow enhancements

### Q3 2024 - Analytics & Tooling 📊

**Delivered**:
- ✅ Advanced search and filtering
- ✅ Enhanced impact reports
- ✅ Garden templates
- 🚧 Hypercert integration (in progress)
- 🚧 Map view for gardens (in progress)
- 🚧 Batch operations (in progress)

### Q4 2024 - Impact Markets 💰

**Planned**:
- 🔮 Impact token minting
- 🔮 Marketplace integration
- 🔮 Retroactive funding tools
- 🔮 DAO governance features
- 🔮 Native mobile apps

---

## Breaking Changes

### None Yet

Green Goods maintains backward compatibility for all attestations and data structures.

**Future schema changes** will use version fields for graceful migration.

---

## Security Updates

### No CVEs Reported

Green Goods has had no security vulnerabilities reported to date.

**Report security issues**: security@greengoods.app (or via Telegram privately)

---

## Deprecations

### Privy → Pimlico Migration (Completed in v0.4.0) ✅

**Old**: Privy smart accounts  
**New**: Pimlico smart accounts with Kernel

**Status**: Migration completed. All users seamlessly transitioned.

---

## Upcoming Features

Track our roadmap:
- 📋 [GitHub Projects](https://github.com/greenpill-dev-guild/green-goods/projects)
- 📝 [GitHub Discussions](https://github.com/greenpill-dev-guild/green-goods/discussions)
- 📣 [Twitter](https://x.com/greengoodsapp)

---

## Release Notes Archive

**Detailed release notes**: [GitHub Releases](https://github.com/greenpill-dev-guild/green-goods/releases)

**Technical changelog**: [CHANGELOG.md](https://github.com/greenpill-dev-guild/green-goods/blob/main/CHANGELOG.md)

---

## Subscribe to Updates

- 📣 [Twitter](https://x.com/greengoodsapp)
- 💬 [Telegram](https://t.me/+N3o3_43iRec1Y2Jh)
- 📝 [Blog](https://paragraph.com/@greenpilldevguild)
