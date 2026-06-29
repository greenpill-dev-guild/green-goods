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
import { JobQueueProvider } from "../src/providers/JobQueue";
import { WorkProvider } from "../src/providers/Work";
import { AppContext, supportedLanguages } from "../src/providers/App";
import { DevAuthProvider } from "../src/providers/DevAuthProvider";
import {
  DEV_MOCK_AUTH_ADDRESSES,
  type DevMockAuthRole,
} from "../src/providers/DevAuthProvider";
import { useAdminStore, type Garden as AdminStoreGarden } from "../src/stores/useAdminStore";
import { resetAdminStoryState } from "./adminStoryIsolation";
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

export const withAdminStoryIsolation: Decorator = (Story, context) => {
  useMemo(() => {
    resetAdminStoryState();
    return context.id;
  }, [context.id]);

  return <Story />;
};

export const withTheme: Decorator = (Story) => {
  const [{ theme }] = useGlobals();
  const currentTheme = theme || "light";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
  }, [currentTheme]);

  return (
    <div data-theme={currentTheme} className="storybook-browser-preview">
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

const installedPwaContext = {
  isMobile: true,
  isInstalled: true,
  isInstalling: false,
  isPwaPresentation: true,
  isStandalone: true,
  installState: "installed",
  presentationMode: "pwa",
  wasInstalled: true,
  platform: "ios",
  locale: "en",
  availableLocales: supportedLanguages,
  deferredPrompt: null,
  promptInstall: () => {},
  handleInstallCheck: () => {},
  switchLanguage: () => {},
} satisfies React.ContextType<typeof AppContext>;

function InstalledPwaFrame({
  children,
  className = "",
  heightClassName = "min-h-[720px]",
}: {
  children: React.ReactNode;
  className?: string;
  heightClassName?: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalMatchMedia = window.matchMedia.bind(window);

    window.matchMedia = (query: string) => {
      if (query.includes("display-mode: standalone")) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        };
      }
      return originalMatchMedia(query);
    };

    document.documentElement.dataset.displayMode = "standalone";
    document.body.classList.add("storybook-installed-pwa");

    return () => {
      window.matchMedia = originalMatchMedia;
      delete document.documentElement.dataset.displayMode;
      document.body.classList.remove("storybook-installed-pwa");
    };
  }, []);

  return (
    <AppContext.Provider value={installedPwaContext}>
      <div className={`storybook-installed-pwa-frame ${heightClassName} ${className}`.trim()}>
        {children}
      </div>
    </AppContext.Provider>
  );
}

export function withInstalledPwa({
  className = "",
  heightClassName = "min-h-[720px]",
}: {
  className?: string;
  heightClassName?: string;
} = {}): Decorator {
  return (Story) => (
    <InstalledPwaFrame className={className} heightClassName={heightClassName}>
      <Story />
    </InstalledPwaFrame>
  );
}

export const withAdminPrimitiveFrame: Decorator = (Story) => (
  <div
    data-workspace="hub"
    className="admin-m3 storybook-canvas-frame min-h-[520px] overflow-auto p-6 text-[rgb(var(--m3-on-surface))] sm:p-8"
  >
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-[var(--m3-shape-lg)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface))] p-6 shadow-[var(--m3-elevation-1)]">
      <Story />
    </div>
  </div>
);

/**
 * Minimal WagmiProvider for Storybook. Uses a mock connector so that
 * `useAccount`, `useReadContract`, and wagmi mutation hooks resolve
 * without throwing. Contract reads return undefined → components render
 * their loading / empty states. Writes are inert.
 */
const STORYBOOK_MOCK_ADDRESS = DEV_MOCK_AUTH_ADDRESSES.operator;

function createStorybookWagmiConfig(address: `0x${string}` = STORYBOOK_MOCK_ADDRESS) {
  return createConfig({
    chains: [arbitrum, arbitrumSepolia, mainnet, sepolia],
    connectors: [
      mock({
        accounts: [address],
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
}

const storybookWagmiConfig = createStorybookWagmiConfig();

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

export function withAdminIdentityRole(role: Exclude<DevMockAuthRole, "disconnected">): Decorator {
  return (Story, context) => {
    const config = useMemo(() => createStorybookWagmiConfig(DEV_MOCK_AUTH_ADDRESSES[role]), [role]);

    return (
      <WagmiProvider config={config} reconnectOnMount={false}>
        <DevAuthProvider mockRole={role}>
          <Story {...context} />
        </DevAuthProvider>
      </WagmiProvider>
    );
  };
}

/**
 * Client runtime harness for protected PWA/client stories that render the real
 * shell widgets. It mirrors the auth + queue + work providers used by
 * `AppShell` while keeping wallet reads mocked and inert.
 */
export const withClientAppRuntime: Decorator = (Story, context) => (
  <WagmiProvider config={storybookWagmiConfig} reconnectOnMount={false}>
    <DevAuthProvider>
      <JobQueueProvider>
        <WorkProvider>
          <Story {...context} />
        </WorkProvider>
      </JobQueueProvider>
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
  return (Story, context) => {
    const client = useMemo(() => {
      const c = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity },
        },
      });
      for (const [key, data] of seeds) {
        c.setQueryData(key, data);
      }
      return c;
    }, [context.id]);

    useEffect(() => {
      return () => {
        client.clear();
      };
    }, [client]);

    return (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    );
  };
}

export function withSelectedAdminGarden(garden: AdminStoreGarden): Decorator {
  return (Story, context) => {
    useState(() => {
      useAdminStore.setState({ selectedGarden: garden });
      return garden.id;
    });

    useEffect(() => {
      useAdminStore.setState({ selectedGarden: garden });
    }, [garden]);

    return <Story {...context} />;
  };
}
