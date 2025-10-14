import { vi } from "vitest";

// Mock URQL client for testing
export function createMockUrqlClient(customHandlers?: Record<string, unknown>) {
  const mockClient = {
    query: vi.fn(),
    mutation: vi.fn(),
    subscription: vi.fn(),
    executeQuery: vi.fn(),
    executeMutation: vi.fn(),
    executeSubscription: vi.fn(),
  };

  // Default mock responses
  const defaultResponses = {
    GetGardens: {
      data: {
        gardens: [
          {
            id: "0x1234567890123456789012345678901234567890",
            chainId: 84532,
            tokenAddress: "0xabcd1234567890123456789012345678901234ef",
            tokenID: "1",
            name: "Test Garden 1",
            description: "A test garden for unit testing",
            location: "Test Location",
            bannerImage: "https://example.com/banner1.jpg",
            createdAt: "2024-01-01T00:00:00Z",
            gardeners: ["0x2aa64E6d80390F5C017F0313cB908051BE2FD35e"],
            operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
          },
        ],
      },
      fetching: false,
      error: null,
    },
    GetOperatorGardens: {
      data: {
        gardens: [
          {
            id: "0x2345678901234567890123456789012345678901",
            name: "Test Garden 2",
          },
        ],
      },
      fetching: false,
      error: null,
    },
    GetGardenDetail: {
      data: {
        garden: {
          id: "0x1234567890123456789012345678901234567890",
          chainId: 84532,
          tokenAddress: "0xabcd1234567890123456789012345678901234ef",
          tokenID: "1",
          name: "Test Garden Detail",
          description: "Detailed test garden",
          location: "Test Location",
          bannerImage: "https://example.com/banner.jpg",
          createdAt: "2024-01-01T00:00:00Z",
          gardeners: ["0x2aa64E6d80390F5C017F0313cB908051BE2FD35e"],
          operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
        },
      },
      fetching: false,
      error: null,
    },
  };

  // Setup query mock to return appropriate responses
  mockClient.executeQuery.mockImplementation(({ query }) => {
    const queryName = query.definitions[0]?.name?.value;
    const response = customHandlers?.[queryName] ||
      defaultResponses[queryName] || {
        data: null,
        fetching: false,
        error: new Error(`Unmocked query: ${queryName}`),
      };

    return Promise.resolve(response);
  });

  return mockClient;
}

// Mock useQuery hook
export const mockUseQuery = vi.fn();

// Mock urql module
vi.mock("urql", async () => {
  const actual = await vi.importActual("urql");
  return {
    ...actual,
    useQuery: mockUseQuery,
    Provider: ({ children }: { children: React.ReactNode }) => children,
  };
});
