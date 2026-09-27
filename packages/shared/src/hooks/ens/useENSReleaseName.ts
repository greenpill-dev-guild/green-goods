/**
 * ENS Release Mutation Hook
 *
 * Releases the caller's current *.greengoods.eth subdomain. Releases are
 * sponsored where the ENS sender supports it: the contract pays the CCIP fee.
 * The legacy Arbitrum sender has no sponsored release, so there passkey users
 * are steward-assisted and wallet users pay the fee themselves. A wallet's
 * share is checked before the wallet opens.
 *
 * @module hooks/ens/useENSReleaseName
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Address,
  decodeEventLog,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  zeroAddress,
} from "viem";
import { useAccount, useWalletClient } from "wagmi";

import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getChain } from "../../config/chains";
import { ensKeys } from "../../config/query-keys/identity";
import { logger } from "../../modules/app/logger";
import { ensureAppKitWalletChain } from "../../modules/transactions/chain-guard";
import {
  assertLocalArbitrumForkSmartAccountsDisabled,
  assertLocalArbitrumForkWallet,
} from "../../modules/transactions/local-fork-safety";
import {
  assertWalletCanFundTransaction,
  WalletCannotFundTransactionError,
} from "../../modules/transactions/wallet-funding";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { parseContractError } from "../../utils/errors/contract-errors";
import { useAuth } from "../auth/useAuth";

const ENS_RELEASE_ERROR_MESSAGES: Record<string, string> = {
  NoNameToRelease: "You do not have a greengoods.eth name to release.",
  CannotReleaseGardenName: "Garden names are permanent and cannot be released.",
  InsufficientFee: "Not enough ETH to cover the release fee.",
  InsufficientSponsoredBalance:
    "The sponsored username fund needs more ETH before names can be released.",
  SponsoredReleaseUnavailable:
    "Username changes are temporarily steward-assisted while we migrate the ENS sender.",
  NotOwner: "Only the current name owner can release this name.",
};

const LEGACY_ENS_SENDERS_WITHOUT_SPONSORED_RELEASE = new Set([
  "0x4fad8db8e04005884d484ec730adae10d7a2e491",
]);

function isSponsoredENSReleaseUnavailable(ensAddress: Address | null | undefined) {
  return Boolean(
    ensAddress && LEGACY_ENS_SENDERS_WITHOUT_SPONSORED_RELEASE.has(ensAddress.toLowerCase())
  );
}

function createENSReleaseError(name: keyof typeof ENS_RELEASE_ERROR_MESSAGES) {
  const error = new Error(name);
  error.name = name;
  return error;
}

function getENSReleaseErrorMessage(error: Error, parsedName: string) {
  const directName = error.name in ENS_RELEASE_ERROR_MESSAGES ? error.name : null;
  const directMessage = error.message in ENS_RELEASE_ERROR_MESSAGES ? error.message : null;
  return ENS_RELEASE_ERROR_MESSAGES[directName ?? directMessage ?? parsedName] ?? null;
}

function readReleaseFee(publicClient: PublicClient, ensAddress: Address, slug: string) {
  return publicClient.readContract({
    address: ensAddress,
    abi: GreenGoodsENSABI,
    functionName: "getReleaseFee",
    args: [slug],
  }) as Promise<bigint>;
}

/** Rejects a release the sponsored fund cannot pay for, before anything is signed. */
async function assertSponsoredReleaseFunded(params: {
  publicClient: PublicClient;
  ensAddress: Address;
  slug: string;
}) {
  const { publicClient, ensAddress, slug } = params;
  const [fee, balance, totalPendingRefunds] = await Promise.all([
    readReleaseFee(publicClient, ensAddress, slug),
    publicClient.getBalance({ address: ensAddress }),
    publicClient
      .readContract({
        address: ensAddress,
        abi: GreenGoodsENSABI,
        functionName: "totalPendingRefunds",
      })
      .catch((error: unknown) => {
        logger.warn("Failed to read totalPendingRefunds; assuming zero for precheck", {
          error,
        });
        return 0n;
      }) as Promise<bigint>,
  ]);

  if (balance < fee + totalPendingRefunds) {
    throw createENSReleaseError("InsufficientSponsoredBalance");
  }
}

export interface ENSReleaseResult {
  slug: string;
  owner: Address;
  ccipMessageId: string | null;
  submittedAt: number;
  txHash: Hex;
}

export function useENSReleaseName() {
  const queryClient = useQueryClient();
  const { authMode, smartAccountClient } = useAuth();
  const { address: walletAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const isPasskeyUser = authMode === "passkey";
  const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
  const ensAddress = contracts.greenGoodsENS as Address;
  const isSponsoredReleaseUnavailable =
    isPasskeyUser && isSponsoredENSReleaseUnavailable(ensAddress);

  const mutation = useMutation<ENSReleaseResult, Error, void>({
    mutationFn: async () => {
      if (!ensAddress || ensAddress === zeroAddress) {
        throw new Error("ENS module not configured for this network");
      }

      const { publicClient } = createClients(DEFAULT_CHAIN_ID);
      let txHash: Hex;
      let owner: Address;
      let slug: string;

      if (isPasskeyUser) {
        if (!smartAccountClient?.account) {
          throw new Error("Passkey smart account not ready");
        }
        if (isSponsoredReleaseUnavailable) {
          throw createENSReleaseError("SponsoredReleaseUnavailable");
        }

        owner = smartAccountClient.account.address as Address;
        slug = (await publicClient.readContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "ownerToSlug",
          args: [owner],
        })) as string;
        if (!slug) throw createENSReleaseError("NoNameToRelease");

        await assertSponsoredReleaseFunded({ publicClient, ensAddress, slug });

        const data = encodeFunctionData({
          abi: GreenGoodsENSABI,
          functionName: "releaseNameSponsored",
        });
        assertLocalArbitrumForkSmartAccountsDisabled();

        txHash = await smartAccountClient.sendTransaction({
          account: smartAccountClient.account,
          chain: smartAccountClient.chain,
          to: ensAddress,
          data,
        });
      } else if (walletClient && walletAddress) {
        owner = walletAddress;
        slug = (await publicClient.readContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "ownerToSlug",
          args: [owner],
        })) as string;
        if (!slug) throw createENSReleaseError("NoNameToRelease");

        // Wallets take the sponsored release where the sender has one and pay
        // only gas. On the legacy sender they pay the release fee as value.
        const sponsored = !isSponsoredENSReleaseUnavailable(ensAddress);
        let value = 0n;
        if (sponsored) {
          await assertSponsoredReleaseFunded({ publicClient, ensAddress, slug });
        } else {
          value = await readReleaseFee(publicClient, ensAddress, slug);
        }
        const data = encodeFunctionData({
          abi: GreenGoodsENSABI,
          functionName: sponsored ? "releaseNameSponsored" : "releaseName",
        });

        // A wallet opened for a release it cannot pay for shows no request.
        try {
          await assertWalletCanFundTransaction(publicClient, {
            account: owner,
            to: ensAddress,
            data,
            value,
          });
        } catch (error) {
          // Paying its own fee, the wallet is short mostly of the fee, not gas.
          if (!sponsored && error instanceof WalletCannotFundTransactionError) {
            throw createENSReleaseError("InsufficientFee");
          }
          throw error;
        }
        await ensureAppKitWalletChain(DEFAULT_CHAIN_ID);
        await assertLocalArbitrumForkWallet();

        txHash = await walletClient.sendTransaction({
          account: walletClient.account,
          chain: getChain(DEFAULT_CHAIN_ID),
          to: ensAddress,
          data,
          value,
        });
      } else {
        throw new Error("No connected account");
      }

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
          if (decoded.eventName === "NameReleaseSent") {
            ccipMessageId = (decoded.args as unknown as { messageId: Hex }).messageId;
            break;
          }
        } catch {
          // Not our event, skip
        }
      }

      return { slug, owner, ccipMessageId, submittedAt: Date.now(), txHash };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ensKeys.protocolName(data.owner), null);
      queryClient.invalidateQueries({ queryKey: ensKeys.all });

      toastService.success({
        title: "Name release started",
        description: `${data.slug}.greengoods.eth will be released in ~15-20 minutes.`,
      });
    },
    onError: (error) => {
      const parsed = parseContractError(error);
      // ENS wording first, then the shared wording for wallet errors it recognises
      // (such as a wallet short of gas).
      const message =
        getENSReleaseErrorMessage(error, parsed.name) ||
        (parsed.isKnown ? parsed.message : null) ||
        "Release failed. Please try again.";
      logger.error("ENS release failed", { error, parsed });
      toastService.error({ title: "Release failed", description: message });
    },
  });

  return {
    ...mutation,
    isSponsoredReleaseUnavailable,
  };
}
