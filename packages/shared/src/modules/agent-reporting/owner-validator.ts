import type { KernelValidator } from "@zerodev/sdk";
import { hashTypedData, isAddressEqual, slice, zeroAddress, type Address, type Hex } from "viem";
import { toAccount } from "viem/accounts";

/**
 * The validator the app's Kernel 0.3.1 passkey accounts are created on: permissionless's WebAuthn
 * validator. It is the only root this page asks to approve a permission.
 */
export const PASSKEY_ROOT_VALIDATOR = "0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd" as const;

/** Kernel's type byte for a root that is a plain validator module. */
const VALIDATOR_ROOT = "0x01";
/** `execute(bytes32,bytes)` with no action contract and no hook: the one selector a grant opens. */
const EXECUTE_ONLY = `0xe9ae5c53${"00".repeat(40)}`;

/** What approving a permission needs of the owner's account: its own way of signing a digest. */
export interface OwnerAccount {
  signMessage(parameters: { message: { raw: Hex } }): Promise<Hex>;
}

/** The one permission the owner is asked to approve, as the page rebuilt and verified it. */
export interface ApprovedPermission {
  account: Address;
  chainId: number;
  /** Kernel's identifier for the permission: its type byte, then its id. */
  validationId: Hex;
  /** The signer and policies Kernel installs, exactly as the verified permission encodes them. */
  validatorData: Hex;
}

type EnableRequest = Parameters<typeof hashTypedData>[0];

function isApprovedRequest(request: EnableRequest, approved: ApprovedPermission): boolean {
  const { domain, message } = request as {
    domain?: { name?: string; chainId?: number | bigint; verifyingContract?: string };
    message?: Record<string, unknown>;
  };
  const text = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : "");
  return (
    request.primaryType === "Enable" &&
    domain?.name === "Kernel" &&
    Number(domain.chainId) === approved.chainId &&
    text(domain.verifyingContract) === approved.account.toLowerCase() &&
    text(message?.validationId) === approved.validationId.toLowerCase() &&
    text(message?.validatorData) === approved.validatorData.toLowerCase() &&
    text(message?.hook) === zeroAddress &&
    message?.hookData === "0x" &&
    text(message?.selectorData).startsWith(EXECUTE_ONLY)
  );
}

/**
 * The owner's passkey as the Kernel SDK's owner validator, for one job: approving one permission.
 *
 * The app builds passkey accounts with permissionless, whose account object is not the SDK's and
 * carries no plugin manager, so the SDK has no owner to ask. Signing a raw digest with that
 * account is the call it already makes for every operation it sends: one passkey prompt over the
 * digest, answered as the root validator's identifier followed by that validator's signature.
 * Kernel checks an enable approval against exactly that signature over the enable request's
 * digest, so this hands the SDK the validator's part and nothing else.
 *
 * `rootValidator` is the account's own record of its root, read from the chain. Anything but the
 * passkey validator is refused, and so is an answer signed for a different root. The passkey is
 * asked only for the enable request of `approved`: this account, this permission, these policies,
 * the execute selector and no hook. Any other request, and every message, transaction and
 * operation, is refused before a prompt opens. The permission's operation is the delegate's to
 * sign.
 */
export function passkeyOwnerValidator(
  owner: OwnerAccount,
  rootValidator: Hex,
  approved: ApprovedPermission
): KernelValidator {
  if (
    rootValidator.length !== 44 ||
    slice(rootValidator, 0, 1) !== VALIDATOR_ROOT ||
    !isAddressEqual(slice(rootValidator, 1, 21), PASSKEY_ROOT_VALIDATOR)
  ) {
    throw new Error("unsupported_account");
  }
  const refuse = async (): Promise<never> => {
    throw new Error("The owner's passkey approves one permission and signs nothing else");
  };
  const account = toAccount({
    address: PASSKEY_ROOT_VALIDATOR,
    signMessage: refuse,
    signTransaction: refuse,
    async signTypedData(typedData) {
      const request = typedData as EnableRequest;
      if (!isApprovedRequest(request, approved)) throw new Error("unsupported_scope");
      const signed = await owner.signMessage({ message: { raw: hashTypedData(request) } });
      if (slice(signed, 0, 21).toLowerCase() !== rootValidator.toLowerCase()) {
        throw new Error("unsupported_account");
      }
      return slice(signed, 21);
    },
  });
  return {
    ...account,
    source: "PasskeyOwnerValidator",
    validatorType: "SECONDARY",
    supportedKernelVersions: "0.3.1",
    getIdentifier: () => PASSKEY_ROOT_VALIDATOR,
    // Only an account that does not exist yet is described by its owner's install data, and a
    // permission is approved by a deployed account alone.
    getEnableData: async () => "0x" as Hex,
    getNonceKey: async (_account, customNonceKey) => customNonceKey ?? 0n,
    isEnabled: async () => true,
    signUserOperation: refuse,
    getStubSignature: refuse,
  };
}
