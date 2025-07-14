# Green Goods Client

This package contains the frontend application for Green Goods, a Progressive Web App (PWA) designed to revolutionize biodiversity conservation. It enables Garden Operators and Gardeners to document and get approval for conservation work, interact with blockchain components for attestations, and view impact data.

## Getting Started

This section assumes you have already set up the main Green Goods project as outlined in the [root README.md](../../README.md).

### Prerequisites

- Ensure Node.js (version 20 or higher) and pnpm are installed.
- The main project dependencies should be installed by running `pnpm init` in the root directory.

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

The `lint` command runs both Biome checks and Oxlint to ensure code quality and consistency in milliseconds.

**Tools Used:**
- **Biome**: Fast formatting and basic checks
- **Oxlint**: Ultra-fast Rust-based linting (30ms on 84 files)
- **Combined**: Complete code quality coverage

## Key Technologies

The client application is built with a modern frontend stack:

### Core Framework
- **[React](https://react.dev/):** UI library with lazy loading for optimal performance
- **[Vite](https://vitejs.dev/):** Fast build tool with experimental Rolldown support
- **[TypeScript](https://www.typescriptlang.org/):** Static typing for better development experience

### Styling & UI
- **[Tailwind CSS](https://tailwindcss.com/):** Utility-first CSS framework
  - Includes `tailwind-merge` and `tailwind-variants` for managing styles
- **[Radix UI](https://www.radix-ui.com/):** Unstyled, accessible UI primitives

### State Management & Data
- **[TanStack Query (React Query)](https://tanstack.com/query/latest):** Server-state management and caching
- **[GQL.tada](https://gql-tada.0no.co/):** Type-safe GraphQL queries
- **[React Hook Form](https://react-hook-form.com/):** Form validation and management

### Authentication & Blockchain
- **[Privy](https://www.privy.io/):** User authentication and wallet management
- **[React Router](https://reactrouter.com/):** Client-side routing

### Development & Quality
- **[Vitest](https://vitest.dev/):** Vite-native testing framework
- **[Biome](https://biomejs.dev/):** Fast formatting and linting
- **[Oxlint](https://oxc-project.github.io/):** Ultra-fast Rust-based linting
- **[PWA Features](https://vite-pwa-org.netlify.app/):** Progressive Web App capabilities

### Performance Optimizations
- **Dynamic Imports**: Lazy loading for major components
- **Code Splitting**: Automatic chunking for optimal loading
- **Bundle Optimization**: ~4.4MB main bundle with separate feature chunks

## Project Structure Highlights

The `packages/client/src` directory is organized as follows:

- **`main.tsx`**: The main entry point of the application.
- **`App.tsx`**: The root React component with dynamic imports and global providers.
- **`api/`**: Serverless functions (e.g., `subscribe.cjs`, `users.cjs`) for deployment on platforms like Vercel.
- **`components/`**: Reusable UI components used throughout the application.
  - `