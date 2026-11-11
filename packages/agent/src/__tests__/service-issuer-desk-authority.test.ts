import { describe, expect, it, vi } from "vitest";
import { keccak256, type PublicClient, zeroAddress } from "viem";
import { SERVICE_ISSUER_DESK_POOLS } from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";
import { createServiceIssuerDeskAuthority } from "../services/service-issuer-desk-authority";
function fixture() {
  const original = SERVICE_ISSUER_DESK_POOLS[0];
  const pin = original.deployment;
  const pool = {
    ...original,
    deployment: {
      ...pin,
      runtimeCodeHash: keccak256("0x1234"),
      implementation: { ...pin.implementation, runtimeCodeHash: keccak256("0x1234") },
    },
  };
  const state = {
    owner: pin.owner,
    admin: true,
    delay: 0,
    ownerSigner: true,
    guard: zeroAddress as string,
  };
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "owner") return state.owner;
    if (functionName === "hasRole") return [state.admin, state.delay];
    if (functionName === "isOwner") return state.ownerSigner;
    throw new Error("Unexpected authority read");
  });
  const getCode = vi.fn(async () => "0x1234");
  const client = {
    readContract,
    getCode,
    getStorageAt: vi.fn(
      async ({ address }: { address: string }) =>
        `0x${(address.toLowerCase() === pin.address.toLowerCase() ? pin.implementation.address : state.guard).slice(2).toLowerCase().padStart(64, "0")}`
    ),
  } as unknown as PublicClient;
  const authority = createServiceIssuerDeskAuthority({
    rpcUrl: "https://unused.invalid",
    client,
    pools: [pool],
  });
  return {
    pin,
    state,
    readContract,
    getCode,
    authority,
    selection: { routeId: pool.routeId, poolId: pool.poolId },
  };
}
const actor = "0x1111111111111111111111111111111111111111";
describe("issuer desk pool authority", () => {
  it("requires the exact configured pool and current owner Safe signer", async () => {
    const f = fixture();
    expect(await f.authority.canManage(f.selection, actor)).toBe(true);
    expect(await f.authority.canManage({ ...f.selection, poolId: "unknown" }, actor)).toBe(false);
    f.state.ownerSigner = false;
    expect(await f.authority.canManage(f.selection, actor)).toBe(false);
  });
  it("recognizes the configured manager's actual Safe admin while preserving its governance delay", async () => {
    const f = fixture();
    expect(f.pin.accessManager).toBeDefined();
    f.state.owner = f.pin.accessManager!;
    expect(await f.authority.canManage(f.selection, actor)).toBe(true);
    expect(f.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: f.pin.accessManager,
        functionName: "hasRole",
        args: [0n, f.pin.owner],
      })
    );
    expect(f.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: f.pin.owner, functionName: "isOwner" })
    );
    f.state.admin = false;
    expect(await f.authority.canManage(f.selection, actor)).toBe(false);
    f.state.admin = true;
    f.state.delay = 86400;
    expect(await f.authority.canManage(f.selection, actor)).toBe(true);
  });
  it("refuses an arbitrary manager and unknown Safe guard", async () => {
    const f = fixture();
    f.state.owner = actor;
    expect(await f.authority.canManage(f.selection, actor)).toBe(false);
    f.state.owner = f.pin.owner;
    f.state.guard = actor;
    expect(await f.authority.canManage(f.selection, actor)).toBe(false);
  });
  it("refuses a changed proxy or implementation even with a valid signer", async () => {
    const f = fixture();
    f.getCode.mockResolvedValue("0x4321");
    expect(await f.authority.canManage(f.selection, actor)).toBe(false);
  });
});
