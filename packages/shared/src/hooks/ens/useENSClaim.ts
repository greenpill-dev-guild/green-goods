/**
 * ENS Claim Mutation Hook
 *
 * Standalone mutation for claiming a *.greengoods.eth subdomain via Chainlink CCIP.
 * Detects auth mode: passkey users get sponsored registration (contract pays CCIP fee),
 * wallet users pay their own fee via msg.value.
 *
 * @module hooks/ens/useENSClaim
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decodeEventLog, encodeFunctionData, type Hex, zeroAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";

import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys } from "../../config/query-keys";
import { logger } from "../../modules/app/logger";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { parseContractError } from "../../utils/errors/contract-errors";
import { useAuth } from "../auth/useAuth";
import { isSlugAvailableAcrossChains } from "./availability";

// Contract error -> user-friendly message mapping
const ENS_ERROR_MESSAGES: Record<string, string> = {
  NameTaken: "This name is already taken. Please choose a different one.",
  InvalidSlug: "This name contains invalid characters.",
  NotProtocolMember: "You need to join a garden before claiming a name.",
  AlreadyHasName: "You already have a greengoods.eth name. Release it first.",
  CannotReleaseGardenName: "Garden names are permanent and cannot be released.",
  InsufficientFee: "Not enough ETH to cover the registration fee.",
  InsufficientSponsoredBalance:
    "The sponsored username fund needs more ETH before passkey users can claim names.",
  NameInCooldown: "This name was recently released and is in a 30-day cooldown.",
};

function createENSError(name: keyof typeof ENS_ERROR_MESSAGES) {
  const error = new Error(name);
  error.name = name;
  return error;
}

function getENSErrorMessage(error: Error, parsedName: string) {
  const directName = error.name in ENS_ERROR_MESSAGES ? error.name : null;
  const directMessage = error.message in ENS_ERROR_MESSAGES ? error.message : null;
  return ENS_ERROR_MESSAGES[directName ?? directMessage ?? parsedName] ?? null;
}

export interface ENSClaimResult {
  slug: string;
  ccipMessageId: string | null;
  submittedAt: number;
  txHash: Hex;
}

export function useENSClaim() {
  const queryClient = useQueryClient();
  const { authMode, smartAccountClient } = useAuth();
  const { address: walletAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const isPasskeyUser = authMode === "passkey";

  return useMutation<ENSClaimResult, Error, { slug: string }>({
    mutationFn: async ({ slug }) => {
      const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
      const ensAddress = contracts.greenGoodsENS;
      if (!ensAddress || ensAddress === zeroAddress) {
        throw new Error("ENS module not configured for this network");
      }

      const { publicClient } = createClients(DEFAULT_CHAIN_ID);
      let txHash: Hex;

      const isAvailable = await isSlugAvailableAcrossChains({
        slug,
        ensAddress,
        publicClient,
        chainId: DEFAULT_CHAIN_ID,
      });
      if (!isAvailable) {
        throw createENSError("NameTaken");
      }

      if (isPasskeyUser) {
        if (!smartAccountClient?.account) {
          throw new Error("Passkey smart account not ready");
        }

        const sponsoredOwner = smartAccountClient.account.address as Address | undefined;
        if (!sponsoredOwner) {
          throw new Error("Passkey smart account not ready");
        }

        const [fee, balance, totalPendingRefunds] = await Promise.all([
          publicClient.readContract({
            address: ensAddress,
            abi: GreenGoodsENSABI,
            functionName: "getRegistrationFee",
            args: [slug, sponsoredOwner, 0], // 0 = Gardener NameType
          }) as Promise<bigint>,
          publicClient.getBalance({ address: ensAddress }),
          publicClient
            .readContract({
              address: ensAddress,
              abi: GreenGoodsENSABI,
              functionName: "totalPendingRefunds",
            })
            .catch(() => 0n) as Promise<bigint>,
        ]);

        if (balance < fee + totalPendingRefunds) {
          throw createENSError("InsufficientSponsoredBalance");
        }

        // Passkey user: sponsored registration (CCIP fee from contract balance)
        const data = encodeFunctionData({
          abi: GreenGoodsENSABI,
          functionName: "claimNameSponsored",
          args: [slug],
        });
        txHash = await smartAccountClient.sendTransaction({
          account: smartAccountClient.account,
          chain: smartAccountClient.chain,
          to: ensAddress,
          data,
        });
      } else if (walletClient && walletAddress) {
        // Wallet user: user-funded registration
        const fee = await publicClient.readContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "getRegistrationFee",
          args: [slug, walletAddress, 0], // 0 = Gardener NameType
        });
        txHash = await walletClient.writeContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "claimName",
          args: [slug],
          value: fee as bigint,
        });
      } else {
        throw new Error("No connected account");
      }

      // Wait for receipt and parse NameRegistrationSent event
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: TX_RECEIPT_TIMEOUT_MS,
      });

      let ccipMessageId: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: GreenGoodsENSABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "NameRegistrationSent") {
            ccipMessageId = (decoded.args as unknown as { messageId: Hex }).messageId;
            break;
          }
        } catch {
          // Not our event, skip
        }
      }

      return { slug, ccipMessageId, submittedAt: Date.now(), txHash };
    },
    onSuccess: (data) => {
      // Seed registration status query with initial "pending" data
      queryClient.setQueryData(queryKeys.ens.registrationStatus(data.slug), {
        status: "pending" as const,
        ccipMessageId: data.ccipMessageId,
        submittedAt: data.submittedAt,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.ens.all });

      toastService.success({
        title: "Name registration started",
        description: `${data.slug}.greengoods.eth will be active in ~15-20 minutes.`,
      });
    },
    onError: (error) => {
      const parsed = parseContractError(error);
      const message =
        getENSErrorMessage(error, parsed.name) || "Registration failed. Please try again.";
      logger.error("ENS claim failed", { error, parsed });
      toastService.error({ title: "Registration failed", description: message });
    },
  });
}
