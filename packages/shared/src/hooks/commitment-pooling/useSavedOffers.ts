import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import {
  savedOfferPersistenceAfterFailure,
  type SavedOfferApiError,
  type SavedOfferPayloadV1,
  type SavedOfferPersistenceState,
  type SavedOfferRecord,
} from "../../public-contracts/saved-offers";

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
    queryKey: queryKeys.savedOffers.list(input.chainId),
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
    queryKey: queryKeys.savedOffers.record(input.chainId, input.savedOfferId),
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
  const isOnline = input.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine);

  const saveMutation = useMutation({
    mutationFn: async (request: { payload: SavedOfferPayloadV1; expectedVersion: number }) => {
      if (!isOnline()) {
        setState("OFFLINE_LOCAL");
        throw savedOfferFailure("provider_unavailable", "No network connection is available.");
      }
      if (!input.api) {
        setState("SAVE_FAILED");
        throw savedOfferFailure("provider_unavailable", "Saved Offers are unavailable.");
      }
      setState("SAVING_REMOTE");
      return input.api.put(request.payload.savedOfferId, request.payload, request.expectedVersion);
    },
    onSuccess: (record) => {
      queryClient.setQueryData(
        queryKeys.savedOffers.record(input.chainId, record.savedOfferId),
        record
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.savedOffers.list(input.chainId),
      });
      setState("SAVED_REMOTE");
    },
    onError: (error) => {
      const apiError = error as Partial<SavedOfferApiError>;
      setState(
        savedOfferPersistenceAfterFailure({
          online: isOnline(),
          errorCode: apiError.errorCode,
        })
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (request: { savedOfferId: string; expectedVersion: number }) => {
      if (!isOnline()) {
        setState("OFFLINE_LOCAL");
        throw savedOfferFailure("provider_unavailable", "No network connection is available.");
      }
      if (!input.api) {
        setState("SAVE_FAILED");
        throw savedOfferFailure("provider_unavailable", "Saved Offers are unavailable.");
      }
      setState("SAVING_REMOTE");
      const version = await input.api.delete(request.savedOfferId, request.expectedVersion);
      return { ...request, version };
    },
    onSuccess: ({ savedOfferId }) => {
      queryClient.removeQueries({
        queryKey: queryKeys.savedOffers.record(input.chainId, savedOfferId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.savedOffers.list(input.chainId),
      });
      setState("LOCAL_DRAFT");
    },
    onError: (error) => {
      const apiError = error as Partial<SavedOfferApiError>;
      setState(
        savedOfferPersistenceAfterFailure({
          online: isOnline(),
          errorCode: apiError.errorCode,
        })
      );
    },
  });

  const markLocalDraft = useCallback(() => setState("LOCAL_DRAFT"), []);
  return { state, markLocalDraft, saveMutation, deleteMutation };
}

function savedOfferFailure(
  errorCode: SavedOfferApiError["errorCode"],
  message: string
): SavedOfferApiError {
  return { ok: false, errorCode, message };
}
