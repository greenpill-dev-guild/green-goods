import type { Decorator } from "@storybook/react";
import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { useGlobals } from "storybook/preview-api";
import { WagmiProvider, createConfig, http, mock } from "wagmi";
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from "wagmi/chains";
import { DevAuthProvider } from "../src/providers/DevAuthProvider";
import { STORYBOOK_NOW_SECONDS } from "./fixtures";
import messages from "../src/i18n/en.json";

/**
 * Freeze wall-clock time inside the Storybook preview iframe so fixture
 * timestamps align with components that still call `Date.now()` or
 * `new Date()` (e.g. `ActiveListingsTable` activity checks,
 * `formatRelativeTime`). Applied once at module load — the preview
 * iframe is an isolated realm, so this does NOT leak to the Storybook
 * manager UI or anything outside Storybook.
 *
 * Covers the three entry points components use:
 *   - `Date.now()`
 *   - `new Date()` (zero-arg → frozen instant)
 *   - `Date()` as a function (rare, but mirrors native behavior)
 *
 * All other Date constructor forms (`new Date(ms)`,
 * `new Date("2026-05-01")`) pass through unchanged, so explicit fixture
 * dates still work.
 */
function installFrozenClock(): void {
  // Idempotent — guards against double-install if the preview reloads
  // module graph (HMR).
  const w = globalThis as typeof globalThis & {
    __greenGoodsStorybookClockInstalled?: boolean;
  };
  if (w.__greenGoodsStorybookClockInstalled) return;
  w.__greenGoodsStorybookClockInstalled = true;

  const FROZEN_MS = STORYBOOK_NOW_SECONDS * 1000;
  const NativeDate = globalThis.Date;

  const FrozenDate = function (this: unknown, ...args: unknown[]) {
    if (!(this instanceof FrozenDate)) {
      // `Date()` called as a function returns a string — mirror native behavior.
      return new NativeDate(FROZEN_MS).toString();
    }
    if (args.length === 0) {
      return new NativeDate(FROZEN_MS);
    }
    // biome-ignore lint/suspicious/noExplicitAny: constructor passthrough
    return new (NativeDate as any)(...(args as [unknown]));
  } as unknown as DateConstructor;

  Object.defineProperty(FrozenDate, "prototype", {
    value: NativeDate.prototype,
  });
  Object.setPrototypeOf(FrozenDate, NativeDate);
  FrozenDate.UTC = NativeDate.UTC;
  FrozenDate.parse = NativeDate.parse;
  FrozenDate.now = () => FROZEN_MS;

  globalThis.Date = FrozenDate;
}

// Install at module load so every story — including those that don't
// opt into any decorator — renders against the fixed clock.
if (typeof window !== "undefined") {
  installFrozenClock();
}

export function createStorybookQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

export const withI18n: Decorator = (Story) => (
  <IntlProvider locale="en" messages={messages}>
    <Story />
  </IntlProvider>
);

export const withQueryClient: Decorator = (Story, context) => {
  const queryClient = useMemo(() => createStorybookQueryClient(), [context.id]);

  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
};

export const withTheme: Decorator = (Story) => {
  const [{ theme }] = useGlobals();
  const currentTheme = theme || "light";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
  }, [currentTheme]);

  return (
    <div data-theme={currentTheme} className="min-h-screen bg-bg-white-0 p-4 text-text-strong-950">
      <Story />
    </div>
  );
};

export function withRouter(initialEntries: MemoryRouterProps["initialEntries"] = ["/"]): Decorator {
  return (Story) => (
    <MemoryRouter initialEntries={initialEntries}>
      <Story />
    </MemoryRouter>
  );
}

interface CanvasFrameOptions {
  className?: string;
  heightClassName?: string;
  workspace?: "home" | "hub" | "garden" | "community" | "actions" | "profile";
}

export function withCanvasFrame({
  className = "",
  heightClassName = "min-h-[560px]",
  workspace = "hub",
}: CanvasFrameOptions = {}): Decorator {
  return (Story) => (
    <div
      data-workspace={workspace}
      className={`storybook-canvas-frame ${heightClassName} ${className}`.trim()}
    >
      <Story />
    </div>
  );
}

/**
 * Minimal WagmiProvider for Storybook. Uses a mock connector so that
 * `useAccount`, `useReadContract`, and wagmi mutation hooks resolve
 * without throwing. Contract reads return undefined → components render
 * their loading / empty states. Writes are inert.
 */
const STORYBOOK_MOCK_ADDRESS = "0x04D60647836bcA09c37B379550038BdaaFD82503" as const;

const storybookWagmiConfig = createConfig({
  chains: [arbitrum, arbitrumSepolia, mainnet, sepolia],
  connectors: [
    mock({
      accounts: [STORYBOOK_MOCK_ADDRESS],
      features: { reconnect: true },
    }),
  ],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

export const withWagmi: Decorator = (Story) => (
  <WagmiProvider config={storybookWagmiConfig} reconnectOnMount={false}>
    <Story />
  </WagmiProvider>
);

/**
 * Provides the shared Auth context via `DevAuthProvider`, which exposes
 * the same context shape as the real `AuthProvider` but with hardcoded
 * role values keyed off the `?mockAuth=` URL param (defaults to
 * `operator`). Stories that need a connected admin identity should layer
 * this on top of `withWagmi`.
 */
export const withDevAuth: Decorator = (Story) => (
  <DevAuthProvider>
    <Story />
  </DevAuthProvider>
);

/**
 * Combined decorator for stories that render real components which read
 * auth + wagmi state. Applies `withWagmi` then `withDevAuth`. Must sit
 * inside `withQueryClient` / `withI18n` (the global preview decorators
 * already provide those).
 */
export const withAdminIdentity: Decorator = (Story, context) => (
  <WagmiProvider config={storybookWagmiConfig} reconnectOnMount={false}>
    <DevAuthProvider>
      <Story {...context} />
    </DevAuthProvider>
  </WagmiProvider>
);

/**
 * Wrap a story in a fresh `QueryClientProvider` whose cache is
 * pre-seeded with the provided [queryKey, data] pairs. The seeded
 * provider shadows the global one for this subtree, so real hooks that
 * read via React Query will return the seeded data synchronously on
 * first render.
 *
 * Use for stories that render real components driven by React Query
 * (not wagmi's internal `useReadContract`). Examples: shared hooks like
 * `useHypercertListings`, `useTradeHistory`, `useVaultEvents`,
 * `useMarketplaceApprovals`.
 *
 * Pair with `withAdminIdentity` when the underlying hook also reads
 * auth or wagmi state.
 */
export function withSeededQueryClient(
  seeds: ReadonlyArray<readonly [QueryKey, unknown]>,
): Decorator {
  return (Story) => {
    const [client] = useState(() => {
      const c = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity },
        },
      });
      for (const [key, data] of seeds) {
        c.setQueryData(key, data);
      }
      return c;
    });
    return (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    );
  };
}
