import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  keccak256,
  parseAbi,
  type Hex,
} from "viem";
import { createLiveServiceAccessAdapter } from "../modules/commitment-pooling/service-access-live";
import {
  verifyServiceLiveRoute,
  type ServiceLiveChain,
} from "../modules/commitment-pooling/service-access-live-chain";
import type {
  ServiceLiveRoute,
  ServiceDeploymentPin,
} from "../modules/commitment-pooling/service-access-live-config";
import { createServiceRehearsalSnapshot } from "../modules/commitment-pooling/demo/demo-service-access-fixtures";
import { SERVICE_ZERO_HASH as ZERO } from "../modules/commitment-pooling/service-access-chain-values";
import type {
  ServiceAccessAction,
  ServiceAccessKey,
} from "../modules/commitment-pooling/service-access-types";
import {
  TransactionRevertedError,
  type ContractCall,
  type TransactionSender,
} from "../modules/transactions/types";
import type { Address } from "../types/domain";

const account = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const H = `0x${"a".repeat(64)}` as Hex;
const key: ServiceAccessKey = {
  sourceChainId: 42161,
  coreModule: account(1),
  commitmentId: 1024n,
  buyer: account(2),
};
function fixture() {
  const s = createServiceRehearsalSnapshot(key);
  s.evidence = "onchain";
  const row = s.voucherSetups[0]!;
  const d = row.destination!;
  // A fresh authorized setup with no custody, ready for a finite holder approval.
  d.result = {
    ...d.result,
    phase: "authorized",
    decision: "none",
    depositedUnits: 0n,
    depositReceiptHash: null,
    appliedDecisionId: null,
    setupRefundedUnits: 0n,
    issuerApproved: true,
  };
  d.finalAllocation = null;
  d.allowance = 0n;
  d.holderBalance = 200n;
  d.pendingAction = null;
  const storage = new Map<string, string>();
  const persistent = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
  };
  const pin = (address: Address): ServiceDeploymentPin => ({
    address,
    owner: account(10),
    receipt: {
      transactionHash: `0x${address.slice(2).padStart(64, "0")}`,
      blockNumber: 10n,
      blockHash: H,
    },
    runtimeCodeHash: keccak256("0x6001"),
    implementation: { address: account(90), runtimeCodeHash: keccak256("0x6002") },
  });
  const route: ServiceLiveRoute = {
    id: "test-pilot",
    revision: 1,
    sourceChainId: 42161,
    core: pin(key.coreModule),
    source: {
      ...pin(row.authorization.sourceModule),
      guardian: account(11),
      router: account(12),
      remoteSelector: 13n,
    },
    destination: {
      ...pin(row.authorization.destinationEscrow),
      guardian: account(11),
      router: account(12),
      remoteSelector: 14n,
    },
    assets: [
      {
        token: row.authorization.token,
        issuer: row.authorization.issuer,
        symbol: "TEST",
        decimals: 0,
        runtimeCodeHash: keccak256("0x6001"),
        implementation: { address: account(90), runtimeCodeHash: keccak256("0x6002") },
      },
    ],
    buyerGardens: s.eligibleBuyerGardens,
  };
  let paused = false;
  let failReceipt = false;
  let lastCall: ContractCall | undefined;
  const chain: ServiceLiveChain = {
    code: async (_chain, a) => (a === key.buyer ? "0x" : a === account(90) ? "0x6002" : "0x6001"),
    storage: async () => `0x${"0".repeat(24)}${account(90).slice(2)}`,
    receipt: async (_chain, tx) => {
      if (failReceipt && tx === `0x${"b".repeat(64)}`) throw new Error("RPC unavailable");
      return {
        status: "success",
        transactionHash: tx,
        blockNumber: 10n,
        blockHash: H,
        to: tx === `0x${"b".repeat(64)}` ? lastCall!.address : (`0x${tx.slice(-40)}` as Address),
        contractAddress: null,
      };
    },
    transaction: async () => ({
      from: key.buyer,
      to: lastCall!.address,
      value: lastCall!.value ?? 0n,
      input: encodeFunctionData({
        abi: lastCall!.abi,
        functionName: lastCall!.functionName,
        args: lastCall!.args,
      }),
    }),
    balance: async () => 100n,
    read: async ({ chainId, address, functionName }) => {
      const source = chainId === 42161;
      switch (functionName) {
        case "owner":
          return address === row.authorization.token ? row.authorization.issuer : account(10);
        case "serviceOfferProtocolVersion":
        case "voucherAcceptanceProtocolVersion":
          return 1;
        case "voucherServiceSetupModule":
          return route.source.address;
        case "commitmentPooling":
          return key.coreModule;
        case "guardian":
          return account(11);
        case "CCIP_ROUTER":
          return account(12);
        case "LOCAL_CHAIN_ID":
          return BigInt(chainId);
        case "remoteChainId":
          return source ? 100n : 42161n;
        case "remotePeer":
          return source ? route.destination.address : route.source.address;
        case "remoteChainSelector":
          return source ? 13n : 14n;
        case "paused":
          return paused;
        case "allowance":
          return d.allowance;
        case "balanceOf":
          return d.holderBalance;
        case "quoteSetupCommand":
        case "quoteSetupAbortRequest":
        case "quoteSetupAcknowledgment":
          return 2n;
        case "getSetupExecution":
          return {
            authorization: "0x01",
            result: {
              version: 2,
              setupId: row.setupId,
              authorizationHash: row.authorizationHash,
              resultSequence: d.result.sequence,
              phase: [
                "none",
                "authorized",
                "deposited",
                "active",
                "abort-refund-pending",
                "aborted",
              ].indexOf(d.result.phase),
              decision: ["none", "activate", "abort"].indexOf(d.result.decision),
              issuerApproved: d.result.issuerApproved,
              depositReceiptHash: d.result.depositReceiptHash ?? ZERO,
              depositedUnits: d.result.depositedUnits,
              setupRefundedUnits: d.result.setupRefundedUnits,
              appliedDecisionId: d.result.appliedDecisionId ?? ZERO,
              actionSucceeded: d.result.actionSucceeded,
              failureHash: d.result.failureHash ?? ZERO,
            },
            pendingAction:
              d.pendingAction === "deposit" ? 1 : d.pendingAction === "abort-refund" ? 2 : 0,
            decision: "0x",
            failureReason: "0x",
            issuerReturnCeiling: 100n,
            holderAbortRequested: false,
            setupAcknowledgment: { sequence: 0n, messageId: ZERO, failureHash: ZERO },
            finalAcknowledgment: { sequence: 0n, messageId: ZERO, failureHash: ZERO },
            finalSequence: 0n,
            finalAllocation: {
              decisionId: ZERO,
              activationDecisionId: ZERO,
              issuerReturnApprovalAtFreeze: 0n,
              allocation: {},
              release: {},
              refund: {},
            },
          };
      }
      throw new Error(`Unhandled read ${functionName}`);
    },
  };
  const session = {
    address: key.buyer as Address | null,
    authMode: "wallet" as "wallet" | "passkey",
    profile: null as string | null,
    generation: 1,
    online: true,
  };
  const sender: TransactionSender = {
    authMode: "wallet",
    supportsBatching: false,
    supportsSponsorship: false,
    assertOwnership: vi.fn(async () => {}),
    sendContractCall: vi.fn(async (call, options) => {
      lastCall = call;
      await options?.assertOwnership?.();
      await options?.onBeforeBroadcast?.();
      const hash = `0x${"b".repeat(64)}` as Hex;
      await options?.onBroadcastReference?.({
        kind: "transaction",
        hash,
        chainId: call.chainId,
        account: key.buyer,
      });
      if (call.functionName === "approve") d.allowance = call.args[1] as bigint;
      return { hash, sponsored: false };
    }),
  };
  const dependencies = {
    session: () => session,
    sender: () => sender,
    readSnapshot: async () => structuredClone(s),
    routes: [route],
    chain,
    membership: async () => true,
    storage: persistent,
  };
  const adapter = () => createLiveServiceAccessAdapter(dependencies);
  const action: ServiceAccessAction = {
    action: "approveVoucherAllowance",
    sourceChainId: 42161,
    sourceModule: row.authorization.sourceModule,
    setupId: row.setupId,
    expectedAuthorizationHash: row.authorizationHash,
  };
  return {
    s,
    row,
    d,
    route,
    chain,
    session,
    sender,
    storage,
    dependencies,
    adapter,
    action,
    setPaused: (v: boolean) => {
      paused = v;
    },
    setFailReceipt: (v: boolean) => {
      failReceipt = v;
    },
  };
}

describe("live service access", () => {
  it("requires a receipt-backed route before asking a member to sign", async () => {
    const adapter = createLiveServiceAccessAdapter({
      session: () => ({
        address: null,
        authMode: null,
        profile: null,
        generation: 0,
        online: true,
      }),
      sender: () => null,
      readSnapshot: async () => {
        throw new Error("must not read an unconfigured route");
      },
    });
    await expect(
      adapter.execute(
        {
          sourceChainId: 42161,
          coreModule: "0x0000000000000000000000000000000000000001",
          commitmentId: 1n,
          buyer: "0x0000000000000000000000000000000000000002",
        },
        { action: "withdrawClaim", expectedClaimHash: `0x${"a".repeat(64)}` }
      )
    ).rejects.toThrow("reviewed deployment");
  });

  it("sends one exact finite approval with a member-owned EOA and confirmed Gnosis readback", async () => {
    const f = fixture();
    const result = await f.adapter().execute(key, f.action);
    expect(result.kind).toBe("onchain");
    expect(result.observationId).toMatch(/^100:0x/);
    expect(f.sender.sendContractCall).toHaveBeenCalledOnce();
    expect(f.sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        account: key.buyer,
        chainId: 100,
        address: f.row.authorization.token,
        functionName: "approve",
        args: [f.route.destination.address, 100n],
        value: 0n,
      }),
      expect.anything()
    );
    expect(f.storage.size).toBe(0);
    expect(result.snapshot.voucherSetups[0]!.availableActions).toContain("revokeVoucherAllowance");
  });

  it("keeps a finite approval revocable after the service becomes paused or stale", async () => {
    const f = fixture();
    f.d.allowance = 100n;
    f.setPaused(true);
    f.s.coreState = "CANCELLED";
    const result = await f
      .adapter()
      .execute(key, { ...f.action, action: "revokeVoucherAllowance" });
    expect(f.d.allowance).toBe(0n);
    expect(result.snapshot.voucherSetups[0]!.destination!.allowance).toBe(0n);
  });

  it.each([
    "legacy-profile",
    "wrong-wallet",
    "offline",
    "stale-authorization",
  ])("rejects %s before asking for a transaction", async (failure) => {
    const f = fixture();
    if (failure === "legacy-profile") {
      f.session.authMode = "passkey";
      f.session.profile = "kernel-0.3.1-legacy";
    }
    if (failure === "wrong-wallet") f.session.address = account(3);
    if (failure === "offline") f.session.online = false;
    const action =
      failure === "stale-authorization" ? { ...f.action, expectedAuthorizationHash: H } : f.action;
    await expect(f.adapter().execute(key, action)).rejects.toThrow();
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("checks the session again after a wallet chain-switch prompt", async () => {
    const f = fixture();
    f.sender.sendContractCall = vi.fn(async (_call, options) => {
      f.session.generation++;
      await options?.assertOwnership?.();
      throw new Error("must not broadcast");
    });
    await expect(f.adapter().execute(key, f.action)).rejects.toThrow("session changed");
    expect(f.storage.size).toBe(0);
  });

  it("retains an ambiguous receipt and reconciles it on restore without a second approval", async () => {
    const f = fixture();
    f.setFailReceipt(true);
    await expect(f.adapter().execute(key, f.action)).rejects.toThrow("RPC unavailable");
    expect(f.storage.size).toBe(1);
    await expect(f.adapter().execute(key, f.action)).rejects.toThrow("pending");
    expect(f.sender.sendContractCall).toHaveBeenCalledOnce();
    f.setFailReceipt(false);
    const restored = await f.adapter().read(key);
    expect(f.storage.size).toBe(0);
    expect(restored.voucherSetups[0]!.destination!.allowance).toBe(100n);
    expect(f.sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it.each([
    "cancel",
    "revert",
  ])("clears a proved %s without losing other accounts' checkpoints", async (failure) => {
    const f = fixture();
    f.storage.set("other-account", "untouched");
    f.sender.sendContractCall = vi.fn(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw failure === "cancel"
        ? Object.assign(new Error("declined"), { code: 4001 })
        : new TransactionRevertedError(H);
    });
    await expect(f.adapter().execute(key, f.action)).rejects.toThrow();
    expect([...f.storage.keys()]).toEqual(["other-account"]);
  });

  it("rejects implementation, owner, peer and receipt drift independently", async () => {
    for (const field of ["implementation", "owner", "peer", "receipt"]) {
      const f = fixture();
      if (field === "implementation") f.chain.storage = async () => ZERO;
      if (field === "receipt") f.route.core.receipt.blockHash = ZERO;
      if (field === "owner" || field === "peer") {
        const original = f.chain.read;
        f.chain.read = async (input) =>
          input.functionName === (field === "owner" ? "owner" : "remotePeer")
            ? account(99)
            : original(input);
      }
      await expect(verifyServiceLiveRoute(f.route, f.chain)).rejects.toThrow();
      expect(f.sender.sendContractCall).not.toHaveBeenCalled();
    }
  });

  it("rejects a contract wallet or unfunded EOA fallback before asking it to sign", async () => {
    for (const failure of ["contract-wallet", "gas"]) {
      const f = fixture();
      if (failure === "gas") f.chain.balance = async () => 0n;
      else {
        const original = f.chain.code;
        f.chain.code = (chain, address) =>
          address === key.buyer ? Promise.resolve("0x6001") : original(chain, address);
      }
      await expect(f.adapter().execute(key, f.action)).rejects.toThrow(
        failure === "gas" ? "native gas" : "member-owned EOA"
      );
      expect(f.sender.sendContractCall).not.toHaveBeenCalled();
    }
  });

  it("keeps an escrow transfer failure retryable despite a successful outer receipt", async () => {
    const f = fixture();
    f.d.allowance = 100n;
    const send = f.sender.sendContractCall;
    f.sender.sendContractCall = vi.fn(async (call, options) => {
      const sent = await send(call, options);
      f.d.pendingAction = "deposit";
      f.d.result.actionSucceeded = false;
      f.d.result.failureHash = H;
      return sent;
    });
    const result = await f.adapter().execute(key, { ...f.action, action: "presentVoucherSetup" });
    const observed = result.snapshot.voucherSetups[0]!;
    expect(observed.destination!.result.depositedUnits).toBe(0n);
    expect(observed.availableActions).toContain("retryVoucherSetupAction");
    expect(observed.availableActions).toContain("revokeVoucherAllowance");
    expect(f.sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("does not treat an unrelated successful transaction as its own execution", async () => {
    const f = fixture();
    const original = f.chain.transaction;
    f.chain.transaction = async (chain, hash) => ({
      ...(await original(chain, hash)),
      to: account(44),
    });
    await expect(f.adapter().execute(key, f.action)).rejects.toThrow("does not match");
    expect(f.storage.size).toBe(1);
    await expect(f.adapter().read(key)).rejects.toThrow("does not match");
    expect(f.sender.sendContractCall).toHaveBeenCalledOnce();
  });

  it("refuses a changed reviewed fee without a transport send", async () => {
    const f = fixture();
    await expect(
      f.adapter().execute(key, {
        ...f.action,
        action: "dispatchVoucherSetupCommand",
        kind: "authorization",
        expectedDecisionId: null,
        reviewedNativeFee: 9n,
      })
    ).rejects.toThrow("fee-changed");
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("does not reinterpret fictional pilot rewards or exchange observations as live calls", async () => {
    const f = fixture();
    for (const action of [
      { action: "observePilotRole", observation: "work-fulfilled" },
      { action: "deliverPilotReward", asset: "voucher" },
      { action: "quotePilotExchange" },
    ] as const)
      await expect(f.adapter().execute(key, action)).rejects.toThrow(
        "no reviewed live service implementation"
      );
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });

  it.each([
    "reviewed-upgrade",
    "unrelated-call",
    "failed-safe",
  ])("checks actual Safe adoption evidence for %s", async (kind) => {
    const f = fixture();
    f.route.core.receipt.kind = "safe-upgrade";
    const abi = parseAbi([
      "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool)",
      "function upgradeTo(address implementation)",
      "event ExecutionSuccess(bytes32 txHash,uint256 payment)",
      "event ExecutionFailure(bytes32 txHash,uint256 payment)",
      "event Upgraded(address indexed implementation)",
    ]);
    const inner = encodeFunctionData({ abi, functionName: "upgradeTo", args: [account(90)] });
    const outer = encodeFunctionData({
      abi,
      functionName: "execTransaction",
      args: [
        kind === "unrelated-call" ? account(99) : (f.route.core.address as `0x${string}`),
        0n,
        inner,
        0,
        0n,
        0n,
        0n,
        account(0),
        account(0),
        "0x1122",
      ],
    });
    const receipt = f.chain.receipt;
    f.chain.receipt = async (chain, hash) =>
      hash === f.route.core.receipt.transactionHash
        ? {
            ...(await receipt(chain, hash)),
            to: f.route.core.owner,
            logs: [
              {
                address: f.route.core.owner,
                topics: encodeEventTopics({
                  abi,
                  eventName: kind === "failed-safe" ? "ExecutionFailure" : "ExecutionSuccess",
                }) as Hex[],
                data: encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [H, 0n]),
              },
              {
                address: f.route.core.address,
                topics: encodeEventTopics({
                  abi,
                  eventName: "Upgraded",
                  args: { implementation: account(90) },
                }) as Hex[],
                data: "0x",
              },
            ],
          }
        : receipt(chain, hash);
    f.chain.transaction = async () => ({
      from: account(8),
      to: f.route.core.owner,
      value: 0n,
      input: outer,
    });
    if (kind === "reviewed-upgrade")
      await expect(verifyServiceLiveRoute(f.route, f.chain)).resolves.toBeUndefined();
    else await expect(verifyServiceLiveRoute(f.route, f.chain)).rejects.toThrow("receipt");
  });
});
