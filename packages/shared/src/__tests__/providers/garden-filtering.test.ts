import { describe, expect, it } from "vitest";

/**
 * Unit tests for garden filtering logic
 * 
 * Tests the filtering behavior that ensures gardeners only see gardens they're members of
 */

describe("Garden Filtering Logic", () => {
  const mockGardens: Garden[] = [
    {
      id: "84532-1",
      chainId: 84532,
      tokenAddress: "0xGardenToken",
      tokenID: BigInt(1),
      name: "Test Garden 1",
      description: "Description",
      location: "Location 1",
      bannerImage: "/banner.png",
      gardeners: ["0xuser1", "0xuser2"],
      operators: ["0xoperator1"],
      assessments: [],
      works: [],
      createdAt: Date.now(),
    },
    {
      id: "84532-2",
      chainId: 84532,
      tokenAddress: "0xGardenToken",
      tokenID: BigInt(2),
      name: "Test Garden 2",
      description: "Description",
      location: "Location 2",
      bannerImage: "/banner.png",
      gardeners: ["0xuser2", "0xuser3"],
      operators: ["0xoperator1"],
      assessments: [],
      works: [],
      createdAt: Date.now(),
    },
    {
      id: "84532-3",
      chainId: 84532,
      tokenAddress: "0xGardenToken",
      tokenID: BigInt(3),
      name: "Test Garden 3",
      description: "Description",
      location: "Location 3",
      bannerImage: "/banner.png",
      gardeners: ["0xuser4"],
      operators: ["0xoperator1"],
      assessments: [],
      works: [],
      createdAt: Date.now(),
    },
  ];

  /**
   * Filter gardens by user address (mimics WorkProvider logic)
   */
  function filterGardensByUser(gardens: Garden[], userAddress: string | undefined): Garden[] {
    if (!userAddress) return [];
    
    const normalizedUserAddress = userAddress.toLowerCase();
    
    return gardens.filter((garden) =>
      garden.gardeners?.some(
        (gardenerAddress: string) => gardenerAddress.toLowerCase() === normalizedUserAddress
      )
    );
  }

  it("filters gardens to only show ones where user is a gardener", () => {
    const userAddress = "0xuser1";
    const filtered = filterGardensByUser(mockGardens, userAddress);

    // User 0xuser1 should only see Garden 1
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("84532-1");
    expect(filtered[0].name).toBe("Test Garden 1");
  });

  it("shows multiple gardens if user is a gardener in multiple gardens", () => {
    const userAddress = "0xuser2";
    const filtered = filterGardensByUser(mockGardens, userAddress);

    // User 0xuser2 should see Gardens 1 and 2
    expect(filtered).toHaveLength(2);
    expect(filtered.map((g) => g.id)).toEqual(["84532-1", "84532-2"]);
  });

  it("shows empty list if user is not a gardener in any garden", () => {
    const userAddress = "0xuserNotInGarden";
    const filtered = filterGardensByUser(mockGardens, userAddress);

    // User should see no gardens
    expect(filtered).toHaveLength(0);
  });

  it("handles case-insensitive address matching", () => {
    // Test with uppercase user address
    const upperCaseAddress = "0xUSER1";
    const filtered = filterGardensByUser(mockGardens, upperCaseAddress);

    // Should still match Garden 1 (case-insensitive)
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("84532-1");
  });

  it("handles mixed case in garden gardeners list", () => {
    const mixedCaseGardens: Garden[] = [
      {
        ...mockGardens[0],
        gardeners: ["0xUser1", "0xUSER2"], // Mixed case in gardeners list
      },
    ];

    const userAddress = "0xuser1"; // Lowercase input
    const filtered = filterGardensByUser(mixedCaseGardens, userAddress);

    // Should match despite case differences
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("84532-1");
  });

  it("returns empty array when userAddress is undefined", () => {
    const filtered = filterGardensByUser(mockGardens, undefined);
    expect(filtered).toHaveLength(0);
  });

  it("returns empty array when userAddress is empty string", () => {
    const filtered = filterGardensByUser(mockGardens, "");
    expect(filtered).toHaveLength(0);
  });

  it("handles gardens with empty gardeners array", () => {
    const gardensWithEmpty: Garden[] = [
      ...mockGardens,
      {
        ...mockGardens[0],
        id: "84532-4",
        name: "Empty Garden",
        gardeners: [], // Empty gardeners list
      },
    ];

    const userAddress = "0xuser1";
    const filtered = filterGardensByUser(gardensWithEmpty, userAddress);

    // Should only see Garden 1, not the empty garden
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("84532-1");
  });
});










