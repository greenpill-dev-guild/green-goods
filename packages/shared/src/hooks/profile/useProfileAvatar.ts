import {
  createAccountMessageSigner,
  resolveAccountFactoryArgs,
} from "../../modules/auth/account-message-signer";
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
import { useEnsName } from "../blockchain/useEnsName";
import { uploadFileToIPFS } from "../../modules/data/ipfs/upload";
import {
  clearProfileAvatarDraft,
  classifyProfileAvatarFailure,
  loadProfileAvatarDraft,
  normalizeProfileAvatarFile,
  publishProfileAvatar,
  profileAvatarTransport,
  resolveProfileAvatar,
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

export interface ProfileAvatarReadOptions {
  /**
   * The photo of one row in a list of people. Its read goes out with the list's other rows, 50
   * to a request on the batch route's own budget, so a long roster never spends the
   * single-read budget the photo editor needs. The record shares the account's one cache entry.
   * The row looks up an ENS avatar only for someone with an ENS name and no profile photo, so
   * most rows make no ENS call of their own: the name is the one the row's address display
   * already reads.
   */
  list?: boolean;
}

export function useProfileAvatar(
  address?: Address | null,
  chainId = DEFAULT_CHAIN_ID,
  { list = false }: ProfileAvatarReadOptions = {}
) {
  const primaryAddress = usePrimaryAddress();
  const targetAddress = address ?? primaryAddress;
  return useQuery({
    queryKey: profileAvatarKeys.record(chainId, targetAddress ?? ""),
    queryFn: () =>
      list
        ? profileAvatarTransport.getListed(chainId, targetAddress!)
        : profileAvatarTransport.get(chainId, targetAddress!),
    enabled: Boolean(targetAddress),
  });
}

export function useResolvedProfileAvatar(
  address?: Address | null,
  fallbackAvatarUri?: string | null,
  chainId = DEFAULT_CHAIN_ID,
  options: ProfileAvatarReadOptions = {}
): ProfileAvatarResolution & {
  record: ProfileAvatarRecord | null;
  isLoading: boolean;
  error: Error | null;
} {
  const avatar = useProfileAvatar(address, chainId, options);
  const primaryAddress = usePrimaryAddress();
  const targetAddress = address ?? primaryAddress;
  const list = options.list === true;
  const profilePhoto = avatar.data?.avatarUri;
  // In a list, the ENS name query is the one the row's address display already runs.
  const ensName = useEnsName(list ? targetAddress : null);
  const ensAvatarWanted = list
    ? Boolean(ensName.data) && !avatar.isLoading && !profilePhoto
    : Boolean(targetAddress);
  const ens = useEnsAvatar(targetAddress, { enabled: ensAvatarWanted });
  // A list row waits on ENS only while an ENS photo could still be the one it shows.
  const waitingOnEns = list ? !profilePhoto && (ensName.isLoading || ens.isLoading) : ens.isLoading;
  const resolved = resolveProfileAvatar(profilePhoto, ens.data, fallbackAvatarUri);
  return {
    ...resolved,
    record: avatar.data ?? null,
    isLoading: avatar.isLoading || waitingOnEns,
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
      createAccountMessageSigner({
        authMode: auth.authMode,
        signMessage: signMessageAsync,
        account: auth.smartAccountClient?.account,
      })(message),
    [auth.authMode, auth.smartAccountClient, signMessageAsync]
  );

  const getFactoryArgs = useCallback(async () => {
    if (auth.authMode !== "passkey") return undefined;
    return resolveAccountFactoryArgs(
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
