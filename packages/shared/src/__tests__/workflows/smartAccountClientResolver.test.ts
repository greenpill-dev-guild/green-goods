import { describe, expect, it, vi } from "vitest";
import type { SmartAccountClient } from "permissionless";
import type { P256Credential } from "viem/account-abstraction";
import {
  createSmartAccountClientResolver,
  invalidateSmartAccountClientResolver,
} from "../../modules/auth/smartAccountClientResolver";

const ADDRESS = "0x1111111111111111111111111111111111111111" as const;
const credential: P256Credential = {
  id: "same-credential",
  publicKey: "0x1234",
  raw: undefined as unknown as P256Credential["raw"],
};
const client = (chainId: number, address = ADDRESS) =>
  ({ chain: { id: chainId }, account: { address } }) as SmartAccountClient;

function setup() {
  const primary = client(42161);
  const celo = client(42220);
  const buildSmartAccount = vi.fn().mockResolvedValue({ client: celo, address: ADDRESS });
  const resolve = createSmartAccountClientResolver({
    credential,
    primaryClient: primary,
    primaryChainId: 42161,
    expectedAddress: ADDRESS,
    buildSmartAccount,
  });
  return { primary, celo, buildSmartAccount, resolve };
}

describe("session smart-account resolver", () => {
  it("seeds the primary client and derives Celo once from the identical credential", async () => {
    const { primary, celo, buildSmartAccount, resolve } = setup();
    expect(await resolve(42161)).toBe(primary);
    const [first, second] = await Promise.all([resolve(42220), resolve(42220)]);
    expect(first).toBe(celo);
    expect(second).toBe(celo);
    expect(buildSmartAccount).toHaveBeenCalledExactlyOnceWith(credential, 42220);
    expect(celo.account!.address).toBe(primary.account!.address);
  });

  it("evicts a rejected build so a transient failure can retry", async () => {
    const { celo, buildSmartAccount, resolve } = setup();
    buildSmartAccount.mockRejectedValueOnce(new Error("RPC unavailable"));
    await expect(resolve(42220)).rejects.toThrow("RPC unavailable");
    expect(await resolve(42220)).toBe(celo);
    expect(buildSmartAccount).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["chain_mismatch", { client: client(42161), address: ADDRESS }],
    [
      "address_mismatch",
      { client: client(42220), address: "0x2222222222222222222222222222222222222222" },
    ],
    [
      "address_mismatch",
      {
        client: {
          chain: { id: 42220 },
          account: { address: "0x2222222222222222222222222222222222222222" },
        },
        address: ADDRESS,
      },
    ],
  ])("rejects %s and never caches that client", async (code, result) => {
    const { buildSmartAccount, resolve } = setup();
    buildSmartAccount.mockResolvedValue(result);
    await expect(resolve(42220)).rejects.toMatchObject({ code });
    await expect(resolve(42220)).rejects.toMatchObject({ code });
    expect(buildSmartAccount).toHaveBeenCalledTimes(2);
  });

  it("revokes old cached and pending capabilities on signout or credential replacement", async () => {
    const { celo, buildSmartAccount, resolve } = setup();
    let finish!: (value: { client: SmartAccountClient; address: typeof ADDRESS }) => void;
    buildSmartAccount.mockReturnValue(
      new Promise((res) => {
        finish = res;
      })
    );
    const pending = resolve(42220);
    await Promise.resolve();
    invalidateSmartAccountClientResolver(resolve);
    finish({ client: celo, address: ADDRESS });
    await expect(pending).rejects.toMatchObject({ code: "session_expired" });
    await expect(resolve(42161)).rejects.toMatchObject({ code: "session_expired" });
    await expect(resolve(42220)).rejects.toMatchObject({ code: "session_expired" });
  });
});
