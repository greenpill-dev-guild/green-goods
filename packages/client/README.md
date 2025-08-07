# Green Goods Client

This package contains the frontend application for Green Goods, a Progressive Web App (PWA) designed to revolutionize biodiversity conservation. It enables Garden Operators and Gardeners to document and get approval for conservation work, interact with blockchain components for attestations, and view impact data.

## Getting Started

This section assumes you have already set up the main Green Goods project as outlined in the [root README.md](../../README.md).

### Prerequisites

- Ensure Node.js (version 20 or higher) and pnpm are installed.
- The main project dependencies should be installed by running `pnpm install` in the root directory.

### Environment Variables

Client-specific environment variables are managed in a `.env` file within the `packages/client` directory.

1.  **Copy the example file:**
    ```bash
    cp .env.example .env
    ```
2.  **Populate the variables:**
    You will need to populate this file with necessary API keys and configuration values. Key variables include:

    - `VITE_PRIVY_APP_ID`: Your Privy application ID for authentication.
    - `VITE_WALLETCONNECT_PROJECT_ID`: Your WalletConnect project ID.
    - `VITE_PINATA_GATEWAY_URL`: URL for your Pinata IPFS gateway.
    - `VITE_PINATA_API_URL`: Pinata API endpoint for file uploads.
    - `VITE_PINATA_API_KEY`: Your Pinata API key.
    - `VITE_DESKTOP_DEV`: Set to bypass PWA download checks during desktop development.

    _Refer to the main project's [README.md](../../README.md#configure-environment-variables) for guidance on obtaining these values, typically by reaching out to the Green Goods team._

## Development

To run the client application in a local development environment:

1.  **Navigate to the client directory (if not already there):**

    ```bash
    cd packages/client
    ```

    _(Note: If you are in the root directory, you can often run client scripts directly using pnpm's workspace features, e.g., `pnpm --filter client dev`)_

2.  **Start the development server:**
    ```bash
    pnpm run dev
    ```

    **Alternative development server (experimental):**
    ```bash
    pnpm run dev:rolldown
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
pnpm run format

# Run linting (ultra-fast)
pnpm run lint

# The lint command runs both Biome checks and 0xlint
```

**Testing Commands:**
```bash
# Run tests once
pnpm run test

# Run tests in watch mode (for interactive development)
pnpm run test:watch

# Generate test coverage report
pnpm run coverage
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
4. Run `pnpm install` to ensure dependencies

**Development server issues:**
```bash
# Check if port 3001 is in use
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
- Use `pnpm run build` to check production bundle size
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
pnpm run build
pnpm run preview
```
- Tests production build locally
- Mimics production environment
- Useful for final testing before deployment

## Building for Production

The client supports dual build systems for different use cases:

### Production Build (Recommended)
```bash
pnpm run build
```
- **Optimized**: Full Vite optimization with code splitting
- **Bundle Size**: ~4.4MB main bundle with dynamic imports
- **Features**: PWA support, optimal chunking, production-ready

### Experimental Build
```bash
pnpm run build:rolldown
```
- **Purpose**: Testing next-generation Rolldown bundling
- **Performance**: Similar output with experimental Rust-based bundling
- **Status**: Based on Vite's Rolldown integration

Both commands will compile TypeScript, bundle the application, and output static assets to the `dist` directory, ready for deployment.

## Testing

The client application uses [Vitest](https://vitest.dev/) for unit and integration testing.

- **Run tests once:**
  ```bash
  pnpm run test
  ```

- **Run tests in watch mode (for interactive development):**
  ```bash
  pnpm run test:watch
  ```

- **Generate test coverage report:**
  ```bash
  pnpm run coverage
  ```

## Code Quality and Formatting

The project uses a high-performance linting setup:

- **Format code:**
  ```bash
  pnpm run format
  ```

- **Run linting (ultra-fast):**
  ```bash
  pnpm run lint
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
- **[Wagmi](https://wagmi.sh/):** React hooks for Ethereum

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
  - `job-processor.ts`: Background job processing logic
  - `media-resource-manager.ts`: Media file handling and compression
  - `sync-manager.ts`: Online/offline synchronization management
  - `processors/`: Specific job processors for work and approval submissions

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
pnpm run build
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