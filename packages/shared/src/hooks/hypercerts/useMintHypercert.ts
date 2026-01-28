import { validateAllowlist as sdkValidateAllowlist } from "@hypercerts-org/sdk";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo } from "react";
import { type Address, decodeEventLog, getAddress, type Hex, isAddress, zeroAddress } from "viem";
import { useWalletClient } from "wagmi";
import { fromPromise } from "xstate";

import { DEFAULT_CHAIN_ID, createPublicClientForChain } from "../../config";
import {
  TOTAL_UNITS,
  TransferRestrictions,
  encodeCreateAllowlist,
  generateMerkleTree,
  validateAllowlist as validateAllowlistEntries,
  validateMetadata,
} from "../../lib/hypercerts";
import { logger } from "../../modules/app/logger";
import { uploadJSONToIPFS, getIpfsInitStatus } from "../../modules";
import type {
  AllowlistEntry,
  HypercertAttestation,
  HypercertDraft,
  HypercertMetadata,
} from "../../types/hypercerts";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { useHypercertWizardStore } from "../../stores/useHypercertWizardStore";
import {
  mintHypercertMachine,
  type MintHypercertInput,
  type MintHypercertSigningInput,
  type MintHypercertReceiptInput,
} from "../../workflows/mintHypercert";
import { useAuth } from "../auth/useAuth";

/**
 * Chain-specific Hypercert Minter contract addresses.
 * Used as fallback when the deployment registry is unavailable.
 *
 * @see https://github.com/hypercerts-org/hypercerts/blob/main/contracts/deployments
 */
const HYPERCERT_MINTER_BY_CHAIN: Record<number, Address> = {
  // Testnets
  84532: "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07", // Base Sepolia
  11155111: "0xa16DFb32Eb140a6f3F2AC68f41dAd8c7e83C4941", // Sepolia

  // Mainnets
  10: "0xC2d179166bc9dbB00A03686a5b17eBe2224c2704", // Optimism
  42161: "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07", // Arbitrum (per protocol config)
  42220: "0x16bA53B74c234C870c61EFC04cD418B8f2865959", // Celo
  8453: "0xC2d179166bc9dbB00A03686a5b17eBe2224c2704", // Base
};

/**
 * Get the Hypercert Minter address for a chain.
 * Falls back to Base Sepolia if chain is not supported.
 */
function getHypercertMinterFallback(chainId: number): Address {
  const address = HYPERCERT_MINTER_BY_CHAIN[chainId];
  if (!address) {
    logger.warn("[useMintHypercert] No Hypercert Minter fallback for chain, using Base Sepolia", {
      chainId,
      fallbackChainId: 84532,
    });
    return HYPERCERT_MINTER_BY_CHAIN[84532];
  }
  return address;
}

/** Maps XState machine states to public status values */
const MINT_STATUS_MAP: Record<string, UseMintHypercertResult["status"]> = {
  idle: "idle",
  uploadingMetadata: "uploading_metadata",
  uploadingAllowlist: "uploading_allowlist",
  signing: "building_userop",
  awaitingSignature: "awaiting_signature",
  submitting: "submitting",
  pending: "pending",
  confirmed: "confirmed",
  failed: "failed",
};

const ERC1155_TRANSFER_SINGLE_ABI = [
  {
    type: "event",
    name: "TransferSingle",
    inputs: [
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "id", type: "uint256" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

const DEPLOYMENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "getNetworkConfigForChain",
    stateMutability: "view",
    inputs: [{ name: "chainId", type: "uint256" }],
    outputs: [
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "eas", type: "address" },
          { name: "easSchemaRegistry", type: "address" },
          { name: "communityToken", type: "address" },
          { name: "actionRegistry", type: "address" },
          { name: "gardenToken", type: "address" },
          { name: "workResolver", type: "address" },
          { name: "workApprovalResolver", type: "address" },
          { name: "assessmentResolver", type: "address" },
          { name: "integrationRouter", type: "address" },
          { name: "hatsAccessControl", type: "address" },
          { name: "octantFactory", type: "address" },
          { name: "unlockFactory", type: "address" },
          { name: "hypercerts", type: "address" },
          { name: "greenWillRegistry", type: "address" },
        ],
      },
    ],
  },
] as const;

const HATS_MODULE_ABI = [
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function serializeAllowlistTree(tree: ReturnType<typeof generateMerkleTree>["tree"]) {
  return tree.dump();
}

/** Maximum time (ms) to wait for transaction receipt before timing out */
const RECEIPT_POLLING_TIMEOUT_MS = 120_000; // 2 minutes

/** i18n key for timeout errors - consumers should resolve this key via localization */
const TIMEOUT_ERROR_KEY = "app.errors.timeout.transactionConfirmation";

/**
 * Custom error class for timeout operations.
 * Consumers can check `instanceof TimeoutError` or access `i18nKey`/`operation` properties.
 */
export class TimeoutError extends Error {
  readonly name = "TimeoutError" as const;
  readonly i18nKey = TIMEOUT_ERROR_KEY;
  readonly operation: string;

  constructor(operation: string) {
    super(`Operation timed out: ${operation}`);
    this.operation = operation;
  }
}

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within the specified duration.
 * Note: Error contains an i18n key that should be resolved by consumers.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(operation)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

function isZeroAddress(address?: Address | null) {
  return !address || address.toLowerCase() === zeroAddress;
}

async function resolveHypercertContracts(chainId: number): Promise<{
  hypercertMinter: Address;
  hatsModule?: Address;
}> {
  const contracts = getNetworkContracts(chainId);
  const deploymentRegistry = contracts.deploymentRegistry as Address;
  const fallbackMinter = getHypercertMinterFallback(chainId);

  if (!deploymentRegistry || isZeroAddress(deploymentRegistry)) {
    logger.info("[useMintHypercert] No deployment registry, using fallback Hypercert Minter", {
      chainId,
      fallbackMinter,
    });
    return {
      hypercertMinter: fallbackMinter,
    };
  }

  try {
    const publicClient = createPublicClientForChain(chainId);
    const config = await publicClient.readContract({
      address: deploymentRegistry,
      abi: DEPLOYMENT_REGISTRY_ABI,
      functionName: "getNetworkConfigForChain",
      args: [BigInt(chainId)],
    });

    const result = config as {
      hatsAccessControl: Address;
      hypercerts: Address;
    };

    return {
      hypercertMinter: !isZeroAddress(result.hypercerts)
        ? getAddress(result.hypercerts)
        : fallbackMinter,
      hatsModule: !isZeroAddress(result.hatsAccessControl)
        ? getAddress(result.hatsAccessControl)
        : undefined,
    };
  } catch (error) {
    logger.warn("[useMintHypercert] Failed to read deployment registry, using fallback", {
      correlationId: `resolve-contracts-${chainId}`,
      chainId,
      deploymentRegistry,
      fallbackMinter,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      hypercertMinter: fallbackMinter,
    };
  }
}

function extractHypercertIdFromLogs(
  logs: Array<{ address: Address } & Record<string, unknown>>,
  chainId: number
): string | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ERC1155_TRANSFER_SINGLE_ABI,
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });

      if (decoded.eventName !== "TransferSingle") continue;

      const args = decoded.args as {
        from: Address;
        id: bigint;
      };

      if (args.from.toLowerCase() === zeroAddress) {
        return `${chainId}-${args.id.toString()}`;
      }
    } catch {
      // Ignore non-matching logs
    }
  }
  return null;
}

export interface UseMintHypercertResult {
  status:
    | "idle"
    | "uploading_metadata"
    | "uploading_allowlist"
    | "building_userop"
    | "awaiting_signature"
    | "submitting"
    | "pending"
    | "confirmed"
    | "failed";
  metadataCid: string | null;
  allowlistCid: string | null;
  merkleRoot: string | null;
  userOpHash: string | null;
  txHash: string | null;
  hypercertId: string | null;
  error: string | null;
  mint: (params: {
    draft: HypercertDraft;
    attestations: HypercertAttestation[];
    allowlist: AllowlistEntry[];
    metadata: HypercertMetadata;
  }) => Promise<void>;
  retry: () => void;
  cancel: () => void;
}

export function useMintHypercert(): UseMintHypercertResult {
  const { smartAccountClient, authMode, smartAccountAddress, eoaAddress } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const setMintingState = useHypercertWizardStore((state) => state.setMintingState);

  logger.debug("[useMintHypercert] Hook initializing", {
    hasSmartAccountClient: !!smartAccountClient,
    authMode,
    chainId,
    hasWalletClient: !!walletClient,
  });

  const machine = useMemo(
    () => {
      logger.debug("[useMintHypercert] Creating machine with provide()");

      const providedMachine = mintHypercertMachine.provide({
        actors: {
          uploadMetadata: fromPromise(async ({ input }: { input: MintHypercertInput }) => {
            logger.debug("[useMintHypercert] uploadMetadata actor starting", { hasInput: !!input });
            const validation = validateMetadata(input.metadata);
            if (!validation.valid) {
              const message =
                Object.values(validation.errors ?? {}).join(", ") || "Invalid metadata";
              throw new Error(message);
            }

            const result = await uploadJSONToIPFS(
              input.metadata as unknown as Record<string, unknown>,
              {
                source: "hypercert-minting-metadata",
                gardenAddress: input.gardenAddress,
                authMode,
                metadataType: "hypercert",
              }
            );

            return { cid: result.cid };
          }),
          uploadAllowlist: fromPromise(async ({ input }: { input: MintHypercertInput }) => {
            const validation = sdkValidateAllowlist(input.allowlist, input.totalUnits);
            if (!validation.valid) {
              const message =
                Object.values(validation.errors ?? {}).join(", ") || "Invalid allowlist";
              throw new Error(message);
            }

            const tree = generateMerkleTree(input.allowlist);
            const payload = serializeAllowlistTree(tree.tree);

            const result = await uploadJSONToIPFS(payload as unknown as Record<string, unknown>, {
              source: "hypercert-minting-allowlist",
              gardenAddress: input.gardenAddress,
              authMode,
              metadataType: "hypercert-allowlist",
            });

            return { cid: result.cid, merkleRoot: tree.root };
          }),
          buildAndSignUserOp: fromPromise(async ({ input }: { input: MintHypercertSigningInput }) => {
            if (!input.metadataCid) {
              throw new Error("Missing metadata CID");
            }
            if (!input.merkleRoot) {
              throw new Error("Missing merkle root");
            }

            const contracts = await resolveHypercertContracts(chainId);
            const callData = encodeCreateAllowlist({
              account: smartAccountClient?.account?.address || (eoaAddress as Address),
              totalUnits: input.totalUnits,
              merkleRoot: input.merkleRoot,
              metadataUri: `ipfs://${input.metadataCid}`,
              transferRestrictions: TransferRestrictions.AllowAll,
            });

            if (smartAccountClient) {
              const userOpHash = await smartAccountClient.sendUserOperation({
                account: smartAccountClient.account,
                calls: [
                  {
                    to: contracts.hypercertMinter,
                    data: callData,
                    value: 0n,
                  },
                ],
              });

              return { hash: userOpHash };
            }

            if (!walletClient || !eoaAddress) {
              throw new Error("Connect a wallet to mint the hypercert");
            }

            const txHash = await walletClient.writeContract({
              address: contracts.hypercertMinter,
              abi: [
                {
                  type: "function",
                  name: "createAllowlist",
                  stateMutability: "nonpayable",
                  inputs: [
                    { name: "account", type: "address" },
                    { name: "totalUnits", type: "uint256" },
                    { name: "merkleRoot", type: "bytes32" },
                    { name: "metadataUri", type: "string" },
                    { name: "transferRestrictions", type: "uint8" },
                  ],
                  outputs: [{ name: "hypercertId", type: "uint256" }],
                },
              ],
              functionName: "createAllowlist",
              args: [
                eoaAddress as Address,
                input.totalUnits,
                input.merkleRoot,
                `ipfs://${input.metadataCid}`,
                TransferRestrictions.AllowAll,
              ],
              account: eoaAddress as Address,
            });

            return { hash: txHash };
          }),
          pollForReceipt: fromPromise(async ({ input }: { input: MintHypercertReceiptInput }) => {
            const contracts = await resolveHypercertContracts(chainId);
            const publicClient = createPublicClientForChain(chainId);

            if (smartAccountClient) {
              const receipt = await withTimeout(
                smartAccountClient.getUserOperationReceipt({
                  hash: input.hash,
                }),
                RECEIPT_POLLING_TIMEOUT_MS,
                "Transaction confirmation"
              );

              const txHash = receipt.receipt.transactionHash as Hex;
              const hypercertId = extractHypercertIdFromLogs(
                receipt.logs.filter(
                  (log) => log.address.toLowerCase() === contracts.hypercertMinter.toLowerCase()
                ) as Array<{ address: Address } & Record<string, unknown>>,
                chainId
              );

              return {
                txHash,
                hypercertId: hypercertId ?? "",
              };
            }

            const receipt = await withTimeout(
              publicClient.waitForTransactionReceipt({ hash: input.hash }),
              RECEIPT_POLLING_TIMEOUT_MS,
              "Transaction confirmation"
            );
            const hypercertId = extractHypercertIdFromLogs(
              receipt.logs.filter(
                (log) => log.address.toLowerCase() === contracts.hypercertMinter.toLowerCase()
              ) as Array<{ address: Address } & Record<string, unknown>>,
              chainId
            );

            return {
              txHash: receipt.transactionHash,
              hypercertId: hypercertId ?? "",
            };
          }),
        },
      } as never);

      logger.debug("[useMintHypercert] Machine created successfully", {
        machineId: providedMachine.id,
        machineType: typeof providedMachine,
        hasConfig: !!providedMachine.config,
      });

      // Debug: Check the actors in the provided machine
      const implementations = (providedMachine as unknown as { implementations?: unknown }).implementations;
      logger.debug("[useMintHypercert] Machine implementations", {
        hasImplementations: !!implementations,
        implementationsType: typeof implementations,
        implementationsKeys: implementations ? Object.keys(implementations as object) : [],
      });

      return providedMachine;
    },
    [authMode, chainId, eoaAddress, smartAccountClient, walletClient]
  );

  logger.debug("[useMintHypercert] About to call useMachine", {
    machineId: machine?.id,
    machineType: typeof machine,
    machineKeys: machine ? Object.keys(machine).slice(0, 10) : [],
  });

  const [state, send] = useMachine(machine);

  logger.debug("[useMintHypercert] useMachine succeeded", {
    stateValue: state.value,
  });

  useEffect(() => {
    const status = MINT_STATUS_MAP[state.value as string] ?? "idle";

    // Log detailed error information when minting fails
    if (status === "failed" && state.context.error) {
      logger.error("[useMintHypercert] Minting failed", {
        error: state.context.error,
        lastStep: state.value,
        context: {
          hasMetadataCid: !!state.context.metadataCid,
          hasAllowlistCid: !!state.context.allowlistCid,
          hasMerkleRoot: !!state.context.merkleRoot,
          hasUserOpHash: !!state.context.userOpHash,
          hasTxHash: !!state.context.txHash,
          retryCount: state.context.retryCount,
        },
        chainId,
        authMode,
      });
    }

    setMintingState({
      status,
      metadataCid: state.context.metadataCid,
      allowlistCid: state.context.allowlistCid,
      merkleRoot: state.context.merkleRoot,
      userOpHash: state.context.userOpHash,
      txHash: state.context.txHash,
      hypercertId: state.context.hypercertId,
      error: state.context.error,
    });
  }, [authMode, chainId, setMintingState, state]);

  const mint = useCallback(
    async (params: {
      draft: HypercertDraft;
      attestations: HypercertAttestation[];
      allowlist: AllowlistEntry[];
      metadata: HypercertMetadata;
    }) => {
      logger.debug("[useMintHypercert] mint() called", {
        gardenId: params.draft.gardenId,
        attestationCount: params.attestations.length,
        allowlistCount: params.allowlist.length,
        hasMetadata: !!params.metadata,
      });

      if (!params.allowlist.length) {
        throw new Error("Allowlist is empty");
      }

      // Check IPFS is initialized before attempting mint
      const ipfsStatus = getIpfsInitStatus();
      if (!ipfsStatus.clientReady) {
        const errorDetail = ipfsStatus.error ? `: ${ipfsStatus.error}` : "";
        logger.error("[useMintHypercert] IPFS not ready for minting", {
          status: ipfsStatus.status,
          error: ipfsStatus.error,
        });
        throw new Error(
          `IPFS storage is not configured. Please check your Storacha credentials${errorDetail}`
        );
      }

      const operatorAddress = smartAccountAddress || eoaAddress;
      if (!operatorAddress || !isAddress(operatorAddress)) {
        throw new Error("Connect a wallet or passkey to mint");
      }

      const allowlistValidation = validateAllowlistEntries(params.allowlist);
      if (!allowlistValidation.valid) {
        throw new Error(allowlistValidation.error || "Allowlist invalid");
      }

      const sdkValidation = sdkValidateAllowlist(params.allowlist, TOTAL_UNITS);
      if (!sdkValidation.valid) {
        const message = Object.values(sdkValidation.errors ?? {}).join(", ") || "Allowlist invalid";
        throw new Error(message);
      }

      const contracts = await resolveHypercertContracts(chainId);
      if (contracts.hatsModule) {
        const publicClient = createPublicClientForChain(chainId);
        const isOperator = await publicClient.readContract({
          address: contracts.hatsModule,
          abi: HATS_MODULE_ABI,
          functionName: "isOperator",
          args: [params.draft.gardenId as Address, operatorAddress as Address],
        });

        if (!isOperator) {
          throw new Error("Only garden operators can mint hypercerts");
        }
      }

      const input: MintHypercertInput = {
        metadata: params.metadata,
        allowlist: params.allowlist,
        totalUnits: TOTAL_UNITS,
        gardenAddress: params.draft.gardenId as Address,
        attestationUIDs: params.attestations.map((attestation) => attestation.id as Hex),
      };

      logger.debug("[useMintHypercert] Sending START_MINT event", {
        hasInput: !!input,
        totalUnits: input.totalUnits.toString(),
        allowlistLength: input.allowlist.length,
      });

      try {
        send({ type: "START_MINT", input });
        logger.debug("[useMintHypercert] START_MINT event sent successfully");
      } catch (err) {
        logger.error("[useMintHypercert] send() threw error", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        throw err;
      }
    },
    [chainId, eoaAddress, send, smartAccountAddress]
  );

  return {
    status: MINT_STATUS_MAP[state.value as string] ?? "idle",
    metadataCid: state.context.metadataCid,
    allowlistCid: state.context.allowlistCid,
    merkleRoot: state.context.merkleRoot,
    userOpHash: state.context.userOpHash,
    txHash: state.context.txHash,
    hypercertId: state.context.hypercertId,
    error: state.context.error,
    mint,
    retry: () => send({ type: "RETRY" }),
    cancel: () => send({ type: "CANCEL" }),
  };
}
