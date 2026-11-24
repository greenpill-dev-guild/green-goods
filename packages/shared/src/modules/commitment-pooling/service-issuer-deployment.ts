import { decodeEventLog, encodeFunctionData, getCreate2Address, keccak256, parseAbi } from "viem";
import { serviceAddress } from "./service-access-chain-values";
import { verifyServiceDeploymentState } from "./service-access-live-route";
import type { ServiceIssuerChain } from "./service-issuer-chain";
import type { ServiceIssuerCodePin, ServiceIssuerProxyPin } from "./service-issuer-types";
import { issuerSame } from "./service-issuer-metadata";

export const ISSUER_FACTORY_ABI = parseAbi([
  "function deployDeterministicAndCall(address implementation,address admin,bytes32 salt,bytes data) payable returns(address)",
  "function predictDeterministicAddress(bytes32 salt) view returns(address)",
  "function adminOf(address proxy) view returns(address)",
  "function initCodeHash() view returns(bytes32)",
  "event Deployed(address indexed proxy,address indexed implementation,address indexed admin)",
]);
/** Factory creation has no receipt.contractAddress: exact reviewed calldata plus factory prediction bind its proxy. */
export async function verifyIssuerProxyDeployment(
  pin: ServiceIssuerProxyPin,
  factory: ServiceIssuerCodePin,
  chain: ServiceIssuerChain
) {
  const deployment = pin.factoryDeployment;
  if (!deployment) throw new Error("Reviewed CLC factory deployment evidence required");
  const [receipt, transaction, code, predicted, admin, initCodeHash] = await Promise.all([
    chain.receipt(100, pin.receipt.transactionHash),
    chain.transaction(100, pin.receipt.transactionHash),
    chain.code(100, factory.address),
    chain.read({
      chainId: 100,
      address: factory.address,
      abi: ISSUER_FACTORY_ABI,
      functionName: "predictDeterministicAddress",
      args: [deployment.salt],
    }),
    chain.read({
      chainId: 100,
      address: factory.address,
      abi: ISSUER_FACTORY_ABI,
      functionName: "adminOf",
      args: [pin.address],
    }),
    chain.read({
      chainId: 100,
      address: factory.address,
      abi: ISSUER_FACTORY_ABI,
      functionName: "initCodeHash",
    }),
    verifyServiceDeploymentState(pin, 100, chain),
  ]);
  const expected = encodeFunctionData({
    abi: ISSUER_FACTORY_ABI,
    functionName: "deployDeterministicAndCall",
    args: [
      pin.implementation.address as `0x${string}`,
      deployment.admin as `0x${string}`,
      deployment.salt,
      deployment.initializer,
    ],
  });
  let deployed = false;
  for (const log of receipt.logs ?? []) {
    if (!issuerSame(log.address, factory.address) || !log.topics[0]) continue;
    try {
      const event = decodeEventLog({
        abi: ISSUER_FACTORY_ABI,
        topics: [log.topics[0], ...log.topics.slice(1)],
        data: log.data,
      });
      if (
        event.eventName === "Deployed" &&
        issuerSame(event.args.proxy, pin.address) &&
        issuerSame(event.args.implementation, pin.implementation.address) &&
        issuerSame(event.args.admin, deployment.admin)
      )
        deployed = true;
    } catch {
      /* Other factory events do not prove this proxy deployment. */
    }
  }
  if (
    typeof initCodeHash !== "string" ||
    !/^0x[a-f0-9]{64}$/i.test(initCodeHash) ||
    !issuerSame(
      initCodeHash,
      "0x1fa551e9b261b3a9568d5ec12f9d6028366575ac46f6d66f918abeebb2242c6b"
    ) ||
    !issuerSame(
      getCreate2Address({
        from: factory.address as `0x${string}`,
        salt: deployment.salt,
        bytecodeHash: initCodeHash as `0x${string}`,
      }),
      pin.address
    ) ||
    !deployed ||
    receipt.status !== "success" ||
    !issuerSame(receipt.transactionHash, pin.receipt.transactionHash) ||
    receipt.blockNumber !== pin.receipt.blockNumber ||
    !issuerSame(receipt.blockHash, pin.receipt.blockHash) ||
    !receipt.to ||
    !issuerSame(receipt.to, factory.address) ||
    receipt.contractAddress ||
    !transaction.to ||
    !issuerSame(transaction.to, factory.address) ||
    !issuerSame(transaction.from, deployment.deployer) ||
    transaction.value !== 0n ||
    !issuerSame(transaction.input, expected) ||
    code === "0x" ||
    !issuerSame(keccak256(code), factory.runtimeCodeHash) ||
    !issuerSame(serviceAddress(predicted), pin.address) ||
    !issuerSame(serviceAddress(admin), deployment.admin)
  )
    throw new Error(
      "CLC factory deployment identity, initializer, implementation or admin changed"
    );
}
