import { setupServer } from "msw/node";
import { graphql, HttpResponse } from "msw";

// Mock GraphQL responses for the indexer
const handlers = [
  // Mock GetGardens query
  graphql.query("GetGardens", ({ variables }) => {
    const chainId = variables.chainId as number;
    
    // Filter gardens by chainId
    const allGardens = [
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
          {
            id: "0x2345678901234567890123456789012345678901",
            chainId: 84532,
            tokenAddress: "0xbcde2345678901234567890123456789012345f0",
            tokenID: "2",
            name: "Test Garden 2",
            description: "Another test garden",
            location: "Test Location 2",
            bannerImage: "https://example.com/banner2.jpg",
            createdAt: "2024-01-02T00:00:00Z",
            gardeners: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
            operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
          },
        ];

        // Filter by chainId
        const filteredGardens = allGardens.filter(garden => garden.chainId === chainId);

        return HttpResponse.json({
          data: {
            Garden: filteredGardens,
          },
        });
  }),

  // Mock GetDashboardStats query
  graphql.query("GetDashboardStats", ({ variables }) => {
    const chainId = variables.chainId as number;
    
    const allGardens = [
      {
        id: "0x1234567890123456789012345678901234567890",
        name: "Test Garden 1",
        operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
        gardeners: ["0x2aa64E6d80390F5C017F0313cB908051BE2FD35e"],
        chainId: 84532,
      },
      {
        id: "0x2345678901234567890123456789012345678901",
        name: "Test Garden 2",
        operators: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
        gardeners: ["0x04D60647836bcA09c37B379550038BdaaFD82503"],
        chainId: 84532,
      },
    ];

    const filteredGardens = allGardens.filter(garden => garden.chainId === chainId);

    return HttpResponse.json({
      data: {
        Garden: filteredGardens,
      },
    });
  }),

  // Mock GetOperatorGardens query
  graphql.query("GetOperatorGardens", ({ variables }) => {
    const operator = variables.operator as string[];
    
    // Return gardens where the operator is listed
    const operatorGardens = [
      {
        id: "0x2345678901234567890123456789012345678901",
        name: "Test Garden 2",
      },
    ];

    // Only return gardens if the operator address matches our test operator
    if (operator[0]?.toLowerCase() === "0x04d60647836bca09c37b379550038bdaafd82503") {
      return HttpResponse.json({
        data: { Garden: operatorGardens },
      });
    }

    return HttpResponse.json({
      data: { Garden: [] },
    });
  }),

  // Mock GetGardenDetail query
  graphql.query("GetGardenDetail", ({ variables }) => {
    const id = variables.id as string;
    
    return HttpResponse.json({
      data: {
        Garden: [{
          id,
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
        }],
      },
    });
  }),
];

export const server = setupServer(...handlers);
