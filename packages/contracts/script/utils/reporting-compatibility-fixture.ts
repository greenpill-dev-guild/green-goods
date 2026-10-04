import {
  createPublicClient,
  createWalletClient,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  padHex,
  parseAbiParameters,
  parseEventLogs,
  toHex,
  zeroAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import {
  entryPoint07Abi,
  getUserOperationHash,
  toPackedUserOperation,
  type UserOperation,
} from "viem/account-abstraction";
import { assertReportingFixtureRpc, reportingFixtureArtifact } from "./reporting-compatibility-boundary";
import { loadReportingCompatibilitySdk } from "./reporting-compatibility-sdk";
import { reportingFixtureEvidence } from "./reporting-compatibility-evidence";

// Public Anvil development keys. They are confined to the runner-owned loopback fork.
const OWNER_FIXTURE = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DELEGATE_FIXTURE = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
export const REPORTING_GARDEN_FIXTURE = "0x00000000000000000000000000000000000000c2" as Hex;
export const OPERATION_PREFUND = 6_200_000n * 1_000_000_000n;

export async function reportingCompatibilityFixture(contracts: string, rpc: string) {
  assertReportingFixtureRpc(rpc);
  const loaded = await loadReportingCompatibilitySdk(`${contracts}/../..`);
  const { sdk, constants, permissions, signers, reporting, domain } = loaded;
  const client = createPublicClient({ chain: arbitrum, transport: http(rpc), pollingInterval: 100, cacheTime: 0 });
  const owner = privateKeyToAccount(OWNER_FIXTURE),
    delegate = privateKeyToAccount(DELEGATE_FIXTURE);
  const wallet = createWalletClient({ chain: arbitrum, transport: http(rpc), account: owner });
  const request = (method: string, params: unknown[] = []) =>
    client.request({ method, params } as Parameters<typeof client.request>[0]);
  const mined = async (hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Reporting fixture setup transaction reverted");
    return receipt;
  };
  await request("anvil_setBalance", [owner.address, toHex(1000n * 10n ** 18n)]);
  const entryPoint = constants.getEntryPoint("0.7");
  if (!(await client.getCode({ address: entryPoint.address }))) throw new Error("Fork has no deployed EntryPoint 0.7");
  const deploy = async (name: string, args: unknown[] = []) => {
    const artifact = reportingFixtureArtifact(contracts, name);
    const receipt = await mined(await wallet.deployContract({ ...artifact, args }));
    if (!receipt.contractAddress) throw new Error("Fixture deployment returned no address");
    return { ...artifact, address: receipt.contractAddress };
  };
  const guard = await deploy("SingleAttestationPolicy");
  const eas = await deploy("ReportingFixtureEAS");
  const paymaster = await deploy("ReportingFixturePaymaster", [entryPoint.address]);
  await mined(
    await wallet.writeContract({
      address: entryPoint.address,
      abi: entryPoint07Abi,
      functionName: "depositTo",
      args: [paymaster.address],
      value: 100n * 10n ** 18n,
    }),
  );
  const sudo = await permissions.toPermissionValidator(client, {
    signer: await signers.toECDSASigner({ signer: owner }),
    policies: [],
    entryPoint,
    kernelVersion: constants.KERNEL_V3_1,
  });
  const account = await sdk.createKernelAccount(client, {
    plugins: { sudo },
    entryPoint,
    kernelVersion: constants.KERNEL_V3_1,
    index: 0n,
  });
  const { factory, factoryData } = await account.getFactoryArgs();
  await mined(await wallet.sendTransaction({ to: factory, data: factoryData }));
  const reader = reporting.createPermissionReader(client);
  await reader.assertKernel(account.address);
  const deployment = domain.resolveReportingDeployment(42161);
  const count = () =>
    client.readContract({ address: eas.address, abi: eas.abi, functionName: "count" }) as Promise<bigint>;
  const { attest, review } = reportingFixtureEvidence(deployment, eas, REPORTING_GARDEN_FIXTURE);
  const reviewAttest = async () =>
    review(
      (await client.readContract({
        address: eas.address,
        abi: eas.abi,
        functionName: "lastUID",
      })) as Hex,
    );

  const createGrant = async (
    overrides: {
      validUntil?: number;
      maxSubmissions?: number;
      gasCostCapWei?: string;
      purpose?: "reporting" | "review";
      schemaUID?: Hex;
    } = {},
  ) => {
    const now = Number((await client.getBlock()).timestamp) * 1000;
    const policy = {
      version: 1,
      account: account.address,
      chainId: 42161,
      gardenAddress: REPORTING_GARDEN_FIXTURE,
      purpose: "reporting",
      easAddress: eas.address,
      schemaUID: deployment.work.schemaUID,
      signerAddress: delegate.address,
      moduleRef: "isolated-fork-fixture",
      validAfter: now - 1000,
      validUntil: now + 24 * 60 * 60 * 1000,
      maxSubmissions: 5,
      gasCap: 10_000_000,
      gasCostCapWei: (OPERATION_PREFUND * 10n).toString(),
      approvedPaymaster: paymaster.address,
      singleCallPolicy: guard.address,
      ...overrides,
    };
    const permission = await reporting.grantPermissionValidator(client, {
      policy,
      signer: delegate,
      scope: {
        purpose: policy.purpose,
        easAddress: policy.easAddress,
        schemaUID: policy.schemaUID,
        gardenAddress: policy.gardenAddress,
      },
    });
    const permissionId = permission.getIdentifier() as Hex;
    const enabling = await sdk.createKernelAccount(client, {
      address: account.address,
      plugins: { sudo, regular: permission },
      entryPoint,
      kernelVersion: constants.KERNEL_V3_1,
    });
    const enabled = await sdk.createKernelAccount(client, {
      address: account.address,
      plugins: { regular: permission },
      entryPoint,
      kernelVersion: constants.KERNEL_V3_1,
    });
    let enableSignature: Hex | undefined;
    const operation = async (
      enable: boolean,
      calls?: ReturnType<typeof attest>[],
      changes: Partial<UserOperation<"0.7">> = {},
      adversarialDefault = false,
    ) => {
      const kernel = enable ? enabling : enabled;
      const callData = await kernel.encodeCalls(
        calls ?? [policy.purpose === "review" ? await reviewAttest() : attest()],
      );
      const nonce = adversarialDefault
        ? await client.readContract({
            address: entryPoint.address,
            abi: entryPoint07Abi,
            functionName: "getNonce",
            args: [
              account.address,
              BigInt(concatHex(["0x0002", padHex(permissionId, { size: 20, dir: "right" }), "0x0000"])),
            ],
          })
        : await kernel.getNonce();
      const op: UserOperation<"0.7"> = {
        sender: account.address,
        nonce,
        callData,
        callGasLimit: 1_000_000n,
        verificationGasLimit: 4_000_000n,
        preVerificationGas: 100_000n,
        maxFeePerGas: 1_000_000_000n,
        maxPriorityFeePerGas: 0n,
        paymaster: paymaster.address,
        paymasterVerificationGasLimit: 1_000_000n,
        paymasterPostOpGasLimit: 100_000n,
        paymasterData: "0x",
        signature: "0x",
        ...changes,
      };
      if (enable) enableSignature = await enabling.kernelPluginManager.getPluginEnableSignature(account.address);
      const signature = adversarialDefault
        ? await permission.signUserOperation(op)
        : await kernel.signUserOperation(op);
      return { ...op, signature };
    };
    const remaining = () =>
      client.readContract({
        address: guard.address,
        abi: guard.abi,
        functionName: "remainingCostWei",
        args: [padHex(permissionId, { size: 32, dir: "right" }), account.address],
      }) as Promise<bigint>;
    const status = () =>
      client.readContract({
        address: guard.address,
        abi: guard.abi,
        functionName: "status",
        args: [padHex(permissionId, { size: 32, dir: "right" }), account.address],
      }) as Promise<number>;
    const revoke = async () => {
      const disable = encodeAbiParameters([{ type: "bytes[]" }], [["0x", "0x", "0x", "0x", "0x", "0x"]]);
      const data = encodeFunctionData({
        abi: reporting.KERNEL_PERMISSION_ABI,
        functionName: "uninstallValidation",
        args: [reporting.permissionValidationId(permissionId), disable, "0x"],
      });
      await ownerCall(data);
      if ((await status()) !== 2) throw new Error("Kernel uninstall did not retire the guard permission");
    };
    const staleEnable = async () => {
      if (!enableSignature) throw new Error("No prior enable signature captured in fixture browser memory");
      const op = await operation(false, [attest()], {}, true);
      // Enable mode is the top byte of the 192-bit nonce key. This is an adversarial replay,
      // because the pinned SDK notices signer installation and would otherwise select DEFAULT.
      const key = ((op.nonce >> 64n) & ((1n << 184n) - 1n)) | (1n << 184n);
      op.nonce = await client.readContract({
        address: entryPoint.address,
        abi: entryPoint07Abi,
        functionName: "getNonce",
        args: [account.address, key],
      });
      const raw = await permission.signUserOperation(op);
      const typed = await enabling.kernelPluginManager.getPluginsEnableTypedData(account.address);
      // Exact Kernel v3.1 wire ABI; compare with the pinned SDK first operation in the gate.
      op.signature =
        `${zeroAddress}${encodeAbiParameters(parseAbiParameters("bytes,bytes,bytes,bytes,bytes"), [await permission.getEnableData(account.address), "0x", typed.message.selectorData, enableSignature, raw]).slice(2)}` as Hex;
      return op;
    };
    return {
      policy,
      permissionId,
      operation,
      // Only negative checks bypass the SDK's missing-owner error to exercise real on-chain rejection.
      revokedOperation: () => operation(false, [attest()], {}, true),
      remaining,
      status,
      revoke,
      staleEnable,
      view: () => reader.permission(account.address, permissionId),
    };
  };
  const submit = async (op: UserOperation<"0.7">, expectSuccess = true) => {
    const hash = getUserOperationHash({
      userOperation: op,
      entryPointAddress: entryPoint.address,
      entryPointVersion: "0.7",
      chainId: 42161,
    });
    const receipt = await client.waitForTransactionReceipt({
      hash: await wallet.writeContract({
        address: entryPoint.address,
        abi: entryPoint07Abi,
        functionName: "handleOps",
        args: [[toPackedUserOperation(op)], owner.address],
        gas: 20_000_000n,
      }),
    });
    if (!expectSuccess) {
      if (receipt.status !== "reverted")
        throw new Error("Rejected-policy fixture unexpectedly passed EntryPoint validation");
      return;
    }
    const events = parseEventLogs({ abi: entryPoint07Abi, eventName: "UserOperationEvent", logs: receipt.logs });
    if (receipt.status !== "success" || !events.some((event) => event.args.userOpHash === hash && event.args.success))
      throw new Error("Real EntryPoint handleOps did not publish the expected report");
  };
  const ownerCall = async (data: Hex) => {
    const op: UserOperation<"0.7"> = {
      sender: account.address,
      nonce: await account.getNonce(),
      callData: await account.encodeCalls([{ to: account.address, value: 0n, data }]),
      callGasLimit: 1_000_000n,
      verificationGasLimit: 4_000_000n,
      preVerificationGas: 100_000n,
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 0n,
      paymaster: paymaster.address,
      paymasterVerificationGasLimit: 1_000_000n,
      paymasterPostOpGasLimit: 100_000n,
      paymasterData: "0x",
      signature: "0x",
    };
    await submit({ ...op, signature: await account.signUserOperation(op) });
  };
  const moduleHashes = [];
  const sample = await createGrant();
  for (const module of reporting.grantPolicies(sample.policy, {
    purpose: "reporting",
    easAddress: eas.address,
    schemaUID: sample.policy.schemaUID,
    gardenAddress: REPORTING_GARDEN_FIXTURE,
  })) {
    const address = `0x${module.getPolicyInfoInBytes().slice(6)}` as Hex;
    const code = await client.getCode({ address });
    if (!code) throw new Error("Pinned policy has no bytecode on the fork");
    moduleHashes.push({
      address,
      codeHash: keccak256(code),
      fixture: address.toLowerCase() === guard.address.toLowerCase(),
    });
  }
  return {
    client,
    request,
    createGrant,
    submit,
    ownerCall,
    account,
    sudo,
    count,
    attest,
    deployment,
    eas,
    guard,
    paymaster,
    reader,
    kernelAbi: reporting.KERNEL_PERMISSION_ABI,
    versions: loaded.versions,
    moduleHashes,
    guardRuntimeCodeHash: keccak256((await client.getCode({ address: guard.address }))!),
  };
}
