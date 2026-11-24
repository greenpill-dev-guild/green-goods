import { gunzipSync } from "node:zlib";
import { toKernelSmartAccount } from "permissionless/accounts";
import { encode7579Calls } from "permissionless/utils";
import {
  concatHex,
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  encodeFunctionResult,
  getCreate2Address,
  type Hex,
  keccak256,
  parseAbi,
  stringToHex,
  toHex,
  zeroAddress,
} from "viem";
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  toUserOperation,
  toWebAuthnAccount,
  type UserOperation,
} from "viem/account-abstraction";
import { gnosis } from "viem/chains";
import { describe, expect, it } from "vitest";
import {
  discoverPilotAccountProof,
  PilotProofExecutionFailedError,
} from "../../modules/auth/pilot-account-proof";
import runtimeFixture from "./fixtures/pilot-gnosis-runtimes.json";

const codes = JSON.parse(
  gunzipSync(Buffer.from(runtimeFixture.codesGzipBase64, "base64")).toString()
) as Record<string, { address: Hex; code: Hex; codeHash: Hex }>;
const validator = codes.validator.address,
  factory = codes.factory.address,
  implementation = codes.implementation.address;
const x = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n;
const y = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n;
const publicKey = concatHex(["0x04", toHex(x, { size: 32 }), toHex(y, { size: 32 })]);
const key = BigInt(concatHex(["0x0000", validator, "0x0000"]));
const nonce = key << 64n;
const launch = 48906502n,
  proofBlock = launch + 1n;
const txHash = `0x${"12".repeat(32)}` as Hex,
  blockHash = `0x${"34".repeat(32)}` as Hex;
const otherHash = `0x${"56".repeat(32)}` as Hex;
const zeroSalt = toHex(0n, { size: 32 });
const root = concatHex(["0x01", validator]);
const accountAbi = parseAbi([
  "function initialize(bytes21,address,bytes,bytes,bytes[])",
  "function rootValidator() view returns (bytes21)",
  "function accountId() view returns (string)",
  "function entrypoint() view returns (address)",
]);
const validatorAbi = parseAbi([
  "function webAuthnValidatorStorage(address) view returns (uint256,uint256)",
  "function isValidSignatureWithSender(address,bytes32,bytes) view returns (bytes4)",
]);
const factoryAbi = parseAbi(["function getAddress(bytes,bytes32) view returns (address)"]);
const proxyRuntime =
  "0x363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3";
// Public synthetic P256 generator and 'pilot' credential; no member data or real signature.
const initializer = encodeFunctionData({
  abi: accountAbi,
  functionName: "initialize",
  args: [
    root,
    zeroAddress,
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "bytes32" }],
      [x, y, keccak256(stringToHex("pilot"))]
    ),
    "0x",
    [],
  ],
});
const accountAddress = getCreate2Address({
  from: factory,
  salt: keccak256(concatHex([initializer, zeroSalt])),
  bytecode: concatHex(["0x603d3d8160223d3973", implementation, "0x60095155f3", proxyRuntime]),
});
const proofCall = encode7579Calls({
  mode: { type: "call", revertOnError: false, selector: "0x", context: "0x" },
  callData: [
    {
      to: accountAddress,
      value: 0n,
      data: encodeFunctionData({ abi: accountAbi, functionName: "rootValidator" }),
    },
  ],
});
const signature = encodeAbiParameters(
  [
    { type: "bytes" },
    { type: "string" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "uint256" },
    { type: "bool" },
  ],
  ["0x010203", "synthetic public signature fixture", 0n, 1n, 2n, false]
);

function fixture() {
  const op = {
    sender: accountAddress as Hex,
    nonce,
    initCode: "0x" as Hex,
    callData: proofCall,
    accountGasLimits: concatHex([toHex(100000n, { size: 16 }), toHex(100000n, { size: 16 })]),
    preVerificationGas: 50000n,
    gasFees: concatHex([toHex(1n, { size: 16 }), toHex(2n, { size: 16 })]),
    paymasterAndData: "0x" as Hex,
    signature,
  };
  const state = {
    chainId: "0x64",
    head: launch + 5n,
    sequence: 1n,
    deployed: true,
    root,
    implementation: toHex(BigInt(implementation), { size: 32 }),
    publicKey: [x, y],
    magic: "0x1626ba7e" as Hex,
    codes: Object.fromEntries(Object.values(codes).map((c) => [c.address.toLowerCase(), c.code])),
    op,
    receipt: {} as Record<string, unknown> | null,
    tx: {} as Record<string, unknown>,
    ranges: [] as Array<{ fromBlock: Hex; toBlock: Hex; topics: unknown }>,
    signatureChecks: [] as Array<{ from?: string; args: readonly unknown[] }>,
    logs: [] as Array<Record<string, unknown>>,
    canonicalHash: blockHash,
    outerOps: [op],
    discoveryLogs: undefined as Array<Record<string, unknown>> | undefined,
    earlierReceipts: {} as Record<string, Record<string, unknown>>,
    earlierTransactions: {} as Record<string, Record<string, unknown>>,
  };
  const userHash = () =>
    getUserOperationHash({
      userOperation: toUserOperation({
        ...op,
        sender: op.sender as Hex,
      }) as unknown as UserOperation<"0.7">,
      chainId: 100,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: "0.7",
    });
  const event = (hash: Hex, index: bigint) => ({
    address: entryPoint07Address,
    blockHash,
    blockNumber: toHex(proofBlock),
    transactionHash: hash,
    transactionIndex: toHex(index),
    logIndex: "0x0",
    removed: false,
    topics: encodeEventTopics({
      abi: entryPoint07Abi,
      eventName: "UserOperationEvent",
      args: { userOpHash: userHash(), sender: accountAddress, paymaster: zeroAddress },
    }),
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
      [op.nonce, true, 1000n, 500n]
    ),
  });
  const refresh = (hash: Hex = txHash, index = 0n) => {
    state.logs = [event(hash, index)];
    state.receipt = {
      transactionHash: hash,
      transactionIndex: toHex(index),
      blockHash,
      blockNumber: toHex(proofBlock),
      status: "0x1",
      logs: state.logs,
    };
    state.tx = {
      hash,
      transactionIndex: toHex(index),
      to: entryPoint07Address,
      blockHash,
      blockNumber: toHex(proofBlock),
      chainId: "0x64",
      value: "0x0",
      input: encodeFunctionData({
        abi: entryPoint07Abi,
        functionName: "handleOps",
        args: [state.outerOps, zeroAddress],
      }),
    };
  };
  refresh();
  const client = createPublicClient({
    chain: gnosis,
    transport: custom({
      request: async ({ method, params }) => {
        const p = params as readonly unknown[] | undefined;
        if (method === "eth_chainId") return state.chainId;
        if (method === "eth_blockNumber") return toHex(state.head);
        if (method === "eth_getBlockByNumber") return { number: p?.[0], hash: state.canonicalHash };
        if (method === "eth_getCode")
          return String(p?.[0]).toLowerCase() === accountAddress.toLowerCase()
            ? state.deployed
              ? proxyRuntime
              : "0x"
            : state.codes[String(p?.[0]).toLowerCase()];
        if (method === "eth_getStorageAt") return state.implementation;
        if (method === "eth_getTransactionReceipt")
          return state.earlierReceipts[String(p?.[0])] ?? state.receipt;
        if (method === "eth_getTransactionByHash")
          return state.earlierTransactions[String(p?.[0])] ?? state.tx;
        if (method === "eth_getLogs") {
          const range = p?.[0] as { fromBlock: Hex; toBlock: Hex; topics: unknown };
          state.ranges.push(range);
          return BigInt(range.fromBlock) <= proofBlock && BigInt(range.toBlock) >= proofBlock
            ? (state.discoveryLogs ?? state.logs)
            : [];
        }
        if (method === "eth_call") {
          const call = p?.[0] as { to: string; data: Hex; from?: string };
          if (call.to.toLowerCase() === factory.toLowerCase()) {
            const decoded = decodeFunctionData({ abi: factoryAbi, data: call.data });
            expect(decoded.args.map((value) => value.toLowerCase())).toEqual([
              initializer.toLowerCase(),
              zeroSalt,
            ]);
            return encodeFunctionResult({
              abi: factoryAbi,
              functionName: "getAddress",
              result: accountAddress,
            });
          }
          if (call.to.toLowerCase() === entryPoint07Address.toLowerCase()) {
            const decoded = decodeFunctionData({ abi: entryPoint07Abi, data: call.data });
            expect(decoded).toMatchObject({
              functionName: "getNonce",
              args: [accountAddress, key],
            });
            return encodeFunctionResult({
              abi: entryPoint07Abi,
              functionName: "getNonce",
              result: nonce | state.sequence,
            });
          }
          if (call.to.toLowerCase() === validator.toLowerCase()) {
            const decoded = decodeFunctionData({ abi: validatorAbi, data: call.data });
            if (decoded.functionName === "webAuthnValidatorStorage")
              return encodeFunctionResult({
                abi: validatorAbi,
                functionName: decoded.functionName,
                result: state.publicKey as [bigint, bigint],
              });
            state.signatureChecks.push({ from: call.from, args: decoded.args });
            return encodeFunctionResult({
              abi: validatorAbi,
              functionName: decoded.functionName,
              result: state.magic,
            });
          }
          const decoded = decodeFunctionData({ abi: accountAbi, data: call.data });
          if (decoded.functionName === "rootValidator")
            return encodeFunctionResult({
              abi: accountAbi,
              functionName: decoded.functionName,
              result: state.root,
            });
          if (decoded.functionName === "entrypoint")
            return encodeFunctionResult({
              abi: accountAbi,
              functionName: decoded.functionName,
              result: entryPoint07Address,
            });
          return encodeFunctionResult({
            abi: accountAbi,
            functionName: "accountId",
            result: "kernel.advanced.v0.3.3",
          });
        }
        throw new Error(`Unexpected read-only fixture method ${method}`);
      },
    }),
  });
  return {
    state,
    refresh,
    userHash,
    input: { client, accountAddress, publicKey, canonicalCredentialId: "cGlsb3Q" },
  };
}

describe("pilot account proof", () => {
  it("rejects a provider connected to another chain before identity reads", async () => {
    const methods: string[] = [];
    const client = createPublicClient({
      chain: gnosis,
      transport: custom({
        request: async ({ method }) => {
          methods.push(method);
          return "0xa4b1";
        },
      }),
    });
    await expect(
      discoverPilotAccountProof({
        client,
        accountAddress: "0x1111111111111111111111111111111111111111",
        publicKey: `0x04${"11".repeat(64)}`,
        canonicalCredentialId: "cGlsb3Q",
      })
    ).rejects.toThrow("Gnosis");
    expect(methods).toEqual(["eth_chainId"]);
  });

  it("matches the installed SDK's real initializer, execution encoding and root nonce key", async () => {
    const f = fixture();
    f.state.deployed = false;
    const sdk = await toKernelSmartAccount({
      client: f.input.client,
      version: "0.3.3",
      validatorAddress: validator,
      factoryAddress: factory,
      accountLogicAddress: implementation,
      metaFactoryAddress: codes.metaFactory.address,
      owners: [toWebAuthnAccount({ credential: { id: "cGlsb3Q", publicKey }, rpId: "pilot.test" })],
      entryPoint: { address: entryPoint07Address, version: "0.7" },
      address: accountAddress,
    });
    const args = await sdk.getFactoryArgs();
    expect(args.factory?.toLowerCase()).toBe(codes.metaFactory.address.toLowerCase());
    const metaAbi = parseAbi([
      "function deployWithFactory(address,bytes,bytes32) payable returns(address)",
    ]);
    const decoded = decodeFunctionData({ abi: metaAbi, data: args.factoryData! });
    expect(decoded.args.map((value) => value.toLowerCase())).toEqual([
      factory.toLowerCase(),
      initializer.toLowerCase(),
      zeroSalt,
    ]);
    expect(
      await sdk.encodeCalls([
        {
          to: accountAddress,
          value: 0n,
          data: encodeFunctionData({ abi: accountAbi, functionName: "rootValidator" }),
        },
      ])
    ).toBe(proofCall);
    // Installed permissionless ignores this argument and reads its constructor's root key.
    expect(await sdk.getNonce({ key: 1n })).toBe(nonce | 1n);
  });

  it("accepts only the exact receipt and rechecks the captured signature with the candidate's stored key", async () => {
    const f = fixture();
    expect(await discoverPilotAccountProof({ ...f.input, transactionHash: txHash })).toEqual({
      accountAddress,
      chainId: 100,
      transactionHash: txHash,
      userOperationHash: f.userHash(),
      blockNumber: proofBlock,
      nonce,
    });
    expect(f.state.signatureChecks).toEqual([
      { from: accountAddress, args: [accountAddress, f.userHash(), signature] },
    ]);
    expect(f.state.ranges).toEqual([]);
  });

  it("discovers prior proof through bounded indexed logs without choosing an account or broadcasting", async () => {
    const f = fixture();
    expect((await discoverPilotAccountProof(f.input))?.transactionHash).toBe(txHash);
    expect(f.state.ranges).toEqual([
      {
        address: entryPoint07Address,
        fromBlock: toHex(launch),
        toBlock: toHex(f.state.head),
        topics: [
          keccak256(
            stringToHex("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)")
          ),
          null,
          toHex(BigInt(accountAddress), { size: 32 }),
        ],
      },
    ]);
  });

  it("does not treat a nonzero encoded nonce as member authorization when its sequence is zero", async () => {
    const f = fixture();
    f.state.sequence = 0n;
    expect(nonce).toBeGreaterThan(0n);
    expect(await discoverPilotAccountProof(f.input)).toBeNull();
    expect(f.state.ranges).toEqual([]);
  });

  it("leaves a publicly deployed or absent candidate unproven without successful operation evidence", async () => {
    const absent = fixture();
    absent.state.deployed = false;
    expect(await discoverPilotAccountProof(absent.input)).toBeNull();
    const deployed = fixture();
    deployed.state.logs = [];
    expect(await discoverPilotAccountProof(deployed.input)).toBeNull();
  });

  it.each([
    "root",
    "publicKey",
    "implementation",
    "dependency",
  ])("rejects current identity drift in %s", async (kind) => {
    const f = fixture();
    if (kind === "root") f.state.root = concatHex(["0x01", zeroAddress]);
    if (kind === "publicKey") f.state.publicKey = [1n, 2n];
    if (kind === "implementation") f.state.implementation = zeroSalt;
    if (kind === "dependency") f.state.codes[validator.toLowerCase()] = "0x6000";
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("mismatch");
  });

  it("rejects a credential alias or different public key instead of applying an address override", async () => {
    const f = fixture();
    await expect(
      discoverPilotAccountProof({ ...f.input, canonicalCredentialId: "cGlsb3Q=" })
    ).rejects.toThrow("credential ID");
    await expect(
      discoverPilotAccountProof({ ...f.input, canonicalCredentialId: "b3RoZXI" })
    ).rejects.toThrow("credential-derived");
    await expect(
      discoverPilotAccountProof({
        ...f.input,
        publicKey: concatHex([toHex(1n, { size: 32 }), toHex(2n, { size: 32 })]),
      })
    ).rejects.toThrow("credential-derived");
  });

  it.each([
    "outer target",
    "chain",
    "value",
    "canonical block",
    "hash",
  ])("rejects wrong %s in an otherwise successful receipt", async (kind) => {
    const f = fixture();
    if (kind === "outer target") f.state.tx.to = validator;
    if (kind === "chain") f.state.tx.chainId = "0xa4b1";
    if (kind === "value") f.state.tx.value = "0x1";
    if (kind === "canonical block") f.state.canonicalHash = otherHash;
    if (kind === "hash") f.state.tx.hash = otherHash;
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("mismatch");
  });

  it("rejects status-success receipts whose UserOperation failed or was emitted by another address", async () => {
    const f = fixture();
    f.state.logs[0].data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
      [nonce, false, 1000n, 500n]
    );
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("UserOperation failed");
    f.refresh();
    f.state.logs[0].address = validator;
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("unambiguous");
  });

  it("rejects a failed TRY inner call even when the UserOperation event says success", async () => {
    const f = fixture();
    const failAbi = parseAbi([
      "event TryExecuteUnsuccessful(uint256 batchExecutionindex,bytes result)",
    ]);
    f.state.logs.push({
      ...f.state.logs[0],
      address: accountAddress,
      topics: encodeEventTopics({ abi: failAbi, eventName: "TryExecuteUnsuccessful" }),
      data: encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], [0n, "0xdead"]),
    });
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toBeInstanceOf(PilotProofExecutionFailedError);
    expect(f.state.signatureChecks).toHaveLength(1);
  });

  it("never classifies unverified calldata or signature evidence as a mined retryable failure", async () => {
    const f = fixture();
    const failAbi = parseAbi([
      "event TryExecuteUnsuccessful(uint256 batchExecutionindex,bytes result)",
    ]);
    f.state.logs.push({
      ...f.state.logs[0],
      address: accountAddress,
      logIndex: "0x1",
      topics: encodeEventTopics({ abi: failAbi, eventName: "TryExecuteUnsuccessful" }),
      data: encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], [0n, "0xdead"]),
    });
    f.state.op.preVerificationGas++;
    f.state.tx.input = encodeFunctionData({
      abi: entryPoint07Abi,
      functionName: "handleOps",
      args: [f.state.outerOps, zeroAddress],
    });
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.not.toBeInstanceOf(PilotProofExecutionFailedError);
    f.state.op.preVerificationGas--;
    f.state.tx.input = encodeFunctionData({
      abi: entryPoint07Abi,
      functionName: "handleOps",
      args: [f.state.outerOps, zeroAddress],
    });
    f.state.magic = "0xffffffff";
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.not.toBeInstanceOf(PilotProofExecutionFailedError);
  });

  it("recomputes the chain-bound hash instead of trusting event topics", async () => {
    const f = fixture();
    f.state.op.preVerificationGas++;
    f.state.tx.input = encodeFunctionData({
      abi: entryPoint07Abi,
      functionName: "handleOps",
      args: [f.state.outerOps, zeroAddress],
    });
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("UserOperation hash");
  });

  it.each([
    "wrong target",
    "native value",
    "other call",
    "batch",
  ])("refuses a signed %s as pilot enrollment proof", async (kind) => {
    const f = fixture();
    f.state.op.callData = encode7579Calls({
      mode: {
        type: kind === "batch" ? "batchcall" : "call",
        revertOnError: false,
        selector: "0x",
        context: "0x",
      },
      callData:
        kind === "batch"
          ? [
              { to: accountAddress, value: 0n },
              { to: accountAddress, value: 0n },
            ]
          : [
              {
                to: kind === "wrong target" ? validator : accountAddress,
                value: kind === "native value" ? 1n : 0n,
                data:
                  kind === "other call"
                    ? "0xdeadbeef"
                    : encodeFunctionData({ abi: accountAbi, functionName: "rootValidator" }),
              },
            ],
    });
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("zero-value rootValidator call");
  });

  it("refuses replayable or empty signatures and a validator's invalid magic result", async () => {
    const f = fixture();
    f.state.op.signature = concatHex([
      keccak256(stringToHex("kernel.replayable.signature")),
      signature,
    ]);
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("chain-bound signature");
    f.state.op.signature = "0x";
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("chain-bound signature");
    f.state.op.signature = signature;
    f.state.magic = "0xffffffff";
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("captured signature");
  });

  it("rejects unknown factory initialization and multiple account operations in one outer batch", async () => {
    const f = fixture();
    f.state.op.initCode = concatHex([factory, "0xdeadbeef"]);
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("factory recipe");
    f.state.op.initCode = "0x";
    f.state.outerOps.push({ ...f.state.op });
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("one account operation");
  });

  it("returns pending for an unavailable known receipt without looking for a substitute", async () => {
    const f = fixture();
    f.state.receipt = null;
    expect(await discoverPilotAccountProof({ ...f.input, transactionHash: txHash })).toBeNull();
    expect(f.state.ranges).toEqual([]);
  });

  it("rejects malformed, removed, duplicate or unconsumed receipt events", async () => {
    const f = fixture();
    f.state.logs[0].data = "0x";
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("UserOperation event");
    f.refresh();
    f.state.logs[0].removed = true;
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("removed");
    f.refresh();
    f.state.logs.push({ ...f.state.logs[0] });
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("unambiguous");
    f.state.op.nonce++;
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("not been consumed");
  });

  it("does not reinterpret another successful signed action as enrollment during discovery", async () => {
    const f = fixture();
    f.state.op.callData = encode7579Calls({
      mode: { type: "call", revertOnError: false, selector: "0x", context: "0x" },
      callData: [{ to: accountAddress, value: 0n, data: "0xdeadbeef" }],
    });
    f.refresh();
    expect(await discoverPilotAccountProof(f.input)).toBeNull();
    expect(f.state.signatureChecks).toEqual([]);
  });

  it("rejects malformed WebAuthn encoding without leaking the captured signature in errors", async () => {
    const f = fixture();
    f.state.op.signature = "0xdeadbeef";
    f.refresh();
    await expect(
      discoverPilotAccountProof({ ...f.input, transactionHash: txHash })
    ).rejects.toThrow("Invalid pilot WebAuthn signature encoding");
    expect(f.state.signatureChecks).toEqual([]);
  });

  it("paginates a finite launch-block window and requires an exact hash after its search budget", async () => {
    const f = fixture();
    f.state.logs = [];
    f.state.head = launch + 128000n;
    await expect(discoverPilotAccountProof(f.input)).rejects.toThrow("discovery limit reached");
    expect(f.state.ranges).toHaveLength(64);
    expect(f.state.ranges[0]).toMatchObject({
      fromBlock: toHex(launch),
      toBlock: toHex(launch + 1999n),
    });
    expect(f.state.ranges[63]).toMatchObject({
      fromBlock: toHex(launch + 126000n),
      toBlock: toHex(launch + 127999n),
    });
  });

  it.each([
    "failed TRY",
    "ambiguous batch",
  ])("discovers a later valid retry after earlier %s history", async (kind) => {
    const f = fixture();
    if (kind === "failed TRY") {
      const failAbi = parseAbi([
        "event TryExecuteUnsuccessful(uint256 batchExecutionindex,bytes result)",
      ]);
      f.state.logs.push({
        ...f.state.logs[0],
        address: accountAddress,
        logIndex: "0x1",
        topics: encodeEventTopics({ abi: failAbi, eventName: "TryExecuteUnsuccessful" }),
        data: encodeAbiParameters([{ type: "uint256" }, { type: "bytes" }], [0n, "0xdead"]),
      });
    } else {
      const second = { ...f.state.op, nonce: nonce + 1n };
      const secondHash = getUserOperationHash({
        userOperation: toUserOperation(second) as unknown as UserOperation<"0.7">,
        chainId: 100,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
      });
      f.state.outerOps.push(second);
      f.state.tx.input = encodeFunctionData({
        abi: entryPoint07Abi,
        functionName: "handleOps",
        args: [f.state.outerOps, zeroAddress],
      });
      f.state.logs.push({
        ...f.state.logs[0],
        logIndex: "0x1",
        topics: encodeEventTopics({
          abi: entryPoint07Abi,
          eventName: "UserOperationEvent",
          args: { userOpHash: secondHash, sender: accountAddress, paymaster: zeroAddress },
        }),
        data: encodeAbiParameters(
          [{ type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
          [second.nonce, true, 1000n, 500n]
        ),
      });
    }
    const priorLogs = structuredClone(f.state.logs).filter(
      (log) => log.address === entryPoint07Address
    );
    f.state.earlierReceipts[txHash] = structuredClone(f.state.receipt!);
    f.state.earlierTransactions[txHash] = structuredClone(f.state.tx);
    f.state.op.nonce = nonce + (kind === "failed TRY" ? 1n : 2n);
    f.state.sequence = kind === "failed TRY" ? 2n : 3n;
    f.state.outerOps = [f.state.op];
    f.refresh(otherHash, 1n);
    f.state.discoveryLogs = [...priorLogs, ...f.state.logs];
    expect((await discoverPilotAccountProof(f.input))?.transactionHash).toBe(otherHash);
    expect(f.state.signatureChecks).toHaveLength(kind === "failed TRY" ? 2 : 1);
  });
});
