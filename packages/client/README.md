# Green Goods Client

This package contains the frontend application for Green Goods, a Progressive Web App (PWA) designed to revolutionize community impact reporting. It enables Garden Operators and Gardeners to document and get approval for community actions, interact with blockchain components for attestations, and view impact data.

## Getting Started

This section assumes you have already set up the main Green Goods project as outlined in the [root README.md](../../README.md).

### Prerequisites

- Ensure Node.js (version 20 or higher) and bun are installed.
- The main project dependencies should be installed by running `bun install` in the root directory.

### Environment Variables

**All environment variables are configured in the root `.env` file** (at the monorepo root, not in this package).

The root `.env` file is automatically loaded by:
- Vite development server (via `vite.config.ts`)
- Build scripts
- All package scripts

**Client-relevant environment variables:**

- `VITE_WALLETCONNECT_PROJECT_ID`: **Required** - Reown AppKit project ID for wallet connections (get from [cloud.reown.com](https://cloud.reown.com/))
- `VITE_PIMLICO_API_KEY`: **Required** - Pimlico API key for passkey smart accounts (get from [pimlico.io](https://pimlico.io))
- `VITE_APP_URL`: Application URL for AppKit metadata (e.g., `https://greengoods.app` or `http://localhost:3001` for dev)
- `VITE_PINATA_JWT`: Pinata JWT token for uploads (client-side)
- `VITE_CHAIN_ID`: Chain selection (e.g., 42161 for Arbitrum, 84532 for Base Sepolia)
- `VITE_ENVIO_INDEXER_URL`: Envio GraphQL endpoint (optional; defaults to localhost in dev)
- `VITE_DESKTOP_DEV`: Set to bypass PWA download checks during desktop development
- `VITE_DEBUG_MODE`: Optional toggle to skip the two-media requirement in the Garden submission flow and enable verbose debug logging (use for manual testing only)
- `VITE_PRIVY_APP_ID`: **Deprecated** - Legacy Privy authentication (being migrated away)

**Setup:**
1. Copy the root `.env.example` to `.env` at the project root
2. Get your WalletConnect Project ID from [cloud.reown.com](https://cloud.reown.com/)
3. Get your Pimlico API key from [pimlico.io](https://pimlico.io)
4. Add the required environment variables to your `.env` file
5. Variables are automatically loaded when running `bun dev` from root or package directory

**Authentication Setup:**
Green Goods uses a dual authentication strategy:
- **Passkey (Primary)**: WebAuthn biometric authentication via Pimlico smart accounts - recommended for gardeners
- **Wallet (Fallback)**: Traditional wallet connection via AppKit - for operators who prefer EOA control

_Refer to the main project's [README.md](../../README.md#configure-environment-variables) for complete environment setup instructions._

## Development

To run the client application in a local development environment:

1.  **Navigate to the client directory (if not already there):**

    ```bash
    cd packages/client
    ```

    _(Note: If you are in the root directory, you can often run client scripts directly using bun's workspace features, e.g., `bun --filter client dev`)_

2.  **Start the development server:**
    ```bash
    bun run dev
    ```

    **Alternative development server (experimental):**
    ```bash
    bun run dev:rolldown
    ```

The application should typically be accessible at `https://localhost:3001` (note: HTTPS due to mkcert plugin for PWA features). The Vite server will provide live reloading and HMR (Hot Module Replacement).

### Development Setup

**VS Code Configuration:**
The project includes pre-configured VS Code settings that:
- Set Biome as the default formatter for JS/TS files
- Enable format on save
- Configure automatic import organization
- Set up proper formatters for different file types

**Required VS Code Extensions:**
1. **Biome** (`biomejs.biome`) - Primary formatting and linting
2. **Error Lens** (`usernamehw.errorlens`) - Inline error display
3. **GitLens** (`eamodio.gitlens`) - Git integration

**Code Quality Tools:**
- **Biome**: Fast formatting and basic linting (35x faster than Prettier)
- **0xlint**: Ultra-fast Rust-based linting (30ms on entire codebase)
- **TypeScript**: Strict type checking with excellent IDE integration
- **Husky**: Automated git hooks for quality checks

### Development Workflow

**Hot Module Replacement (HMR):**
Vite provides instant HMR for:
- React component updates
- CSS changes
- TypeScript compilation
- Asset updates

**Code Quality Commands:**
```bash
# Format code
bun run format

# Run linting (ultra-fast)
bun run lint

# The lint command runs both Biome checks and 0xlint
```

**Testing Commands:**
```bash
# Run tests once
bun run test

# Run tests in watch mode (for interactive development)
bun run test:watch

# Generate test coverage report
bun run coverage
```

**Component Development Workflow:**
1. Create component directory: `src/components/YourComponent/`
2. Add main component file: `index.tsx`
3. Add test file: `__tests__/index.test.tsx`
4. Use existing design system components from `src/components/UI/`
5. Follow Tailwind CSS + Radix UI patterns

**PWA Development:**
For PWA testing:
- Use `VITE_DESKTOP_DEV=true` to bypass installation prompts during development
- Test on mobile devices for full PWA experience
- Use browser dev tools for PWA auditing and performance testing

**Performance Monitoring:**
- **React DevTools**: For component debugging and profiling
- **TanStack Query DevTools**: For server state inspection and caching analysis
- **Vite DevTools**: For build analysis and optimization
- **Browser DevTools**: For performance profiling and Core Web Vitals

### Configuration Files

**Biome Configuration (`biome.json`):**
- React/TypeScript specific rules
- Optimized for component development
- Automatic import organization

**Key Development Settings:**
- **Line width**: 100 characters
- **Indentation**: 2 spaces
- **Quotes**: Double quotes
- **Semicolons**: Always
- **Trailing commas**: ES5 style

### Troubleshooting

**Common Development Issues:**

**Biome not working:**
1. Restart VS Code
2. Check Biome extension is enabled
3. Verify `node_modules/.bin/biome` exists
4. Run `bun install` to ensure dependencies

**Development server issues:**
```bash
# Check if port 3001 is in use (dev server runs on HTTPS)
lsof -i :3001

# Kill process if needed
pkill -f "client dev"

# Clear Vite cache
rm -rf node_modules/.vite
```

**PWA installation issues:**
- Ensure you're using HTTPS (mkcert handles this automatically)
- Check service worker registration in browser dev tools
- Verify PWA manifest is correctly generated

**Performance issues:**
- Use `bun run build` to check production bundle size
- Enable React DevTools Profiler for component performance
- Check Network tab for slow API calls or large assets

### Environment-Specific Development

**Development Environment:**
- Hot reloading enabled
- Source maps for debugging
- Development-specific error boundaries
- Mock data support (if configured)

**Production Preview:**
```bash
bun run build
bun run preview
```
- Tests production build locally
- Mimics production environment
- Useful for final testing before deployment

## Building for Production

The client supports dual build systems for different use cases:

### Production Build (Recommended)
```bash
bun run build
```
- **Optimized**: Full Vite optimization with code splitting
- **Bundle Size**: ~4.4MB main bundle with dynamic imports
- **Features**: PWA support, optimal chunking, production-ready

### Experimental Build
```bash
bun run build:rolldown
```
- **Purpose**: Testing next-generation Rolldown bundling
- **Performance**: Similar output with experimental Rust-based bundling
- **Status**: Based on Vite's Rolldown integration

Both commands will compile TypeScript, bundle the application, and output static assets to the `dist` directory, ready for deployment.

## Testing

The client application uses [Vitest](https://vitest.dev/) for unit/integration testing and Playwright for E2E.

- **Run tests once:**
  ```bash
  bun run test
  ```

- **Run tests in watch mode (for interactive development):**
  ```bash
  bun run test:watch
  ```

- **Generate test coverage report:**
  ```bash
  bun run coverage
  ```

## Code Quality and Formatting

The project uses a high-performance linting setup:

- **Format code:**
  ```bash
  bun run format
  ```

- **Run linting (ultra-fast):**
  ```bash
  bun run lint
  ```

The `lint` command runs both Biome checks and 0xlint to ensure code quality and consistency in milliseconds.

**Tools Used:**
- **Biome**: Fast formatting and basic checks
- **0xlint**: Ultra-fast Rust-based linting (30ms on 84 files)
- **Combined**: Complete code quality coverage

## Key Technologies

The client application is built with a modern frontend stack:

### Core Framework
- **[React](https://react.dev/):** UI library with lazy loading for optimal performance
- **[Vite](https://vitejs.dev/):** Fast build tool with experimental Rolldown support
- **[TypeScript](https://www.typescriptlang.org/):** Static typing for better development experience

### Styling & UI
- **[Tailwind CSS v4](https://tailwindcss.com/):** Utility-first CSS framework with modern features
  - Includes `tailwind-merge` and `tailwind-variants` for managing styles
- **[Radix UI](https://www.radix-ui.com/):** Unstyled, accessible UI primitives
  - Components: Accordion, Avatar, Dialog, Select, Slot, Tabs

### State Management & Data
- **[TanStack Query (React Query)](https://tanstack.com/query/latest):** Server-state management and caching
- **[GQL.tada](https://gql-tada.0no.co/):** Type-safe GraphQL queries
- **[React Hook Form](https://react-hook-form.com/):** Form validation and management

### Authentication & Blockchain
- **[Privy](https://www.privy.io/):** User authentication and wallet management
- **[EAS SDK](https://github.com/ethereum-attestation-service/eas-sdk):** Ethereum Attestation Service integration
- **[Viem](https://viem.sh/):** Type-safe Ethereum client

### Development & Quality
- **[Vitest](https://vitest.dev/):** Vite-native testing framework
- **[Biome](https://biomejs.dev/):** Fast formatting and linting
- **[0xlint](https://oxc-project.github.io/):** Ultra-fast Rust-based linting
- **[PWA Features](https://vite-pwa-org.netlify.app/):** Progressive Web App capabilities

### Performance Optimizations
- **Dynamic Imports**: Lazy loading for major components (Home, Garden, Profile views)
- **Code Splitting**: Automatic chunking for optimal loading
- **Bundle Optimization**: ~4.4MB main bundle with separate feature chunks
  - `Assessment-*.js` (0.36 kB) - Assessment component
  - `Garden-*.js` (10.81 kB) - Garden component  
  - `WorkApproval-*.js` (66.11 kB) - Work approval component

## Architecture & Features

### Component Library
The application uses a comprehensive design system built with:
- **Tailwind CSS v4**: Modern utility-first styling with CSS variables
- **Radix UI primitives**: Accessible, unstyled components
- **Custom components**: Button, Card variants (ActionCard, GardenCard, WorkCard), Form components, Navigation, etc.

### Progressive Web App (PWA)
- **Offline Support**: Service worker for offline functionality
- **Mobile Optimization**: Responsive design with mobile-first approach
- **Installation**: Can be installed as a native app on mobile devices
- **HTTPS Required**: Development server uses mkcert for HTTPS

### Routing & Navigation
- **React Router**: Client-side routing with lazy-loaded components
- **Dynamic routing**: `/home`, `/garden/:id`, `/profile`, `/login`
- **Navigation hooks**: Custom `useNavigateToTop` for smooth navigation

### Work Flow Management
- **Multi-step Forms**: Garden assessment, work submission, approval workflows
- **State Management**: React Query for server state, React Hook Form for forms
- **Real-time Updates**: GraphQL subscriptions for live data updates

### Dual Authentication & Submission Paths

Green Goods supports two distinct authentication modes with optimized submission workflows:

**Passkey Mode (Gardeners):**
- **Authentication**: WebAuthn biometric authentication (Face ID, Touch ID, fingerprint)
- **Accounts**: Kernel smart accounts via Pimlico
- **Submission**: Offline-first job queue with automatic sync
- **Gas**: Sponsored transactions (gasless for users)
- **Target Users**: Mobile-first gardeners who need offline support

**Wallet Mode (Operators):**
- **Authentication**: Traditional wallet connection (MetaMask, WalletConnect, Coinbase Wallet)
- **Accounts**: Standard EOA (Externally Owned Accounts)
- **Submission**: Direct blockchain transactions (bypasses job queue)
- **Gas**: User pays gas fees
- **Target Users**: Operators and admins who prefer traditional web3 UX

**Implementation Files:**
- Direct wallet submission: `src/modules/work/wallet-submission.ts`
- Job queue submission: `src/modules/work/work-submission.ts`
- Unified hooks: `src/hooks/work/useWorkApproval.ts`
- Provider branching: `src/providers/work.tsx`
- Future integration path: `docs/WALLET_QUEUE_INTEGRATION.md`

The system automatically branches based on `authMode` from the authentication provider, ensuring each user type gets an optimized experience.

### Schema Integration

The client integrates with EAS (Ethereum Attestation Service) using versioned schemas for future-proof attestation encoding.

**V2 Schema Encoding:**
```typescript
// Work attestations include version field
const SCHEMA_VERSION_V2 = 2;

encodeWorkData([
  { name: "version", value: SCHEMA_VERSION_V2, type: "uint8" },
  { name: "actionUID", value: actionUID, type: "uint256" },
  { name: "title", value: title, type: "string" },
  // ... other fields
]);
```

**Key Features:**
- **Version field**: All attestations include schema version for backward compatibility
- **Automatic encoding**: `src/utils/eas/encoders.ts` handles V2 encoding
- **Schema UIDs**: Retrieved from deployment JSON files
- **Backward compatible**: Frontend can decode both V1 and V2 attestations

**Schema Configuration:**
- Schema UIDs loaded from contract deployment artifacts
- Version detection for proper decoding
- Support for gradual V1 → V2 migration

See `docs/UPGRADES.md` for schema versioning strategy.

## Project Structure Highlights

The `packages/client/src` directory is organized as follows:

### Core Application Files
- **`main.tsx`**: The main entry point that initializes React, providers, and PWA features
- **`App.tsx`**: Root component with dynamic imports, error boundaries, and global providers
- **`config.ts`**: Configuration management for API endpoints, chains, and feature flags

### Hooks (`hooks/`)
Centralized React hooks for shared functionality:
- **`index.ts`**: Central export file for all hooks
- **`useChainConfig.ts`**: Chain configuration hooks (useCurrentChain, useEASConfig, useNetworkConfig, useChainConfig)
- **`useDebounced.ts`**: Debouncing utilities (useDebounced, useDebouncedValue)
- **`useNavigateToTop.ts`**: Navigation helper for smooth top scrolling
- **`useOffline.ts`**: Offline state management and sync status detection
- **`useStorageManager.ts`**: Local storage management and cleanup utilities
- **`useWorks.ts`**: Work data management, job queue integration, and pending work tracking
- **`query-keys.ts`**: Centralized query key definitions for React Query

### Modules (`modules/`)
Service layer and business logic:
- **`deduplication.ts`**: Data deduplication utilities for efficient storage
- **`eas.ts`**: Ethereum Attestation Service integration and schema management
- **`graphql.ts`**: GraphQL client configuration and type definitions
- **`greengoods.ts`**: Green Goods API integration for gardens, actions, and gardeners
- **`pinata.ts`**: IPFS file upload service for media storage
- **`posthog.ts`**: Analytics and user behavior tracking
- **`react-query.ts`**: Query client configuration with offline support
- **`retry-policy.ts`**: Network retry logic for failed requests
- **`service-worker.ts`**: Service worker registration and PWA functionality
- **`storage-manager.ts`**: Advanced local storage management with cleanup
- **`urql.ts`**: Alternative GraphQL client configuration
- **`work-submission.ts`**: Work and approval submission utilities with validation
- **`job-queue/`**: Offline-first job processing system
  - `index.ts`: Main job queue interface and configuration
  - `db.ts`: IndexedDB integration for persistent storage
  - `event-bus.ts`: Event-driven communication for job updates
  - `media-resource-manager.ts`: Media file handling and cleanup helpers

### Components (`components/`)
Reusable UI components organized by scope:
- **`Garden/`**: Garden-specific components (Work submission, assessment forms)
- **`Layout/`**: Navigation and layout components (AppBar, TopNav, etc.)
- **`UI/`**: Generic design system components
  - `Button/`: Button variants and loading states
  - `Card/`: ActionCard, GardenCard, WorkCard components
  - `ErrorBoundary/`: Error handling and fallback UI
  - `Form/`: Form inputs, validation, and accessibility
  - `TopNav/`: Navigation with offline indicators
  - `WorkDashboard/`: Work management interface

### Views (`views/`)
Main application pages with lazy loading:
- **`Home/`**: Garden management dashboard
  - `index.tsx`: Main home view with garden overview
  - `Assessment.tsx`: Garden assessment workflow
  - `Garden.tsx`: Garden list and selection
  - `Notifications.tsx`: User notifications and alerts
  - `WorkApproval.tsx`: Work approval interface for garden operators
- **`Garden/`**: Garden details and work submission
  - `index.tsx`: Garden detail view
  - `Completed.tsx`: Completed work display
  - `Details.tsx`: Garden information and statistics
  - `Intro.tsx`: Garden onboarding flow
  - `Media.tsx`: Media upload and management
  - `Review.tsx`: Work review and submission
- **`Profile/`**: User account management
  - `index.tsx`: Profile overview
  - `Account.tsx`: Account settings and wallet management
  - `Help.tsx`: Help documentation and support
- **`Landing/`**: Public landing page for unauthenticated users
- **`Login/`**: Authentication flow with Privy integration

### Providers (`providers/`)
React context providers for global state:
- **`app.tsx`**: Global application state (platform detection, theme, settings)
- **`garden.tsx`**: Garden-specific state (current garden, actions, gardeners)
- **`jobQueue.tsx`**: Job queue state management and event handling
- **`user.tsx`**: User authentication state and wallet management
- **`work.tsx`**: Work submission state and form management

### Utilities (`utils/`)
Helper functions and utilities:
- **`abis/`**: Smart contract ABIs for blockchain interactions
- **`cn.ts`**: Class name utility using tailwind-merge for conditional styling
- **`eas.ts`**: EAS utility functions for attestation creation and verification
- **`image-compression.ts`**: Image optimization and compression utilities
- **`constants/`**: Application constants and configuration values
- **`forms/`**: Form validation and helper utilities
- **`text/`**: Text processing and formatting utilities

### Styles (`styles/`)
Styling and design system:
- **`animation.css`**: Custom CSS animations and keyframes (dot-fade, accordion, spring-bump, slide effects)
- **`globals.css`**: Global styles and CSS reset
- **`index.css`**: Main stylesheet with Tailwind imports
- **`variables.css`**: CSS custom properties and design tokens

### Types (`types/`)
TypeScript type definitions:
- **`api.ts`**: API response and request types
- **`auth.ts`**: Authentication and user types
- **`garden.ts`**: Garden-related type definitions
- **`index.ts`**: Centralized type exports
- **`job.ts`**: Job queue and work submission types
- **`storage.ts`**: Storage and caching types
- **`work.ts`**: Work and approval type definitions

### Internationalization (`i18n/`)
Multi-language support:
- **`en.json`**: English translations
- **`es.json`**: Spanish translations
- **`pt.json`**: Portuguese translations

### Testing (`__tests__/`)
Comprehensive test suite:
- **`components/`**: Component unit tests
- **`hooks/`**: Hook testing with custom render utilities
- **`integration/`**: Integration tests for workflows
- **`modules/`**: Service layer tests
- **`providers/`**: Context provider tests
- **`utils/`**: Utility function tests
- **`setupTests.ts`**: Test environment configuration

## Development Tips

### Hot Module Replacement (HMR)
Vite provides instant HMR for:
- React component updates
- CSS changes
- TypeScript compilation
- Asset updates

### Code Quality
The project enforces high code quality through:
- **Pre-commit hooks**: Automatic formatting and linting
- **Type checking**: Strict TypeScript configuration
- **Testing**: Comprehensive test coverage with Vitest
- **Performance monitoring**: Bundle analysis and optimization

### PWA Development
For PWA testing:
- Use `VITE_DESKTOP_DEV=true` to bypass installation prompts
- Test on mobile devices for full PWA experience
- Use browser dev tools for PWA auditing

### Debugging
- **React DevTools**: For component debugging
- **TanStack Query DevTools**: For server state inspection
- **Vite DevTools**: For build analysis
- **Browser DevTools**: For performance profiling

## Deployment

The client is optimized for static hosting:

### Build Output
```bash
bun run build
```
Produces:
- Static HTML, CSS, JS files in `dist/`
- Service worker for PWA functionality
- Optimized assets with cache headers
- Source maps for debugging

### Deployment Targets
- **Vercel**: Zero-config deployment
- **Netlify**: Static site hosting
- **Railway**: Full-stack deployment
- **Any CDN**: Standard static hosting

### Environment Configuration
Production deployments require:
- Environment variables for API endpoints
- HTTPS for PWA functionality
- Proper CORS configuration for API access

For detailed deployment instructions, see the [main project README](../../README.md).
