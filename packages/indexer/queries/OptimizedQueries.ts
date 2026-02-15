// Optimized GraphQL queries following indexer rules
// Provides pagination, filtering, and performance optimizations

export const OPTIMIZED_QUERIES = {
  // Gardens with pagination and filters
  getGardensOptimized: `
    query GetGardensOptimized(
      $first: Int = 20
      $skip: Int = 0
      $where: Garden_filter
      $orderBy: Garden_orderBy = createdAt
      $orderDirection: OrderDirection = desc
    ) {
      gardens(
        first: $first
        skip: $skip
        where: $where
        orderBy: $orderBy
        orderDirection: $orderDirection
      ) {
        id
        chainId
        name
        description
        location
        bannerImage
        createdAt
        gardeners
        operators
        evaluators
        owners
        funders
        communities
      }
    }
  `,

  // Active actions optimized for UI (filters server-side)
  getActiveActions: `
    query GetActiveActions(
      $first: Int = 10
      $chainId: Int
    ) {
      actions(
        first: $first
        where: {
          chainId: $chainId
        }
        orderBy: endTime
        orderDirection: asc
      ) {
        id
        title
        instructions
        capitals
        media
        startTime
        endTime
        ownerAddress
      }
    }
  `,

  // Garden details with all role arrays
  getGardenDetails: `
    query GetGardenDetails($id: ID!) {
      garden(id: $id) {
        id
        chainId
        name
        description
        location
        bannerImage
        createdAt
        gardeners
        operators
        evaluators
        owners
        funders
        communities
        gapProjectUID
      }
    }
  `,

  // User's gardens (for dashboard) - filter by membership in role arrays
  getUserGardens: `
    query GetUserGardens(
      $userAddress: String!
      $first: Int = 20
      $skip: Int = 0
    ) {
      gardens(
        first: $first
        skip: $skip
        where: {
          or: [
            { gardeners_contains: [$userAddress] }
            { operators_contains: [$userAddress] }
            { owners_contains: [$userAddress] }
          ]
        }
        orderBy: createdAt
        orderDirection: desc
      ) {
        id
        name
        description
        location
        bannerImage
        createdAt
        gardeners
        operators
        owners
      }
    }
  `,

  // Actions with pagination
  getActions: `
    query GetActions(
      $chainId: Int
      $first: Int = 20
      $skip: Int = 0
    ) {
      actions(
        first: $first
        skip: $skip
        where: {
          chainId: $chainId
        }
        orderBy: createdAt
        orderDirection: desc
      ) {
        id
        title
        instructions
        capitals
        startTime
        endTime
        ownerAddress
      }
    }
  `,
};

// Helper types for TypeScript
export interface GardenFilters {
  chainId?: number;
  name_contains?: string;
}

export interface ActionFilters {
  chainId?: number;
  title_contains?: string;
}

export interface PaginationOptions {
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

// Query builders for dynamic filtering
export const QueryBuilders = {
  buildGardenQuery: (filters: GardenFilters, pagination: PaginationOptions = {}) => ({
    query: OPTIMIZED_QUERIES.getGardensOptimized,
    variables: {
      first: pagination.first || 20,
      skip: pagination.skip || 0,
      where: filters,
      orderBy: pagination.orderBy || "createdAt",
      orderDirection: pagination.orderDirection || "desc",
    },
  }),

  buildActionQuery: (filters: ActionFilters, pagination: PaginationOptions = {}) => ({
    query: OPTIMIZED_QUERIES.getActions,
    variables: {
      chainId: filters.chainId,
      first: pagination.first || 20,
      skip: pagination.skip || 0,
    },
  }),
};
