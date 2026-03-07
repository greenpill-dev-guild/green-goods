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
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { type Hex, encodeFunctionData, isAddress } from "viem";
import { useWalletClient } from "wagmi";
import { fromPromise } from "xstate";

import { toastService } from "../../components/toast";
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
import type { Address } from "../../types/domain";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { useHypercertWizardStore } from "../../stores/useHypercertWizardStore";
import {
  mintHypercertMachine,
  type MintHypercertInput,
  type MintHypercertSigningInput,
  type MintHypercertReceiptInput,
  type RegisterInSignalPoolInput,
} from "../../workflows/mintHypercert";
import { useAuth } from "../auth/useAuth";

// Import from extracted modules
import { CREATE_ALLOWLIST_ABI } from "./hypercert-abis";
import { GARDENS_MODULE_ABI, HYPERCERT_SIGNAL_POOL_ABI } from "../../utils/blockchain/abis";
import { resolveHypercertContracts } from "./hypercert-contracts";
import { GardenAccountABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import {
  TimeoutError,
  withTimeout,
  extractHypercertIdFromLogs,
  serializeAllowlistTree,
  RECEIPT_POLLING_TIMEOUT_MS,
} from "./hypercert-utils";
import { isZeroAddress } from "../../utils/blockchain/address";

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
  registeringProposal: "registering_proposal",
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
    | "registering_proposal"
    | "confirmed"
    | "failed";
  metadataCid: string | null;
  allowlistCid: string | null;
  merkleRoot: string | null;
  userOpHash: string | null;
  txHash: string | null;
  hypercertId: string | null;
  error: string | null;
  poolRegistered: boolean | null;
  signalPoolAddress: string | null;
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
  const { formatMessage } = useIntl();

  // Store mutable dependencies in refs so the machine actor can read
  // current values without recreating the machine on every change.
  // This prevents loss of active mint progress on wallet reconnect.
  const walletClientRef = useRef(walletClient);
  const smartAccountClientRef = useRef(smartAccountClient);
  const eoaAddressRef = useRef(eoaAddress);
  const authModeRef = useRef(authMode);
  const chainIdRef = useRef(chainId);

  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);
  useEffect(() => {
    smartAccountClientRef.current = smartAccountClient;
  }, [smartAccountClient]);
  useEffect(() => {
    eoaAddressRef.current = eoaAddress;
  }, [eoaAddress]);
  useEffect(() => {
    authModeRef.current = authMode;
  }, [authMode]);
  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  const machine = useMemo(() => {
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
              authMode: authModeRef.current,
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
            authMode: authModeRef.current,
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

          const currentSmartAccountClient = smartAccountClientRef.current;
          const currentEoaAddress = eoaAddressRef.current;
          const currentWalletClient = walletClientRef.current;
          const currentChainId = chainIdRef.current;

          const contracts = await resolveHypercertContracts(currentChainId);
          const callData = encodeCreateAllowlist({
            account: currentSmartAccountClient?.account?.address || (currentEoaAddress as Address),
            totalUnits: input.totalUnits,
            merkleRoot: input.merkleRoot,
            metadataUri: `ipfs://${input.metadataCid}`,
            transferRestrictions: TransferRestrictions.AllowAll,
          });

          if (currentSmartAccountClient) {
            const userOpHash = await currentSmartAccountClient.sendUserOperation({
              account: currentSmartAccountClient.account,
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

          if (!currentWalletClient || !currentEoaAddress) {
            throw new Error("Connect a wallet to mint the hypercert");
          }

          const txHash = await currentWalletClient.writeContract({
            address: contracts.hypercertMinter,
            abi: CREATE_ALLOWLIST_ABI,
            functionName: "createAllowlist",
            args: [
              currentEoaAddress as Address,
              input.totalUnits,
              input.merkleRoot,
              `ipfs://${input.metadataCid}`,
              TransferRestrictions.AllowAll,
            ],
            account: currentEoaAddress as Address,
          });

          return { hash: txHash };
        }),
        pollForReceipt: fromPromise(async ({ input }: { input: MintHypercertReceiptInput }) => {
          const currentSmartAccountClient = smartAccountClientRef.current;
          const currentChainId = chainIdRef.current;

          const contracts = await resolveHypercertContracts(currentChainId);
          const publicClient = createPublicClientForChain(currentChainId);

          if (currentSmartAccountClient) {
            const receipt = await withTimeout(
              currentSmartAccountClient.getUserOperationReceipt({
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
              currentChainId
            );

            if (hypercertId === null) {
              logger.warn("[useMintHypercert] Failed to extract hypercertId from logs", {
                txHash,
                logsCount: receipt.logs.length,
              });
              throw new Error(
                "Failed to extract hypercert ID from transaction logs. The mint transaction succeeded but the hypercert ID could not be determined."
              );
            }

            return {
              txHash,
              hypercertId,
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
            currentChainId
          );

          if (hypercertId === null) {
            logger.warn("[useMintHypercert] Failed to extract hypercertId from logs", {
              txHash: receipt.transactionHash,
              logsCount: receipt.logs.length,
            });
            throw new Error(
              "Failed to extract hypercert ID from transaction logs. The mint transaction succeeded but the hypercert ID could not be determined."
            );
          }

          return {
            txHash: receipt.transactionHash,
            hypercertId,
          };
        }),
        registerInSignalPool: fromPromise(
          async ({ input }: { input: RegisterInSignalPoolInput }) => {
            const currentSmartAccountClient = smartAccountClientRef.current;
            const currentWalletClient = walletClientRef.current;
            const currentEoaAddress = eoaAddressRef.current;
            const currentChainId = chainIdRef.current;

            const { gardenAddress, hypercertId } = input;

            if (!hypercertId) {
              logger.warn("[useMintHypercert] No hypercertId, skipping pool registration");
              return { registered: false, poolAddress: null };
            }

            // Resolve GardensModule address from deployment config
            const contracts = getNetworkContracts(currentChainId);
            const gardensModuleAddr = contracts.gardensModule as Address;

            if (!gardensModuleAddr || isZeroAddress(gardensModuleAddr)) {
              logger.info(
                "[useMintHypercert] No GardensModule deployed, skipping pool registration",
                { chainId: currentChainId }
              );
              return { registered: false, poolAddress: null };
            }

            const publicClient = createPublicClientForChain(currentChainId);

            // Read signal pools for this garden (index 1 = HypercertSignalPool)
            const pools = (await publicClient.readContract({
              address: gardensModuleAddr,
              abi: GARDENS_MODULE_ABI,
              functionName: "getGardenSignalPools",
              args: [gardenAddress],
            })) as Address[];

            if (!pools || pools.length === 0) {
              logger.info("[useMintHypercert] No signal pools for garden, skipping registration", {
                gardenAddress,
                chainId: currentChainId,
              });
              return { registered: false, poolAddress: null };
            }

            if (pools.length < 2) {
              logger.info(
                "[useMintHypercert] HypercertSignalPool missing (action-only pool set), skipping registration",
                {
                  gardenAddress,
                  poolsCount: pools.length,
                }
              );
              return { registered: false, poolAddress: null };
            }

            const hypercertPoolAddress = pools[1];

            if (!hypercertPoolAddress || isZeroAddress(hypercertPoolAddress)) {
              logger.warn("[useMintHypercert] HypercertSignalPool is zero address", {
                gardenAddress,
                poolsCount: pools.length,
              });
              return { registered: false, poolAddress: null };
            }

            const hypercertIdBigInt = BigInt(hypercertId);

            logger.info("[useMintHypercert] Registering hypercert in signal pool", {
              hypercertId,
              poolAddress: hypercertPoolAddress,
              gardenAddress,
            });

            // Send registration transaction
            if (currentSmartAccountClient) {
              const regOpHash = await currentSmartAccountClient.sendUserOperation({
                account: currentSmartAccountClient.account,
                calls: [
                  {
                    to: hypercertPoolAddress,
                    data: encodeFunctionData({
                      abi: HYPERCERT_SIGNAL_POOL_ABI,
                      functionName: "registerHypercert",
                      args: [hypercertIdBigInt],
                    }),
                    value: 0n,
                  },
                ],
              });

              // Wait for registration confirmation
              await withTimeout(
                currentSmartAccountClient.getUserOperationReceipt({ hash: regOpHash }),
                RECEIPT_POLLING_TIMEOUT_MS,
                "Signal pool registration"
              );
            } else if (currentWalletClient && currentEoaAddress) {
              const regTxHash = await currentWalletClient.writeContract({
                address: hypercertPoolAddress,
                abi: HYPERCERT_SIGNAL_POOL_ABI,
                functionName: "registerHypercert",
                args: [hypercertIdBigInt],
                account: currentEoaAddress as Address,
              });

              await withTimeout(
                publicClient.waitForTransactionReceipt({ hash: regTxHash }),
                RECEIPT_POLLING_TIMEOUT_MS,
                "Signal pool registration"
              );
            } else {
              logger.warn("[useMintHypercert] No wallet available for pool registration");
              return { registered: false, poolAddress: hypercertPoolAddress };
            }

            logger.info("[useMintHypercert] Hypercert registered in signal pool", {
              hypercertId,
              poolAddress: hypercertPoolAddress,
              gardenAddress,
            });

            return { registered: true, poolAddress: hypercertPoolAddress };
          }
        ),
      },
      // XState's strict typing for provide() expects exact type matches for actors.
      // The runtime implementation is type-safe, but TypeScript cannot infer the
      // correct types through the provide() boundary. We use 'as unknown as typeof'
      // to maintain some type safety while satisfying the compiler. The actual actor
      // implementations are verified at runtime.
      // See: https://stately.ai/docs/actors#fromPromise
    } as unknown as typeof mintHypercertMachine.implementations);

    return providedMachine;
  }, []); // Machine created once — actors read current values from refs

  const [state, send] = useMachine(machine);

  // Track previous values to avoid redundant store writes
  const prevMintStateRef = useRef<string>("");

  useEffect(() => {
    const status = MINT_STATUS_MAP[state.value as string] ?? "idle";

    // Log and toast when minting fails
    if (status === "failed" && state.context.error) {
      const normalizedError = state.context.error.toLowerCase();
      const errorMessageId = normalizedError.includes("user rejected")
        ? "app.hypercerts.mint.error.userRejected"
        : normalizedError.includes("insufficient")
          ? "app.hypercerts.mint.error.insufficientFunds"
          : normalizedError.includes("nonce")
            ? "app.hypercerts.mint.error.nonce"
            : normalizedError.includes("network")
              ? "app.hypercerts.mint.error.network"
              : "app.hypercerts.mint.error.generic.message";

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
        chainId: chainIdRef.current,
        authMode: authModeRef.current,
      });
      toastService.error({
        title: formatMessage({ id: "app.hypercerts.mint.error.generic.title" }),
        message: formatMessage(
          {
            id: errorMessageId,
            defaultMessage: state.context.error,
          },
          { error: state.context.error }
        ),
        context: "hypercert minting",
      });
    }

    // Build a fingerprint of the values we write to the store.
    // Only call setMintingState when something actually changed.
    const fingerprint = `${status}|${state.context.metadataCid ?? ""}|${state.context.allowlistCid ?? ""}|${state.context.merkleRoot ?? ""}|${state.context.userOpHash ?? ""}|${state.context.txHash ?? ""}|${state.context.hypercertId ?? ""}|${state.context.error ?? ""}|${state.context.poolRegistered ?? ""}|${state.context.signalPoolAddress ?? ""}`;

    if (fingerprint !== prevMintStateRef.current) {
      prevMintStateRef.current = fingerprint;
      setMintingState({
        status,
        metadataCid: state.context.metadataCid,
        allowlistCid: state.context.allowlistCid,
        merkleRoot: state.context.merkleRoot,
        userOpHash: state.context.userOpHash,
        txHash: state.context.txHash,
        hypercertId: state.context.hypercertId,
        error: state.context.error,
        poolRegistered: state.context.poolRegistered,
        signalPoolAddress: state.context.signalPoolAddress,
      });
    }
  }, [setMintingState, state, formatMessage]);

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

      const operatorAddress = smartAccountAddress || eoaAddressRef.current;
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

      const currentChainId = chainIdRef.current;
      const contracts = await resolveHypercertContracts(currentChainId);
      if (contracts.hatsModule) {
        const publicClient = createPublicClientForChain(currentChainId);
        const isOperator = await publicClient.readContract({
          address: params.draft.gardenId as Address,
          abi: GardenAccountABI,
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
    [send, smartAccountAddress]
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
    poolRegistered: state.context.poolRegistered,
    signalPoolAddress: state.context.signalPoolAddress,
    mint,
    retry: () => send({ type: "RETRY" }),
    cancel: () => send({ type: "CANCEL" }),
  };
}
