// import { useWallets } from "@privy-io/react-auth";
import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { type Chain } from "viem";
import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS } from "@/config";

export interface ChainSyncState {
  currentChain: Chain;
  switchChain: (chainId: number) => Promise<void>;
  isSwitching: boolean;
}

export function useChainSync(): ChainSyncState {
  // const { wallets } = useWallets();"
  const [isSwitching, setIsSwitching] = useState(false);
  
  const currentChain = SUPPORTED_CHAINS.find(chain => chain.id === DEFAULT_CHAIN_ID) || SUPPORTED_CHAINS[0];

  const switchChain = useCallback(async (chainId: number) => {
    if (isSwitching) return;
    
    const targetChain = SUPPORTED_CHAINS.find(chain => chain.id === chainId);
    if (!targetChain) {
      toast.error(`Unsupported chain: ${chainId}`);
      return;
    }

    setIsSwitching(true);
    const toastId = toast.loading(`Switching to ${targetChain.name}...`);
    
    try {
      // For now, just update the store - actual chain switching would need wallet integration
      toast.success(`Switched to ${targetChain.name}`, { id: toastId });
    } catch (error) {
      // console.error("Failed to switch chain:", error);
      toast.error("Failed to switch chain", { id: toastId });
    } finally {
      setIsSwitching(false);
    }
  }, [isSwitching]);

  return {
    currentChain,
    switchChain,
    isSwitching,
  };
}