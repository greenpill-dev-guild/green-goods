import assert from "node:assert/strict";
import { concat, getAddress, getCreate2Address, Interface, keccak256, toUtf8Bytes, TypedDataEncoder } from "ethers";

export const HATS_DELEGATION = Object.freeze({
  chainId: 42161,
  safe: "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19",
  module: "0x5b943088ecdDBF8E4ae387348A88A654aC5F7266",
  manager: "0xfBf07b2d0e5eA8249756F205e5214B9d7cDF4e66",
  hats: "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
  factory: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  // Arachnid/deterministic-deployment-proxy, deployed runtime (not its creation code).
  factoryRuntime:
    "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3",
  roles: [
    "0x0000005c00010000000000000000000000000000000000000000000000000000",
    "0x0000005c00050000000000000000000000000000000000000000000000000000",
    "0x0000005c00040000000000000000000000000000000000000000000000000000",
    "0x0000005c00030001000000000000000000000000000000000000000000000000",
  ],
});

export const DELEGATION_CALLS = new Interface([
  "function upgradeToAndCall(address,bytes)",
  "function setProtocolRoleHats(uint256,uint256,uint256,uint256)",
  "function configureProtocolAdministration(uint256,uint256,uint256,uint256)",
  "function schedule(address,bytes,uint48) returns(bytes32,uint32)",
  "function execute(address,bytes) payable returns(uint32)",
  "function multicall(bytes[]) returns(bytes[])",
  "function changeHatEligibility(uint256,address)",
  "function changeHatToggle(uint256,address)",
]);

export interface DelegationArtifact {
  bytecode: { object: string; linkReferences?: Record<string, unknown> };
  deployedBytecode: { object: string; immutableReferences?: Record<string, { start: number; length: number }[]> };
}

export function buildHatsDelegationPlan(input: {
  artifact: DelegationArtifact;
  sourceCommit: string;
  safeNonce: number;
  blockNumber: number;
  blockHash: string;
  currentImplementation: string;
  governanceDelay: number;
}) {
  assert.match(input.sourceCommit, /^[a-f0-9]{40}$/, "committed source revision required");
  assert(
    Number.isSafeInteger(input.safeNonce) && input.safeNonce >= 0 && input.safeNonce <= Number.MAX_SAFE_INTEGER - 2,
    "invalid Safe nonce",
  );
  assert(Number.isSafeInteger(input.blockNumber) && input.blockNumber > 0, "invalid proof block");
  assert.match(input.blockHash, /^0x[a-f0-9]{64}$/i, "invalid proof hash");
  assert(Number.isSafeInteger(input.governanceDelay) && input.governanceDelay >= 0, "invalid governance delay");
  assert.equal(Object.keys(input.artifact.bytecode.linkReferences ?? {}).length, 0, "unresolved library links");
  const creation = input.artifact.bytecode.object;
  assert.match(creation, /^0x(?:[a-f0-9]{2})+$/i);
  assert((creation.length - 2) / 2 <= 49_152, "implementation initcode exceeds EIP-3860");
  assert.match(input.artifact.deployedBytecode.object, /^0x(?:[a-f0-9]{2})+$/i);
  assert((input.artifact.deployedBytecode.object.length - 2) / 2 <= 24_576, "implementation exceeds EIP-170");
  const creationHash = keccak256(creation);
  const salt = keccak256(toUtf8Bytes(`Green Goods PRD-615:${creationHash}`));
  const implementation = getCreate2Address(HATS_DELEGATION.factory, salt, creationHash);
  const references = Object.values(input.artifact.deployedBytecode.immutableReferences ?? {});
  assert.equal(references.length, 1, "expected the UUPS implementation self immutable only");
  assert(references[0].length > 0, "missing UUPS self immutable references");
  let runtime = input.artifact.deployedBytecode.object.slice(2);
  for (const reference of references[0]) {
    assert(reference.length === 32 && reference.start >= 0 && reference.start + reference.length <= runtime.length / 2);
    runtime =
      runtime.slice(0, reference.start * 2) +
      implementation.slice(2).toLowerCase().padStart(64, "0") +
      runtime.slice((reference.start + reference.length) * 2);
  }
  const configuration = DELEGATION_CALLS.encodeFunctionData("configureProtocolAdministration", HATS_DELEGATION.roles);
  const upgrade = DELEGATION_CALLS.encodeFunctionData("upgradeToAndCall", [implementation, configuration]);
  const operations: { target: string; data: string; label: string }[] = [
    { target: HATS_DELEGATION.module, data: upgrade, label: "Upgrade and configure HatsModule" },
  ];
  for (const [index, hat] of HATS_DELEGATION.roles.entries()) {
    const label = ["Team", "Product Lead", "Agents", "Deployer"][index];
    operations.push({
      target: HATS_DELEGATION.hats,
      data: DELEGATION_CALLS.encodeFunctionData("changeHatEligibility", [hat, HATS_DELEGATION.manager]),
      label: `${label}: Safe-governed eligibility and revocation`,
    });
    operations.push({
      target: HATS_DELEGATION.hats,
      data: DELEGATION_CALLS.encodeFunctionData("changeHatToggle", [hat, HATS_DELEGATION.manager]),
      label: `${label}: Safe-governed active status`,
    });
  }
  const calls = [
    {
      nonce: input.safeNonce,
      name: "Deploy the reviewed implementation",
      to: HATS_DELEGATION.factory,
      data: concat([salt, creation]),
      value: "0",
      operation: 0,
    },
    {
      nonce: input.safeNonce + 1,
      name: "Schedule the HatsModule upgrade and role configuration",
      to: HATS_DELEGATION.manager,
      data: DELEGATION_CALLS.encodeFunctionData("multicall", [
        operations.map((operation) =>
          DELEGATION_CALLS.encodeFunctionData("schedule", [operation.target, operation.data, 0]),
        ),
      ]),
      value: "0",
      operation: 0,
    },
    {
      nonce: input.safeNonce + 2,
      name: "Execute the ready HatsModule upgrade and role configuration",
      to: HATS_DELEGATION.manager,
      data: DELEGATION_CALLS.encodeFunctionData("multicall", [
        operations.map((operation) =>
          DELEGATION_CALLS.encodeFunctionData("execute", [operation.target, operation.data]),
        ),
      ]),
      value: "0",
      operation: 0,
    },
  ];
  const types = {
    SafeTx: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  };
  return {
    release: "PRD-615",
    chainId: HATS_DELEGATION.chainId,
    sourceCommit: input.sourceCommit,
    proofBlock: { number: input.blockNumber, hash: input.blockHash },
    safe: HATS_DELEGATION.safe,
    module: HATS_DELEGATION.module,
    manager: HATS_DELEGATION.manager,
    previousImplementation: getAddress(input.currentImplementation),
    implementation,
    salt,
    creationHash,
    runtimeHash: keccak256(`0x${runtime}`),
    factoryRuntimeHash: keccak256(HATS_DELEGATION.factoryRuntime),
    governanceDelay: input.governanceDelay,
    roles: HATS_DELEGATION.roles,
    configuration,
    upgrade,
    operations,
    calls: calls.map((call) => {
      const message = {
        ...call,
        safeTxGas: "0",
        baseGas: "0",
        gasPrice: "0",
        gasToken: "0x0000000000000000000000000000000000000000",
        refundReceiver: "0x0000000000000000000000000000000000000000",
      };
      return {
        ...call,
        safeTransactionHash: TypedDataEncoder.hash(
          { chainId: HATS_DELEGATION.chainId, verifyingContract: HATS_DELEGATION.safe },
          types,
          message,
        ),
      };
    }),
  };
}

export type HatsDelegationPlan = ReturnType<typeof buildHatsDelegationPlan>;

/** Each file contains one ordinary CALL, avoiding Transaction Builder multisend-version ambiguity. */
export function hatsDelegationBuilderFiles(plan: HatsDelegationPlan, createdAt: number) {
  assert.equal(plan.chainId, HATS_DELEGATION.chainId);
  assert.equal(plan.safe, HATS_DELEGATION.safe);
  return plan.calls.map((call) => ({
    filename: `${call.nonce}-${["deploy", "schedule", "execute"][call.nonce - plan.calls[0].nonce]}.safe.json`,
    content: {
      version: "1.0",
      chainId: "42161",
      createdAt,
      meta: {
        name: `PRD-615 nonce ${call.nonce}: ${call.name}`,
        createdFromSafeAddress: plan.safe,
        createdFromOwnerAddress: "",
        description: `Review only. Safe nonce ${call.nonce}; expected hash ${call.safeTransactionHash}. Execution remains conditional on release approval and verified dependencies.`,
      },
      transactions: [
        { to: call.to, value: call.value, data: call.data, contractMethod: null, contractInputsValues: null },
      ],
    },
  }));
}
