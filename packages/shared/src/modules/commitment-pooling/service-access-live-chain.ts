import { getPublicClient } from "@wagmi/core";
import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  parseAbi,
  type Abi,
  type Hex,
} from "viem";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import EscrowABI from "@green-goods/contracts/abis/GnosisVoucherEscrow.json";
import AcceptanceABI from "@green-goods/contracts/abis/ICommitmentVoucherAcceptance.json";
import ServiceOffersABI from "@green-goods/contracts/abis/ICommitmentServiceOffers.json";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import type { ServiceChainRead } from "./service-access-chain";
import type { ServiceDeploymentPin, ServiceLiveRoute } from "./service-access-live-config";
import type { ServiceAccessSnapshot } from "./service-access-types";
import {
  mapVoucherFinalResult,
  mapVoucherSetupResult,
} from "./service-access-voucher-chain-mappers";
import {
  serviceAddress as address,
  serviceFlag as flag,
  serviceHash as hash,
  serviceTuple as tuple,
  serviceUint as uint,
  SERVICE_ZERO_HASH as ZERO,
} from "./service-access-chain-values";

const OWNER = parseAbi(["function owner() view returns (address)"]);
const SAFE_UPGRADE = parseAbi([
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool)",
  "event ExecutionSuccess(bytes32 txHash,uint256 payment)",
  "event ExecutionFailure(bytes32 txHash,uint256 payment)",
  "event Upgraded(address indexed implementation)",
]);
const UPGRADE = parseAbi(["function upgradeTo(address implementation)"]);
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface ServiceLiveChain {
  read: ServiceChainRead;
  code(chainId: number, account: Address): Promise<Hex>;
  storage(chainId: number, account: Address, slot: Hex): Promise<Hex>;
  receipt(
    chainId: number,
    transactionHash: Hex
  ): Promise<{
    status: string;
    transactionHash: Hex;
    blockNumber: bigint;
    blockHash: Hex;
    to: Address | null;
    contractAddress?: Address | null;
    logs?: readonly { address: Address; topics: readonly Hex[]; data: Hex }[];
  }>;
  transaction(
    chainId: number,
    transactionHash: Hex
  ): Promise<{ from: Address; to: Address | null; input: Hex; value: bigint }>;
  balance(chainId: number, account: Address): Promise<bigint>;
}
function publicClient(chainId: number) {
  const client = getPublicClient(getWagmiConfig(), { chainId });
  if (!client || client.chain?.id !== chainId) throw new Error("Service chain reader unavailable");
  return client;
}
export const serviceLiveChain: ServiceLiveChain = {
  read: async (input) =>
    publicClient(input.chainId).readContract({ ...input, args: input.args ?? [] }),
  code: async (chain, account) => (await publicClient(chain).getCode({ address: account })) ?? "0x",
  storage: async (chain, account, slot) =>
    (await publicClient(chain).getStorageAt({ address: account, slot })) ?? "0x",
  receipt: (chain, transactionHash) =>
    publicClient(chain).getTransactionReceipt({ hash: transactionHash }),
  transaction: (chain, transactionHash) =>
    publicClient(chain).getTransaction({ hash: transactionHash }),
  balance: (chain, address) => publicClient(chain).getBalance({ address }),
};

async function verifyDeployment(
  pin: ServiceDeploymentPin,
  chainId: number,
  chain: ServiceLiveChain
) {
  const [receipt, code, slot, implementation, owner] = await Promise.all([
    chain.receipt(chainId, pin.receipt.transactionHash),
    chain.code(chainId, pin.address),
    chain.storage(chainId, pin.address, IMPLEMENTATION_SLOT),
    chain.code(chainId, pin.implementation.address),
    chain.read({ chainId, address: pin.address, abi: OWNER, functionName: "owner" }),
  ]);
  let targetMatches = [receipt.to, receipt.contractAddress].some(
    (value) => value && same(value, pin.address)
  );
  if (pin.receipt.kind === "safe-upgrade") {
    targetMatches = false;
    const transaction = await chain.transaction(chainId, pin.receipt.transactionHash);
    if (
      receipt.to &&
      transaction.to &&
      same(receipt.to, pin.owner) &&
      same(transaction.to, pin.owner) &&
      transaction.value === 0n
    ) {
      const decoded = decodeFunctionData({ abi: SAFE_UPGRADE, data: transaction.input });
      if (decoded.functionName === "execTransaction") {
        const [to, value, data, operation, , baseGas, gasPrice, gasToken, refundReceiver] =
          decoded.args;
        const directUpgrade = encodeFunctionData({
          abi: UPGRADE,
          functionName: "upgradeTo",
          args: [pin.implementation.address as `0x${string}`],
        });
        let successful = false;
        let failed = false;
        let upgraded = false;
        for (const log of receipt.logs ?? []) {
          if (!log.topics[0]) continue;
          try {
            const event = decodeEventLog({
              abi: SAFE_UPGRADE,
              topics: [log.topics[0], ...log.topics.slice(1)],
              data: log.data,
            });
            if (
              same(log.address, pin.owner) &&
              event.eventName === "ExecutionSuccess" &&
              event.args.payment === 0n
            )
              successful = true;
            if (same(log.address, pin.owner) && event.eventName === "ExecutionFailure")
              failed = true;
            if (
              same(log.address, pin.address) &&
              event.eventName === "Upgraded" &&
              same(event.args.implementation, pin.implementation.address)
            )
              upgraded = true;
          } catch {
            /* Other receipt events do not establish this upgrade. */
          }
        }
        targetMatches =
          same(to, pin.address) &&
          value === 0n &&
          same(data, directUpgrade) &&
          operation === 0 &&
          baseGas === 0n &&
          gasPrice === 0n &&
          /^0x0{40}$/i.test(gasToken) &&
          /^0x0{40}$/i.test(refundReceiver) &&
          successful &&
          !failed &&
          upgraded;
      }
    }
  }
  if (
    receipt.status !== "success" ||
    !same(receipt.transactionHash, pin.receipt.transactionHash) ||
    receipt.blockNumber !== pin.receipt.blockNumber ||
    !same(receipt.blockHash, pin.receipt.blockHash) ||
    !targetMatches ||
    code === "0x" ||
    !same(keccak256(code), pin.runtimeCodeHash) ||
    !/^0x0{24}[a-f0-9]{40}$/i.test(slot) ||
    !same(`0x${slot.slice(-40)}`, pin.implementation.address) ||
    implementation === "0x" ||
    !same(keccak256(implementation), pin.implementation.runtimeCodeHash) ||
    !same(address(owner), pin.owner)
  )
    throw new Error("Service deployment receipt, implementation or owner changed");
}

/** Proxy bytecode alone does not identify its implementation or authority. */
export async function verifyServiceLiveRoute(route: ServiceLiveRoute, chain: ServiceLiveChain) {
  if (
    route.sourceChainId !== 42161 ||
    !route.id ||
    !Number.isSafeInteger(route.revision) ||
    route.revision < 1 ||
    !route.assets.length ||
    !route.buyerGardens.length
  )
    throw new Error("Invalid reviewed service route");
  await Promise.all([
    verifyDeployment(route.core, 42161, chain),
    verifyDeployment(route.source, 42161, chain),
    verifyDeployment(route.destination, 100, chain),
  ]);
  const read = (chainId: number, account: Address, abi: Abi, functionName: string) =>
    chain.read({ chainId, address: account, abi, functionName });
  const [service, voucher, module, core] = await Promise.all([
    read(42161, route.core.address, ServiceOffersABI as Abi, "serviceOfferProtocolVersion"),
    read(42161, route.core.address, AcceptanceABI as Abi, "voucherAcceptanceProtocolVersion"),
    read(42161, route.core.address, AcceptanceABI as Abi, "voucherServiceSetupModule"),
    read(42161, route.source.address, SourceABI as Abi, "commitmentPooling"),
  ]);
  if (
    service !== 1 ||
    voucher !== 1 ||
    !same(address(module), route.source.address) ||
    !same(address(core), route.core.address)
  )
    throw new Error("Service protocol or core pin changed");
  await Promise.all(
    [
      {
        pin: route.source,
        local: 42161,
        remote: 100,
        peer: route.destination.address,
        abi: SourceABI,
      },
      {
        pin: route.destination,
        local: 100,
        remote: 42161,
        peer: route.source.address,
        abi: EscrowABI,
      },
    ].map(async ({ pin, local, remote, peer, abi }) => {
      const [guardian, router, localChain, remoteChain, remotePeer, selector] = await Promise.all(
        [
          "guardian",
          "CCIP_ROUTER",
          "LOCAL_CHAIN_ID",
          "remoteChainId",
          "remotePeer",
          "remoteChainSelector",
        ].map((fn) => read(local, pin.address, abi as Abi, fn))
      );
      if (
        same(pin.owner, pin.guardian) ||
        !same(address(guardian), pin.guardian) ||
        !same(address(router), pin.router) ||
        uint(localChain) !== BigInt(local) ||
        uint(remoteChain) !== BigInt(remote) ||
        !same(address(remotePeer), peer) ||
        uint(selector, 64) !== pin.remoteSelector
      )
        throw new Error("Service peer or recovery authority changed");
    })
  );
  await Promise.all(
    route.assets.map(async (asset) => {
      const [code, slot, implementation] = await Promise.all([
        chain.code(100, asset.token),
        chain.storage(100, asset.token, IMPLEMENTATION_SLOT),
        chain.code(100, asset.implementation.address),
      ]);
      if (
        code === "0x" ||
        !same(keccak256(code), asset.runtimeCodeHash) ||
        !/^0x0{24}[a-f0-9]{40}$/i.test(slot) ||
        !same(`0x${slot.slice(-40)}`, asset.implementation.address) ||
        implementation === "0x" ||
        !same(keccak256(implementation), asset.implementation.runtimeCodeHash)
      )
        throw new Error("Service voucher token changed");
    })
  );
}

/** Destination decisions, custody, allowance, fees and immutable allocation come from RPC, never the index. */
export async function hydrateLiveVoucherSnapshot(
  s: ServiceAccessSnapshot,
  route: ServiceLiveRoute,
  chain: ServiceLiveChain
) {
  const call = (
    chainId: number,
    account: Address,
    abi: Abi,
    functionName: string,
    args: readonly unknown[] = []
  ) => chain.read({ chainId, address: account, abi, functionName, args });
  s.pause.destinationVoucher = flag(
    await call(100, route.destination.address, EscrowABI as Abi, "paused")
  );
  for (const row of s.voucherSetups) {
    const a = row.authorization;
    const asset = route.assets.find((v) => same(v.token, a.token) && same(v.issuer, a.issuer));
    if (
      !asset ||
      !same(a.sourceModule, route.source.address) ||
      !same(a.destinationEscrow, route.destination.address) ||
      a.destinationChainId !== 100 ||
      !same(a.buyer, a.holder)
    )
      throw new Error("Voucher authorization is outside the reviewed pilot route");
    row.asset = {
      chainId: 100,
      token: asset.token,
      symbol: asset.symbol,
      decimals: asset.decimals,
    };
    const source = (fn: string, args: readonly unknown[]) =>
      call(42161, route.source.address, SourceABI as Abi, fn, args);
    const dest = (fn: string, args: readonly unknown[] = [row.setupId]) =>
      call(100, route.destination.address, EscrowABI as Abi, fn, args);
    row.fees.authorization = uint(await source("quoteSetupCommand", [row.setupId, 0]));
    row.fees.decision =
      row.source.decision === "none"
        ? null
        : uint(await source("quoteSetupCommand", [row.setupId, 1]));
    const execution = tuple(await dest("getSetupExecution"), [
      "authorization",
      "result",
      "pendingAction",
      "decision",
      "failureReason",
      "issuerReturnCeiling",
      "holderAbortRequested",
      "setupAcknowledgment",
      "finalAcknowledgment",
      "finalSequence",
      "finalAllocation",
    ]);
    const result = mapVoucherSetupResult(execution.result, row.setupId, row.authorizationHash, a);
    if (!result) {
      row.destination = null;
      continue;
    }
    const [allowance, balance] = await Promise.all([
      call(100, asset.token, erc20Abi, "allowance", [a.holder, a.destinationEscrow]),
      call(100, asset.token, erc20Abi, "balanceOf", [a.holder]),
    ]);
    const finalRaw = tuple(execution.finalAllocation, [
      "decisionId",
      "activationDecisionId",
      "issuerReturnApprovalAtFreeze",
      "allocation",
      "release",
      "refund",
    ]);
    const final =
      hash(finalRaw.decisionId) === ZERO
        ? null
        : mapVoucherFinalResult(
            await dest("getFinalResult"),
            row.setupId,
            row.authorizationHash,
            a
          );
    if (typeof execution.pendingAction !== "number" || ![0, 1, 2].includes(execution.pendingAction))
      throw new Error("Unknown voucher recovery action");
    row.destination = {
      evidence: "onchain",
      result,
      issuerReturnCeiling: uint(execution.issuerReturnCeiling),
      pendingAction: ([null, "deposit", "abort-refund"] as const)[execution.pendingAction]!,
      holderAbortRequested: flag(execution.holderAbortRequested),
      allowance: uint(allowance),
      holderBalance: uint(balance),
      finalAllocation: final,
    };
    for (const [name, sequence] of [
      ["setup", result.sequence],
      ["final", uint(execution.finalSequence, 64)],
    ] as const) {
      const ack = tuple(execution[`${name}Acknowledgment`], [
        "sequence",
        "messageId",
        "failureHash",
      ]);
      const sent = uint(ack.sequence, 64);
      row.acknowledgments[name] = {
        ...row.acknowledgments[name],
        destinationSequence: sequence,
        sentSequence: sent,
        pending: sent < sequence,
        sent: hash(ack.messageId) !== ZERO,
      };
    }
    row.fees.holderAbortRequest =
      result.decision === "none" ? uint(await dest("quoteSetupAbortRequest")) : null;
    row.fees.setupAcknowledgment = uint(await dest("quoteSetupAcknowledgment"));
    row.fees.finalAcknowledgment = final ? uint(await dest("quoteFinalAcknowledgment")) : null;
  }
}
