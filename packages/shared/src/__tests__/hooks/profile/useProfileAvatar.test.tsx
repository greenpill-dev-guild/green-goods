/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";

const CHAIN_ID = 42161;
const ADDRESS_A = "0x1111111111111111111111111111111111111111" as Address;
const ADDRESS_B = "0x2222222222222222222222222222222222222222" as Address;

const mocks = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  clearDraft: vi.fn(),
  loadDraft: vi.fn(),
  getAvatar: vi.fn(),
  publishAvatar: vi.fn(),
  saveAvatar: vi.fn(),
  signMessage: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useSignMessage: () => ({ signMessageAsync: mocks.signMessage }),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.address,
}));
vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: () => ({ authMode: "wallet", smartAccountClient: null }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => CHAIN_ID,
}));
vi.mock("../../../modules/profile-avatar", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../modules/profile-avatar")>();
  return {
    ...original,
    clearProfileAvatarDraft: mocks.clearDraft,
    loadProfileAvatarDraft: mocks.loadDraft,
    publishProfileAvatar: mocks.publishAvatar,
    profileAvatarTransport: {
      get: mocks.getAvatar,
      save: mocks.saveAvatar,
    },
  };
});

import { useProfileAvatarEditor } from "../../../hooks/profile/useProfileAvatar";

function createDraft(address: Address) {
  return {
    chainId: CHAIN_ID,
    address,
    fileData: null,
    file: null,
    action: "clear" as const,
    updatedAt: 1,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("useProfileAvatarEditor", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.address = ADDRESS_A;
    mocks.clearDraft.mockReset();
    mocks.loadDraft.mockReset();
    mocks.getAvatar.mockReset();
    mocks.publishAvatar.mockReset();
    mocks.saveAvatar.mockReset();
    mocks.signMessage.mockReset();
    mocks.getAvatar.mockResolvedValue({
      chainId: CHAIN_ID,
      address: ADDRESS_A,
      avatarUri: null,
      version: 0,
      updatedAt: null,
    });
  });

  it("ignores an IndexedDB draft that resolves after the account changes", async () => {
    const firstLoad = createDeferred<ReturnType<typeof createDraft>>();
    mocks.loadDraft.mockImplementation((_chainId: number, address: Address) =>
      address === ADDRESS_A ? firstLoad.promise : Promise.resolve(createDraft(ADDRESS_B))
    );

    const { result, rerender } = renderHook(() => useProfileAvatarEditor(CHAIN_ID), { wrapper });

    await waitFor(() => expect(mocks.loadDraft).toHaveBeenCalledWith(CHAIN_ID, ADDRESS_A));

    mocks.address = ADDRESS_B;
    rerender();

    await waitFor(() => expect(result.current.draft?.address).toBe(ADDRESS_B));

    await act(async () => {
      firstLoad.resolve(createDraft(ADDRESS_A));
      await firstLoad.promise;
    });

    expect(result.current.address).toBe(ADDRESS_B);
    expect(result.current.draft?.address).toBe(ADDRESS_B);
  });

  it("discards a draft whose stored identity does not match the active account", async () => {
    mocks.loadDraft.mockResolvedValue(createDraft(ADDRESS_B));

    const { result } = renderHook(() => useProfileAvatarEditor(CHAIN_ID), { wrapper });

    await waitFor(() => expect(mocks.loadDraft).toHaveBeenCalledWith(CHAIN_ID, ADDRESS_A));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.draft).toBeNull();
    await expect(result.current.continueAfterReconnect()).rejects.toThrow(
      "There is no saved profile photo draft for this account."
    );
  });

  it("does not let an in-flight publish overwrite the next account's editor state", async () => {
    const publishing = createDeferred<{
      chainId: number;
      address: Address;
      avatarUri: null;
      version: number;
      updatedAt: string;
    }>();
    mocks.loadDraft.mockImplementation((_chainId: number, address: Address) =>
      Promise.resolve(address === ADDRESS_B ? createDraft(ADDRESS_B) : null)
    );
    mocks.publishAvatar.mockImplementation(
      (
        _chainId: number,
        _address: Address,
        _input: unknown,
        dependencies: { onStage?: (stage: string) => void }
      ) => {
        dependencies.onStage?.("uploading");
        return publishing.promise;
      }
    );

    const { result, rerender } = renderHook(() => useProfileAvatarEditor(CHAIN_ID), { wrapper });
    await waitFor(() => expect(mocks.loadDraft).toHaveBeenCalledWith(CHAIN_ID, ADDRESS_A));

    let publishPromise!: Promise<unknown>;
    act(() => {
      publishPromise = result.current.clear();
    });
    await waitFor(() => {
      expect(result.current.stage).toBe("uploading");
      expect(result.current.isSaving).toBe(true);
    });

    mocks.address = ADDRESS_B;
    rerender();
    await waitFor(() => {
      expect(result.current.draft?.address).toBe(ADDRESS_B);
      expect(result.current.stage).toBe("idle");
      expect(result.current.isSaving).toBe(false);
    });

    await act(async () => {
      publishing.resolve({
        chainId: CHAIN_ID,
        address: ADDRESS_A,
        avatarUri: null,
        version: 1,
        updatedAt: new Date(0).toISOString(),
      });
      await publishPromise;
    });

    expect(result.current.address).toBe(ADDRESS_B);
    expect(result.current.draft?.address).toBe(ADDRESS_B);
    expect(result.current.stage).toBe("idle");
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not surface a previous account's publish failure in the active editor", async () => {
    const publishing = createDeferred<never>();
    mocks.loadDraft.mockImplementation((_chainId: number, address: Address) =>
      Promise.resolve(address === ADDRESS_B ? createDraft(ADDRESS_B) : null)
    );
    mocks.publishAvatar.mockImplementation(
      (
        _chainId: number,
        _address: Address,
        _input: unknown,
        dependencies: { onStage?: (stage: string) => void }
      ) => {
        dependencies.onStage?.("signing");
        return publishing.promise;
      }
    );

    const { result, rerender } = renderHook(() => useProfileAvatarEditor(CHAIN_ID), { wrapper });
    await waitFor(() => expect(mocks.loadDraft).toHaveBeenCalledWith(CHAIN_ID, ADDRESS_A));

    let publishPromise!: Promise<unknown>;
    act(() => {
      publishPromise = result.current.clear();
    });
    await waitFor(() => expect(result.current.stage).toBe("signing"));

    mocks.address = ADDRESS_B;
    rerender();
    await waitFor(() => expect(result.current.draft?.address).toBe(ADDRESS_B));

    await act(async () => {
      publishing.reject(new Error("account A failed"));
      await publishPromise.catch(() => undefined);
    });

    expect(result.current.draft?.address).toBe(ADDRESS_B);
    expect(result.current.stage).toBe("idle");
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not let a completed discard clear the next account's restored draft", async () => {
    const clearing = createDeferred<void>();
    mocks.clearDraft.mockReturnValueOnce(clearing.promise);
    mocks.loadDraft.mockImplementation((_chainId: number, address: Address) =>
      Promise.resolve(address === ADDRESS_B ? createDraft(ADDRESS_B) : createDraft(ADDRESS_A))
    );

    const { result, rerender } = renderHook(() => useProfileAvatarEditor(CHAIN_ID), { wrapper });
    await waitFor(() => expect(result.current.draft?.address).toBe(ADDRESS_A));

    let discardPromise!: Promise<void>;
    act(() => {
      discardPromise = result.current.discardDraft();
    });

    mocks.address = ADDRESS_B;
    rerender();
    await waitFor(() => {
      expect(result.current.draft?.address).toBe(ADDRESS_B);
      expect(result.current.isSaving).toBe(false);
    });

    await act(async () => {
      clearing.resolve();
      await discardPromise;
    });

    expect(result.current.draft?.address).toBe(ADDRESS_B);
    expect(result.current.stage).toBe("idle");
  });
});
