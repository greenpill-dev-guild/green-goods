/**
 * Centralized Barrel Mock Factory for @green-goods/shared
 *
 * Provides a complete mock of the shared barrel that:
 * 1. Inherits ALL real exports via vi.importActual (utils, types, components)
 * 2. Only overrides hooks with configurable vi.fn() wrappers
 * 3. Prevents mock drift — new exports auto-inherit, new hooks fail loudly
 *
 * Usage in consumer tests (admin/client):
 * ```typescript
 * import { createSharedBarrelMock } from "@green-goods/shared/testing";
 *
 * vi.mock(import("@green-goods/shared"), async (importOriginal) => {
 *   const actual = await importOriginal();
 *   return createSharedBarrelMock(actual, {
 *     useGardens: vi.fn(() => ({ data: [myGarden], isLoading: false })),
 *   });
 * });
 * ```
 */

import { vi } from "vitest";

type SharedModule = typeof import("../../index");

/**
 * Default hook return values — sensible defaults that prevent component crashes.
 * Each returns the minimal shape to avoid runtime errors.
 */
function createDefaultHookMocks() {
  return {
    // Auth hooks
    useAuth: vi.fn(() => ({
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      authMode: "disconnected" as const,
    })),
    useUser: vi.fn(() => ({
      primaryAddress: null,
      ensName: null,
      isLoading: false,
    })),

    // Garden hooks
    useGardens: vi.fn(() => ({ data: [], isLoading: false })),
    useJoinGarden: vi.fn(() => ({
      joinGarden: vi.fn(),
      isJoining: false,
    })),

    // Work hooks
    useWorks: vi.fn(() => ({
      works: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    })),

    // Actions hooks
    useActions: vi.fn(() => ({ data: [], isLoading: false })),

    // Offline hooks
    useOffline: vi.fn(() => ({
      isOnline: true,
      syncStatus: "idle" as const,
      pendingCount: 0,
    })),

    // UI store
    useUIStore: vi.fn((selector?: (state: any) => any) => {
      const state = {
        isOfflineBannerVisible: false,
        setOfflineBannerVisible: vi.fn(),
        isWorkDashboardOpen: false,
        openWorkDashboard: vi.fn(),
        closeWorkDashboard: vi.fn(),
        isGardenFilterOpen: false,
        openGardenFilter: vi.fn(),
        closeGardenFilter: vi.fn(),
        isEndowmentDrawerOpen: false,
        openEndowmentDrawer: vi.fn(),
        closeEndowmentDrawer: vi.fn(),
        isAnyDrawerOpen: () => false,
        sidebarOpen: false,
        setSidebarOpen: vi.fn(),
        toggleSidebar: vi.fn(),
        debugMode: false,
        setDebugMode: vi.fn(),
        toggleDebugMode: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),

    // Audio
    useAudioRecording: vi.fn(() => ({
      isRecording: false,
      isRequesting: false,
      elapsed: 0,
      error: null,
      toggle: vi.fn(),
      stop: vi.fn(),
    })),

    // Roles
    useHasRole: vi.fn(() => ({ hasRole: false, isLoading: false })),

    // ENS
    useEnsName: vi.fn(() => ({ data: null })),

    // Tracking
    track: vi.fn(),

    // Logger
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
}

/**
 * Creates a complete @green-goods/shared mock by spreading real exports
 * and overriding only hooks. Pass overrides to customize specific hooks.
 *
 * @param actual - The real module from importOriginal()
 * @param overrides - Custom hook implementations for this test
 */
export function createSharedBarrelMock(
  actual: SharedModule,
  overrides: Record<string, unknown> = {}
): SharedModule {
  const defaults = createDefaultHookMocks();

  return {
    ...actual, // All real exports (types, utils, components)
    ...defaults, // Default hook mocks
    ...overrides, // Test-specific overrides win
  } as unknown as SharedModule;
}
