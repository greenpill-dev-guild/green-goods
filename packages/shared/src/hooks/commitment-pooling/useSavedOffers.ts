import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { savedOffersKeys } from "../../config/query-keys/saved-offers";
import type {
  SavedOfferApiError,
  SavedOfferPayloadV1,
  SavedOfferPersistenceState,
  SavedOfferRecord,
} from "../../public-contracts/saved-offers/types";
import { savedOfferPersistenceAfterFailure } from "../../public-contracts/saved-offers/validation";

export type SavedOffersApi = {
  list(): Promise<SavedOfferRecord[]>;
  get(savedOfferId: string): Promise<SavedOfferRecord>;
  put(
    savedOfferId: string,
    payload: SavedOfferPayloadV1,
    expectedVersion: number
  ): Promise<SavedOfferRecord>;
  delete(savedOfferId: string, expectedVersion: number): Promise<number>;
};

export function useSavedOffers(input: { chainId: number; api?: SavedOffersApi }) {
  const query = useQuery({
    queryKey: savedOffersKeys.list(input.chainId),
    queryFn: () => input.api!.list(),
    enabled: Boolean(input.api),
    staleTime: STALE_TIME_MEDIUM,
  });
  return { ...query, records: query.data ?? [] };
}

export function useSavedOffer(input: {
  chainId: number;
  savedOfferId: string;
  api?: SavedOffersApi;
}) {
  return useQuery({
    queryKey: savedOffersKeys.record(input.chainId, input.savedOfferId),
    queryFn: () => input.api!.get(input.savedOfferId),
    enabled: Boolean(input.api && input.savedOfferId),
    staleTime: STALE_TIME_MEDIUM,
  });
}

export function useSavedOfferPersistence(input: {
  chainId: number;
  api?: SavedOffersApi;
  isOnline?: () => boolean;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SavedOfferPersistenceState>("LOCAL_DRAFT");
  const latestOperation = useRef(0);
  const isOnline = input.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine);

  const saveMutation = useMutation({
    onMutate: () => {
      const operationId = ++latestOperation.current;
      setState("SAVING_REMOTE");
      return { operationId };
    },
    mutationFn: async (request: { payload: SavedOfferPayloadV1; expectedVersion: number }) => {
      if (!isOnline()) {
        throw savedOfferFailure("provider_unavailable", "No network connection is available.");
      }
      if (!input.api) {
        throw savedOfferFailure("provider_unavailable", "Saved Offers are unavailable.");
      }
      return input.api.put(request.payload.savedOfferId, request.payload, request.expectedVersion);
    },
    onSuccess: (record, _request, context) => {
      queryClient.setQueryData(savedOffersKeys.record(input.chainId, record.savedOfferId), record);
      void queryClient.invalidateQueries({
        queryKey: savedOffersKeys.list(input.chainId),
      });
      if (context.operationId === latestOperation.current) setState("SAVED_REMOTE");
    },
    onError: (error, _request, context) => {
      const apiError = error as Partial<SavedOfferApiError>;
      if (context?.operationId === latestOperation.current) {
        setState(
          savedOfferPersistenceAfterFailure({
            online: isOnline(),
            errorCode: apiError.errorCode,
          })
        );
      }
    },
  });

  const deleteMutation = useMutation({
    onMutate: () => {
      const operationId = ++latestOperation.current;
      setState("SAVING_REMOTE");
      return { operationId };
    },
    mutationFn: async (request: { savedOfferId: string; expectedVersion: number }) => {
      if (!isOnline()) {
        throw savedOfferFailure("provider_unavailable", "No network connection is available.");
      }
      if (!input.api) {
        throw savedOfferFailure("provider_unavailable", "Saved Offers are unavailable.");
      }
      const version = await input.api.delete(request.savedOfferId, request.expectedVersion);
      return { ...request, version };
    },
    onSuccess: ({ savedOfferId }, _request, context) => {
      queryClient.removeQueries({
        queryKey: savedOffersKeys.record(input.chainId, savedOfferId),
      });
      void queryClient.invalidateQueries({
        queryKey: savedOffersKeys.list(input.chainId),
      });
      if (context.operationId === latestOperation.current) setState("LOCAL_DRAFT");
    },
    onError: (error, _request, context) => {
      const apiError = error as Partial<SavedOfferApiError>;
      if (context?.operationId === latestOperation.current) {
        setState(
          savedOfferPersistenceAfterFailure({
            online: isOnline(),
            errorCode: apiError.errorCode,
          })
        );
      }
    },
  });

  const markLocalDraft = useCallback(() => {
    latestOperation.current += 1;
    setState("LOCAL_DRAFT");
  }, []);
  return { state, markLocalDraft, saveMutation, deleteMutation };
}

function savedOfferFailure(
  errorCode: SavedOfferApiError["errorCode"],
  message: string
): SavedOfferApiError {
  return { ok: false, errorCode, message };
}
