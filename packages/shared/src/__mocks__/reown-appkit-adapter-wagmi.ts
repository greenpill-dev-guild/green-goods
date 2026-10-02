/**
 * Stand-in for `@reown/appkit-adapter-wagmi` in the Shared, Client and Admin Vitest configs.
 *
 * Shared's config/appkit imports the adapter at load. Only Shared depends on it, so a `vi.mock` of
 * it in a Client or Admin setup file never matched Shared's import; an alias does. It builds no
 * wagmi config, so a test that reaches getWagmiConfig() without mocking config/appkit fails with
 * that function's own message.
 */

export class WagmiAdapter {
  readonly wagmiConfig = undefined;

  constructor(_options: unknown) {}
}
