/**
 * Hypercert Minting Hook
 *
 * React hook for minting hypercerts with XState state machine orchestration.
 * Handles metadata upload, allowlist validation, and transaction submission.
 *
 * Service actors are defined in ./services/ and wired to the machine here.
 *
 * @module hooks/hypercerts/useMintHypercert
 */

import { validateAllowlist as sdkValidateAllowlist } from "@hypercerts-org/sdk";
import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { type Hex, isAddress } from "viem";
import { useWalletClient } from "wagmi";

import { toastService } from "../../components/toast";
import { createPublicClientForChain, DEFAULT_CHAIN_ID } from "../../config";
import { TOTAL_UNITS, validateAllowlist as validateAllowlistEntries } from "../../lib/hypercerts";
import { getIpfsInitStatus } from "../../modules";
import { logger } from "../../modules/app/logger";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { useHypercertWizardStore } from "../../stores/useHypercertWizardStore";
import type { Address } from "../../types/domain";
import type {
  AllowlistEntry,
  HypercertAttestation,
  HypercertDraft,
  HypercertMetadata,
} from "../../types/hypercerts";
import { GardenAccountABI } from "../../utils/blockchain/contracts";
import {
  classifyTxError,
  isMeaningfulTxErrorMessage,
} from "../../utils/errors/tx-error-classifier";
import { type MintHypercertInput, mintHypercertMachine } from "../../workflows/mintHypercert";
import { useAuth } from "../auth/useAuth";
import { resolveHypercertContracts } from "./hypercert-contracts";
import { TimeoutError } from "./hypercert-utils";
import {
  createUploadMetadataActor,
  createUploadAllowlistActor,
  createBuildAndSignActor,
  createPollForReceiptActor,
  createRegisterInSignalPoolActor,
} from "./services";

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

type TxErrorMode = "toast" | "inline" | "auto";

export interface UseMintHypercertOptions {
  errorMode?: TxErrorMode;
}

function shouldShowErrorToast(mode: TxErrorMode = "auto"): boolean {
  return mode !== "inline";
}

export function useMintHypercert(options: UseMintHypercertOptions = {}): UseMintHypercertResult {
  const { smartAccountClient, authMode, smartAccountAddress, eoaAddress } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const setMintingState = useHypercertWizardStore((state) => state.setMintingState);
  const { formatMessage } = useIntl();
  const showErrorToast = shouldShowErrorToast(options.errorMode);

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
    const deps = { walletClientRef, smartAccountClientRef, eoaAddressRef, authModeRef, chainIdRef };

    return mintHypercertMachine.provide({
      actors: {
        // Note: XState automatically stops actors if the machine transitions away (e.g., on CANCEL).
        // Full cancellation of in-flight IPFS uploads would require Storacha library support
        // for AbortSignal, which is not currently available.
        uploadMetadata: createUploadMetadataActor(deps),
        uploadAllowlist: createUploadAllowlistActor(deps),
        buildAndSignUserOp: createBuildAndSignActor(deps),
        pollForReceipt: createPollForReceiptActor(deps),
        registerInSignalPool: createRegisterInSignalPoolActor(deps),
      },
      // XState's strict typing for provide() expects exact type matches for actors.
      // The runtime implementation is type-safe, but TypeScript cannot infer the
      // correct types through the provide() boundary. We use 'as unknown as typeof'
      // to maintain some type safety while satisfying the compiler.
      // See: https://stately.ai/docs/actors#fromPromise
    } as unknown as typeof mintHypercertMachine.implementations);
  }, []); // Machine created once — actors read current values from refs

  const [state, send] = useMachine(machine);

  // Track previous values to avoid redundant store writes
  const prevMintStateRef = useRef<string>("");

  useEffect(() => {
    const status = MINT_STATUS_MAP[state.value as string] ?? "idle";

    // Log and toast when minting fails
    if (status === "failed" && state.context.error) {
      const errorView = classifyTxError(state.context.error);

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

      if (showErrorToast) {
        const fallbackMessage = formatMessage({
          id: errorView.messageKey,
          defaultMessage: "Something went wrong. Please try again.",
        });
        const displayMessage =
          errorView.kind === "cancelled"
            ? fallbackMessage
            : isMeaningfulTxErrorMessage(state.context.error)
              ? state.context.error
              : fallbackMessage;

        toastService.show({
          status: errorView.severity === "warning" ? "info" : "error",
          title: formatMessage({
            id: errorView.titleKey,
            defaultMessage:
              errorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
          }),
          message: displayMessage,
          context: "hypercert minting",
        });
      }
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
  }, [formatMessage, setMintingState, showErrorToast, state]);

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
