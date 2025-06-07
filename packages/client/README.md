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

The application should typically be accessible at `http://localhost:3001`. The Vite server will provide live reloading and HMR (Hot Module Replacement).

## Building for Production

To create a production-ready build of the client application:

1.  **Ensure you are in the `packages/client` directory or use pnpm workspace filtering.**

2.  **Run the build command:**
    ```bash
    pnpm run build
    ```

This command will compile the TypeScript code, bundle the application using Vite, and output the static assets to the `dist` directory within `packages/client`. These assets are ready for deployment to a static hosting provider.

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

  _(Note: The `package.json` specifies `--standalone` for `test:watch`, which might require you to be in the `packages/client` directory or adjust if running from the root.)_

- **Generate test coverage report:**
  ```bash
  pnpm run coverage
  ```
  The coverage report will typically be generated in a `coverage` directory within `packages/client`.

## Code Quality and Formatting

The project uses Biome for fast formatting and linting, along with ESLint for additional code quality checks.

- **Format code:**
  ```bash
  pnpm run format
  ```

- **Check formatting without applying changes:**
  ```bash
  pnpm run format:check
  ```

- **Run linting:**
  ```bash
  pnpm run lint
  ```

The `lint` command runs both Biome checks and ESLint to ensure code quality and consistency based on the configured rules in `biome.json` and `eslint.config.js`.

## Key Technologies

The client application is built with a modern frontend stack:

- **[React](https://react.dev/):** A JavaScript library for building user interfaces.
- **[Vite](https://vitejs.dev/):** A fast build tool and development server.
- **[TypeScript](https://www.typescriptlang.org/):** A superset of JavaScript that adds static typing.
- **[Tailwind CSS](https://tailwindcss.com/):** A utility-first CSS framework for rapid UI development.
  - Includes `tailwind-merge` and `tailwind-variants` for managing styles.
- **[Privy](https://www.privy.io/):** For user authentication and wallet management.
- **[TanStack Query (React Query)](https://tanstack.com/query/latest):** For server-state management, data fetching, and caching.
- **[GQL.tada](https://gql-tada.0no.co/):** For type-safe GraphQL queries.
- **[Vitest](https://vitest.dev/):** A Vite-native testing framework.
- **[React Router](https://reactrouter.com/):** For client-side routing.
- **[Radix UI](https://www.radix-ui.com/):** For unstyled, accessible UI primitives.
- **[React Hook Form](https://react-hook-form.com/):** For form validation and management.
- **[PWA Features](https://vite-pwa-org.netlify.app/):** Configured via `vite-plugin-pwa` to enable Progressive Web App capabilities.
- **[Biome](https://biomejs.dev/):** Fast and modern formatter and linter for JavaScript/TypeScript.

## Project Structure Highlights

The `packages/client/src` directory is organized as follows:

- **`main.tsx`**: The main entry point of the application.
- **`App.tsx`**: The root React component, setting up routing and global providers.
- **`api/`**: Contains serverless functions (e.g., `subscribe.cjs`, `users.cjs`) intended for deployment on platforms like Vercel. These handle specific backend interactions.
- **`components/`**: Reusable UI components used throughout the application.
  - `UI/`: General-purpose UI elements (buttons, inputs, modals, etc.).
  - `Layout/`: Components related to page structure (header, footer, navigation).
  - `Garden/`: Components specific to "Garden" features.
- **`constants.ts`**: Global constants used in the application.
- **`i18n/`**: Internationalization configuration and translation files (e.g., `en.json`, `pt.json`).
- **`modules/`**: Contains modules for interacting with external services or implementing core functionalities.
  - `eas.ts`: Ethereum Attestation Service related logic.
  - `graphql.ts`: GraphQL client setup (using `gql.tada`).
  - `greengoods.ts`: Green Goods specific logic or API interactions.
  - `pinata.ts`: Pinata IPFS service interactions.
  - `react-query.ts`: TanStack Query (React Query) configuration.
- **`providers/`**: React Context API providers for managing global state or shared functionality (e.g., `AppProvider`, `UserProvider`).
- **`styles/`**: Global styles, Tailwind CSS configuration, and custom CSS.
- **`types/`**: TypeScript type definitions, including ambient types (`*.d.ts`).
- **`utils/`**: Utility functions and helpers used across the application.
  - `abis/`: ABIs for interacting with smart contracts.
  - `actions/`: Specific action-related utilities.
- **`views/`**: Page-level components that represent different routes/screens of the application (e.g., `Home`, `Login`, `Profile`, `Garden` views).
- **`__tests__/`**: Contains test files, mirroring the structure of the `src` directory.

Other important files in `packages/client`:

- **`vite.config.ts`**: Configuration for Vite, including plugins like PWA and mkcert.
- **`postcss.config.js` and `tailwind.config.js`**: Configuration for PostCSS and Tailwind CSS.
- **`eslint.config.js`**: ESLint configuration.
- **`tsconfig.json` (and variants):** TypeScript configuration files.
- **`public/`**: Static assets that are served directly by the development server or copied to the build output.
- **`index.html`**: The main HTML shell for the SPA.

## Contributing

While this README focuses on the client package, general contribution guidelines for the entire Green Goods project can be found in the [root README.md](../../README.md#contributing). Please refer to it for information on how to fork the repository, create branches, submit pull requests, and the review process.
