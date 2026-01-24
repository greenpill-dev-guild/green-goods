# Client Package (PWA)

> **Audience:** Frontend engineers working on `packages/client`.
> **Related docs:** [Monorepo Structure](monorepo-structure), [packages/client/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/client#readme)
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data: `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** Offline data patterns mirror the [TanStack Query offline guide](https://tanstack.com/query/latest/docs/framework/react/guides/examples/offline); review it when adjusting persistence.

Offline-first Progressive Web App for gardeners to document regenerative work.

---

## Quick Reference

**Path**: `packages/client/`
**Port**: https://localhost:3001 (HTTPS via mkcert)
**Stack**: React 19 + TypeScript + Vite

**Commands**:
```bash
bun --filter client dev      # Start dev server
bun --filter client test     # Run tests
bun --filter client build    # Production build
```

---

## Tech Stack

### Core
- React 19 (lazy loading)
- TypeScript (strict mode)
- Vite (bundler)
- React Router

### State Management
- TanStack Query (server state)
- Zustand (UI state)
- React Hook Form (forms)

### UI
- Tailwind CSS v4
- Radix UI primitives
- CSS variables theme

### Web3
- Viem (Ethereum)
- Pimlico (smart accounts)
- Reown AppKit (wallet connect)
- EAS SDK (attestations)

### Storage
- IndexedDB (offline queue)
- Service Worker (PWA)
- IPFS (via Storacha)

---

## Key Features

### Offline-First

**Job Queue System**:
- Queues work when offline
- Auto-syncs when online
- Event-driven updates
- Exponential backoff retry

**Implementation**:
- `src/modules/job-queue/`
- `src/providers/jobQueue.tsx`

### Dual Authentication

**Passkey Mode** (gardeners):
- WebAuthn biometric
- Kernel smart accounts
- Pimlico gasless transactions

**Wallet Mode** (operators):
- MetaMask, WalletConnect
- Traditional EOA
- Direct transactions

**Implementation**:
- `src/providers/auth.tsx`
- `src/modules/auth/passkey.ts`

### MDR Workflow

**Media → Details → Review**:
- Camera integration
- Form validation
- Preview before submit
- IPFS upload

**Implementation**:
- `src/views/Garden/index.tsx`
- `src/components/Garden/`

---

## Architecture Highlights

### Offline Job Queue

```typescript
// Submission flow
submitWork() 
  → addJob(IndexedDB)
  → processJob (if online)
  → uploadIPFS()
  → createAttestation()
  → transaction sent
```

### Provider Hierarchy

```tsx
<WagmiProvider>
  <AppProvider>
    <AuthProvider>
      <QueryClientProvider>
        <JobQueueProvider>
          <WorkProvider>
            <Routes />
```

**Order matters**: Each depends on ancestors.

---

## Performance

**Bundle Size**:
- Main: ~4.4 MB (offline-first = larger)
- Lazy chunks: 0.3-66 KB

**Optimization**:
- Dynamic imports for views
- Image compression
- Code splitting
- Service worker caching

---

## Complete Documentation

**📖 Full details**: [packages/client/README.md](https://github.com/greenpill-dev-guild/green-goods/tree/main/packages/client#readme)

**Key Files**:
- Patterns and conventions: `.claude/context/client.md`

