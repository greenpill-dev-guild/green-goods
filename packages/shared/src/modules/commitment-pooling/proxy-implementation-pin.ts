import type { Hex } from "viem";
import type { Address } from "../../types/domain";

/** ERC-1967's implementation slot: `keccak256("eip1967.proxy.implementation") - 1`. */
export const ERC1967_IMPLEMENTATION_SLOT: Hex =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/**
 * Whether an upgradeable proxy still runs the implementation that was reviewed: its ERC-1967 slot
 * names the pinned implementation, and that implementation's runtime code hashes to the pinned
 * hash. A slot holding anything but a left-padded address, or an implementation with no code
 * (`codeHash` null), never matches.
 */
export function implementationMatchesPin(
  slot: Hex,
  codeHash: Hex | null,
  pinned: { address: Address; runtimeCodeHash: Hex }
): boolean {
  return (
    /^0x0{24}[a-f0-9]{40}$/i.test(slot) &&
    `0x${slot.slice(-40)}`.toLowerCase() === pinned.address.toLowerCase() &&
    codeHash !== null &&
    codeHash.toLowerCase() === pinned.runtimeCodeHash.toLowerCase()
  );
}
