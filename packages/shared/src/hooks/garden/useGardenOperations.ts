/**
 * Garden Operations Hook
 *
 * Provides functions to manage garden members (gardeners and operators).
 * Uses the createGardenOperation factory for consistent behavior.
 */

import { useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useToastAction } from "../app/useToastAction";
import { createGardenOperation, GARDEN_OPERATIONS } from "./createGardenOperation";

export function useGardenOperations(gardenId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const { executeWithToast } = useToastAction();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Create memoized operations using the factory
  const operations = useMemo(() => {
    if (!walletClient || !address) {
      // Return no-op functions when wallet is not connected
      const notConnected = async () => {
        throw new Error("Wallet not connected");
      };
      return {
        addGardener: notConnected,
        removeGardener: notConnected,
        addOperator: notConnected,
        removeOperator: notConnected,
      };
    }

    return {
      addGardener: createGardenOperation(
        gardenId,
        GARDEN_OPERATIONS.addGardener,
        walletClient,
        address,
        executeWithToast,
        setIsLoading
      ),
      removeGardener: createGardenOperation(
        gardenId,
        GARDEN_OPERATIONS.removeGardener,
        walletClient,
        address,
        executeWithToast,
        setIsLoading
      ),
      addOperator: createGardenOperation(
        gardenId,
        GARDEN_OPERATIONS.addOperator,
        walletClient,
        address,
        executeWithToast,
        setIsLoading
      ),
      removeOperator: createGardenOperation(
        gardenId,
        GARDEN_OPERATIONS.removeOperator,
        walletClient,
        address,
        executeWithToast,
        setIsLoading
      ),
    };
  }, [gardenId, walletClient, address, executeWithToast]);

  return {
    ...operations,
    isLoading,
  };
}
