/** @vitest-environment happy-dom */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const CHAIN_ID = 42161;
const ADDRESS_A = "0x1111111111111111111111111111111111111111" as Address;
const ADDRESS_B = "0x2222222222222222222222222222222222222222" as Address;

const mocks = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  clearDraft: vi.fn(),
  loadDraft: vi.fn(),
  getAvatar: vi.fn(),
  getListed: vi.fn(),
  publishAvatar: vi.fn(),
  saveAvatar: vi.fn(),
  signMessage: vi.fn(),
  ensNames: {} as Record<string, string>,
  ensNameLoading: false,
  ensAvatars: {} as Record<string, string>,
  ensAvatarCalls: [] as Array<{ address: string | null | undefined; enabled: boolean | undefined }>,
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
// ENS answers come from the tables above; every avatar lookup records whether it was enabled.
vi.mock("../../../hooks/blockchain/useEnsName", () => ({
  useEnsName: (address?: string | null) => ({
    data: address ? (mocks.ensNames[address.toLowerCase()] ?? null) : undefined,
    isLoading: address ? mocks.ensNameLoading : false,
  }),
}));
vi.mock("../../../hooks/blockchain/useEnsAvatar", () => ({
  useEnsAvatar: (address?: string | null, options: { enabled?: boolean } = {}) => {
    mocks.ensAvatarCalls.push({ address, enabled: options.enabled });
    return {
      data:
        options.enabled && address ? (mocks.ensAvatars[address.toLowerCase()] ?? null) : undefined,
      isLoading: false,
      error: null,
    };
  },
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
      getListed: mocks.getListed,
      save: mocks.saveAvatar,
    },
  };
});

import {
  useProfileAvatarEditor,
  useResolvedProfileAvatar,
} from "../../../hooks/profile/useProfileAvatar";

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
  beforeEach(() => {
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

    const { result, rerender } = renderHookWithQueryClient(() => useProfileAvatarEditor(CHAIN_ID));

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

    const { result } = renderHookWithQueryClient(() => useProfileAvatarEditor(CHAIN_ID));

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

    const { result, rerender } = renderHookWithQueryClient(() => useProfileAvatarEditor(CHAIN_ID));
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

    const { result, rerender } = renderHookWithQueryClient(() => useProfileAvatarEditor(CHAIN_ID));
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

    const { result, rerender } = renderHookWithQueryClient(() => useProfileAvatarEditor(CHAIN_ID));
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

describe("useResolvedProfileAvatar in a list of people", () => {
  const listedRecord = (address: Address, avatarUri: string | null) => ({
    chainId: CHAIN_ID,
    address,
    avatarUri,
    version: avatarUri ? 1 : 0,
    updatedAt: null,
  });

  beforeEach(() => {
    mocks.getListed.mockReset();
    mocks.ensNames = {};
    mocks.ensNameLoading = false;
    mocks.ensAvatars = {};
    mocks.ensAvatarCalls = [];
  });

  it("makes no ENS avatar lookup for someone without an ENS name", async () => {
    mocks.getListed.mockResolvedValue(listedRecord(ADDRESS_A, null));
    const { result } = renderHookWithQueryClient(() =>
      useResolvedProfileAvatar(ADDRESS_A, "/images/avatar.png", CHAIN_ID, { list: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.avatarUri).toBe("/images/avatar.png");
    expect(mocks.ensAvatarCalls.every((call) => call.enabled === false)).toBe(true);
  });

  it("looks up an ENS-named person's ENS avatar only once their profile shows no photo", async () => {
    mocks.ensNames[ADDRESS_B] = "bea.eth";
    mocks.ensAvatars[ADDRESS_B] = "https://example.com/bea.png";
    const profile = createDeferred<ReturnType<typeof listedRecord>>();
    mocks.getListed.mockReturnValue(profile.promise);
    const { result } = renderHookWithQueryClient(() =>
      useResolvedProfileAvatar(ADDRESS_B, "/images/avatar.png", CHAIN_ID, { list: true })
    );

    // While the profile read is out, the row waits and asks ENS for nothing.
    expect(result.current.isLoading).toBe(true);
    expect(mocks.ensAvatarCalls.every((call) => call.enabled === false)).toBe(true);

    await act(async () => profile.resolve(listedRecord(ADDRESS_B, null)));
    await waitFor(() => expect(result.current.avatarUri).toBe("https://example.com/bea.png"));
    expect(mocks.ensAvatarCalls.at(-1)?.enabled).toBe(true);
  });

  it("shows a profile photo as soon as it arrives, without waiting on the ENS name", async () => {
    mocks.ensNameLoading = true;
    mocks.getListed.mockResolvedValue(listedRecord(ADDRESS_A, "ipfs://river"));
    const { result } = renderHookWithQueryClient(() =>
      useResolvedProfileAvatar(ADDRESS_A, "/images/avatar.png", CHAIN_ID, { list: true })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.record?.avatarUri).toBe("ipfs://river");
    expect(mocks.ensAvatarCalls.every((call) => call.enabled === false)).toBe(true);
  });
});
