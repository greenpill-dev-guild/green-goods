import { encodeAbiParameters, keccak256, stringToHex, type AbiParameter } from "viem";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import type {
  ServiceVoucherAuthorization,
  VoucherFinalAllocation,
} from "./service-access-voucher-types";

// Domains and complete tuples mirror the authoritative v2 wire codec; no token conversion is inferred.
function output(name: string): AbiParameter {
  const entry = SourceABI.find((v) => v.type === "function" && v.name === name);
  if (!entry || !("outputs" in entry) || !entry.outputs?.[0])
    throw new Error("Missing voucher ABI");
  return entry.outputs[0] as AbiParameter;
}
const AUTHORIZATION_PARAMETER = output("getSetupAuthorization");
export function voucherAuthorizationIdentity(a: ServiceVoucherAuthorization) {
  const authorizationHash = keccak256(encodeAbiParameters([AUTHORIZATION_PARAMETER], [a]));
  const setupId = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint64" },
        { type: "bytes32" },
        { type: "uint64" },
      ],
      [
        keccak256(stringToHex("GREEN_GOODS_VOUCHER_SERVICE_SETUP_V2")),
        BigInt(a.sourceChainId),
        a.sourceModule,
        a.coreModule,
        a.commitmentId,
        a.termsRevision,
        a.claimHash,
        a.requestNonce,
      ]
    )
  );
  return { authorizationHash, setupId };
}

export function voucherDepositReceiptHash(a: ServiceVoucherAuthorization) {
  const identity = voucherAuthorizationIdentity(a);
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [
        keccak256(stringToHex("GREEN_GOODS_VOUCHER_SERVICE_DEPOSIT_V2")),
        BigInt(a.destinationChainId),
        a.destinationEscrow,
        identity.setupId,
        identity.authorizationHash,
        a.holder,
        a.token,
        a.voucherUnits,
        1n,
      ]
    )
  );
}
export function voucherFinalDecisionId(
  a: ServiceVoucherAuthorization,
  activation: `0x${string}`,
  allocation: VoucherFinalAllocation,
  ceiling: bigint
) {
  const identity = voucherAuthorizationIdentity(a);
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        {
          type: "tuple",
          components: [
            { name: "approvedDeliveredServiceUnits", type: "uint256" },
            { name: "releaseVoucherUnits", type: "uint256" },
            { name: "refundVoucherUnits", type: "uint256" },
          ],
        },
        { type: "uint256" },
      ],
      [
        keccak256(stringToHex("GREEN_GOODS_VOUCHER_SERVICE_FINAL_ALLOCATION_V2")),
        BigInt(a.destinationChainId),
        a.destinationEscrow,
        identity.setupId,
        identity.authorizationHash,
        activation,
        allocation,
        ceiling,
      ]
    )
  );
}
