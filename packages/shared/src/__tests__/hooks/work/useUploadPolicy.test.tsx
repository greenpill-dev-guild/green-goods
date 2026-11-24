/** @vitest-environment happy-dom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, WorkUploadConsent } from "../../../types/domain";
import { useUploadPolicy } from "../../../hooks/work/useUploadPolicy";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { WORK_UPLOAD_POLICY_VERSION } from "../../../modules/work/upload-policy";
import { uploadConsent } from "../../test-utils/upload-policy";

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("idb-keyval", () => ({ createStore: () => ({}), get: storage.get, set: storage.set }));
const OWNER = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const SKIPPER = "0x3333333333333333333333333333333333333333";
const records = new Map<string, unknown>();
const acceptanceKey = (owner: Address) =>
  `${DEFAULT_CHAIN_ID}:${owner}:${WORK_UPLOAD_POLICY_VERSION}`;

beforeEach(() => {
  vi.resetAllMocks();
  records.clear();
  storage.get.mockImplementation(async (key: string) => records.get(key));
  storage.set.mockImplementation(async (key: string, value: unknown) => {
    records.set(key, value);
  });
});

function renderPolicy(owner: Address | null = OWNER, atSignIn = false) {
  return renderHook(({ address }) => useUploadPolicy(address, "es", atSignIn), {
    initialProps: { address: owner },
  });
}

type PolicyResult = ReturnType<typeof renderPolicy>["result"];
function request(result: PolicyResult) {
  let receipt!: Promise<WorkUploadConsent>;
  act(() => {
    receipt = result.current.request();
    void receipt.catch(() => undefined);
  });
  return receipt;
}

async function accept(result: PolicyResult) {
  act(() => result.current.prompt!.setChecked(true));
  await act(() => result.current.prompt!.accept());
}

describe("versioned upload policy", () => {
  it("offers the terms on sign-in and reuses the same acceptance on future uploads and sign-ins", async () => {
    const { result, rerender } = renderPolicy(null, true);
    expect(result.current.prompt).toBeNull();
    expect(storage.get).not.toHaveBeenCalled();
    rerender({ address: OWNER });
    await waitFor(() => expect(result.current.prompt?.reason).toBe("sign-in"));
    await act(() => result.current.prompt!.accept());
    expect(storage.set).not.toHaveBeenCalled();
    await accept(result);
    const saved = records.get(acceptanceKey(OWNER));
    expect(saved).toMatchObject({
      uploaderAddress: OWNER,
      locale: "es",
      permissionsConfirmed: true,
    });
    expect(saved).not.toHaveProperty("publicSharingAcceptedAt");
    await expect(request(result)).resolves.toEqual(saved);
    await expect(request(result)).resolves.toEqual(saved);
    expect(result.current.prompt).toBeNull();
    expect(storage.set).toHaveBeenCalledOnce();
    rerender({ address: null });
    rerender({ address: OWNER });
    await waitFor(() => expect(storage.get).toHaveBeenCalledTimes(5));
    expect(result.current.prompt).toBeNull();
  });

  it("remembers Skip on sign-in, then requires acceptance before uploading", async () => {
    const first = renderPolicy(SKIPPER, true);
    await waitFor(() => expect(first.result.current.prompt?.reason).toBe("sign-in"));
    act(() => first.result.current.prompt!.cancel());
    expect(records.get(`skipped:${acceptanceKey(SKIPPER)}`)).toBe(true);
    expect(records.has(acceptanceKey(SKIPPER))).toBe(false);
    first.unmount();
    const { result } = renderPolicy(SKIPPER, true);
    await waitFor(() => expect(result.current.prompt).toBeNull());
    await waitFor(() => expect(storage.get).toHaveBeenCalledTimes(3));
    const canceled = request(result);
    await waitFor(() => expect(result.current.prompt?.reason).toBe("upload"));
    act(() => result.current.prompt!.cancel());
    await expect(canceled).rejects.toThrow("User cancelled upload");
    expect(records.has(acceptanceKey(SKIPPER))).toBe(false);
    const receipt = request(result);
    await waitFor(() => expect(result.current.prompt?.reason).toBe("upload"));
    await accept(result);
    await expect(receipt).resolves.toMatchObject({ uploaderAddress: SKIPPER });
    await expect(request(result)).resolves.toEqual(records.get(acceptanceKey(SKIPPER)));
    expect(result.current.prompt).toBeNull();
  });

  it.each([
    { policyVersion: "old" },
    { uploaderAddress: OTHER },
    { termsAcceptedAt: "invalid" },
  ])("offers the current terms when a saved record is invalid: %j", async (patch) => {
    records.set(acceptanceKey(OWNER), { ...uploadConsent(OWNER), ...patch });
    records.set(`skipped:${DEFAULT_CHAIN_ID}:${OWNER}:old`, true);
    const { result } = renderPolicy(OWNER, true);
    await waitFor(() => expect(result.current.prompt?.reason).toBe("sign-in"));
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("cancels a pending upload when the account changes", async () => {
    const { result, rerender } = renderPolicy();
    const receipt = request(result);
    await waitFor(() => expect(result.current.prompt?.reason).toBe("upload"));
    rerender({ address: OTHER });
    await expect(receipt).rejects.toThrow("User cancelled upload");
    expect(result.current.prompt).toBeNull();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it("keeps the prompt open and the upload pending if acceptance cannot be stored", async () => {
    storage.set.mockRejectedValue(new Error("disk full"));
    const { result } = renderPolicy();
    const receipt = request(result);
    await waitFor(() => expect(result.current.prompt?.reason).toBe("upload"));
    await accept(result);
    expect(result.current.prompt?.saveFailed).toBe(true);
    act(() => result.current.prompt!.cancel());
    await expect(receipt).rejects.toThrow("User cancelled upload");
  });
});
