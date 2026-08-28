import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import { gardenJoinRequestTransport } from "../../modules/garden-join-requests";
import {
  createProfileAvatarSigner,
  resolveProfileAvatarFactoryArgs,
} from "../../modules/profile-avatar";
import {
  buildGardenJoinProofMessage,
  type CreateGardenJoinRequestInput,
  GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE,
  type GardenJoinProofAction,
  type GardenJoinProofContent,
  type GardenJoinProofEnvelope,
  type GardenJoinRequestQueueItem,
  type GardenJoinRequestSelfRecord,
  type ResolveGardenJoinRequestInput,
} from "../../public-contracts/join-requests";
import type { Address } from "../../types/domain";
import { useAuth } from "../auth/useAuth";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useGardenJoinRequestMutationBarrier } from "./useGardenJoinRequestMutationBarrier";

type AsyncState = { isLoading: boolean; error: Error | null };
const IDLE_ASYNC_STATE: AsyncState = { isLoading: false, error: null };

export function useGardenJoinRequestAvailability(): boolean {
  const query = useQuery({
    queryKey: gardenJoinRequestKeys.availability(),
    queryFn: () => gardenJoinRequestTransport.availability(),
    staleTime: 60_000,
    retry: false,
  });
  return query.data?.enabled === true;
}

export function useGardenJoinRequests(gardenAddress?: Address | null) {
  const chainId = useCurrentChain();
  const accountAddress = usePrimaryAddress() as Address | null;
  const auth = useAuth();
  const { signMessageAsync } = useSignMessage();
  const scopeKey = `${chainId}:${gardenAddress?.toLowerCase() ?? "none"}:${accountAddress?.toLowerCase() ?? "none"}`;
  const latestScopeKeyRef = useRef(scopeKey);
  const latestRequestOperationRef = useRef(0);
  const { beginRequestMutation, waitForRequestMutation } = useGardenJoinRequestMutationBarrier();
  latestScopeKeyRef.current = scopeKey;
  const [stateScopeKey, setStateScopeKey] = useState(scopeKey);
  const [request, setRequest] = useState<GardenJoinRequestSelfRecord | null>(null);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);
  const [queue, setQueue] = useState<GardenJoinRequestQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [rateLimitedRecently, setRateLimitedRecently] = useState(false);
  const [statusState, setStatusState] = useState<AsyncState>({ isLoading: false, error: null });
  const [queueState, setQueueState] = useState<AsyncState>({ isLoading: false, error: null });
  const [mutationState, setMutationState] = useState<AsyncState>({ isLoading: false, error: null });

  const isCurrentScope = useCallback(
    (operationScope: string) => latestScopeKeyRef.current === operationScope,
    []
  );

  useEffect(() => {
    setStateScopeKey(scopeKey);
    setRequest(null);
    setHasCheckedStatus(false);
    setQueue([]);
    setNextCursor(undefined);
    setRateLimitedRecently(false);
    setStatusState(IDLE_ASYNC_STATE);
    setQueueState(IDLE_ASYNC_STATE);
    setMutationState(IDLE_ASYNC_STATE);
  }, [scopeKey]);

  const signer = useMemo(
    () =>
      createProfileAvatarSigner({
        authMode: auth.authMode,
        signMessage: signMessageAsync,
        account: auth.smartAccountClient?.account,
      }),
    [auth.authMode, auth.smartAccountClient?.account, signMessageAsync]
  );

  const signProof = useCallback(
    async (
      action: GardenJoinProofAction,
      content: GardenJoinProofContent = {},
      extra: Pick<GardenJoinProofEnvelope, "requestId" | "cursor" | "expectedRevision"> = {}
    ): Promise<GardenJoinProofEnvelope> => {
      if (!gardenAddress || !accountAddress) {
        throw new Error("Connect your account before continuing.");
      }
      const issuedAt = Math.floor(Date.now() / 1000);
      const unsigned = {
        version: 1 as const,
        chainId,
        gardenAddress: gardenAddress.toLowerCase() as GardenJoinProofEnvelope["gardenAddress"],
        accountAddress: accountAddress.toLowerCase() as GardenJoinProofEnvelope["accountAddress"],
        action,
        nonce: randomNonce(),
        issuedAt,
        expiresAt: issuedAt + 300,
        ...(extra.requestId ? { requestId: extra.requestId } : {}),
        ...(extra.cursor ? { cursor: extra.cursor } : {}),
        ...(extra.expectedRevision !== undefined
          ? { expectedRevision: extra.expectedRevision }
          : {}),
      };
      const signature = await signer(buildGardenJoinProofMessage(unsigned, content));
      const factoryArgs =
        auth.authMode === "passkey"
          ? await resolveProfileAvatarFactoryArgs(auth.smartAccountClient?.account)
          : undefined;
      return {
        ...unsigned,
        signature,
        ...(factoryArgs?.factory && factoryArgs.factoryData
          ? {
              factory: factoryArgs.factory as GardenJoinProofEnvelope["factory"],
              factoryData: factoryArgs.factoryData,
            }
          : {}),
      };
    },
    [
      accountAddress,
      auth.authMode,
      auth.smartAccountClient?.account,
      chainId,
      gardenAddress,
      signer,
    ]
  );

  const checkStatus = useCallback(async () => {
    const operationScope = scopeKey;
    await waitForRequestMutation(operationScope);
    if (!isCurrentScope(operationScope)) return null;
    const operationId = ++latestRequestOperationRef.current;
    setStatusState({ isLoading: true, error: null });
    try {
      const proof = await signProof("read_self");
      const response = await gardenJoinRequestTransport.mine(gardenAddress!, proof);
      if (isCurrentScope(operationScope) && operationId === latestRequestOperationRef.current) {
        setRequest(response.request);
        setHasCheckedStatus(true);
      }
      return response.request;
    } catch (caught) {
      const error = toError(caught, "Unable to check your request status.");
      if (isCurrentScope(operationScope) && operationId === latestRequestOperationRef.current) {
        setStatusState({ isLoading: false, error });
      }
      throw error;
    } finally {
      if (isCurrentScope(operationScope)) {
        setStatusState((current) => ({ ...current, isLoading: false }));
      }
    }
  }, [gardenAddress, isCurrentScope, scopeKey, signProof, waitForRequestMutation]);

  const submitRequest = useCallback(
    async (input: CreateGardenJoinRequestInput) => {
      const operationScope = scopeKey;
      const finishRequestMutation = beginRequestMutation(operationScope);
      const operationId = ++latestRequestOperationRef.current;
      setMutationState({ isLoading: true, error: null });
      try {
        const proof = await signProof("create", {
          displayName: input.displayName.trim().replace(/\s+/g, " "),
          note: input.note?.trim() || null,
          requestedVia: input.requestedVia,
        });
        const response = await gardenJoinRequestTransport.create(gardenAddress!, input, proof);
        if (isCurrentScope(operationScope) && operationId === latestRequestOperationRef.current) {
          setRequest(response.request);
          setHasCheckedStatus(true);
        }
        return response.request;
      } catch (caught) {
        const error = toError(caught, "Unable to send your join request.");
        if (isCurrentScope(operationScope) && operationId === latestRequestOperationRef.current) {
          setMutationState({ isLoading: false, error });
        }
        throw error;
      } finally {
        finishRequestMutation();
        if (isCurrentScope(operationScope)) {
          setMutationState((current) => ({ ...current, isLoading: false }));
        }
      }
    },
    [beginRequestMutation, gardenAddress, isCurrentScope, scopeKey, signProof]
  );

  const withdrawRequest = useCallback(async () => {
    const operationScope = scopeKey;
    const finishRequestMutation = beginRequestMutation(operationScope);
    const operationId = ++latestRequestOperationRef.current;
    setMutationState({ isLoading: true, error: null });
    try {
      const proof = await signProof("withdraw");
      await gardenJoinRequestTransport.withdraw(gardenAddress!, proof);
      if (isCurrentScope(operationScope) && operationId === latestRequestOperationRef.current) {
        setRequest(null);
      }
      return true;
    } catch (caught) {
      const error = toError(caught, "Unable to withdraw your join request.");
      if (isCurrentScope(operationScope) && operationId === latestRequestOperationRef.current) {
        setMutationState({ isLoading: false, error });
      }
      throw error;
    } finally {
      finishRequestMutation();
      if (isCurrentScope(operationScope)) {
        setMutationState((current) => ({ ...current, isLoading: false }));
      }
    }
  }, [beginRequestMutation, gardenAddress, isCurrentScope, scopeKey, signProof]);

  const loadQueue = useCallback(
    async (options: { cursor?: string; append?: boolean } = {}) => {
      const operationScope = scopeKey;
      setQueueState({ isLoading: true, error: null });
      try {
        const limit = GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE;
        const proof = await signProof(
          "list",
          { state: "pending", limit },
          { cursor: options.cursor }
        );
        const response = await gardenJoinRequestTransport.list(
          gardenAddress!,
          { limit, ...(options.cursor ? { cursor: options.cursor } : {}) },
          proof
        );
        if (isCurrentScope(operationScope)) {
          setQueue((current) =>
            options.append ? [...current, ...response.items] : response.items
          );
          setNextCursor(response.nextCursor);
          setRateLimitedRecently(response.rateLimitedRecently);
        }
        return response;
      } catch (caught) {
        const error = toError(caught, "Unable to load join requests.");
        if (isCurrentScope(operationScope)) {
          setQueueState({ isLoading: false, error });
        }
        throw error;
      } finally {
        if (isCurrentScope(operationScope)) {
          setQueueState((current) => ({ ...current, isLoading: false }));
        }
      }
    },
    [gardenAddress, isCurrentScope, scopeKey, signProof]
  );

  const resolveRequest = useCallback(
    async (requestId: string, input: ResolveGardenJoinRequestInput) => {
      const operationScope = scopeKey;
      setMutationState({ isLoading: true, error: null });
      try {
        const content: GardenJoinProofContent =
          input.action === "decline"
            ? { state: "declined", reason: input.reason.trim() }
            : { state: "welcomed" };
        const proof = await signProof(input.action, content, {
          requestId,
          expectedRevision: input.expectedRevision,
        });
        const response = await gardenJoinRequestTransport.resolve(
          gardenAddress!,
          requestId,
          input,
          proof
        );
        if (!response.pendingOnchainMembership && isCurrentScope(operationScope)) {
          setQueue((current) => current.filter((item) => item.id !== requestId));
        }
        return response;
      } catch (caught) {
        const error = toError(caught, "Unable to update this join request.");
        if (isCurrentScope(operationScope)) {
          setMutationState({ isLoading: false, error });
        }
        throw error;
      } finally {
        if (isCurrentScope(operationScope)) {
          setMutationState((current) => ({ ...current, isLoading: false }));
        }
      }
    },
    [gardenAddress, isCurrentScope, scopeKey, signProof]
  );

  const hasCurrentScope = stateScopeKey === scopeKey;

  return {
    accountAddress,
    request: hasCurrentScope ? request : null,
    hasCheckedStatus: hasCurrentScope ? hasCheckedStatus : false,
    queue: hasCurrentScope ? queue : [],
    nextCursor: hasCurrentScope ? nextCursor : undefined,
    rateLimitedRecently: hasCurrentScope ? rateLimitedRecently : false,
    statusState: hasCurrentScope ? statusState : IDLE_ASYNC_STATE,
    queueState: hasCurrentScope ? queueState : IDLE_ASYNC_STATE,
    mutationState: hasCurrentScope ? mutationState : IDLE_ASYNC_STATE,
    checkStatus,
    submitRequest,
    withdrawRequest,
    loadQueue,
    resolveRequest,
  };
}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function toError(caught: unknown, fallback: string): Error {
  return caught instanceof Error ? caught : new Error(fallback);
}
