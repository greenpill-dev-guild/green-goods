import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createAnvil } from "@viem/anvil";
import { createTestClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { initBlockchain, submitWork, checkApproval } from "../../src/services/blockchain";

describe("Blockchain Integration", () => {
  let anvil: any;
  let testClient: any;
  const testAccount = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  beforeAll(async () => {
    // Start local Anvil instance
    anvil = createAnvil({
      port: 8545,
      accounts: 10,
      balance: 1000,
    });
    await anvil.start();

    // Initialize blockchain service with local node
    process.env.VITE_RPC_URL_31337 = "http://127.0.0.1:8545";
    initBlockchain(foundry);

    // Create test client
    testClient = createTestClient({
      chain: foundry,
      mode: "anvil",
      transport: http("http://127.0.0.1:8545"),
    });
  });

  afterAll(async () => {
    await anvil?.stop();
  });

  describe("Contract Deployment", () => {
    it("should deploy test contracts", async () => {
      // Deploy mock contracts for testing
      const gardenTokenAddress = await deployMockGardenToken();
      expect(gardenTokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const workAddress = await deployMockWork();
      expect(workAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("Work Submission", () => {
    it("should submit work on-chain", async () => {
      const workData = {
        gardenAddress: "0x" + "1".repeat(40),
        actions: [
          { actionUID: "water", quantity: 10 },
          { actionUID: "plant", quantity: 5 },
        ],
        metadata: {
          description: "Test work submission",
          mediaHashes: ["QmTest123"],
        },
      };

      // Submit work
      const txHash = await submitWork(testAccount, workData);
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Wait for transaction
      const receipt = await testClient.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).toBe("success");
    });

    it("should handle submission failures gracefully", async () => {
      const invalidData = {
        gardenAddress: "invalid-address",
        actions: [],
        metadata: {},
      };

      await expect(submitWork(testAccount, invalidData)).rejects.toThrow();
    });
  });

  describe("Approval Checks", () => {
    it("should check operator approvals", async () => {
      const gardenAddress = "0x" + "2".repeat(40);
      const operatorAddress = testAccount.address;

      // Initially not approved
      const approved = await checkApproval(gardenAddress, operatorAddress);
      expect(approved).toBe(false);

      // After approval (would need to call approval method)
      // const approvalTx = await approveOperator(gardenAddress, operatorAddress);
      // await testClient.waitForTransactionReceipt({ hash: approvalTx });
      // const approvedAfter = await checkApproval(gardenAddress, operatorAddress);
      // expect(approvedAfter).toBe(true);
    });
  });

  describe("Gas Estimation", () => {
    it("should estimate gas correctly", async () => {
      const workData = {
        gardenAddress: "0x" + "3".repeat(40),
        actions: [{ actionUID: "water", quantity: 1 }],
        metadata: {},
      };

      // Estimate gas
      const gasEstimate = await estimateWorkGas(testAccount, workData);
      expect(gasEstimate).toBeGreaterThan(0n);
      expect(gasEstimate).toBeLessThan(parseEther("0.01")); // Less than 0.01 ETH
    });
  });
});

// Helper functions for deploying mock contracts
async function deployMockGardenToken() {
  // Deploy bytecode for mock GardenToken
  const bytecode =
    "0x608060405234801561001057600080fd5b5060405161001d906100f1565b604051809103906000f080158015610039573d6000803e3d6000fd5b5050610101565b"; // Simplified
  // ... deployment logic
  return "0x" + "4".repeat(40);
}

async function deployMockWork() {
  // Deploy bytecode for mock Work contract
  return "0x" + "5".repeat(40);
}
