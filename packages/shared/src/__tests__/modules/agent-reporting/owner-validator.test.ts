import { concatHex, hashTypedData, zeroAddress, type Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  PASSKEY_ROOT_VALIDATOR,
  passkeyOwnerValidator,
} from "../../../modules/agent-reporting/owner-validator";

const ACCOUNT = "0x00000000000000000000000000000000000000a1" as const;
/** A root as Kernel records it: the validator type byte, then the validator's address. */
const ROOT = concatHex(["0x01", PASSKEY_ROOT_VALIDATOR]);
const VALIDATOR_SIGNATURE = `0x${"ab".repeat(96)}` as Hex;
/** The permission the page verified and shows: its identifier and the policies it installs. */
const APPROVED = {
  account: ACCOUNT,
  chainId: 42161,
  validationId: `0x02${"12345678".padEnd(40, "0")}`,
  validatorData: "0x1234",
} as const;
const ENABLE = [
  { name: "validationId", type: "bytes21" },
  { name: "nonce", type: "uint32" },
  { name: "hook", type: "address" },
  { name: "validatorData", type: "bytes" },
  { name: "hookData", type: "bytes" },
  { name: "selectorData", type: "bytes" },
] as const;
/** Kernel's request to enable that permission, as the SDK hands it to the owner. */
const message = {
  validationId: APPROVED.validationId,
  nonce: 1,
  hook: zeroAddress,
  validatorData: APPROVED.validatorData,
  hookData: "0x",
  // execute(bytes32,bytes), no action contract, no hook, then the selector's init data.
  selectorData: `0xe9ae5c53${"00".repeat(40)}ff`,
} as const;
const request = (overrides: Record<string, unknown> = {}, verifyingContract: Hex = ACCOUNT) =>
  ({
    domain: { name: "Kernel", version: "0.3.1", chainId: 42161, verifyingContract },
    types: { Enable: ENABLE },
    primaryType: "Enable",
    message: { ...message, ...overrides },
  }) as const;

/** The app's account answers a raw digest with its root's identifier, then the root's signature. */
function owner(identifier: Hex = ROOT) {
  return { signMessage: vi.fn(async () => concatHex([identifier, VALIDATOR_SIGNATURE])) };
}

/** @direct-test-subject ../../../modules/agent-reporting/owner-validator.ts */
describe("the owner's passkey as the SDK's owner validator", () => {
  it("has the passkey sign the enable request's digest and returns the validator's part alone", async () => {
    const account = owner();
    const validator = passkeyOwnerValidator(account, ROOT, APPROVED);
    await expect(validator.signTypedData(request())).resolves.toBe(VALIDATOR_SIGNATURE);
    expect(account.signMessage).toHaveBeenCalledWith({
      message: { raw: hashTypedData(request()) },
    });
    // The SDK names the owner by this type and identifier; Kernel's own record of the root is
    // the same two things joined.
    expect(validator.validatorType).toBe("SECONDARY");
    expect(validator.getIdentifier()).toBe(PASSKEY_ROOT_VALIDATOR);
  });

  it.each([
    ["another permission", request({ validationId: `0x02${"99".repeat(20)}` })],
    ["other policies", request({ validatorData: "0x5678" })],
    ["a hook", request({ hook: "0x0000000000000000000000000000000000000002" })],
    ["another selector", request({ selectorData: `0xdeadbeef${"00".repeat(40)}ff` })],
    ["an action contract", request({ selectorData: `0xe9ae5c53${"11".repeat(20)}ff` })],
    ["another account", request({}, "0x00000000000000000000000000000000000000b2")],
    ["a request that is not an enable", { ...request(), primaryType: "Permit" }],
  ])("opens no prompt for %s", async (_, asked) => {
    const account = owner();
    await expect(
      passkeyOwnerValidator(account, ROOT, APPROVED).signTypedData(asked as never)
    ).rejects.toThrow("unsupported_scope");
    expect(account.signMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["an ECDSA root", concatHex(["0x01", "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57"])],
    ["a permission as root", concatHex(["0x02", PASSKEY_ROOT_VALIDATOR])],
    ["a root that is not 21 bytes", PASSKEY_ROOT_VALIDATOR],
  ])("refuses %s", (_, root) => {
    expect(() => passkeyOwnerValidator(owner(), root as Hex, APPROVED)).toThrow(
      "unsupported_account"
    );
  });

  it("refuses an answer the account signed for another root", async () => {
    const other = concatHex(["0x01", "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57"]);
    await expect(
      passkeyOwnerValidator(owner(other), ROOT, APPROVED).signTypedData(request())
    ).rejects.toThrow("unsupported_account");
  });

  it("signs no message and no operation", async () => {
    const account = owner();
    const validator = passkeyOwnerValidator(account, ROOT, APPROVED);
    await expect(validator.signMessage({ message: "hello" })).rejects.toThrow("signs nothing else");
    await expect(validator.signUserOperation({} as never)).rejects.toThrow("signs nothing else");
    await expect(validator.getStubSignature({} as never)).rejects.toThrow("signs nothing else");
    expect(account.signMessage).not.toHaveBeenCalled();
  });
});
