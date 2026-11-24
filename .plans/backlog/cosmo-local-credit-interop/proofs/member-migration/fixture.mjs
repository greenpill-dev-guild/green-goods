// Local synthetic-credential proof only. Production auth and provider policies are not imported.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { appendFileSync, closeSync, openSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const shared = path.join(root, "packages/shared");
export const v = await import(Bun.resolveSync("viem", shared));
export const aa = await import(Bun.resolveSync("viem/account-abstraction", shared));
const { privateKeyToAccount } = await import(Bun.resolveSync("viem/accounts", shared));
const { toKernelSmartAccount } = await import(Bun.resolveSync("permissionless/accounts", shared));
export const prior = JSON.parse(
  readFileSync(
    path.join(
      root,
      ".plans/backlog/cosmo-local-credit-interop/artifacts/member-readiness-2026-10-22.json"
    ),
    "utf8"
  )
);
export const previous = JSON.parse(
  readFileSync(
    path.join(
      root,
      ".plans/backlog/cosmo-local-credit-interop/artifacts/member-migration-characterization-2026-10-22.json"
    ),
    "utf8"
  )
);
export const PATCHED = "0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69";
export const LEGACY = prior.configuration.validator;
export const EXPECTED = prior.fixture.derivedAddress;
export const KERNEL_ABI = v.parseAbi([
  "function rootValidator() view returns (bytes21)",
  "function currentNonce() view returns (uint32)",
  "function validNonceFrom() view returns (uint32)",
  "function isModuleInstalled(uint256,address,bytes) view returns (bool)",
  "function isAllowedSelector(bytes21,bytes4) view returns (bool)",
  "function validationConfig(bytes21) view returns ((uint32 nonce,address hook))",
  "function changeRootValidator(bytes21,address,bytes,bytes)",
  "function uninstallModule(uint256,address,bytes)",
  "function execute(bytes32,bytes) payable",
]);
const VALIDATOR_ABI = v.parseAbi([
  "function webAuthnValidatorStorage(address) view returns (uint256 pubKeyX,uint256 pubKeyY)",
]);
export const rootId = (address) => v.concatHex(["0x01", address]);
export const installData = v.decodeFunctionData({
  abi: v.parseAbi(["function initialize(bytes21,address,bytes,bytes,bytes[])"]),
  data: prior.fixture.initializer,
}).args[2];
export const ownerCoordinates = v.decodeAbiParameters(
  [{ type: "uint256" }, { type: "uint256" }],
  installData
);
export const publicKey = v.concatHex(ownerCoordinates.map((n) => v.toHex(n, { size: 32 })));
export const configs = {
  gnosis: { network: "gnosis-mainnet", id: 100 },
  arbitrum: { network: "arb-mainnet", id: 42161 },
  celo: { network: "celo-mainnet", id: 42220 },
};
export function assertLocalRpc(url) {
  const u = new URL(url);
  assert.ok(
    u.protocol === "http:" &&
      u.hostname === "127.0.0.1" &&
      u.port &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash &&
      !u.username &&
      !u.password,
    "Signing requires runner-owned loopback RPC"
  );
}
export function assertNodeInfo(info, cfg, pin) {
  assert.equal(Number(info.environment.chainId), cfg.id);
  assert.equal(Number(info.forkConfig.forkBlockNumber), parseInt(pin.number, 16));
}
function owner() {
  const pub = Buffer.from(publicKey.slice(2), "hex");
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: pub.subarray(0, 32).toString("base64url"),
      y: pub.subarray(32).toString("base64url"),
      d: Buffer.from("01".padStart(64, "0"), "hex").toString("base64url"),
    },
  });
  const id = Buffer.from("fictional-cosmo-member-readiness-v1").toString("base64url");
  const buffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  return aa.toWebAuthnAccount({
    credential: { id, publicKey },
    rpId: prior.fixture.rpId,
    getFn: async (options) => {
      const challenge = Buffer.from(options.publicKey.challenge);
      const json = Buffer.from(
        JSON.stringify({
          type: "webauthn.get",
          challenge: challenge.toString("base64url"),
          origin: "https://" + prior.fixture.rpId,
          crossOrigin: false,
        })
      );
      const auth = Buffer.concat([
        createHash("sha256").update(prior.fixture.rpId).digest(),
        Buffer.from([5, 0, 0, 0, 0]),
      ]);
      const signature = sign(
        "sha256",
        Buffer.concat([auth, createHash("sha256").update(json).digest()]),
        { key, dsaEncoding: "der" }
      );
      return {
        id,
        type: "public-key",
        response: {
          authenticatorData: buffer(auth),
          clientDataJSON: buffer(json),
          signature: buffer(signature),
        },
      };
    },
  });
}
export async function startFixture(name, out) {
  const cfg = { ...configs[name] };
  assert.ok(cfg.id, "Unknown proof network");
  cfg.url = process.env.MEMBER_MIGRATION_RPC_URL;
  assert.ok(
    cfg.url,
    "Supply the authorized read-only Alchemy RPC or connector bridge through MEMBER_MIGRATION_RPC_URL in the process environment"
  );
  const pin = previous.pins[cfg.network];
  assert.ok(pin);
  const upstream = await fetch(cfg.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: [pin.number, false],
    }),
    signal: AbortSignal.timeout(20000),
  }).then((r) => r.json());
  assert.equal(upstream.result.hash, pin.hash, "Pinned upstream block mismatch");
  const listener = createServer();
  await new Promise((yes, no) => {
    listener.once("error", no);
    listener.listen(0, "127.0.0.1", yes);
  });
  const port = listener.address().port;
  await new Promise((yes, no) => listener.close((e) => (e ? no(e) : yes())));
  const rpc = `http://127.0.0.1:${port}`;
  assertLocalRpc(rpc);
  const fd = openSync(path.join(out, name + "-anvil.log"), "w");
  const child = spawn(
    "anvil",
    [
      "--fork-url",
      cfg.url,
      "--fork-block-number",
      String(parseInt(pin.number, 16)),
      "--chain-id",
      String(cfg.id),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--silent",
    ],
    { stdio: ["ignore", fd, fd] }
  );
  let spawnError;
  child.once("error", (error) => {
    spawnError = error;
  });
  const stop = async () => {
    if (child.exitCode !== null || !child.pid) {
      closeSync(fd);
      return;
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 2000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    closeSync(fd);
  };
  try {
    const chain = v.defineChain({
      id: cfg.id,
      name: "Isolated " + name,
      nativeCurrency: { name: "Fixture gas", symbol: "FIXTURE", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
    });
    const client = v.createPublicClient({
      chain,
      transport: v.http(rpc, { retryCount: 0, timeout: 180_000 }),
      pollingInterval: 20,
      cacheTime: 0,
    });
    const request = (method, params = []) => client.request({ method, params });
    let info;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(child.exitCode, null, "Owned fork exited");
      assert.ok(!spawnError, "Owned fork spawn failed");
      try {
        info = await request("anvil_nodeInfo");
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.ok(info, "Owned fork unavailable");
    assertNodeInfo(info, cfg, pin);
    assert.equal(await client.getChainId(), cfg.id);
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    assertLocalRpc(rpc);
    const wallet = v.createWalletClient({
      account,
      chain,
      transport: v.http(rpc, { retryCount: 0, timeout: 180_000 }),
    });
    await request("anvil_setBalance", [account.address, v.toHex(1000n * 10n ** 18n)]);
    const mined = async (hash) => {
      await request("evm_mine");
      return client.waitForTransactionReceipt({ hash, timeout: 120_000 });
    };
    const tx = async (data) => {
      assertLocalRpc(rpc);
      return mined(await wallet.sendTransaction({ ...data, gas: 8_000_000n }));
    };
    if (!(await client.getCode({ address: LEGACY }))) {
      const created = await tx({
        to: previous.legacyCreation.contractFactory,
        data: v.concatHex([prior.configuration.salt, previous.legacyCreation.creationBytecode]),
      });
      assert.equal(created.status, "success");
    }
    assert.equal(
      v.keccak256(await client.getCode({ address: LEGACY })),
      previous.legacyCreation.runtimeKeccak256
    );
    assert.ok(await client.getCode({ address: aa.entryPoint07Address }));
    const artifact = JSON.parse(
      readFileSync(
        path.join(
          root,
          "packages/contracts/.generated/foundry/out/default/MemberMigrationFailureFixture.sol/MemberMigrationFailureFixture.json"
        ),
        "utf8"
      )
    );
    const deployed = await mined(
      await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
        gas: 3_000_000n,
      })
    );
    assert.equal(deployed.status, "success");
    const fixture = deployed.contractAddress;
    assert.ok(fixture);
    await request("anvil_setBalance", [EXPECTED, v.toHex(100n * 10n ** 18n)]);
    let snap = await request("evm_snapshot");
    const reset = async () => {
      assert.equal(await request("evm_revert", [snap]), true);
      snap = await request("evm_snapshot");
    };
    const makeAccount = async (validator = LEGACY) => {
      const a = await toKernelSmartAccount({
        client,
        version: "0.3.1",
        owners: [owner()],
        entryPoint: { address: aa.entryPoint07Address, version: "0.7" },
        address: EXPECTED,
        validatorAddress: validator,
      });
      assert.equal(a.address.toLowerCase(), EXPECTED);
      return a;
    };
    const state = async () => {
      const code = await client.getCode({ address: EXPECTED });
      const nonce = await client.readContract({
        address: aa.entryPoint07Address,
        abi: aa.entryPoint07Abi,
        functionName: "getNonce",
        args: [EXPECTED, BigInt("0x0000" + LEGACY.slice(2) + "0000")],
      });
      const storage = {};
      for (const [label, slot] of Object.entries({
        validation: "0x7bcaa2ced2a71450ed5a9a1b4848e8e5206dbc3f06011e595f7f55428cc6f84f",
        implementation: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
      }))
        storage[label] = await client.getStorageAt({ address: EXPECTED, slot });
      const keys = {};
      for (const [label, address] of Object.entries({ legacy: LEGACY, patched: PATCHED }))
        keys[label] = await client.readContract({
          address,
          abi: VALIDATOR_ABI,
          functionName: "webAuthnValidatorStorage",
          args: [EXPECTED],
        });
      if (!code) return { exists: false, nonce, storage, keys };
      const read = (functionName, args = []) =>
        client.readContract({ address: EXPECTED, abi: KERNEL_ABI, functionName, args });
      return {
        exists: true,
        codeHash: v.keccak256(code),
        nonce,
        root: await read("rootValidator"),
        currentNonce: await read("currentNonce"),
        validNonceFrom: await read("validNonceFrom"),
        oldModule: await read("isModuleInstalled", [1n, LEGACY, "0x"]),
        patchedModule: await read("isModuleInstalled", [1n, PATCHED, "0x"]),
        oldConfig: await read("validationConfig", [rootId(LEGACY)]),
        patchedConfig: await read("validationConfig", [rootId(PATCHED)]),
        oldExecuteAllowed: await read("isAllowedSelector", [
          rootId(LEGACY),
          v.toFunctionSelector("execute(bytes32,bytes)"),
        ]),
        keys,
        storage,
      };
    };
    const operation = async (
      callData,
      { factory = true, verificationGasLimit = 2_500_000n, callGasLimit = 600_000n, account } = {}
    ) => {
      account ??= await makeAccount();
      const args = factory ? await account.getFactoryArgs() : {};
      if (factory) {
        assert.equal(args.factory.toLowerCase(), prior.configuration.metaFactory.toLowerCase());
        assert.equal(args.factoryData, prior.fixture.metaFactoryData);
      }
      const block = await client.getBlock();
      return {
        sender: EXPECTED,
        nonce: await account.getNonce(),
        ...args,
        callData,
        verificationGasLimit,
        callGasLimit,
        preVerificationGas: 100_000n,
        maxFeePerGas: (block.baseFeePerGas ?? 0n) * 2n + 1_000_000_000n,
        maxPriorityFeePerGas: 0n,
        signature: "0x",
      };
    };
    const signed = async (op, chainId = cfg.id) => ({
      ...op,
      signature: await (await makeAccount()).signUserOperation({ ...op, chainId }),
    });
    const submit = async (op) => {
      assertLocalRpc(rpc);
      const receipt = await mined(
        await wallet.writeContract({
          address: aa.entryPoint07Address,
          abi: aa.entryPoint07Abi,
          functionName: "handleOps",
          args: [[aa.toPackedUserOperation(op)], account.address],
          gas: 8_000_000n,
        })
      );
      const event =
        aa.entryPoint07Abi &&
        v.parseEventLogs({
          abi: aa.entryPoint07Abi,
          eventName: "UserOperationEvent",
          logs: receipt.logs,
        })[0];
      const reason = v.parseEventLogs({
        abi: aa.entryPoint07Abi,
        eventName: "UserOperationRevertReason",
        logs: receipt.logs,
      })[0];
      let outerFailure;
      if (receipt.status === "reverted") {
        try {
          const trace = await request("debug_traceTransaction", [
            receipt.transactionHash,
            { tracer: "callTracer" },
          ]);
          outerFailure = v.decodeErrorResult({ abi: aa.entryPoint07Abi, data: trace.output });
        } catch (error) {
          outerFailure = { decodeError: error.message };
        }
      }
      const result = {
        transaction: receipt.transactionHash,
        status: receipt.status,
        event: event?.args,
        reason: reason?.args?.revertReason,
        outerFailure,
        operation: { ...op, signature: "omitted: synthetic fixture signature" },
        userOpHash: aa.getUserOperationHash({
          userOperation: op,
          entryPointAddress: aa.entryPoint07Address,
          entryPointVersion: "0.7",
          chainId: cfg.id,
        }),
      };
      appendFileSync(
        path.join(out, name + "-operations.jsonl"),
        JSON.stringify(result, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        ) + "\n"
      );
      return result;
    };
    const delegated = (functionName) =>
      v.encodeFunctionData({
        abi: KERNEL_ABI,
        functionName: "execute",
        args: [
          "0xff" + "00".repeat(31),
          v.concatHex([
            fixture,
            v.encodeFunctionData({
              abi: artifact.abi,
              functionName,
              args: functionName === "failBeforeChange" ? [] : [rootId(PATCHED), installData],
            }),
          ]),
        ],
      });
    const dependencies = {};
    for (const [label, address] of Object.entries({
      entryPoint: aa.entryPoint07Address,
      implementation: prior.configuration.implementation,
      factory: prior.configuration.factory,
      metaFactory: prior.configuration.metaFactory,
      legacy: LEGACY,
      patched: PATCHED,
      controlledFixture: fixture,
    }))
      dependencies[label] = { address, codeHash: v.keccak256(await client.getCode({ address })) };
    return {
      cfg,
      nodeInfo: {
        environment: info.environment,
        hardFork: info.hardFork,
        clientVersion: await request("web3_clientVersion"),
      },
      pin,
      rpc,
      client,
      request,
      stop,
      reset,
      makeAccount,
      state,
      operation,
      signed,
      submit,
      delegated,
      dependencies,
      fixture,
      tx,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}
