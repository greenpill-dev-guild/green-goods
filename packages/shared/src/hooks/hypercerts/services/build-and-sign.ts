/**
 * Build & Sign Transaction Service
 *
 * XState actor that constructs and submits the hypercert minting transaction.
 * Supports both smart account (UserOp) and EOA (direct tx) flows.
 *
 * @module hooks/hypercerts/services/build-and-sign
 */

import { fromPromise } from "xstate";

import { getChain } from "../../../config/chains";
import { encodeCreateAllowlist, TransferRestrictions } from "../../../lib/hypercerts";
import type { Address } from "../../../types/domain";
import type { MintHypercertSigningInput } from "../../../workflows/mintHypercert";
import { CREATE_ALLOWLIST_ABI } from "../../../utils/blockchain/hypercert-abis";
import { resolveHypercertContracts } from "../hypercert-contracts";
import type { MintServiceDeps } from "./types";

/**
 * Creates the buildAndSignUserOp actor for the mint hypercert machine.
 *
 * Resolves contract addresses, encodes the createAllowlist calldata,
 * then either submits a UserOp (smart account) or writes a direct
 * contract call (EOA wallet).
 */
export function createBuildAndSignActor(deps: MintServiceDeps) {
  return fromPromise(async ({ input }: { input: MintHypercertSigningInput }) => {
    if (!input.metadataCid) {
      throw new Error("Missing metadata CID");
    }
    if (!input.merkleRoot) {
      throw new Error("Missing merkle root");
    }

    const currentSmartAccountClient = deps.smartAccountClientRef.current;
    const currentEoaAddress = deps.eoaAddressRef.current;
    const currentWalletClient = deps.walletClientRef.current;
    const currentChainId = deps.chainIdRef.current;

    const contracts = await resolveHypercertContracts(currentChainId);
    const callData = encodeCreateAllowlist({
      account: currentSmartAccountClient?.account?.address || (currentEoaAddress as Address),
      totalUnits: input.totalUnits,
      merkleRoot: input.merkleRoot,
      metadataUri: `ipfs://${input.metadataCid}`,
      transferRestrictions: TransferRestrictions.AllowAll,
    });

    if (currentSmartAccountClient) {
      const userOpHash = await currentSmartAccountClient.sendUserOperation({
        account: currentSmartAccountClient.account,
        calls: [
          {
            to: contracts.hypercertMinter,
            data: callData,
            value: 0n,
          },
        ],
      });

      return { hash: userOpHash };
    }

    if (!currentWalletClient || !currentEoaAddress) {
      throw new Error("Connect a wallet to mint the hypercert");
    }

    const txHash = await currentWalletClient.writeContract({
      address: contracts.hypercertMinter,
      abi: CREATE_ALLOWLIST_ABI,
      functionName: "createAllowlist",
      args: [
        currentEoaAddress as Address,
        input.totalUnits,
        input.merkleRoot,
        `ipfs://${input.metadataCid}`,
        TransferRestrictions.AllowAll,
      ],
      account: currentEoaAddress as Address,
      chain: getChain(currentChainId),
    });

    return { hash: txHash };
  });
}
