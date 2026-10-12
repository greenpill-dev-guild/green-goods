import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import {
  GardenJoinRequestTransportError,
  gardenJoinRequestTransport,
} from "../../modules/garden-join-requests";
import {
  createAccountMessageSigner,
  resolveAccountFactoryArgs,
} from "../../modules/auth/account-message-signer";
import {
  assertSmartAccountClient,
  assertSmartAccountClientResolverActive,
} from "../../modules/auth/smartAccountClientResolver";
import {
  buildGardenJoinProofMessage,
  type CreateGardenJoinRequestInput,
  GARDEN_JOIN_REQUEST_DEFAULT_PAGE_SIZE,
  type GardenJoinProofAction,
  type GardenJoinProofContent,
  type GardenJoinProofEnvelope,
  type GardenJoinRequestQueueItem,
  type GardenJoinRequestKind,
  type ResolveGardenJoinRequestInput,
  validateCreateGardenJoinRequest,
} from "../../public-contracts/join-requests";
import {
  type GardenJoinRequestFailure,
  trackGardenJoinRequestFailed,
} from "../../modules/garden-join-requests/analytics";
import type { Address } from "../../types/domain";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import { useAuth } from "../auth/useAuth";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useGardenJoinRequestSession } from "./useGardenJoinRequestSession";
import { useGardenJoinRequestMutationBarrier } from "./useGardenJoinRequestMutationBarrier";

type AsyncState = { isLoading: boolean; error: Error | null };
const IDLE_ASYNC_STATE: AsyncState = { isLoading: false, error: null };

export function useGardenJoinRequestAvailability(
  kind: GardenJoinRequestKind = "garden_membership"
): boolean {
  return useGardenJoinRequestAvailabilityState(kind).available;
}

export function useGardenJoinRequestAvailabilityState(
  kind: GardenJoinRequestKind = "garden_membership"
) {
  const query = useQuery({
    queryKey: gardenJoinRequestKeys.availability(),
    queryFn: () => gardenJoinRequestTransport.availability(),
    staleTime: 60_000,
    retry: false,
  });
  return {
    available:
      query.data?.enabled === true &&
      (query.data.supportedKinds ?? ["garden_membership"]).includes(kind),
    isLoading: query.isPending,
    error: query.error,
  };
}

export function useGardenJoinRequests(
  gardenAddress?: Address | null,
  options: { kind?: GardenJoinRequestKind } = {}
) {
  const kind = options.kind ?? "garden_membership";
  const chainId = useCurrentChain();
  const accountAddress = usePrimaryAddress() as Address | null;
  const { authMode, smartAccountClient, resolveSmartAccountClient } = useAuth();
  const { signMessageAsync } = useSignMessage();
  const session = useGardenJoinRequestSession(
    chainId,
    gardenAddress ?? "none",
    accountAddress ?? "none",
    authMode ?? "none",
    kind
  );
  const { scopeKey, isCurrentScope, request, hasCheckedStatus, setRequest, setHasCheckedStatus } =
    session;
  const { beginRequestMutation, waitForRequestMutation } = useGardenJoinRequestMutationBarrier();
  const [stateScopeKey, setStateScopeKey] = useState(scopeKey);
  const [queue, setQueue] = useState<GardenJoinRequestQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [rateLimitedRecently, setRateLimitedRecently] = useState(false);
  const [statusState, setStatusState] = useState<AsyncState>({ isLoading: false, error: null });
  const [queueState, setQueueState] = useState<AsyncState>({ isLoading: false, error: null });
  const [mutationState, setMutationState] = useState<AsyncState>({ isLoading: false, error: null });

  useEffect(() => {
    setStateScopeKey(scopeKey);
    setQueue([]);
    setNextCursor(undefined);
    setRateLimitedRecently(false);
    setStatusState(IDLE_ASYNC_STATE);
    setQueueState(IDLE_ASYNC_STATE);
    setMutationState(IDLE_ASYNC_STATE);
  }, [scopeKey]);

  const latestResolver = useRef(resolveSmartAccountClient);
  latestResolver.current = resolveSmartAccountClient;

  const signProof = useCallback(
    async (
      action: GardenJoinProofAction,
      content: GardenJoinProofContent = {},
      extra: Pick<
        GardenJoinProofEnvelope,
        "requestId" | "cursor" | "expectedRevision" | "readSelf"
      > = {}
    ): Promise<GardenJoinProofEnvelope> => {
      if (!gardenAddress || !accountAddress) {
        throw new Error("Connect your account before continuing.");
      }
      let account = smartAccountClient?.account;
      if (authMode === "passkey") {
        assertSmartAccountClientResolverActive(resolveSmartAccountClient);
        const client =
          smartAccountClient?.chain?.id === chainId
            ? smartAccountClient
            : await resolveSmartAccountClient?.(chainId);
        if (!isCurrentScope(scopeKey) || latestResolver.current !== resolveSmartAccountClient) {
          throw new Error("The account or request changed while authorizing.");
        }
        assertSmartAccountClientResolverActive(resolveSmartAccountClient);
        if (!client) throw new Error("Reconnect your passkey account before continuing.");
        assertSmartAccountClient(client, chainId, accountAddress);
        account = client.account;
      }
      const issuedAt = Math.floor(Date.now() / 1000);
      const unsigned = {
        version: 1 as const,
        chainId,
        gardenAddress: gardenAddress.toLowerCase() as GardenJoinProofEnvelope["gardenAddress"],
        accountAddress: accountAddress.toLowerCase() as GardenJoinProofEnvelope["accountAddress"],
        action,
        ...(kind === "steward_access" ? { kind } : {}),
        nonce: randomNonce(),
        issuedAt,
        expiresAt: issuedAt + 300,
        ...(extra.readSelf ? { readSelf: extra.readSelf } : {}),
        ...(extra.requestId ? { requestId: extra.requestId } : {}),
        ...(extra.cursor ? { cursor: extra.cursor } : {}),
        ...(extra.expectedRevision !== undefined
          ? { expectedRevision: extra.expectedRevision }
          : {}),
      };
      const signer = createAccountMessageSigner({
        authMode,
        signMessage: signMessageAsync,
        account,
      });
      const signature = await signer(buildGardenJoinProofMessage(unsigned, content));
      const factoryArgs =
        authMode === "passkey" ? await resolveAccountFactoryArgs(account) : undefined;
      if (unsigned.expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new GardenJoinRequestTransportError(
          "Authorization expired while signing. Please sign again.",
          401,
          "signature_expired"
        );
      }
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
      authMode,
      smartAccountClient,
      resolveSmartAccountClient,
      chainId,
      gardenAddress,
      kind,
      isCurrentScope,
      scopeKey,
      signMessageAsync,
    ]
  );

  const checkStatus = useCallback(
    async (options: { allowSignature?: boolean } = {}) => {
      const operationScope = scopeKey;
      await waitForRequestMutation(session.barrierKey);
      if (!isCurrentScope(operationScope)) return null;
      const retainedProof = session.readAuthorization();
      if (!retainedProof && options.allowSignature === false) return null;
      const operationId = session.beginOperation();
      setStatusState({ isLoading: true, error: null });
      setHasCheckedStatus(false);
      try {
        const proof = retainedProof ?? (await signProof("read_self"));
        if (!isCurrentScope(operationScope) || !session.isCurrentOperation(operationId))
          return null;
        session.retainAuthorization(proof);
        const response = await gardenJoinRequestTransport.mine(gardenAddress!, proof);
        if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
          setRequest(response.request);
          setHasCheckedStatus(true);
          session.setOutcomeUnknown(false);
        }
        return isCurrentScope(operationScope) && session.isCurrentOperation(operationId)
          ? response.request
          : null;
      } catch (caught) {
        if (
          isCurrentScope(operationScope) &&
          session.isCurrentOperation(operationId) &&
          caught instanceof GardenJoinRequestTransportError &&
          ["signature_expired", "signature_invalid"].includes(caught.errorCode ?? "")
        )
          session.forgetAuthorization();
        const error = failureToShow(caught, "Unable to check your request status.", "read_self");
        if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
          setStatusState({ isLoading: false, error });
        }
        throw error ?? caught;
      } finally {
        if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
          setStatusState((current) => ({ ...current, isLoading: false }));
        }
      }
    },
    [
      gardenAddress,
      isCurrentScope,
      scopeKey,
      signProof,
      waitForRequestMutation,
      session,
      setRequest,
      setHasCheckedStatus,
    ]
  );

  const submitRequest = useCallback(
    async (input: CreateGardenJoinRequestInput) => {
      const operationScope = scopeKey;
      const finishRequestMutation = beginRequestMutation(session.barrierKey);
      const operationId = session.beginOperation();
      setMutationState({ isLoading: true, error: null });
      setHasCheckedStatus(false);
      setStatusState(IDLE_ASYNC_STATE);
      try {
        if (input.kind !== undefined && input.kind !== kind) {
          throw new GardenJoinRequestTransportError(
            "Request kind does not match this flow.",
            400,
            "invalid_request"
          );
        }
        const validated = validateCreateGardenJoinRequest({
          ...input,
          ...(kind === "steward_access" ? { kind } : {}),
        });
        if (!validated.ok)
          throw new GardenJoinRequestTransportError(
            validated.error.message,
            400,
            validated.error.errorCode
          );
        const content = validated.value;
        const proof = await signProof(
          "create",
          { ...content, note: content.note ?? null },
          {
            readSelf: { audience: window.location.origin, content },
          }
        );
        if (!isCurrentScope(operationScope) || !session.isCurrentOperation(operationId))
          return null;
        session.retainAuthorization(proof);
        const response = await gardenJoinRequestTransport.create(gardenAddress!, content, proof);
        if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
          setRequest(response.request);
          setHasCheckedStatus(true);
          session.setOutcomeUnknown(false);
        }
        return isCurrentScope(operationScope) && session.isCurrentOperation(operationId)
          ? response.request
          : null;
      } catch (caught) {
        const error = failureToShow(caught, "Unable to send your join request.", "create");
        if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
          if (caught instanceof GardenJoinRequestTransportError && caught.outcomeUnknown)
            session.setOutcomeUnknown(true);
          setMutationState({ isLoading: false, error });
        }
        throw error ?? caught;
      } finally {
        finishRequestMutation();
        if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
          setMutationState((current) => ({ ...current, isLoading: false }));
        }
      }
    },
    [
      beginRequestMutation,
      gardenAddress,
      kind,
      isCurrentScope,
      scopeKey,
      signProof,
      session,
      setRequest,
      setHasCheckedStatus,
    ]
  );

  const withdrawRequest = useCallback(async () => {
    const operationScope = scopeKey;
    const finishRequestMutation = beginRequestMutation(session.barrierKey);
    const operationId = session.beginOperation();
    setMutationState({ isLoading: true, error: null });
    setStatusState(IDLE_ASYNC_STATE);
    try {
      if (!request || request.state !== "pending") {
        throw new Error("No pending request is available to withdraw.");
      }
      const proof = await signProof(
        "withdraw",
        {},
        {
          requestId: request.id,
          expectedRevision: request.revision,
        }
      );
      if (!isCurrentScope(operationScope) || !session.isCurrentOperation(operationId)) return false;
      await gardenJoinRequestTransport.withdraw(gardenAddress!, proof);
      if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
        setRequest(null);
        setHasCheckedStatus(true);
        session.setOutcomeUnknown(false);
      }
      return isCurrentScope(operationScope) && session.isCurrentOperation(operationId);
    } catch (caught) {
      const error = failureToShow(caught, "Unable to withdraw your join request.", "withdraw");
      if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
        setMutationState({ isLoading: false, error });
      }
      throw error ?? caught;
    } finally {
      finishRequestMutation();
      if (isCurrentScope(operationScope) && session.isCurrentOperation(operationId)) {
        setMutationState((current) => ({ ...current, isLoading: false }));
      }
    }
  }, [
    beginRequestMutation,
    gardenAddress,
    isCurrentScope,
    request,
    scopeKey,
    signProof,
    session,
    setRequest,
    setHasCheckedStatus,
  ]);

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
        const error = failureToShow(caught, "Unable to load join requests.", "list");
        if (isCurrentScope(operationScope)) {
          setQueueState({ isLoading: false, error });
        }
        throw error ?? caught;
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
        if (
          !response.pendingOnchainMembership &&
          !response.pendingOnchainRole &&
          isCurrentScope(operationScope)
        ) {
          setQueue((current) => current.filter((item) => item.id !== requestId));
        }
        return response;
      } catch (caught) {
        const error = failureToShow(caught, "Unable to update this join request.", "resolve");
        if (isCurrentScope(operationScope)) {
          setMutationState({ isLoading: false, error });
        }
        throw error ?? caught;
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
    outcomeUnknown: session.outcomeUnknown,
    canRefreshStatus: Boolean(session.readAuthorization()),
    scopeKey,
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

// Keep signature cancellations recognizable and silent. Record other failures
// without account addresses, names, or notes.
function failureToShow(
  caught: unknown,
  fallback: string,
  operation: GardenJoinRequestFailure["operation"]
): Error | null {
  if (isCancelledTxError(caught)) return null;
  const error = caught instanceof Error ? caught : new Error(fallback);
  trackGardenJoinRequestFailed(
    error instanceof GardenJoinRequestTransportError
      ? { operation, status: error.status, errorCode: error.errorCode }
      : { operation, errorName: error.name }
  );
  return error;
}

// The declared join-request entrypoint also exposes its presentation lifecycle.
export { useGardenJoinRequestActivity } from "./useGardenJoinRequestActivity";
