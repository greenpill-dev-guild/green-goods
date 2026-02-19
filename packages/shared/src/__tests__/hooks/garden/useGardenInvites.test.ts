/**
 * useGardenInvites Tests
 * @vitest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAddress = vi.fn();
const mockWriteContract = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mockAddress() }),
  useWalletClient: () => ({
    data: {
      writeContract: mockWriteContract,
      chain: { id: 11155111 },
    },
  }),
}));

vi.mock("viem", () => ({
  keccak256: (data: string) => `0xhash_${data}`,
  toHex: (data: string) => `hex_${data}`,
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  GardenAccountABI: [],
}));

const mockExecuteWithToast = vi.fn(async (action: () => Promise<unknown>) => action());
vi.mock("../../../hooks/app/useToastAction", () => ({
  useToastAction: () => ({
    executeWithToast: mockExecuteWithToast,
  }),
}));

import { useGardenInvites } from "../../../hooks/garden/useGardenInvites";
import type { Address } from "viem";

describe("useGardenInvites", () => {
  const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress.mockReturnValue("0xUser1234567890123456789012345678901234");
    mockWriteContract.mockResolvedValue("0xTxHash");
  });

  it("generates invite code and link", () => {
    const { result } = renderHook(() => useGardenInvites(GARDEN_ADDRESS));

    const code = result.current.generateInviteCode();
    const link = result.current.generateInviteLink(code);

    expect(code).toMatch(/^0x/);
    expect(link).toContain(`/garden/join?invite=${code}`);
    expect(link).toContain(`&garden=${GARDEN_ADDRESS}`);
  });

  it("creates an invite and stores it in local state", async () => {
    const { result } = renderHook(() => useGardenInvites(GARDEN_ADDRESS));

    let inviteLink = "";
    await act(async () => {
      inviteLink = await result.current.createInvite();
    });

    expect(inviteLink).toContain("/garden/join?invite=");
    expect(result.current.invites).toHaveLength(1);
    expect(result.current.invites[0]).toMatchObject({
      garden: GARDEN_ADDRESS,
      creator: "0xUser1234567890123456789012345678901234",
      used: false,
      chainId: 11155111,
    });
  });

  it("marks a local invite as used on revoke", async () => {
    const { result } = renderHook(() => useGardenInvites(GARDEN_ADDRESS));

    let inviteCode = "";
    await act(async () => {
      const link = await result.current.createInvite();
      const params = new URL(link).searchParams;
      inviteCode = params.get("invite") || "";
    });

    await act(async () => {
      await result.current.revokeInvite(inviteCode);
    });

    expect(result.current.invites).toHaveLength(1);
    expect(result.current.invites[0].used).toBe(true);
    expect(result.current.invites[0].usedBy).toBe("0xUser1234567890123456789012345678901234");
  });

  it("refetch returns local invites without indexer calls", async () => {
    const { result } = renderHook(() => useGardenInvites(GARDEN_ADDRESS));

    await act(async () => {
      await result.current.createInvite();
    });

    await expect(result.current.refetch()).resolves.toHaveLength(1);
  });

  it("throws when wallet is not connected", async () => {
    mockAddress.mockReturnValue(undefined);

    const { result } = renderHook(() => useGardenInvites(GARDEN_ADDRESS));

    await expect(async () => {
      await act(async () => {
        await result.current.createInvite();
      });
    }).rejects.toThrow("Wallet not connected");
  });
});
