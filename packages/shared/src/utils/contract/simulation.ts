/**
 * Contract Transaction Simulation Utilities
 *
 * Provides utilities for simulating contract transactions before execution.
 * Helps catch errors early and provide better user feedback.
 *
 * @module utils/contract/simulation
 */

import { simulateContract } from "@wagmi/core";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { wagmiConfig } from "../../config/appkit";
import { parseContractError } from "../errors/contract-errors";

/**
 * Simulation result with parsed error if applicable
 */
export interface SimulationResult {
  /** Whether the simulation succeeded */
  success: boolean;
  /** Parsed error if simulation failed */
  error?: {
    name: string;
    message: string;
    action?: string;
    raw: string;
  };
  /** Original simulation result from wagmi */
  result?: any;
}

/**
 * Simulate a contract write transaction
 *
 * @param address - Contract address
 * @param abi - Contract ABI
 * @param functionName - Function to call
 * @param args - Function arguments
 * @param account - User address
 * @returns Simulation result with success/error
 *
 * @example
 * ```typescript
 * const result = await simulateTransaction(
 *   gardenAddress,
 *   GardenAccountABI,
 *   'joinGarden',
 *   [],
 *   userAddress
 * );
 *
 * if (!result.success) {
 *   toast.error({
 *     title: result.error.name,
 *     message: result.error.message
 *   });
 *   return;
 * }
 *
 * // Proceed with actual transaction
 * await writeContract(...);
 * ```
 */
export async function simulateTransaction(
  address: Address,
  abi: any,
  functionName: string,
  args: any[] = [],
  account: Address
): Promise<SimulationResult> {
  try {
    const result = await simulateContract(wagmiConfig, {
      address,
      abi,
      functionName,
      args,
      account,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    // Parse the contract error
    const parsed = parseContractError(error);

    return {
      success: false,
      error: {
        name: parsed.name,
        message: parsed.message,
        action: parsed.action,
        raw: parsed.raw,
      },
    };
  }
}

/**
 * Simulate joining a garden (root or otherwise)
 *
 * @param gardenAddress - Garden contract address
 * @param userAddress - User attempting to join
 * @param abi - Garden ABI (defaults to GardenAccountABI)
 * @returns Simulation result
 */
export async function simulateJoinGarden(
  gardenAddress: Address,
  userAddress: Address,
  abi?: any
): Promise<SimulationResult> {
  // Import GardenAccountABI dynamically to avoid circular deps
  const { GardenAccountABI } = await import("../contracts");

  return simulateTransaction(gardenAddress, abi || GardenAccountABI, "joinGarden", [], userAddress);
}

/**
 * Batch simulate multiple transactions
 *
 * @param simulations - Array of simulation configs
 * @returns Array of simulation results
 */
export async function batchSimulate(
  simulations: Array<{
    address: Address;
    abi: any;
    functionName: string;
    args?: any[];
    account: Address;
  }>
): Promise<SimulationResult[]> {
  return Promise.all(
    simulations.map((sim) =>
      simulateTransaction(sim.address, sim.abi, sim.functionName, sim.args || [], sim.account)
    )
  );
}
