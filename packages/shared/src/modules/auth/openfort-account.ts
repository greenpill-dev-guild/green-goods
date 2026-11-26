/**
 * The Kernel account an email wallet owns, and the record that restores it.
 *
 * The account is Kernel 0.3.3 with the ECDSA validator, the account logic the pilot passkey
 * profile uses, so its address is the same on every chain the factory serves. It is a different
 * address from the person's passkey account: linking the two is second-signer work.
 */

import { toKernelSmartAccount } from "permissionless/accounts";
import { type Hex, type LocalAccount, toHex } from "viem";
import { toAccount } from "viem/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import type { OpenfortSignInMethod } from "../../types/auth";
import type { OpenfortWallet } from "./openfort-wallet";
import { asHexAddress } from "./passkey-profile-storage";
import { OPENFORT_ACCOUNT_STORAGE_KEY, type SessionStorage } from "./session";

/** Pinned addresses, so a library default can never move anyone's account. */
const OPENFORT_KERNEL_RECIPE = {
  version: "0.3.3",
  index: 0n,
  useMetaFactory: true,
  validatorAddress: "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57",
  factoryAddress: "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9",
  accountLogicAddress: "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28",
  metaFactoryAddress: "0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
} as const;

/** The wallet signed as someone other than the account this session opened. */
export class OpenfortOwnerMismatchError extends Error {
  constructor() {
    super("The signed-in wallet does not own this account. Sign in again.");
    this.name = "OpenfortOwnerMismatchError";
  }
}

/**
 * A viem account whose signatures come from the embedded wallet. Before every signature it
 * makes sure this device holds the expected owner's signer, recovering it if the device lost
 * it, and refuses to sign as anyone else.
 */
export function createOpenfortOwner(wallet: OpenfortWallet, ownerAddress: Hex): LocalAccount {
  const ensureOwner = async () => {
    const current = (await wallet.currentOwnerAddress()) ?? (await wallet.configureWallet());
    if (current.toLowerCase() !== ownerAddress.toLowerCase())
      throw new OpenfortOwnerMismatchError();
  };
  return toAccount({
    address: ownerAddress,
    async signMessage({ message }) {
      await ensureOwner();
      if (typeof message === "string") return wallet.signMessage(message, false);
      return wallet.signMessage(
        typeof message.raw === "string" ? message.raw : toHex(message.raw),
        true
      );
    },
    async signTypedData(typedData) {
      await ensureOwner();
      return wallet.signTypedData(typedData as Parameters<OpenfortWallet["signTypedData"]>[0]);
    },
    async signTransaction() {
      throw new Error("An email wallet signs for its smart account and never sends itself");
    },
  });
}

export function createOpenfortKernelAccount({
  client,
  owner,
  knownAddress,
}: {
  client: Parameters<typeof toKernelSmartAccount>[0]["client"];
  owner: LocalAccount;
  knownAddress?: Hex;
}) {
  return toKernelSmartAccount({
    client,
    ...OPENFORT_KERNEL_RECIPE,
    owners: [owner],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    address: knownAddress,
  });
}

/** What a reload needs to reopen the account without asking Openfort; cleared at sign-out. */
export interface OpenfortAccountRecord {
  ownerAddress: Hex;
  smartAccountAddress: Hex;
  method: OpenfortSignInMethod;
  /** The email the person signed in with, shown as whose account is open. */
  email: string;
}

export function getStoredOpenfortAccount(
  storage: SessionStorage = localStorage
): OpenfortAccountRecord | null {
  try {
    const value = JSON.parse(storage.getItem(OPENFORT_ACCOUNT_STORAGE_KEY) ?? "null") as Record<
      string,
      unknown
    > | null;
    const ownerAddress = asHexAddress(value?.ownerAddress);
    const smartAccountAddress = asHexAddress(value?.smartAccountAddress);
    const method = value?.method;
    const email = value?.email;
    if (!ownerAddress || !smartAccountAddress || method !== "email" || typeof email !== "string")
      return null;
    return { ownerAddress, smartAccountAddress, method, email };
  } catch {
    return null;
  }
}

export function setStoredOpenfortAccount(
  record: OpenfortAccountRecord,
  storage: SessionStorage = localStorage
): void {
  storage.setItem(OPENFORT_ACCOUNT_STORAGE_KEY, JSON.stringify(record));
}

export function clearStoredOpenfortAccount(storage: SessionStorage = localStorage): void {
  storage.removeItem(OPENFORT_ACCOUNT_STORAGE_KEY);
}
