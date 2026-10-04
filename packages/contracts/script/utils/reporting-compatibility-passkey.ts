import { createHash, generateKeyPairSync, sign as signWith } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  keccak256,
  padHex,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import {
  entryPoint07Abi,
  getUserOperationHash,
  toPackedUserOperation,
  toWebAuthnAccount,
  type UserOperation,
} from "viem/account-abstraction";
import type { reportingCompatibilityFixture } from "./reporting-compatibility-fixture";
import { loadReportingCompatibilitySdk } from "./reporting-compatibility-sdk";

type Fixture = Awaited<ReturnType<typeof reportingCompatibilityFixture>>;
type Operation = UserOperation<"0.7">;

const GARDEN_ABI = parseAbi(["function joinGarden()", "function isGardener(address account) view returns (bool)"]);
const ACTIONS_ABI = parseAbi([
  "struct Action { uint256 startTime; uint256 endTime; string title; string slug; string instructions; uint8[] capitals; string[] media; uint8 domain; }",
  "function getAction(uint256 actionUID) view returns (Action)",
  "function gardenHasDomain(address garden, uint8 domain) view returns (bool)",
]);
const EAS_ABI = parseAbi([
  "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)",
]);
/** Limits wide enough for a passkey check through the fallback verifier; the fork has no bundler to estimate them. */
const LIMITS = {
  callGasLimit: 700_000n,
  verificationGasLimit: 2_500_000n,
  preVerificationGas: 100_000n,
  maxFeePerGas: 100_000_000n,
  maxPriorityFeePerGas: 0n,
  paymasterVerificationGasLimit: 100_000n,
  paymasterPostOpGasLimit: 1n,
} as const;
const OPERATION_GAS_LIMIT = Number(
  LIMITS.callGasLimit +
    LIMITS.verificationGasLimit +
    LIMITS.preVerificationGas +
    LIMITS.paymasterVerificationGasLimit +
    LIMITS.paymasterPostOpGasLimit,
);

/**
 * A passkey as a browser would answer for one: a P-256 key that signs the WebAuthn assertion over
 * the challenge it is given. The key never leaves this process and exists only on the fork.
 */
function softwarePasskey(rpId: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const coordinate = (value: string | undefined) =>
    Buffer.from(value ?? "", "base64url")
      .toString("hex")
      .padStart(64, "0");
  const id = createHash("sha256").update("green-goods fork passkey").digest().subarray(0, 16).toString("base64url");
  const buffer = (bytes: Buffer) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return toWebAuthnAccount({
    credential: { id, publicKey: `0x${coordinate(jwk.x)}${coordinate(jwk.y)}` },
    rpId,
    getFn: async (options) => {
      const challenge = Buffer.from(options?.publicKey?.challenge as ArrayBuffer);
      const clientDataJSON = Buffer.from(
        JSON.stringify({
          type: "webauthn.get",
          challenge: challenge.toString("base64url"),
          origin: `https://${rpId}`,
          crossOrigin: false,
        }),
      );
      // The relying party's hash, then "user present and verified", then a zero signature counter.
      const authenticatorData = Buffer.concat([
        createHash("sha256").update(rpId).digest(),
        Buffer.from([0x05, 0, 0, 0, 0]),
      ]);
      const signature = signWith(
        "sha256",
        Buffer.concat([authenticatorData, createHash("sha256").update(clientDataJSON).digest()]),
        { key: privateKey, dsaEncoding: "der" },
      );
      return {
        id,
        type: "public-key",
        response: {
          authenticatorData: buffer(authenticatorData),
          clientDataJSON: buffer(clientDataJSON),
          signature: buffer(signature),
        },
      } as never;
    },
  });
}

/**
 * The path a real person takes, on the fork: an account built as the app builds one (Kernel 0.3.1
 * on the WebAuthn validator, through permissionless), deployed by its own first operation, which
 * joins the Community Garden; then the first report, which the passkey approves through the same
 * functions the page and the Agent run, published to the production EAS and its work resolver
 * under the deployed guard; then a second report signed by the delegate alone; then the owner
 * removing the permission with their passkey. The approved module's own values build the policy,
 * so this proves the entry that switches delegation on.
 *
 * One thing is a stand-in: the approved paymaster's address keeps its place in the policy and
 * carries fixture code, because Pimlico's signature over an operation cannot be produced here.
 */
export async function verifyPasskeyActivation(contracts: string, f: Fixture, check: (name: string) => void) {
  const repository = path.resolve(contracts, "../..");
  const { sdk, constants, reporting, domain } = await loadReportingCompatibilitySdk(repository);
  const shared = path.join(repository, "packages/shared");
  const { toKernelSmartAccount } = await import(Bun.resolveSync("permissionless/accounts", shared));
  const assert = (truth: unknown, message: string) => {
    if (!truth) throw new Error(message);
  };
  const { client } = f;
  const entryPoint = constants.getEntryPoint("0.7");
  const deployment = domain.resolveReportingDeployment(42161);
  const module = domain.VERIFIED_PERMISSION_MODULES.find((entry: { chainId: number }) => entry.chainId === 42161);
  assert(
    module?.singleCallPolicy &&
      module.approvedPaymaster &&
      module.gasCostCapsWei &&
      module.measuredGasUnitsPerSubmission,
    "No approved module to prove on Arbitrum",
  );
  assert(
    module.measuredGasUnitsPerSubmission >= OPERATION_GAS_LIMIT,
    "The Agent's activation reservation cannot admit the fork's first operation",
  );
  const deployed = JSON.parse(readFileSync(path.join(contracts, "deployments/42161-latest.json"), "utf8"));
  const garden = getAddress(deployed.rootGarden.address);
  const actions = getAddress(deployed.actionRegistry);

  // The approved paymaster's address with code that sponsors on this fork.
  const sponsor = getAddress(module.approvedPaymaster);
  await f.request("anvil_setCode", [sponsor, await client.getCode({ address: f.paymaster.address })]);
  const deposit = (await client.readContract({
    address: entryPoint.address,
    abi: entryPoint07Abi,
    functionName: "balanceOf",
    args: [sponsor],
  })) as bigint;
  assert(deposit > 10n ** 16n, "The approved paymaster has no deposit on the fork");

  const send = async (operation: Operation, expectSuccess = true) => {
    const hash = getUserOperationHash({
      userOperation: operation,
      entryPointAddress: entryPoint.address,
      entryPointVersion: "0.7",
      chainId: 42161,
    });
    const receipt = await client.waitForTransactionReceipt({
      hash: await f.wallet.writeContract({
        address: entryPoint.address,
        abi: entryPoint07Abi,
        functionName: "handleOps",
        args: [[toPackedUserOperation(operation)], f.wallet.account.address],
        gas: 20_000_000n,
      }),
    });
    if (!expectSuccess) {
      assert(receipt.status === "reverted", "An operation that must be refused was accepted");
      return { gasUsed: 0, attested: 0 };
    }
    const [event] = parseEventLogs({ abi: entryPoint07Abi, eventName: "UserOperationEvent", logs: receipt.logs });
    assert(
      receipt.status === "success" && event?.args.userOpHash === hash && event.args.success,
      "EntryPoint did not execute the operation",
    );
    const attested = parseEventLogs({ abi: EAS_ABI, eventName: "Attested", logs: receipt.logs }).filter(
      (log) =>
        getAddress(log.address) === getAddress(deployment.easAddress) &&
        getAddress(log.args.recipient) === garden &&
        getAddress(log.args.attester) === getAddress(operation.sender) &&
        log.args.schemaUID === deployment.work.schemaUID,
    ).length;
    return { gasUsed: Number(event.args.actualGasUsed), attested };
  };
  const sponsored = (operation: Omit<Operation, keyof typeof LIMITS | "paymaster" | "paymasterData" | "signature">) =>
    ({ ...operation, ...LIMITS, paymaster: sponsor, paymasterData: "0x", signature: "0x" }) as Operation;

  // 1. The account, as the app makes it, deployed by the operation that joins the garden.
  const account = await toKernelSmartAccount({
    client,
    version: "0.3.1",
    owners: [softwarePasskey("greengoods.test")],
    entryPoint: { address: entryPoint.address, version: "0.7" },
  });
  const { factory, factoryData } = await account.getFactoryArgs();
  const joining = sponsored({
    sender: account.address,
    nonce: await account.getNonce(),
    factory,
    factoryData,
    callData: await account.encodeCalls([
      { to: garden, value: 0n, data: encodeFunctionData({ abi: GARDEN_ABI, functionName: "joinGarden" }) },
    ]),
  });
  const joined = await send({ ...joining, signature: await account.signUserOperation(joining) });
  assert(
    await client.readContract({
      address: garden,
      abi: GARDEN_ABI,
      functionName: "isGardener",
      args: [account.address],
    }),
    "The passkey account did not become a gardener",
  );
  await reporting.createPermissionReader(client).assertKernel(account.address);
  check("app_passkey_account_deploys_and_joins_in_its_first_operation");

  // 2. An activity the garden accepts today, read from the registry the resolver reads.
  const now = (await client.getBlock()).timestamp;
  let actionUID: bigint | null = null;
  for (let uid = 0n; uid < 80n && actionUID === null; uid += 1n) {
    const action = await client.readContract({
      address: actions,
      abi: ACTIONS_ABI,
      functionName: "getAction",
      args: [uid],
    });
    if (action.startTime === 0n || action.startTime > now || action.endTime < now) continue;
    const accepted = await client.readContract({
      address: actions,
      abi: ACTIONS_ABI,
      functionName: "gardenHasDomain",
      args: [garden, action.domain],
    });
    if (accepted) actionUID = uid;
  }
  assert(actionUID !== null, "The Community Garden accepts no activity on this fork");

  const delegate = f.delegate;
  const started = Date.now();
  const policy = {
    version: 1 as const,
    purpose: "reporting" as const,
    chainId: 42161,
    account: account.address as Address,
    gardenAddress: garden,
    easAddress: getAddress(deployment.easAddress),
    schemaUID: deployment.work.schemaUID as Hex,
    signerAddress: delegate.address,
    moduleRef: module.moduleRef as string,
    validAfter: started - 10 * 60 * 1000,
    validUntil: started + 23 * 60 * 60 * 1000,
    maxSubmissions: 5,
    gasCap: module.measuredGasUnitsPerSubmission * 5,
    gasCostCapWei: module.gasCostCapsWei.reporting as string,
    approvedPaymaster: sponsor,
    singleCallPolicy: getAddress(module.singleCallPolicy),
  };
  const scope = {
    purpose: policy.purpose,
    easAddress: policy.easAddress,
    schemaUID: policy.schemaUID,
    gardenAddress: policy.gardenAddress,
  };
  const permission = await reporting.grantPermissionValidator(client, { policy, signer: delegate, scope });
  const permissionId = permission.getIdentifier() as Hex;
  const report = (title: string) =>
    domain.buildEnvelope(deployment, {
      kind: "work",
      operationId: `fork-${title}`,
      revision: 1,
      chainId: 42161,
      accountAddress: account.address,
      gardenAddress: garden,
      clientWorkId: `fork-${title}`,
      actionDefinitionDigest: `0x${"12".repeat(32)}`,
      fields: {
        actionUID: String(actionUID),
        title,
        feedback: "Published on a fork through a passkey-approved permission",
        metadata: "ipfs://fork-fixture",
        media: [],
      },
      media: [],
      metadataDigest: `0x${"34".repeat(32)}`,
    });
  const callOf = (envelope: ReturnType<typeof report>) => ({
    to: envelope.call.to as Address,
    value: 0n,
    data: envelope.call.data as Hex,
  });

  // 3. The first report: the page's account and the Agent's signer, exactly as they run live.
  const first = report("first report");
  const activation = await reporting.createGrantedKernelActivationAccount({
    client,
    policy,
    permissionId,
    envelope: first,
    owner: account,
    signDelegate: async (operation: Operation) =>
      (await reporting.signGrantedKernelActivation({ client, policy, envelope: first, signer: delegate, operation }))
        .delegateSignature,
  });
  const enabling = sponsored({
    sender: account.address,
    nonce: await activation.getNonce(),
    callData: await activation.encodeCalls([callOf(first)]),
  });
  assert(enabling.nonce >> 248n === 1n, "The first report did not use Kernel's enable mode");
  const enabled = await send({ ...enabling, signature: await activation.signUserOperation(enabling) });
  const reader = reporting.createPermissionReader(client);
  const installed = await reader.permission(account.address, permissionId);
  assert(
    enabled.attested === 1 && installed.active,
    "The passkey's approval did not install a usable permission and publish the first report",
  );
  // What Kernel recorded is what the approved module pins: the Agent refuses anything else.
  const codeHash = async (address: Address) => keccak256((await client.getCode({ address })) ?? "0x");
  assert(
    getAddress(installed.signerAddress) === getAddress(module.validatorAddress) &&
      (await codeHash(module.validatorAddress)) === module.validatorCodeHash &&
      (await codeHash(module.singleCallPolicy)) === module.singleCallPolicyCodeHash,
    "The installed permission does not match the approved module's signer and guard",
  );
  check("passkey_owner_enables_and_publishes_to_production_eas_under_the_deployed_guard");

  // 4. The next report: the delegate alone, with no owner in the room.
  const granted = await sdk.createKernelAccount(client, {
    address: account.address,
    plugins: { regular: permission },
    entryPoint,
    kernelVersion: constants.KERNEL_V3_1,
  });
  const next = async (title: string) => {
    const operation = sponsored({
      sender: account.address,
      nonce: await granted.getNonce(),
      callData: await granted.encodeCalls([callOf(report(title))]),
    });
    return { ...operation, signature: (await granted.signUserOperation(operation)) as Hex };
  };
  const second = await send(await next("second report"));
  assert(second.attested === 1, "The delegate's own report did not reach the production EAS");
  check("delegate_publishes_the_next_report_to_production_eas_alone");

  // 5. The owner removes it with their passkey; the Agent is not asked.
  const removal = sponsored({
    sender: account.address,
    nonce: await account.getNonce(),
    callData: await account.encodeCalls([
      {
        to: account.address,
        value: 0n,
        data: encodeFunctionData({
          abi: reporting.KERNEL_PERMISSION_ABI,
          functionName: "uninstallValidation",
          args: [
            reporting.permissionValidationId(permissionId),
            encodeAbiParameters([{ type: "bytes[]" }], [["0x", "0x", "0x", "0x", "0x", "0x"]]),
            "0x",
          ],
        }),
      },
    ]),
  });
  const removed = await send({ ...removal, signature: await account.signUserOperation(removal) });
  assert(
    !(await reader.permission(account.address, permissionId)).active,
    "The owner's removal left the permission active",
  );
  // The SDK refuses to build an operation for a permission it sees removed, which is the point:
  // sign one directly, as a delegate that ignored that would, and the chain must refuse it.
  const stale = sponsored({
    sender: account.address,
    nonce: await client.readContract({
      address: entryPoint.address,
      abi: entryPoint07Abi,
      functionName: "getNonce",
      args: [
        account.address,
        BigInt(concatHex(["0x0002", padHex(permissionId, { size: 20, dir: "right" }), "0x0000"])),
      ],
    }),
    callData: await granted.encodeCalls([callOf(report("after removal"))]),
  });
  await send({ ...stale, signature: (await permission.signUserOperation(stale)) as Hex }, false);
  check("passkey_owner_removal_stops_the_delegate");

  return {
    account: account.address,
    garden,
    actionUID: Number(actionUID),
    moduleRef: policy.moduleRef,
    guard: policy.singleCallPolicy,
    paymaster: sponsor,
    // What EntryPoint charged for each operation, with the limits above. Unused call gas is
    // charged a tenth, so these run a little over what the work itself burns.
    gasUsed: {
      join: joined.gasUsed,
      firstReport: enabled.gasUsed,
      nextReport: second.gasUsed,
      removal: removed.gasUsed,
    },
    gasLimitsPerOperation: OPERATION_GAS_LIMIT,
    approvedGasUnitsPerSubmission: module.measuredGasUnitsPerSubmission as number,
    approvedCostCapWei: policy.gasCostCapWei,
    paymasterDepositWei: deposit.toString(),
  };
}
