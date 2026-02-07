/**
 * Hypercert Minting Hook
 *
 * React hook for minting hypercerts with XState state machine orchestration.
 * Handles metadata upload, allowlist validation, and transaction submission.
 *
 * @module hooks/hypercerts/useMintHypercert
 */

import { validateAllowlist as sdkValidateAllowlist } from "@hypercerts-org/sdk";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo } from "react";
import { type Address, type Hex, isAddress } from "viem";
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
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { useHypercertWizardStore } from "../../stores/useHypercertWizardStore";
import {
  mintHypercertMachine,
  type MintHypercertInput,
  type MintHypercertSigningInput,
  type MintHypercertReceiptInput,
} from "../../workflows/mintHypercert";
import { useAuth } from "../auth/useAuth";

// Import from extracted modules
import { CREATE_ALLOWLIST_ABI } from "./hypercert-abis";
import { GARDEN_ACCOUNT_ROLE_ABI } from "../../utils/blockchain/abis";
import { resolveHypercertContracts } from "./hypercert-contracts";
import {
  TimeoutError,
  withTimeout,
  extractHypercertIdFromLogs,
  serializeAllowlistTree,
  RECEIPT_POLLING_TIMEOUT_MS,
} from "./hypercert-utils";

// Re-export TimeoutError for consumers
export { TimeoutError };

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

  const machine = useMemo(() => {
    logger.debug("[useMintHypercert] Creating machine with provide()");

    const providedMachine = mintHypercertMachine.provide({
      actors: {
        // Note: XState automatically stops actors if the machine transitions away (e.g., on CANCEL).
        // Full cancellation of in-flight IPFS uploads would require Storacha library support
        // for AbortSignal, which is not currently available.
        uploadMetadata: fromPromise(async ({ input }: { input: MintHypercertInput }) => {
          logger.debug("[useMintHypercert] uploadMetadata actor starting", { hasInput: !!input });
          const validation = validateMetadata(input.metadata);
          if (!validation.valid) {
            const message = Object.values(validation.errors ?? {}).join(", ") || "Invalid metadata";
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
            abi: CREATE_ALLOWLIST_ABI,
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

            if (hypercertId === null) {
              logger.warn("[useMintHypercert] Failed to extract hypercertId from logs", {
                txHash,
                logsCount: receipt.logs.length,
              });
            }

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

          if (hypercertId === null) {
            logger.warn("[useMintHypercert] Failed to extract hypercertId from logs", {
              txHash: receipt.transactionHash,
              logsCount: receipt.logs.length,
            });
          }

          return {
            txHash: receipt.transactionHash,
            hypercertId: hypercertId ?? "",
          };
        }),
      },
      // XState's strict typing for provide() expects exact type matches for actors.
      // The runtime implementation is type-safe, but TypeScript cannot infer the
      // correct types through the provide() boundary. We use 'as unknown as typeof'
      // to maintain some type safety while satisfying the compiler. The actual actor
      // implementations are verified at runtime.
      // See: https://stately.ai/docs/actors#fromPromise
    } as unknown as typeof mintHypercertMachine.implementations);

    logger.debug("[useMintHypercert] Machine created successfully", {
      machineId: providedMachine.id,
      machineType: typeof providedMachine,
      hasConfig: !!providedMachine.config,
    });

    // Debug introspection - only run in development
    if (process.env.NODE_ENV === "development") {
      const implementations = (providedMachine as unknown as { implementations?: unknown })
        .implementations;
      logger.debug("[useMintHypercert] Machine implementations", {
        hasImplementations: !!implementations,
        implementationsType: typeof implementations,
        implementationsKeys: implementations ? Object.keys(implementations as object) : [],
      });
    }

    return providedMachine;
  }, [authMode, chainId, eoaAddress, smartAccountClient, walletClient]);

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
          address: params.draft.gardenId as Address,
          abi: GARDEN_ACCOUNT_ROLE_ABI,
          functionName: "isOperator",
          args: [operatorAddress as Address],
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
