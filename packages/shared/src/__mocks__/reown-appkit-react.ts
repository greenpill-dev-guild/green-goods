/**
 * Stand-in for `@reown/appkit/react` in the Shared, Client and Admin Vitest configs.
 *
 * Shared's config/appkit imports AppKit's React entry at load, so every test that reaches the Auth
 * provider, the chain guard or a commitment-pooling chain reader used to load all of AppKit
 * without ever creating it. Tests that need AppKit behaviour mock `config/appkit` or
 * `AppKitProvider` themselves.
 */

export function createAppKit(_options: unknown) {
  return {
    open: () => Promise.resolve(),
    close: () => Promise.resolve(),
    setThemeMode: (_mode: "light" | "dark") => undefined,
  };
}

export function useAppKit() {
  return { open: () => Promise.resolve(), close: () => Promise.resolve() };
}
