import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSignMessage } from "wagmi";
import type { Address } from "../../types/domain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { profileAvatarKeys } from "../../config/query-keys/identity";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useAuth } from "../auth/useAuth";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useEnsAvatar } from "../blockchain/useEnsAvatar";
import { uploadFileToIPFS } from "../../modules/data/ipfs/upload";
import {
  clearProfileAvatarDraft,
  classifyProfileAvatarFailure,
  createProfileAvatarSigner,
  loadProfileAvatarDraft,
  normalizeProfileAvatarFile,
  publishProfileAvatar,
  profileAvatarTransport,
  resolveProfileAvatar,
  resolveProfileAvatarFactoryArgs,
  saveProfileAvatarDraft,
  type ProfileAvatarDraft,
  type ProfileAvatarResolution,
} from "../../modules/profile-avatar";
import type { ProfileAvatarRecord } from "../../public-contracts/profile-avatar";

export type ProfileAvatarEditorStage =
  | "idle"
  | "normalizing"
  | "uploading"
  | "signing"
  | "saving"
  | "offline"
  | "error";
export type ProfileAvatarEditorOptions = {
  chainId?: number;
  factory?: Address;
  factoryData?: `0x${string}`;
};

export function useProfileAvatar(address?: Address | null, chainId = DEFAULT_CHAIN_ID) {
  const primaryAddress = usePrimaryAddress();
  const targetAddress = address ?? primaryAddress;
  return useQuery({
    queryKey: profileAvatarKeys.record(chainId, targetAddress ?? ""),
    queryFn: () => profileAvatarTransport.get(chainId, targetAddress!),
    enabled: Boolean(targetAddress),
  });
}

export function useResolvedProfileAvatar(
  address?: Address | null,
  fallbackAvatarUri?: string | null,
  chainId = DEFAULT_CHAIN_ID
): ProfileAvatarResolution & {
  record: ProfileAvatarRecord | null;
  isLoading: boolean;
  error: Error | null;
} {
  const avatar = useProfileAvatar(address, chainId);
  const primaryAddress = usePrimaryAddress();
  const targetAddress = address ?? primaryAddress;
  const ens = useEnsAvatar(targetAddress, { enabled: Boolean(targetAddress) });
  const resolved = resolveProfileAvatar(avatar.data?.avatarUri, ens.data, fallbackAvatarUri);
  return {
    ...resolved,
    record: avatar.data ?? null,
    isLoading: avatar.isLoading || ens.isLoading,
    error: (avatar.error ?? ens.error) as Error | null,
  };
}

export function useProfileAvatarEditor(chainIdOrOptions?: number | ProfileAvatarEditorOptions) {
  const defaultChainId = useCurrentChain();
  const editorOptions =
    typeof chainIdOrOptions === "number" ? { chainId: chainIdOrOptions } : chainIdOrOptions;
  const chainId = editorOptions?.chainId ?? defaultChainId;
  const address = usePrimaryAddress() as Address | null;
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const avatar = useProfileAvatar(address, chainId);
  const [stage, setStage] = useState<ProfileAvatarEditorStage>("idle");
  const [draft, setDraft] = useState<(ProfileAvatarDraft & { file: File | null }) | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const draftLoadGeneration = useRef(0);
  const editorIdentity = `${chainId}:${address?.toLowerCase() ?? ""}`;
  const currentEditorIdentity = useRef(editorIdentity);
  currentEditorIdentity.current = editorIdentity;

  const loadDraft = useCallback(async (): Promise<boolean> => {
    const generation = ++draftLoadGeneration.current;
    const loadIdentity = editorIdentity;
    const isCurrentLoad = () =>
      generation === draftLoadGeneration.current && loadIdentity === currentEditorIdentity.current;
    setDraft(null);
    setError(null);
    setIsSaving(false);
    setStage("idle");
    if (!address) return true;

    let loadedDraft: (ProfileAvatarDraft & { file: File | null }) | null;
    try {
      loadedDraft = await loadProfileAvatarDraft(chainId, address);
    } catch (caught) {
      if (!isCurrentLoad()) return false;
      setError(
        caught instanceof Error ? caught : new Error("Unable to restore the profile photo draft.")
      );
      setStage("error");
      return false;
    }
    if (!isCurrentLoad()) return false;
    if (
      loadedDraft &&
      (loadedDraft.chainId !== chainId ||
        loadedDraft.address.toLowerCase() !== address.toLowerCase())
    ) {
      return false;
    }
    setDraft(loadedDraft);
    return true;
  }, [address, chainId, editorIdentity]);
  useEffect(() => {
    void loadDraft();
    return () => {
      draftLoadGeneration.current += 1;
    };
  }, [loadDraft]);

  const sign = useCallback(
    (message: string) =>
      createProfileAvatarSigner({
        authMode: auth.authMode,
        signMessage: signMessageAsync,
        account: auth.smartAccountClient?.account,
      })(message),
    [auth.authMode, auth.smartAccountClient, signMessageAsync]
  );

  const getFactoryArgs = useCallback(async () => {
    if (auth.authMode !== "passkey") return undefined;
    return resolveProfileAvatarFactoryArgs(
      auth.smartAccountClient?.account,
      editorOptions?.factory && editorOptions.factoryData
        ? {
            factory: editorOptions.factory as `0x${string}`,
            factoryData: editorOptions.factoryData,
          }
        : undefined
    );
  }, [auth.authMode, auth.smartAccountClient, editorOptions?.factory, editorOptions?.factoryData]);

  const publish = useCallback(
    async (input: { file?: File | null; action: "set" | "clear"; cid?: string }) => {
      if (!address) throw new Error("Reconnect before publishing your profile photo.");
      const generation = ++draftLoadGeneration.current;
      const operationIdentity = editorIdentity;
      const isCurrentOperation = () =>
        generation === draftLoadGeneration.current &&
        operationIdentity === currentEditorIdentity.current;
      setError(null);
      setIsSaving(true);
      setStage("idle");
      try {
        const record = await publishProfileAvatar(chainId, address, input, {
          get: profileAvatarTransport.get,
          save: profileAvatarTransport.save,
          normalize: normalizeProfileAvatarFile,
          upload: (file) => uploadFileToIPFS(file, { source: "profile-avatar" }),
          sign,
          saveDraft: (draftInput) => saveProfileAvatarDraft(chainId, address, draftInput),
          clearDraft: () => clearProfileAvatarDraft(chainId, address),
          onStage: (nextStage) => {
            if (isCurrentOperation()) setStage(nextStage);
          },
          getFactoryArgs,
        });
        queryClient.setQueryData(profileAvatarKeys.record(chainId, address), record);
        if (isCurrentOperation()) {
          setDraft(null);
          setError(null);
          setStage("idle");
        }
        return record;
      } catch (caught) {
        if (isCurrentOperation()) {
          const restored = await loadDraft();
          if (restored) {
            setError(
              caught instanceof Error ? caught : new Error("Unable to publish the profile photo.")
            );
            setStage(classifyProfileAvatarFailure(caught));
          }
        }
        throw caught;
      } finally {
        if (isCurrentOperation()) setIsSaving(false);
      }
    },
    [address, chainId, editorIdentity, getFactoryArgs, loadDraft, queryClient, sign]
  );

  const mutation = useMutation({
    mutationFn: publish,
  });
  const discardDraft = useCallback(async () => {
    if (!address) return;
    const generation = ++draftLoadGeneration.current;
    const operationIdentity = editorIdentity;
    const isCurrentOperation = () =>
      generation === draftLoadGeneration.current &&
      operationIdentity === currentEditorIdentity.current;
    setError(null);
    setIsSaving(true);
    try {
      await clearProfileAvatarDraft(chainId, address);
      if (isCurrentOperation()) {
        setDraft(null);
        setStage("idle");
      }
    } catch (caught) {
      if (isCurrentOperation()) {
        setError(
          caught instanceof Error ? caught : new Error("Unable to discard the profile photo draft.")
        );
        setStage("error");
      }
      throw caught;
    } finally {
      if (isCurrentOperation()) setIsSaving(false);
    }
  }, [address, chainId, editorIdentity]);
  const continueAfterReconnect = useCallback(async () => {
    if (
      !address ||
      !draft ||
      draft.chainId !== chainId ||
      draft.address.toLowerCase() !== address.toLowerCase()
    ) {
      throw new Error("There is no saved profile photo draft for this account.");
    }
    return mutation.mutateAsync({ file: draft.file, action: draft.action, cid: draft.cid });
  }, [address, chainId, draft, mutation]);

  return {
    address,
    record: avatar.data ?? null,
    draft,
    stage,
    error,
    isSaving,
    save: (file: File) => mutation.mutateAsync({ file, action: "set" as const }),
    clear: () => mutation.mutateAsync({ action: "clear" as const }),
    continueAfterReconnect,
    discardDraft,
    refetch: avatar.refetch,
  };
}
