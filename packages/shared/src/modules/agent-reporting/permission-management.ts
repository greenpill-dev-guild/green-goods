import { KernelV3_1AccountAbi } from "@zerodev/sdk";
import {
  type Address,
  type Hex,
  concatHex,
  isAddressEqual,
  keccak256,
  padHex,
  parseAbiItem,
  zeroAddress,
} from "viem";
import { type RevocationDescriptor, revocationDescriptorIssues } from "./grants";

/** Public deployment pin read from Arbitrum on 2026-10-02; grants still require their own module gate. */
export const KERNEL_REVOCATION_PIN = {
  chainId: 42161,
  implementation: "0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D" as Address,
  codeHash: "0xcc67e791036a8f3df40d3d0f840e7df67f3c69eae9da0a8bffec9e0f91a8db7b" as Hex,
} as const;
export const KERNEL_PERMISSION_ABI = KernelV3_1AccountAbi;
export const permissionStorageKey = (account: string) =>
  `gg:reporting-permissions:${KERNEL_REVOCATION_PIN.chainId}:${account.toLowerCase()}`;
/** Must succeed before installing authority; stores public metadata only, no signatures/calldata. */
export function persistRevocationDescriptor(descriptor: RevocationDescriptor): void {
  if (revocationDescriptorIssues(descriptor).length) throw new Error("invalid_descriptor");
  const key = permissionStorageKey(descriptor.account);
  const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
  const descriptors = Array.isArray(stored.descriptors)
    ? stored.descriptors.filter((d: unknown) => revocationDescriptorIssues(d).length === 0)
    : [];
  const unique = new Map(
    [...descriptors, descriptor].map((d: RevocationDescriptor) => [d.permissionId, d])
  );
  localStorage.setItem(key, JSON.stringify({ ...stored, descriptors: [...unique.values()] }));
}
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;
const INSTALLED = parseAbiItem("event PermissionInstalled(bytes4 permission, uint32 nonce)");

export interface KernelPermissionView {
  permissionId: Hex;
  signerAddress: Address;
  active: boolean;
  nonce: number;
  descriptor: RevocationDescriptor | null;
}

/** Minimal direct-chain port, deliberately independent of Agent transport/session/database. */
export interface PermissionReader {
  assertKernel(account: Address): Promise<void>;
  generations(account: Address): Promise<{ current: number; validFrom: number }>;
  permission(
    account: Address,
    permissionId: Hex
  ): Promise<Omit<KernelPermissionView, "descriptor">>;
  discover(account: Address): Promise<Hex[]>;
}

export function permissionValidationId(permissionId: Hex): Hex {
  if (!/^0x[0-9a-fA-F]{8}$/.test(permissionId)) throw new Error("invalid_descriptor");
  return concatHex(["0x02", padHex(permissionId, { size: 20, dir: "right" })]);
}

export function createPermissionReader(client: {
  getStorageAt(input: { address: Address; slot: Hex }): Promise<Hex | undefined>;
  getCode(input: { address: Address }): Promise<Hex | undefined>;
  readContract(input: Record<string, unknown>): Promise<unknown>;
  getBlockNumber(): Promise<bigint>;
  getBlock(input: { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
  getLogs(input: Record<string, unknown>): Promise<Array<{ args: { permission?: Hex } }>>;
}): PermissionReader {
  const read = (account: Address, functionName: string, args: unknown[] = []) =>
    client.readContract({ address: account, abi: KERNEL_PERMISSION_ABI, functionName, args });
  const generations = async (account: Address) => {
    const [current, validFrom] = await Promise.all([
      read(account, "currentNonce"),
      read(account, "validNonceFrom"),
    ]);
    return { current: Number(current), validFrom: Number(validFrom) };
  };
  return {
    async assertKernel(account) {
      const slot = await client.getStorageAt({ address: account, slot: IMPLEMENTATION_SLOT });
      if (
        !slot ||
        !isAddressEqual(`0x${slot.slice(-40)}` as Address, KERNEL_REVOCATION_PIN.implementation)
      ) {
        throw new Error("unsupported_account");
      }
      const code = await client.getCode({ address: KERNEL_REVOCATION_PIN.implementation });
      if (!code || keccak256(code) !== KERNEL_REVOCATION_PIN.codeHash)
        throw new Error("unsupported_account");
    },
    generations,
    async permission(account, permissionId) {
      const validationId = permissionValidationId(permissionId);
      const [config, validation, root, generation, executionAllowed] = await Promise.all([
        read(account, "permissionConfig", [permissionId]),
        read(account, "validationConfig", [validationId]),
        read(account, "rootValidator"),
        generations(account),
        read(account, "isAllowedSelector", [validationId, "0xe9ae5c53"]),
      ]);
      const { signer } = config as { signer: Address };
      const { nonce, hook } = validation as { nonce: number; hook: Address };
      // Root credentials must never be offered as removable permissions.
      if (root === validationId) throw new Error("unsupported_account");
      return {
        permissionId,
        signerAddress: signer,
        nonce: Number(nonce),
        active:
          signer !== zeroAddress &&
          hook !== zeroAddress &&
          Number(nonce) >= generation.validFrom &&
          executionAllowed === true,
      };
    },
    async discover(account) {
      const tip = await client.getBlockNumber();
      const { timestamp } = await client.getBlock({ blockNumber: tip });
      const startTime = timestamp > 86_400n ? timestamp - 86_400n : 0n;
      let low = 0n;
      let high = tip;
      while (low < high) {
        const mid = (low + high) / 2n;
        const block = await client.getBlock({ blockNumber: mid });
        if (block.timestamp < startTime) low = mid + 1n;
        else high = mid;
      }
      if (tip - low > 1_000_000n) throw new Error("dependency_unavailable");
      const ids = new Set<Hex>();
      // Reconstruct the accepted maximum 24-hour grant window, even after storage is cleared.
      for (let from = low; from <= tip; from += 10_000n) {
        const logs = await client.getLogs({
          address: account,
          event: INSTALLED,
          fromBlock: from,
          toBlock: from + 9_999n < tip ? from + 9_999n : tip,
          strict: true,
        });
        for (const log of logs) if (log.args.permission) ids.add(log.args.permission);
        if (ids.size > 100) throw new Error("dependency_unavailable");
      }
      return [...ids];
    },
  };
}

/** One owner call; deliberately invalidates ALL non-root permission generations, with no Agent. */
export function invalidatePermissionCall(account: Address, current: number) {
  if (!Number.isSafeInteger(current) || current < 0 || current >= 0xffff_ffff)
    throw new Error("unsupported_account");
  return {
    address: account,
    account,
    chainId: KERNEL_REVOCATION_PIN.chainId,
    abi: KERNEL_PERMISSION_ABI,
    functionName: "invalidateNonce",
    args: [current + 1],
    value: 0n,
  };
}
