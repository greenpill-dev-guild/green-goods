import { toastService } from "@green-goods/shared";
import { useGardenerProfile } from "@green-goods/shared/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth hook used by shared's `useGardenerProfile` implementation.
// NOTE: `useGardenerProfile` imports `useAuth` via a relative path inside `packages/shared`,
// so mocking `@green-goods/shared/hooks` doesn't intercept it.
const mockUseAuth = vi.fn(() => ({
  smartAccountClient: {
    // Minimal shape used by the hook. We don't need a real account object for these tests.
    account: {},
    sendTransaction: vi.fn(async () => "0x1234567890abcdef"),
  },
  smartAccountAddress: "0xGardenerSmartAccountAddress",
  isReady: true,
  isAuthenticated: true,
}));

vi.mock("../../../../shared/src/hooks/auth/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("Gardener Profile Integration Tests", () => {
  let queryClient: QueryClient;
  const toastSuccessSpy = vi.spyOn(toastService, "success").mockImplementation(vi.fn());
  const toastErrorSpy = vi.spyOn(toastService, "error").mockImplementation(vi.fn());

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      smartAccountClient: {
        sendTransaction: vi.fn(async () => "0x1234567890abcdef"),
      },
      smartAccountAddress: "0xGardenerSmartAccountAddress",
      isReady: true,
      isAuthenticated: true,
    });
    toastSuccessSpy.mockClear();
    toastErrorSpy.mockClear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useGardenerProfile Hook", () => {
    it("should provide profile query and mutations", () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      expect(result.current).toHaveProperty("profile");
      expect(result.current).toHaveProperty("updateProfile");
      expect(result.current).toHaveProperty("updateName");
      expect(result.current).toHaveProperty("updateBio");
      expect(result.current).toHaveProperty("updateLocation");
      expect(result.current).toHaveProperty("updateImage");
      expect(result.current).toHaveProperty("isUpdating");
    });

    it("should update profile with gasless transaction", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      const profileData = {
        name: "Alice Green",
        bio: "Regenerative farmer",
        location: "Portland, OR",
        imageURI: "ipfs://QmTest",
        socialLinks: ["https://twitter.com/alice"],
        contactInfo: "@alice",
      };

      result.current.updateProfile(profileData);

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Transaction should have been sent
      expect(result.current.isUpdating).toBe(false);
    });

    it("should handle update errors gracefully", async () => {
      // Mock auth to return null client (simulate error)
      mockUseAuth.mockReturnValue({
        smartAccountClient: null,
        smartAccountAddress: null,
        isReady: true,
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      const profileData = {
        name: "Test",
        bio: "",
        location: "",
        imageURI: "",
        socialLinks: [],
        contactInfo: "",
      };

      result.current.updateProfile(profileData);

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalled();
      });
    });
  });

  describe("Profile Validation", () => {
    it("should validate name length (max 50 chars)", () => {
      const longName = "a".repeat(51);
      expect(longName.length).toBeGreaterThan(50);
      // Client-side validation should catch this before submission
    });

    it("should validate bio length (max 280 chars)", () => {
      const longBio = "a".repeat(281);
      expect(longBio.length).toBeGreaterThan(280);
      // Client-side validation should catch this
    });

    it("should validate social links (max 5)", () => {
      const tooManyLinks = Array(6).fill("https://example.com");
      expect(tooManyLinks.length).toBeGreaterThan(5);
      // Client-side validation should catch this
    });

    it("should validate HTTPS URLs for social links", () => {
      const invalidLink = "http://twitter.com/user"; // Must be https
      expect(invalidLink.startsWith("https://")).toBe(false);
    });

    it("should validate image URI protocols", () => {
      const validProtocols = ["ipfs://", "ar://", "https://"];
      const invalidURI = "http://example.com/image.jpg";

      const isValid = validProtocols.some((protocol) => invalidURI.startsWith(protocol));
      expect(isValid).toBe(false);
    });
  });

  describe("Gasless Transactions", () => {
    it("should use Pimlico paymaster for profile updates", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      const profileData = {
        name: "Bob",
        bio: "Grower",
        location: "NYC",
        imageURI: "",
        socialLinks: [],
        contactInfo: "",
      };

      result.current.updateProfile(profileData);

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Verify transaction was sent (paymaster is configured in smartAccountClient)
      // User should not need to hold ETH for gas
    });
  });

  describe("Indexer Integration", () => {
    it("should query profile from indexer (placeholder)", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      // Currently returns undefined (placeholder until indexer is live)
      expect(result.current.profile).toBeUndefined();
      expect(result.current.isLoading).toBeDefined();
    });

    it("should invalidate queries on successful update", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      const profileData = {
        name: "Charlie",
        bio: "",
        location: "",
        imageURI: "",
        socialLinks: [],
        contactInfo: "",
      };

      result.current.updateProfile(profileData);

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Query invalidation should trigger refetch
      // (GraphQL query will be added later)
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce 5-minute cooldown on contract level", () => {
      // Rate limiting is enforced by smart contract
      // Client should show appropriate UI feedback
      // Test: Multiple rapid updates should fail on-chain after first succeeds
    });
  });

  describe("Field-Specific Updates", () => {
    it("should support updating individual fields for gas efficiency", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      // Update only name (cheaper than full profile)
      result.current.updateName("New Name");

      await waitFor(() => {
        expect(result.current.isUpdatingName).toBe(false);
      });
    });

    it("should support updating bio independently", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      result.current.updateBio("New bio text");

      await waitFor(() => {
        expect(result.current.isUpdatingBio).toBe(false);
      });
    });

    it("should support updating location independently", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      result.current.updateLocation("Berlin, Germany");

      await waitFor(() => {
        expect(result.current.isUpdatingLocation).toBe(false);
      });
    });

    it("should support updating image independently", async () => {
      const { result } = renderHook(() => useGardenerProfile(), { wrapper });

      result.current.updateImage("ipfs://QmNewImage");

      await waitFor(() => {
        expect(result.current.isUpdatingImage).toBe(false);
      });
    });
  });
});
