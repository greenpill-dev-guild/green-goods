/**
 * MSW Handlers for Pimlico Bundler/Paymaster
 *
 * Mocks the Pimlico API endpoints used for smart account gas sponsorship.
 * These handlers enable E2E testing without real API calls.
 *
 * Pimlico endpoints mocked:
 * - eth_estimateUserOperationGas
 * - eth_sendUserOperation
 * - eth_getUserOperationReceipt
 * - pimlico_getUserOperationGasPrice
 * - pm_sponsorUserOperation (paymaster)
 *
 * @see https://docs.pimlico.io/reference/bundler/endpoints
 */

import { http, HttpResponse, type PathParams, type DefaultBodyType } from "msw";

// ============================================================================
// TYPES
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params: unknown[];
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface UserOperationGasPrice {
  slow: { maxFeePerGas: string; maxPriorityFeePerGas: string };
  standard: { maxFeePerGas: string; maxPriorityFeePerGas: string };
  fast: { maxFeePerGas: string; maxPriorityFeePerGas: string };
}

interface UserOperationGasEstimate {
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
  paymasterVerificationGasLimit?: string;
  paymasterPostOpGasLimit?: string;
}

interface PaymasterResult {
  paymaster: string;
  paymasterData: string;
  paymasterVerificationGasLimit: string;
  paymasterPostOpGasLimit: string;
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
}

interface UserOperationReceipt {
  userOpHash: string;
  entryPoint: string;
  sender: string;
  nonce: string;
  paymaster: string;
  actualGasCost: string;
  actualGasUsed: string;
  success: boolean;
  logs: unknown[];
  receipt: {
    transactionHash: string;
    blockNumber: string;
    blockHash: string;
    status: string;
  };
}

// ============================================================================
// MOCK DATA
// ============================================================================

/**
 * Mock paymaster address (Pimlico Verifying Paymaster)
 */
const MOCK_PAYMASTER = "0x00000000000000fBf0ac735561cCAb0e5c8f75c5" as const;

/**
 * Mock gas prices (realistic values for Base Sepolia)
 */
const MOCK_GAS_PRICES: UserOperationGasPrice = {
  slow: {
    maxFeePerGas: "0x5F5E100", // 100 gwei
    maxPriorityFeePerGas: "0x3B9ACA00", // 1 gwei
  },
  standard: {
    maxFeePerGas: "0xB2D05E00", // 3 gwei
    maxPriorityFeePerGas: "0x77359400", // 2 gwei
  },
  fast: {
    maxFeePerGas: "0xEE6B2800", // 4 gwei
    maxPriorityFeePerGas: "0xB2D05E00", // 3 gwei
  },
};

/**
 * Mock gas estimates (realistic values)
 */
const MOCK_GAS_ESTIMATE: UserOperationGasEstimate = {
  preVerificationGas: "0xC350", // 50000
  verificationGasLimit: "0x186A0", // 100000
  callGasLimit: "0x30D40", // 200000
  paymasterVerificationGasLimit: "0x186A0", // 100000
  paymasterPostOpGasLimit: "0x7530", // 30000
};

/**
 * Mock paymaster sponsorship result
 */
const MOCK_PAYMASTER_RESULT: PaymasterResult = {
  paymaster: MOCK_PAYMASTER,
  paymasterData:
    "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000041" +
    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00",
  paymasterVerificationGasLimit: "0x186A0",
  paymasterPostOpGasLimit: "0x7530",
  preVerificationGas: "0xC350",
  verificationGasLimit: "0x186A0",
  callGasLimit: "0x30D40",
};

/**
 * Track sent user operations for receipt lookup
 */
const sentUserOps = new Map<string, UserOperationReceipt>();
let userOpCounter = 0;

// ============================================================================
// HANDLER HELPERS
// ============================================================================

/**
 * Create a successful JSON-RPC response
 */
function successResponse<T>(id: number | string, result: T): JsonRpcResponse<T> {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Create an error JSON-RPC response
 */
function errorResponse(id: number | string, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Generate a mock user operation hash
 */
function generateUserOpHash(): `0x${string}` {
  userOpCounter++;
  const hash = `0x${userOpCounter.toString(16).padStart(64, "0")}` as `0x${string}`;
  return hash;
}

/**
 * Generate a mock transaction hash
 */
function generateTxHash(): `0x${string}` {
  return `0x${Date.now().toString(16).padStart(64, "0")}` as `0x${string}`;
}

// ============================================================================
// RPC METHOD HANDLERS
// ============================================================================

/**
 * Handle Pimlico/bundler RPC methods
 */
function handlePimlicoRpc(body: JsonRpcRequest): JsonRpcResponse {
  const { id, method, params } = body;

  switch (method) {
    // ============================
    // Bundler Methods
    // ============================

    case "pimlico_getUserOperationGasPrice":
      return successResponse(id, MOCK_GAS_PRICES);

    case "eth_estimateUserOperationGas":
      return successResponse(id, MOCK_GAS_ESTIMATE);

    case "eth_sendUserOperation": {
      const userOpHash = generateUserOpHash();
      const txHash = generateTxHash();
      const userOp = params[0] as { sender?: string };

      // Store receipt for later lookup
      sentUserOps.set(userOpHash, {
        userOpHash,
        entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        sender: (userOp?.sender as string) ?? "0x0000000000000000000000000000000000000000",
        nonce: "0x0",
        paymaster: MOCK_PAYMASTER,
        actualGasCost: "0x0",
        actualGasUsed: "0x0",
        success: true,
        logs: [],
        receipt: {
          transactionHash: txHash,
          blockNumber: "0x1",
          blockHash: `0x${"0".repeat(64)}`,
          status: "0x1",
        },
      });

      return successResponse(id, userOpHash);
    }

    case "eth_getUserOperationReceipt": {
      const hash = params[0] as string;
      const receipt = sentUserOps.get(hash);

      if (receipt) {
        return successResponse(id, receipt);
      }

      // Return null if not found (operation still pending)
      return successResponse(id, null);
    }

    case "eth_getUserOperationByHash": {
      const hash = params[0] as string;
      const receipt = sentUserOps.get(hash);

      if (receipt) {
        return successResponse(id, {
          userOperation: {},
          entryPoint: receipt.entryPoint,
          transactionHash: receipt.receipt.transactionHash,
          blockNumber: receipt.receipt.blockNumber,
          blockHash: receipt.receipt.blockHash,
        });
      }

      return successResponse(id, null);
    }

    case "eth_supportedEntryPoints":
      return successResponse(id, ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]);

    // ============================
    // Paymaster Methods
    // ============================

    case "pm_sponsorUserOperation":
      return successResponse(id, MOCK_PAYMASTER_RESULT);

    case "pm_validateSponsorshipPolicies":
      // Validate that sponsorship is allowed
      return successResponse(id, {
        sponsorshipPolicyId: params[2] as string,
        data: {
          name: "Test Policy",
          sponsor: { name: "Test Sponsor" },
        },
      });

    // ============================
    // Standard ETH Methods (passthrough for completeness)
    // ============================

    case "eth_chainId":
      return successResponse(id, "0x14A34"); // 84532 (Base Sepolia)

    case "eth_blockNumber":
      return successResponse(id, "0x1");

    case "eth_getBalance":
      return successResponse(id, "0x56BC75E2D63100000"); // 100 ETH

    case "eth_call":
      // Return empty data for most calls
      return successResponse(id, "0x");

    // ============================
    // Unknown Method
    // ============================

    default:
      console.warn(`[MSW] Unknown Pimlico RPC method: ${method}`);
      return errorResponse(id, -32601, `Method not found: ${method}`);
  }
}

// ============================================================================
// MSW HANDLERS
// ============================================================================

/**
 * Pimlico API endpoint pattern
 * Matches: https://api.pimlico.io/v2/{chainId}/rpc?apikey={key}
 */
const PIMLICO_RPC_PATTERN = /https:\/\/api\.pimlico\.io\/v2\/\d+\/rpc/;

/**
 * MSW handlers for Pimlico bundler/paymaster
 */
export const pimlicoHandlers = [
  // Handle Pimlico bundler/paymaster RPC
  http.post<PathParams, JsonRpcRequest, DefaultBodyType>(
    PIMLICO_RPC_PATTERN,
    async ({ request }) => {
      const body = (await request.json()) as JsonRpcRequest;
      const response = handlePimlicoRpc(body);

      console.debug(`[MSW] Pimlico RPC: ${body.method}`, {
        id: body.id,
        result: response.result ? "success" : response.error,
      });

      return HttpResponse.json(response);
    }
  ),
];

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MOCK_PAYMASTER,
  MOCK_GAS_PRICES,
  MOCK_GAS_ESTIMATE,
  MOCK_PAYMASTER_RESULT,
  handlePimlicoRpc,
  sentUserOps,
};

/**
 * Reset mock state (useful between tests)
 */
export function resetPimlicoMocks(): void {
  sentUserOps.clear();
  userOpCounter = 0;
}
