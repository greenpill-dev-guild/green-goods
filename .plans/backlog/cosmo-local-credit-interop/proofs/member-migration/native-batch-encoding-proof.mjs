// Offline encoding characterization only. No signer, RPC, deployment or account mutation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const shared = path.join(root, "packages/shared");
const v = await import(Bun.resolveSync("viem", shared));
const { encode7579Calls } = await import(Bun.resolveSync("permissionless/utils", shared));
const sdkRoot = path.join(shared, "node_modules/permissionless");
const { encodeCallData } = await import(
  path.join(sdkRoot, "accounts/kernel/utils/encodeCallData.ts")
);
assert.equal(JSON.parse(readFileSync(path.join(sdkRoot, "package.json"))).version, "0.2.57");
assert.equal(
  process.argv.length,
  2,
  "This offline proof accepts no network or execution arguments"
);

const prior = JSON.parse(
  readFileSync(
    path.join(
      root,
      ".plans/backlog/cosmo-local-credit-interop/artifacts/member-readiness-2026-10-22.json"
    )
  )
);
const address = prior.fixture.derivedAddress;
const patched = "0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69";
const abi = v.parseAbi([
  "function initialize(bytes21,address,bytes,bytes,bytes[])",
  "function changeRootValidator(bytes21,address,bytes,bytes)",
  "function uninstallModule(uint256,address,bytes)",
  "function execute(bytes32,bytes)",
]);
const initializer = v.decodeFunctionData({ abi, data: prior.fixture.initializer });
const calls = [
  {
    to: address,
    value: 0n,
    data: v.encodeFunctionData({
      abi,
      functionName: "changeRootValidator",
      args: [v.concatHex(["0x01", patched]), v.zeroAddress, initializer.args[2], "0x"],
    }),
  },
  {
    to: address,
    value: 0n,
    data: v.encodeFunctionData({
      abi,
      functionName: "uninstallModule",
      args: [1n, prior.configuration.validator, "0x"],
    }),
  },
];
const encoded = encodeCallData({ kernelVersion: "0.3.1", calls });
const decoded = v.decodeFunctionData({ abi, data: encoded });
assert.equal(decoded.functionName, "execute");
assert.equal(decoded.args[0], "0x0100" + "00".repeat(30));
process.stdout.write("PASS installed Kernel encoder selects default batch mode 0x0100\n");

const [batch] = v.decodeAbiParameters(
  [{ type: "tuple[]", components: [{ type: "address" }, { type: "uint256" }, { type: "bytes" }] }],
  decoded.args[1]
);
assert.equal(batch.length, 2);
for (const [index, [target, value, data]] of batch.entries()) {
  assert.equal(target.toLowerCase(), address.toLowerCase());
  assert.equal(value, 0n);
  assert.equal(data.toLowerCase(), calls[index].data.toLowerCase());
}
assert.equal(v.decodeFunctionData({ abi, data: batch[0][2] }).functionName, "changeRootValidator");
assert.equal(v.decodeFunctionData({ abi, data: batch[1][2] }).functionName, "uninstallModule");
process.stdout.write(
  "PASS batch contains only ordered zero-value self-calls with exact fixture owner data\n"
);

// In this installed SDK the boolean's name is misleading for Kernel: true encodes TRY (0x01).
const tryBatch = encode7579Calls({
  mode: { type: "batchcall", revertOnError: true },
  callData: calls,
});
const tryMode = v.decodeFunctionData({ abi, data: tryBatch }).args[0];
assert.equal(tryMode, "0x0101" + "00".repeat(30));
assert.notEqual(tryMode, decoded.args[0]);
process.stdout.write(
  "PASS revertOnError=true is distinguished from Kernel default atomic execution\n"
);

assert.throws(() => encodeCallData({ kernelVersion: "0.3.1", calls: [] }), /No calls to encode/);
process.stdout.write("PASS installed encoder rejects an empty call list\n");

const files = [
  ".plans/backlog/cosmo-local-credit-interop/proofs/member-migration/native-batch-encoding-proof.mjs",
  ".plans/backlog/cosmo-local-credit-interop/artifacts/member-readiness-2026-10-22.json",
  "packages/shared/node_modules/permissionless/package.json",
  "packages/shared/node_modules/permissionless/accounts/kernel/utils/encodeCallData.ts",
  "packages/shared/node_modules/permissionless/utils/encode7579Calls.ts",
  "packages/shared/node_modules/permissionless/actions/erc7579/supportsExecutionMode.ts",
];
process.stdout.write(
  JSON.stringify(
    {
      evidenceClass: "offline encoding only; native batch not executed or approved",
      account: address,
      mode: decoded.args[0],
      tryMode,
      payloadKeccak256: v.keccak256(encoded),
      migrationReady: false,
      sourceSha256: Object.fromEntries(
        files.map((file) => [
          file,
          createHash("sha256")
            .update(readFileSync(path.join(root, file)))
            .digest("hex"),
        ])
      ),
    },
    null,
    2
  ) + "\n"
);
