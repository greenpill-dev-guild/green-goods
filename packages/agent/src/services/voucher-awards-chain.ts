import {
  createPublicClient,
  erc20Abi,
  http,
  keccak256,
  parseAbi,
  type PublicClient,
  zeroAddress,
} from "viem";
import { gnosis } from "viem/chains";
import type { Address } from "@green-goods/shared/types";
import {
  VOUCHER_AWARD_ISSUERS,
  type VoucherAwardIssuer,
} from "@green-goods/shared/modules/commitment-pooling/voucher-award-config";
import {
  recoverVoucherAwardSigners,
  verifyVoucherAwardLogs,
  voucherAwardSafeEnvelope,
  VOUCHER_AWARD_SAFE_ABI,
} from "@green-goods/shared/modules/commitment-pooling/voucher-award-safe";
import { VoucherAwardError, type VoucherAwardChain } from "./voucher-awards";

const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const AUTH = parseAbi([
  "function owner() view returns(address)",
  "function safe() view returns(address)",
  "function gate() view returns(address)",
  "function isValidSigner(address) view returns(bool)",
]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const storedAddress = (word: string | undefined) => {
  if (!word || !/^0x0{24}[a-f\d]{40}$/i.test(word)) throw new Error("Invalid authority storage");
  return `0x${word.slice(-40)}` as Address;
};
type ChainClient = Pick<
  PublicClient,
  "readContract" | "getCode" | "getStorageAt" | "getTransaction" | "getTransactionReceipt"
>;

export function createVoucherAwardChain(input: {
  rpcUrl: string;
  client?: ChainClient;
  issuers?: readonly VoucherAwardIssuer[];
}): VoucherAwardChain {
  const client =
    input.client ?? createPublicClient({ chain: gnosis, transport: http(input.rpcUrl) });
  const issuers = input.issuers ?? VOUCHER_AWARD_ISSUERS;
  const issuer = (reserve: string, token?: string) => {
    const found = issuers.find(
      (asset) => same(asset.issuer, reserve) && (!token || same(asset.token, token))
    );
    if (!found) throw new VoucherAwardError("issuer_unavailable", 403);
    return found;
  };
  const canPrepare = async (reserve: Address, actor: Address): Promise<boolean> => {
    const asset = issuer(reserve);
    if (
      !(await client.readContract({
        address: reserve,
        abi: VOUCHER_AWARD_SAFE_ABI,
        functionName: "isOwner",
        args: [actor],
      }))
    )
      return false;
    const guard = storedAddress(await client.getStorageAt({ address: reserve, slot: GUARD_SLOT }));
    if (!asset.guardReceiver) return same(guard, zeroAddress);
    const receiver = asset.guardReceiver;
    const code = await client.getCode({ address: receiver.address });
    if (!code || !same(keccak256(code), receiver.runtimeCodeHash) || same(guard, zeroAddress))
      return false;
    const [actualSafe, actualGuard] = await Promise.all([
      client.readContract({ address: receiver.address, abi: AUTH, functionName: "safe" }),
      client.readContract({ address: receiver.address, abi: AUTH, functionName: "gate" }),
    ]);
    if (!same(actualSafe, reserve) || !same(actualGuard, guard)) return false;
    return client.readContract({
      address: guard,
      abi: AUTH,
      functionName: "isValidSigner",
      args: [actor],
    });
  };
  const assertToken = async (asset: VoucherAwardIssuer) => {
    const [owner, code, implementationSlot, implementationCode] = await Promise.all([
      client.readContract({ address: asset.token, abi: AUTH, functionName: "owner" }),
      client.getCode({ address: asset.token }),
      client.getStorageAt({ address: asset.token, slot: IMPLEMENTATION_SLOT }),
      client.getCode({ address: asset.implementation.address }),
    ]);
    if (
      !same(owner, asset.issuer) ||
      !code ||
      !same(keccak256(code), asset.runtimeCodeHash) ||
      !same(storedAddress(implementationSlot), asset.implementation.address) ||
      !implementationCode ||
      !same(keccak256(implementationCode), asset.implementation.runtimeCodeHash)
    )
      throw new VoucherAwardError("issuer_configuration_changed", 409);
  };
  return {
    canPrepare,
    async nonceMatches(record) {
      await assertToken(issuer(record.award.reserve, record.award.token));
      return (
        (await client.readContract({
          address: record.safe.safe,
          abi: VOUCHER_AWARD_SAFE_ABI,
          functionName: "nonce",
        })) === BigInt(record.safe.nonce)
      );
    },
    async prepare(award) {
      const asset = issuer(award.reserve, award.token);
      const [, balance, nonce, threshold] = await Promise.all([
        assertToken(asset),
        client.readContract({
          address: asset.token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [award.reserve],
        }),
        client.readContract({
          address: award.reserve,
          abi: VOUCHER_AWARD_SAFE_ABI,
          functionName: "nonce",
        }),
        client.readContract({
          address: award.reserve,
          abi: VOUCHER_AWARD_SAFE_ABI,
          functionName: "getThreshold",
        }),
      ]);
      if (threshold < 1n || threshold > 100n)
        throw new VoucherAwardError("issuer_configuration_changed", 409);
      if (balance < BigInt(award.amount)) throw new VoucherAwardError("insufficient_reserve", 409);
      const envelope = voucherAwardSafeEnvelope(award, nonce, Number(threshold));
      const onchainHash = await client.readContract({
        address: award.reserve,
        abi: VOUCHER_AWARD_SAFE_ABI,
        functionName: "getTransactionHash",
        args: [envelope.to, 0n, envelope.data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, nonce],
      });
      if (!same(onchainHash, envelope.safeTxHash))
        throw new VoucherAwardError("safe_hash_mismatch", 409);
      return envelope;
    },
    async reconcile(record, transactionHash) {
      // The pinned token code must still be in place before any evidence counts: a replaced proxy
      // or implementation could run the reviewed calldata and emit the expected Transfer anyway.
      await assertToken(issuer(record.award.reserve, record.award.token));
      let receipt;
      try {
        receipt = await client.getTransactionReceipt({ hash: transactionHash });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !["TransactionReceiptNotFoundError", "TransactionNotFoundError"].includes(error.name)
        )
          throw error;
      }
      if (receipt?.status === "success") {
        try {
          return { status: verifyVoucherAwardLogs(record, receipt.logs), transactionHash };
        } catch {
          throw new VoucherAwardError("transaction_unverified", 409);
        }
      }
      // A pending or reverted outer transaction proves its intended call only when it targets
      // the Safe directly. Account-abstraction sends wait for the inner Safe receipt instead.
      const transaction = await client.getTransaction({ hash: transactionHash });
      if (!transaction.to || !same(transaction.to, record.safe.safe) || transaction.value !== 0n)
        throw new VoucherAwardError("transaction_unverified", 409);
      let signers: Address[];
      try {
        signers = await recoverVoucherAwardSigners(record, transaction.input);
      } catch {
        throw new VoucherAwardError("transaction_unverified", 409);
      }
      const [eligible, threshold, nonce] = await Promise.all([
        Promise.all(signers.map((signer) => canPrepare(record.award.reserve, signer))),
        client.readContract({
          address: record.safe.safe,
          abi: VOUCHER_AWARD_SAFE_ABI,
          functionName: "getThreshold",
        }),
        client.readContract({
          address: record.safe.safe,
          abi: VOUCHER_AWARD_SAFE_ABI,
          functionName: "nonce",
        }),
      ]);
      if (eligible.some((allowed) => !allowed) || threshold !== BigInt(record.safe.threshold))
        throw new VoucherAwardError("transaction_unverified", 409);
      if (nonce !== BigInt(record.safe.nonce))
        throw new VoucherAwardError("safe_nonce_changed", 409);
      return {
        status: receipt?.status === "reverted" ? "transaction_reverted" : "submitted",
        transactionHash,
      };
    },
  };
}
