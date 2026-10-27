import { describe, expect, it, vi } from "vitest";
import { entryPoint07Abi, entryPoint07Address } from "viem/account-abstraction";
import {
  type AbiParameter,
  type Hex,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  encodeFunctionResult,
  decodeFunctionResult,
  getCreate2Address,
  keccak256,
  stringToHex,
  erc20Abi,
} from "viem";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import { createServiceIssuerOperations } from "../modules/commitment-pooling/service-issuer-operations";
import {
  issuerDeserialize,
  issuerSerialize,
} from "../modules/commitment-pooling/service-issuer-metadata";
import {
  AdapterABI,
  BookingEventsABI,
  PoolABI,
  TokenABI,
} from "../modules/commitment-pooling/service-issuer-abis";
import type { ServiceIssuerChain } from "../modules/commitment-pooling/service-issuer-chain";
import type {
  ServiceIssuerAction,
  ServiceIssuerActor,
  ServiceIssuerRoute,
  ServiceIssuerProxyPin,
} from "../modules/commitment-pooling/service-issuer-types";
import type { ServiceDeploymentPin } from "../modules/commitment-pooling/service-access-live-config";
import type { ServiceLiveSession } from "../modules/commitment-pooling/service-access-live";
import type { ServiceVoucherAuthorization } from "../modules/commitment-pooling/service-access-voucher-types";
import { voucherAuthorizationIdentity } from "../modules/commitment-pooling/service-access-voucher-hashes";
import {
  TransactionRevertedError,
  type ContractCall,
  type TransactionSender,
} from "../modules/transactions/types";
import type { Address } from "../types/domain";
import {
  serviceIssuerDelistingDraft,
  serviceIssuerGovernanceDrafts,
} from "../modules/commitment-pooling/service-issuer-governance";
import { assertServiceActor } from "../modules/commitment-pooling/service-actor-session";
import type { GraphQLReader } from "../modules/data/graphql-client";
import { discoverIssuerVoucherSetups } from "../modules/commitment-pooling/data-voucher-service";

import { ISSUER_FACTORY_ABI } from "../modules/commitment-pooling/service-issuer-deployment";
import { verifyIssuerProxyDeployment } from "../modules/commitment-pooling/service-issuer-deployment";
import {
  createIssuerPendingStore,
  issuerReviewFingerprint,
} from "../modules/commitment-pooling/service-issuer-pending";

const INIT = "0x1fa551e9b261b3a9568d5ec12f9d6028366575ac46f6d66f918abeebb2242c6b" as const;
const account = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const H = `0x${"a".repeat(64)}` as Hex;
const TX = `0x${"b".repeat(64)}` as Hex;
const ZERO = `0x${"0".repeat(64)}` as Hex;
const PARAM = SourceABI.find((v) => v.type === "function" && v.name === "getSetupAuthorization")!
  .outputs![0] as AbiParameter;

function exactTopics(values: ReturnType<typeof encodeEventTopics>): Hex[] {
  return values.map((value) => {
    if (typeof value !== "string") throw new Error("Incomplete fixture event");
    return value;
  });
}
/** Synthetic protocol fixtures only: these people, capacities and receipts are not live approvals. */
function fixture(authMode: "wallet" | "passkey" = "wallet") {
  const owner = account(2);
  const pin = (address: Address, authority = account(9)): ServiceDeploymentPin => ({
    address,
    owner: authority,
    receipt: {
      transactionHash: `0x${address.slice(2).padStart(64, "0")}`,
      blockNumber: 1n,
      blockHash: H,
    },
    runtimeCodeHash: keccak256("0x6001"),
    implementation: { address: account(90), runtimeCodeHash: keccak256("0x6002") },
  });
  const clcPin = (label: Address, authority = account(9)): ServiceIssuerProxyPin => {
    const salt = `0x${label.slice(2).padStart(64, "0")}` as Hex;
    const address = getCreate2Address({
      from: account(40) as `0x${string}`,
      salt,
      bytecodeHash: INIT,
    });
    return {
      ...pin(address, authority),
      factoryDeployment: { deployer: account(10), admin: authority, salt, initializer: "0x1234" },
    };
  };
  const asset = (id: string, token: Address, issuer: Address) => ({
    id,
    kind: "individual" as const,
    ownerReserve: issuer,
    sourceAuthority: issuer,
    token: clcPin(token, issuer),
    name: `Test ${id}`,
    symbol: id,
    decimals: 0,
    service: {
      unit: "test hour",
      terms: { reference: "ipfs://test-terms", digest: H },
      capacityConfirmed: true,
      approval: { reference: "ipfs://test-consent", digest: H },
    },
    initialSupply: 1000n,
    adapterAllowance: 400n,
    poolHoldingCap: 2000n,
    priceIndex: 1n,
    upgradeControl: { kind: "member" as const, admin: issuer },
  });
  const assets = [
    asset("engineering", account(20), owner),
    asset("analysis", account(21), account(3)),
  ];
  for (const a of assets)
    a.token.factoryDeployment.initializer = encodeFunctionData({
      abi: TokenABI,
      functionName: "initialize",
      args: [a.name, a.symbol, a.decimals, a.ownerReserve as `0x${string}`, 0n],
    });
  const route: ServiceIssuerRoute = {
    service: {
      id: "fictional-test",
      revision: 1,
      sourceChainId: 42161,
      core: pin(account(30)),
      source: {
        ...pin(account(31)),
        guardian: account(8),
        router: account(7),
        remoteSelector: 13n,
      },
      destination: {
        ...pin(account(32)),
        guardian: account(8),
        router: account(7),
        remoteSelector: 14n,
      },
      assets: assets.map((a) => ({
        token: a.token.address,
        issuer: a.ownerReserve,
        symbol: a.symbol,
        decimals: a.decimals,
        runtimeCodeHash: a.token.runtimeCodeHash,
        implementation: a.token.implementation,
      })),
      buyerGardens: [{ address: account(4), name: "Test garden" }],
    },
    assets,
    factory: { address: account(40), runtimeCodeHash: keccak256("0x6001") },
    adapterSource: {
      ...pin(account(34)),
      guardian: account(8),
      router: account(7),
      remoteSelector: 13n,
    },
    adapter: {
      ...pin(account(33)),
      guardian: account(8),
      router: account(7),
      sourcePeer: account(34),
      sourceSelector: 14n,
    },
    pool: {
      proxyAdmin: account(9),
      deployment: clcPin(account(41)),
      registry: clcPin(account(42)),
      limiter: clcPin(account(43)),
      quoter: clcPin(account(44)),
      feePolicy: clcPin(account(45)),
      protocolFee: clcPin(account(46)),
      feeAddress: account(9),
      feesDecoupled: true,
    },
  };
  const proxies = [
    ...assets.map((a) => a.token),
    route.pool.deployment,
    route.pool.registry,
    route.pool.limiter,
    route.pool.quoter,
    route.pool.feePolicy,
    route.pool.protocolFee,
  ];
  const actor: ServiceIssuerActor = {
    address: owner,
    routeId: route.service.id,
    assetId: assets[0]!.id,
  };
  const session: ServiceLiveSession = {
    address: owner,
    authMode,
    profile: authMode === "passkey" ? "kernel-0.3.3-pilot" : null,
    generation: 0,
    online: true,
  };
  const state = {
    minted: 100n,
    balance: 100n,
    reserve: 0n,
    pool: 0n,
    enabled: false,
    time: 1000n,
    quote: 9n,
    gross: 9n,
    outputFees: 0n,
    inventory: 100n,
    poolFee: 0n,
    protocolFee: 0n,
    poolFeeAmount: 0n,
    protocolFeeAmount: 0n,
    issuerApproved: false,
    ceiling: 0n,
    paused: false,
    expired: false,
    receiptFailure: false,
    revert: false,
    pending: false,
    rpcFailure: false,
    apply: true,
    wrongWallet: false,
    wrongChain: false,
    broadcast: 0,
    delivered: 9n,
    eventGross: null as bigint | null,
    eventNominal: null as bigint | null,
    eventInputAmount: null as bigint | null,
    eventRecipient: null as Address | null,
    eventDelivered: null as bigint | null,
    discoveryError: false,
  };
  const authorization: ServiceVoucherAuthorization = {
    version: 2,
    sourceChainId: 42161,
    sourceModule: route.service.source.address,
    coreModule: route.service.core.address,
    commitmentId: 10n,
    termsRevision: 1n,
    termsHash: H,
    claimHash: H,
    requestNonce: 1n,
    buyer: account(5),
    holder: account(5),
    buyerGarden: account(4),
    providerGarden: account(6),
    destinationChainId: 100,
    destinationEscrow: route.service.destination.address,
    issuer: owner,
    token: assets[0]!.token.address,
    voucherUnits: 20n,
    serviceUnits: 2n,
    unitLabelHash: keccak256(stringToHex("test hour")),
    serviceTermsRef: H,
    remedyTermsRef: H,
    acceptanceDeadline: 1200n,
    remedyPolicy: 1,
  };
  const identity = voucherAuthorizationIdentity(authorization);
  let lastCall: ContractCall | undefined;
  let logs: { address: Address; topics: readonly Hex[]; data: Hex }[] = [];
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, value: string) => {
      store.set(k, value);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  const chain: ServiceIssuerChain = {
    code: async (_id, a) =>
      [owner, account(3), account(5), account(9)].includes(a)
        ? "0x"
        : a === account(90)
          ? "0x6002"
          : "0x6001",
    storage: async () => `0x${"0".repeat(24)}${account(90).slice(2)}`,
    balance: async () => 10n,
    timestamp: async () => state.time,
    receipt: async (_id, hash) => {
      if (hash === TX && state.receiptFailure) throw new Error("Lost receipt RPC");
      const proxy = proxies.find((p) => p.receipt.transactionHash === hash);
      return {
        status: hash === TX && state.revert ? "reverted" : "success",
        transactionHash: hash,
        blockNumber: 1n,
        blockHash: H,
        to:
          hash === TX
            ? lastCall!.address
            : proxy
              ? route.factory.address
              : account(Number(BigInt(hash))),
        contractAddress: null,
        logs: proxy
          ? [
              {
                address: route.factory.address,
                topics: exactTopics(
                  encodeEventTopics({
                    abi: ISSUER_FACTORY_ABI,
                    eventName: "Deployed",
                    args: {
                      proxy: proxy.address as `0x${string}`,
                      implementation: proxy.implementation.address as `0x${string}`,
                      admin: proxy.factoryDeployment.admin as `0x${string}`,
                    },
                  })
                ),
                data: "0x",
              },
            ]
          : logs,
      };
    },
    transaction: async (_id, hash) => {
      const proxy = proxies.find((p) => p.receipt.transactionHash === hash);
      if (proxy)
        return {
          from: proxy.factoryDeployment.deployer,
          to: route.factory.address,
          value: 0n,
          input: encodeFunctionData({
            abi: ISSUER_FACTORY_ABI,
            functionName: "deployDeterministicAndCall",
            args: [
              proxy.implementation.address as `0x${string}`,
              proxy.factoryDeployment.admin as `0x${string}`,
              proxy.factoryDeployment.salt,
              proxy.factoryDeployment.initializer,
            ],
          }),
        };
      return {
        from: lastCall!.account!,
        to: lastCall!.address,
        value: 0n,
        input: encodeFunctionData({
          abi: lastCall!.abi,
          functionName: lastCall!.functionName,
          args: lastCall!.args,
        }),
      };
    },
    read: async ({ chainId, address, functionName, args = [] }) => {
      const selected = assets.find((a) => a.token.address === address);
      switch (functionName) {
        case "initCodeHash":
          return INIT;
        case "predictDeterministicAddress":
          return proxies.find((p) => p.factoryDeployment.salt === args[0])!.address;
        case "owner":
          return selected?.ownerReserve ?? account(9);
        case "adminOf":
          return proxies.find((p) => p.address === args[0])!.factoryDeployment.admin;
        case "name":
          return selected!.name;
        case "symbol":
          return selected!.symbol;
        case "decimals":
          return 0;
        case "serviceOfferProtocolVersion":
        case "voucherAcceptanceProtocolVersion":
          return 1;
        case "voucherServiceSetupModule":
          return route.service.source.address;
        case "commitmentPooling":
          return route.service.core.address;
        case "guardian":
          return account(8);
        case "CCIP_ROUTER":
          return account(7);
        case "LOCAL_CHAIN_ID":
          return BigInt(chainId);
        case "remoteChainId":
          return chainId === 100 ? 42161n : 100n;
        case "remoteChainSelector":
          return chainId === 100 ? 14n : 13n;
        case "remotePeer":
          return address === route.adapter.address
            ? route.adapterSource.address
            : address === route.adapterSource.address
              ? route.adapter.address
              : chainId === 100
                ? route.service.source.address
                : route.service.destination.address;
        case "feePolicy":
          return route.pool.feePolicy.address;
        case "feeAddress":
        case "getProtocolFeeRecipient":
          return account(9);
        case "tokenRegistry":
          return route.pool.registry.address;
        case "tokenLimiter":
          return route.pool.limiter.address;
        case "quoter":
          return route.pool.quoter.address;
        case "protocolFeeController":
          return route.pool.protocolFee.address;
        case "feesDecoupled":
        case "have":
        case "isActive":
          return true;
        case "totalMinted":
          return state.minted;
        case "expired":
          return state.expired;
        case "balanceOf":
          return args[0] === route.pool.deployment.address ? state.inventory : state.balance;
        case "allowance":
          return args[1] === route.adapter.address ? state.reserve : state.pool;
        case "assetAuthorizations":
          return decodeFunctionResult({
            abi: AdapterABI,
            functionName: "assetAuthorizations",
            data: encodeFunctionResult({
              abi: AdapterABI,
              functionName: "assetAuthorizations",
              result: [assets[0]!.sourceAuthority as `0x${string}`, state.enabled],
            }),
          });
        case "issuerAuthority":
          return assets[0]!.sourceAuthority;
        case "paused":
          return state.paused;
        case "limitOf":
          return assets[0]!.poolHoldingCap;
        case "getQuote":
          return state.gross;
        case "getAmountOut":
          return state.quote;
        case "getFee":
          return state.poolFee;
        case "getProtocolFee":
          return state.protocolFee;
        case "fees":
          return state.outputFees;
        case "isSealed":
          return true;
        case "getSetupExecution":
          return {
            authorization: encodeAbiParameters(
              [{ type: "bytes32" }, PARAM],
              [keccak256(stringToHex("GREEN_GOODS_VOUCHER_SETUP_AUTHORIZATION_V2")), authorization]
            ),
            result: {
              version: 2,
              setupId: identity.setupId,
              authorizationHash: identity.authorizationHash,
              resultSequence: 1n,
              phase: 1,
              decision: 0,
              issuerApproved: state.issuerApproved,
              depositReceiptHash: ZERO,
              depositedUnits: 0n,
              setupRefundedUnits: 0n,
              appliedDecisionId: ZERO,
              actionSucceeded: true,
              failureHash: ZERO,
            },
            pendingAction: 0,
            decision: 0,
            failureReason: "0x",
            issuerReturnCeiling: state.ceiling,
            holderAbortRequested: false,
            setupAcknowledgment: {},
            finalAcknowledgment: {},
            finalSequence: 0n,
            finalAllocation: {},
          };
        default:
          throw new Error(`Unmodeled external ABI read ${functionName}`);
      }
    },
  };
  let onPrompt = async () => {};
  const sender: TransactionSender = {
    authMode,
    supportsSponsorship: false,
    supportsBatching: false,
    assertOwnership: async (a, id) => {
      if (a !== session.address || state.wrongWallet || id !== 100 || state.wrongChain)
        throw new Error("Wallet ownership/chain mismatch");
    },
    sendContractCall: vi.fn(async (call, options) => {
      await options?.assertOwnership?.();
      await onPrompt();
      await options?.onBeforeBroadcast?.(
        authMode === "passkey" ? { kind: "user-operation", hash: TX, chainId: 100 } : undefined
      );
      lastCall = call;
      state.broadcast++;
      await options?.onBroadcastReference?.(
        authMode === "passkey"
          ? { kind: "user-operation", hash: TX, chainId: 100 }
          : { kind: "transaction", hash: TX, chainId: 100, account: call.account }
      );
      logs = [];
      if (state.apply && !state.revert) {
        if (call.functionName === "mintTo") {
          state.minted += call.args[1] as bigint;
          state.balance += call.args[1] as bigint;
          logs = [
            {
              address: call.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: erc20Abi,
                  eventName: "Transfer",
                  args: { from: account(0), to: call.args[0] as `0x${string}` },
                })
              ),
              data: encodeAbiParameters([{ type: "uint256" }], [call.args[1] as bigint]),
            },
          ];
        }
        if (call.functionName === "approve") {
          if (call.args[0] === route.adapter.address) state.reserve = call.args[1] as bigint;
          else state.pool = call.args[1] as bigint;
          logs = [
            {
              address: call.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: erc20Abi,
                  eventName: "Approval",
                  args: {
                    owner: call.account as `0x${string}`,
                    spender: call.args[0] as `0x${string}`,
                  },
                })
              ),
              data: encodeAbiParameters([{ type: "uint256" }], [call.args[1] as bigint]),
            },
          ];
        }
        if (call.functionName === "configureAsset") {
          state.enabled = call.args[2] as boolean;
          logs = [
            {
              address: call.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: AdapterABI,
                  eventName: "AssetConfigured",
                  args: {
                    issuer: call.account as `0x${string}`,
                    token: call.args[0] as `0x${string}`,
                    issuerAuthority: call.args[1] as `0x${string}`,
                  },
                })
              ),
              data: encodeAbiParameters([{ type: "bool" }], [call.args[2] as boolean]),
            },
          ];
        }
        if (call.functionName === "approveSetupAuthorization") {
          state.issuerApproved = true;
          logs = [
            {
              address: call.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: BookingEventsABI,
                  eventName: "RedemptionIssuerApproved",
                  args: {
                    redemptionId: call.args[0] as Hex,
                    issuer: call.account as `0x${string}`,
                    payloadHash: call.args[1] as Hex,
                  },
                })
              ),
              data: "0x",
            },
          ];
        }
        if (call.functionName === "authorizeReturn") {
          state.ceiling = call.args[2] as bigint;
          logs = [
            {
              address: call.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: BookingEventsABI,
                  eventName: "RedemptionReturnAuthorized",
                  args: {
                    redemptionId: call.args[0] as Hex,
                    issuer: call.account as `0x${string}`,
                  },
                })
              ),
              data: encodeAbiParameters([{ type: "uint256" }], [call.args[2] as bigint]),
            },
          ];
        }
        if (call.functionName === "withdraw") {
          state.pool = 0n;
          logs = [
            {
              address: route.pool.deployment.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: PoolABI,
                  eventName: "SwapSettlement",
                  args: {
                    initiator: actor.address,
                    tokenIn: assets[0]!.token.address,
                    tokenOut: assets[1]!.token.address,
                  },
                })
              ),
              data: encodeAbiParameters(
                [
                  { type: "uint256" },
                  { type: "uint256" },
                  { type: "uint256" },
                  { type: "uint256" },
                  { type: "uint256" },
                  { type: "uint256" },
                ],
                [
                  state.eventInputAmount ?? (call.args[2] as bigint),
                  state.eventGross ?? state.gross,
                  state.eventNominal ?? state.quote,
                  state.eventDelivered ?? state.delivered,
                  state.poolFeeAmount,
                  state.protocolFeeAmount,
                ]
              ),
            },
            {
              address: assets[1]!.token.address,
              topics: exactTopics(
                encodeEventTopics({
                  abi: erc20Abi,
                  eventName: "Transfer",
                  args: {
                    from: route.pool.deployment.address,
                    to: (state.eventRecipient ?? actor.address) as `0x${string}`,
                  },
                })
              ),
              data: encodeAbiParameters([{ type: "uint256" }], [state.delivered]),
            },
          ];
        }
      }
      if (state.rpcFailure) throw new Error("RPC response lost after broadcast");
      return {
        hash: TX,
        sponsored: false,
        ...(state.pending ? { confirmation: "pending" as const } : {}),
      };
    }),
  };
  const hints: unknown[] = [];
  const bookingsReader = {
    query: vi.fn(async () =>
      state.discoveryError
        ? { error: new Error("Indexer unavailable") }
        : { data: { VoucherServiceCustody: hints } }
    ),
  } as GraphQLReader;
  const hint = {
    id: `100-${route.service.destination.address}-${identity.setupId}`,
    chainId: 100,
    moduleAddress: route.service.destination.address,
    setupId: identity.setupId,
    issuer: owner,
    token: assets[0]!.token.address,
    holder: authorization.holder,
    authorizationSeen: true,
    authorizationHash: identity.authorizationHash,
  };
  const create = (routes = [route]) =>
    createServiceIssuerOperations({
      session: () => session,
      sender: () => sender,
      routes,
      chain,
      storage,
      bookingsReader,
    });
  return {
    route,
    assets,
    actor,
    session,
    state,
    identity,
    authorization,
    sender,
    chain,
    store,
    hints,
    hint,
    bookingsReader,
    proxies,
    storage,
    create,
    prompt: (fn: () => Promise<void>) => {
      onPrompt = fn;
    },
    get lastCall() {
      return lastCall;
    },
    clearLogs: () => {
      logs = [];
    },
    scopeLogs: (kind: "own" | "foreign" | "wrong-sender") => {
      const boundary = (hash: Hex, sender: Address) => ({
        address: entryPoint07Address as Address,
        topics: exactTopics(
          encodeEventTopics({
            abi: entryPoint07Abi,
            eventName: "UserOperationEvent",
            args: { userOpHash: hash, sender, paymaster: account(0) },
          })
        ),
        data: encodeAbiParameters(
          [{ type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
          [0n, true, 1n, 1n]
        ),
      });
      const own = boundary(TX, kind === "wrong-sender" ? account(5) : actor.address);
      logs = kind === "foreign" ? [...logs, boundary(H, actor.address), own] : [...logs, own];
    },
  };
}
const exchange: ServiceIssuerAction = {
  kind: "exchange",
  outputAssetId: "analysis",
  amount: 10n,
  quotedOutput: 9n,
  minimumOutput: 8n,
  deadline: 1100n,
};

describe("member-owned service operations", () => {
  it("retains wallet fallback checks when mutable auth mode is temporarily changed during ownership", async () => {
    const f = fixture();
    const original = f.sender.assertOwnership!;
    f.sender.assertOwnership = async (...args) => {
      await original(...args);
      f.session.authMode = "passkey";
    };
    let sessionReads = 0;
    const session = () => {
      if (sessionReads++ > 0) f.session.authMode = "wallet";
      return f.session;
    };
    f.chain.code = vi.fn(async () => "0x6001" as const);
    await expect(
      assertServiceActor(f.actor.address, 100, 42161, session, f.sender, f.chain)
    ).rejects.toThrow("member-owned EOA");
    expect(f.chain.code).toHaveBeenCalledWith(42161, f.actor.address);
    expect(f.chain.code).toHaveBeenCalledWith(100, f.actor.address);
    expect(f.state.broadcast).toBe(0);
  });
  it.each([
    "online",
    "account",
    "generation",
  ])("rejects post-await %s drift even when the session port returns a mutable object", async (kind) => {
    const f = fixture();
    const original = f.sender.assertOwnership!;
    f.sender.assertOwnership = async (...args) => {
      await original(...args);
      if (kind === "online") f.session.online = false;
      if (kind === "account") f.session.address = account(3);
      if (kind === "generation") f.session.generation++;
    };
    await expect(
      assertServiceActor(f.actor.address, 100, 42161, () => f.session, f.sender, f.chain)
    ).rejects.toThrow("session changed");
    expect(f.state.broadcast).toBe(0);
  });
  it("does not accept a recomputed review fingerprint as permission for an unbounded expiry", async () => {
    const f = fixture();
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    review.expiresAt = 10_000n;
    review.fingerprint = issuerReviewFingerprint(review);
    await expect(ops.execute(review)).rejects.toThrow("bounded window");
    expect(f.state.broadcast).toBe(0);
  });
  it("confirms exact finite approval even when earned distribution consumed it before reconciliation", async () => {
    const f = fixture();
    f.state.pending = true;
    const ops = f.create();
    await ops.execute(await ops.review(f.actor, { kind: "approveReserve", amount: 40n }));
    f.state.reserve = 0n;
    f.state.balance -= 40n;
    expect(await f.create().reconcile(f.actor)).toMatchObject({
      status: "confirmed",
      currentStateMatchesReceipt: false,
    });
    expect(ops.pending(f.actor)).toBeNull();
    expect(f.state.broadcast).toBe(1);
  });
  it("confirms exact mint receipt even when the member has already spent its resulting balance", async () => {
    const f = fixture();
    f.state.pending = true;
    const ops = f.create();
    await ops.execute(await ops.review(f.actor, { kind: "issue", amount: 1n }));
    f.state.balance = 0n;
    expect(await ops.reconcile(f.actor)).toMatchObject({
      status: "confirmed",
      currentStateMatchesReceipt: false,
    });
    expect(ops.pending(f.actor)).toBeNull();
    expect(f.state.broadcast).toBe(1);
  });
  it("does not credit another UserOperation's mint event during reconciliation", async () => {
    const f = fixture("passkey");
    f.state.pending = true;
    const ops = f.create();
    await ops.execute(await ops.review(f.actor, { kind: "issue", amount: 1n }));
    f.scopeLogs("foreign");
    f.sender.reconcileBroadcast = async () => ({ status: "confirmed", transactionHash: TX });
    await expect(ops.reconcile(f.actor)).rejects.toThrow("receipt effect");
    expect(ops.pending(f.actor)).not.toBeNull();
  });
  it.each([
    11n,
    8n,
  ])("confirms observed output %s within signed minimum despite a changed mined quote", async (output) => {
    const f = fixture();
    f.state.pool = 10n;
    f.state.eventGross = output;
    f.state.eventNominal = output;
    f.state.delivered = output;
    const ops = f.create();
    const review = await ops.review(f.actor, exchange);
    expect(await ops.execute(review)).toEqual({
      status: "confirmed",
      transactionHash: TX,
      currentStateMatchesReceipt: true,
      deliveredOutput: output,
    });
    expect(f.state.broadcast).toBe(1);
  });
  it.each([
    "below-minimum",
    "input",
    "recipient",
  ])("retains the receipt when observed %s is outside the exact signed bounds", async (kind) => {
    const f = fixture();
    f.state.pool = 10n;
    if (kind === "below-minimum") {
      f.state.eventGross = 7n;
      f.state.eventNominal = 7n;
      f.state.delivered = 7n;
    }
    if (kind === "input") f.state.eventInputAmount = 11n;
    if (kind === "recipient") f.state.eventRecipient = account(5);
    const ops = f.create();
    const review = await ops.review(f.actor, exchange);
    await expect(ops.execute(review)).rejects.toThrow("delivery");
    await expect(ops.execute(review)).rejects.toThrow("Pending issuer");
    expect(f.state.broadcast).toBe(1);
  });
  it("accepts actual-shaped Factory creation with null contractAddress and exact CREATE2/event evidence", async () => {
    const f = fixture();
    const pin = f.assets[0]!.token;
    expect(await f.chain.receipt(100, pin.receipt.transactionHash)).toMatchObject({
      to: f.route.factory.address,
      contractAddress: null,
    });
    await expect(
      verifyIssuerProxyDeployment(pin, f.route.factory, f.chain)
    ).resolves.toBeUndefined();
  });
  it.each([
    "input",
    "event",
    "admin",
    "runtime",
  ])("rejects Factory %s mismatch rather than accepting receipt metadata alone", async (kind) => {
    const f = fixture();
    const pin = f.assets[0]!.token;
    if (kind === "input") {
      const original = f.chain.transaction;
      vi.spyOn(f.chain, "transaction").mockImplementation(async (...args) => ({
        ...(await original(...args)),
        input: "0x1234",
      }));
    }
    if (kind === "event") {
      const original = f.chain.receipt;
      vi.spyOn(f.chain, "receipt").mockImplementation(async (...args) => ({
        ...(await original(...args)),
        logs: [],
      }));
    }
    if (kind === "admin") {
      const original = f.chain.read;
      vi.spyOn(f.chain, "read").mockImplementation(async (input) =>
        input.functionName === "adminOf" ? account(99) : original(input)
      );
    }
    if (kind === "runtime") {
      const original = f.chain.code;
      vi.spyOn(f.chain, "code").mockImplementation(async (id, a) =>
        a === pin.address ? "0x6003" : original(id, a)
      );
    }
    await expect(verifyIssuerProxyDeployment(pin, f.route.factory, f.chain)).rejects.toThrow();
  });
  it("requires the exact member token initializer instead of adopting a different owner recipe", async () => {
    const f = fixture();
    f.assets[0]!.token.factoryDeployment.initializer = "0x1234";
    await expect(f.create().review(f.actor, { kind: "issue", amount: 1n })).rejects.toThrow(
      "initializer"
    );
  });
  it("preserves actual bookings and bounded return permission when new issuance capacity is suspended", async () => {
    const f = fixture();
    f.hints.push(f.hint);
    f.state.issuerApproved = true;
    f.assets[0]!.service.capacityConfirmed = false;
    expect(await f.create().read(f.actor)).toMatchObject({
      bookings: {
        status: "observed",
        records: [{ approvalEligible: false, returnEligible: true }],
      },
    });
    await f.create().execute(
      await f.create().review(f.actor, {
        kind: "authorizeReturn",
        setupId: f.identity.setupId,
        authorizationHash: f.identity.authorizationHash,
        ceiling: 5n,
      })
    );
    expect(f.state.ceiling).toBe(5n);
  });
  it("keeps historical booking facts visible without relabeling changed service terms", async () => {
    const f = fixture();
    f.hints.push(f.hint);
    f.assets[0]!.service.unit = "different test unit";
    expect(await f.create().read(f.actor)).toMatchObject({
      bookings: {
        status: "observed",
        records: [{ reviewedTermsMatch: false, approvalEligible: false, returnEligible: false }],
      },
    });
    await expect(
      f.create().review(f.actor, {
        kind: "approveBooking",
        setupId: f.identity.setupId,
        authorizationHash: f.identity.authorizationHash,
      })
    ).rejects.toThrow("terms");
    f.state.issuerApproved = true;
    expect(await f.create().read(f.actor)).toMatchObject({
      bookings: { records: [{ reviewedTermsMatch: false, returnEligible: true }] },
    });
    await f.create().execute(
      await f.create().review(f.actor, {
        kind: "authorizeReturn",
        setupId: f.identity.setupId,
        authorizationHash: f.identity.authorizationHash,
        ceiling: 5n,
      })
    );
    expect(f.state.ceiling).toBe(5n);
  });
  it("allows member reserve configuration and disabling while transport is paused", async () => {
    const f = fixture();
    f.state.paused = true;
    f.state.reserve = 40n;
    const ops = f.create();
    await ops.execute(await ops.review(f.actor, { kind: "configureReserve", enabled: true }));
    expect(f.state.enabled).toBe(true);
    f.assets[0]!.service.capacityConfirmed = false;
    await ops.execute(await ops.review(f.actor, { kind: "configureReserve", enabled: false }));
    expect(f.state.enabled).toBe(false);
  });
  it("binds positive-fee gross/net/actual output separately, as the pinned binary conformance proved", async () => {
    const f = fixture();
    Object.assign(f.state, {
      pool: 10_000_000n,
      balance: 100_000_000n,
      inventory: 100_000_000n,
      gross: 10_000_000n,
      quote: 8_900_000n,
      delivered: 8_900_000n,
      poolFee: 100_000n,
      protocolFee: 100_000n,
      poolFeeAmount: 1_000_000n,
      protocolFeeAmount: 100_000n,
    });
    f.assets[0]!.poolHoldingCap = 200_000_000n;
    const ops = f.create();
    const quote = await ops.quote(f.actor, "analysis", 10_000_000n);
    expect(quote).toMatchObject({ grossOutput: 10_000_000n, quotedOutput: 8_900_000n });
    expect(
      (
        await ops.execute(
          await ops.review(f.actor, {
            ...exchange,
            amount: 10_000_000n,
            quotedOutput: 8_900_000n,
            minimumOutput: 8_900_000n,
          })
        )
      ).status
    ).toBe("confirmed");
  });
  it("normalizes real ABI checksum output when reading back exact reserve authorization", async () => {
    const f = fixture();
    f.assets[0]!.sourceAuthority = account(0xabcd);
    f.state.reserve = 40n;
    const ops = f.create();
    expect(
      (await ops.execute(await ops.review(f.actor, { kind: "configureReserve", enabled: true })))
        .status
    ).toBe("confirmed");
  });
  it("reserves output fees before testing gross liquidity rather than comparing raw balance with net output", async () => {
    const f = fixture();
    f.state.pool = 10n;
    f.state.inventory = 91n;
    f.state.outputFees = 1n;
    f.state.gross = 91n;
    f.state.quote = 80n;
    f.state.poolFee = 1n;
    await expect(f.create().quote(f.actor, "analysis", 10n)).rejects.toThrow("liquidity");
    await expect(
      f.create().review(f.actor, { ...exchange, quotedOutput: 80n, minimumOutput: 80n })
    ).rejects.toThrow("inventory");
  });
  it("serializes old pending P reconciliation against another reconciler and a new Q send", async () => {
    const f = fixture();
    const a = f.create();
    f.state.pending = true;
    await a.execute(await a.review(f.actor, { kind: "issue", amount: 1n }));
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = f.chain.receipt;
    vi.spyOn(f.chain, "receipt").mockImplementation(async (id, hash) => {
      if (hash === TX) {
        entered();
        await gate;
      }
      return original(id, hash);
    });
    const b = a.reconcile(f.actor);
    await waiting;
    const attempts = Promise.allSettled([
      f.create().reconcile(f.actor),
      a.execute(a.pending(f.actor)!.review),
    ]);
    release();
    for (const attempt of await attempts) {
      expect(attempt.status).toBe("rejected");
      if (attempt.status === "rejected") expect(attempt.reason.message).toContain("already active");
    }
    expect((await b)?.status).toBe("confirmed");
  });
  it("cannot let delayed B completion of old P delete a newly persisted Q after A confirmed P", async () => {
    const f = fixture();
    const a = f.create();
    f.state.pending = true;
    await a.execute(await a.review(f.actor, { kind: "issue", amount: 1n }));
    const oldP = a.pending(f.actor)!; // B's old read, before A completes.
    expect((await a.reconcile(f.actor))?.status).toBe("confirmed");
    await a.execute(await a.review(f.actor, { kind: "issue", amount: 2n }));
    createIssuerPendingStore(() => f.storage).clear(oldP); // Delayed B cannot clear Q.
    expect(a.pending(f.actor)?.review.action).toEqual({ kind: "issue", amount: 2n });
    expect(f.state.broadcast).toBe(2);
  });
  it("quotes the actual bounded pool read and never infers a one-to-one rate", async () => {
    const f = fixture();
    const quote = await f.create().quote(f.actor, "analysis", 10n);
    expect(quote).toEqual({
      outputAssetId: "analysis",
      amount: 10n,
      quotedOutput: 9n,
      grossOutput: 9n,
      reservedOutputFees: 0n,
      observedAt: 1000n,
      expiresAt: 1300n,
    });
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("discovers issuer bookings with four exact filters and revalidates custody onchain", async () => {
    const f = fixture();
    f.hints.push(f.hint);
    const snapshot = await f.create().read(f.actor);
    expect(snapshot).toMatchObject({
      bookings: {
        status: "observed",
        completeness: "unknown",
        records: [
          {
            setupId: f.identity.setupId,
            authorizationHash: f.identity.authorizationHash,
            approvalEligible: true,
            returnEligible: false,
          },
        ],
      },
    });
    expect(f.bookingsReader.query).toHaveBeenCalledWith(
      expect.stringContaining("authorizationSeen: {_eq: true}"),
      {
        chain: 100,
        escrow: f.route.service.destination.address,
        issuer: f.actor.address,
        token: f.assets[0]!.token.address.toLowerCase(),
      },
      "discoverIssuerVoucherSetups"
    );
  });
  it.each([
    "indexer",
    "canonical",
    "holder",
  ])("retains %s discovery uncertainty without invented obligations", async (kind) => {
    const f = fixture();
    f.hints.push({
      ...f.hint,
      ...(kind === "canonical"
        ? { authorizationHash: H }
        : kind === "holder"
          ? { holder: account(3) }
          : {}),
    });
    f.state.discoveryError = kind === "indexer";
    expect(await f.create().read(f.actor)).toMatchObject({
      bookings: {
        status: kind === "indexer" ? "unavailable" : "partial",
        completeness: "unknown",
        records: [],
      },
    });
  });
  it.each([
    "chainId",
    "moduleAddress",
    "issuer",
    "token",
    "authorizationSeen",
  ])("rejects an indexed %s scope bypass", async (field) => {
    const f = fixture();
    f.hints.push({
      ...f.hint,
      [field]: field === "chainId" ? 42161 : field === "authorizationSeen" ? false : account(99),
    });
    await expect(
      discoverIssuerVoucherSetups(
        {
          chainId: 100,
          escrow: f.route.service.destination.address,
          issuer: f.actor.address,
          token: f.assets[0]!.token.address,
        },
        f.bookingsReader
      )
    ).rejects.toThrow();
  });
  it("labels bounded discovery partial without claiming an issuer-wide total", async () => {
    const f = fixture();
    for (let i = 1; i <= 101; i++) {
      const id = `0x${i.toString(16).padStart(64, "0")}` as Hex;
      f.hints.push({
        ...f.hint,
        setupId: id,
        id: `100-${f.route.service.destination.address}-${id}`,
      });
    }
    const discovered = await discoverIssuerVoucherSetups(
      {
        chainId: 100,
        escrow: f.route.service.destination.address,
        issuer: f.actor.address,
        token: f.assets[0]!.token.address,
      },
      f.bookingsReader
    );
    expect(discovered.partial).toBe(true);
    expect(discovered.records).toHaveLength(100);
  });
  it("keeps explicit reviewed metadata through a public JSON round trip", () => {
    const f = fixture();
    expect(issuerDeserialize(issuerSerialize(f.route))).toEqual(f.route);
    expect(f.route.assets[0]!.kind).toBe("individual");
  });
  it("holds missing receipt-backed routes without RPC or invented zero balances", async () => {
    const f = fixture();
    const code = vi.spyOn(f.chain, "code");
    expect(await f.create([]).read(f.actor)).toEqual({
      evidence: "unavailable",
      reason: "unconfigured",
    });
    await expect(f.create([]).review(f.actor, { kind: "issue", amount: 1n })).rejects.toThrow(
      "configuration"
    );
    expect(code).not.toHaveBeenCalled();
  });
  it("distinguishes held service access from issuer reserve and never invents services owed", async () => {
    const f = fixture();
    expect(await f.create().read(f.actor)).toMatchObject({
      evidence: "onchain",
      holdingBalance: 100n,
      issuerReserveBalance: 100n,
    });
    expect(await f.create().read({ ...f.actor, address: account(5) })).toMatchObject({
      holdingBalance: 100n,
      issuerReserveBalance: null,
      reserveAllowance: null,
    });
  });
  it("reads the token's pool listing apart from any review, including a delisted zero limit", async () => {
    const f = fixture();
    expect(await f.create().read(f.actor)).toMatchObject({
      pool: { admitted: true, limit: f.assets[0]!.poolHoldingCap, holding: 100n },
    });
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    const original = f.chain.read;
    vi.spyOn(f.chain, "read").mockImplementation(async (input) =>
      input.functionName === "limitOf" ? 0n : original(input)
    );
    expect(await ops.read(f.actor)).toMatchObject({
      pool: { admitted: true, limit: 0n, holding: 100n },
    });
    // A pool change alone leaves an open review on the member's own reserve intact.
    await expect(ops.execute(review)).resolves.toMatchObject({ status: "confirmed" });
  });
  it.each([
    "missing unit",
    "unconfirmed capacity",
    "missing consent",
    "unknown control",
  ])("blocks %s without treating metadata as actual approval", async (kind) => {
    const f = fixture();
    if (kind === "missing unit") f.assets[0]!.service.unit = "";
    if (kind === "unconfirmed capacity") f.assets[0]!.service.capacityConfirmed = false;
    if (kind === "missing consent") f.assets[0]!.service.approval.reference = "";
    if (kind === "unknown control")
      Object.assign(f.assets[0]!.upgradeControl, { kind: "administrator" });
    await expect(f.create().review(f.actor, { kind: "issue", amount: 1n })).rejects.toThrow(
      "Reviewed issuer"
    );
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });
  it.each([
    account(3),
    account(9),
  ])("rejects another member or steward %s as issuer", async (other) => {
    const f = fixture();
    f.session.address = other;
    await expect(
      f.create().review({ ...f.actor, address: other }, { kind: "issue", amount: 1n })
    ).rejects.toThrow("owning member");
  });
  it("issues only to the owning member within the remaining reviewed supply", async () => {
    const f = fixture();
    const ops = f.create();
    await expect(ops.review(f.actor, { kind: "issue", amount: 901n })).rejects.toThrow(
      "finite supply"
    );
    const review = await ops.review(f.actor, { kind: "issue", amount: 100n });
    expect(review.call.args).toEqual([f.actor.address, 100n]);
    expect(await ops.execute(review)).toEqual({
      status: "confirmed",
      transactionHash: TX,
      currentStateMatchesReceipt: true,
    });
    expect(f.state.minted).toBe(200n);
    expect(ops.pending(f.actor)).toBeNull();
  });
  it.each([
    "wrongWallet",
    "wrongChain",
  ] as const)("checks fresh %s before a prompt", async (field) => {
    const f = fixture();
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    f.state[field] = true;
    await expect(ops.execute(review)).rejects.toThrow("mismatch");
    expect(f.state.broadcast).toBe(0);
  });
  it.each([
    "account",
    "session",
    "terms",
    "expiry",
    "chain",
  ])("rejects %s changed during the prompt", async (kind) => {
    const f = fixture();
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    f.prompt(async () => {
      if (kind === "account") f.session.address = account(3);
      if (kind === "session") f.session.generation++;
      if (kind === "terms") f.assets[0]!.service.approval.reference = "ipfs://changed";
      if (kind === "expiry") f.state.time = 1400n;
      if (kind === "chain") f.state.wrongChain = true;
    });
    await expect(ops.execute(review)).rejects.toThrow();
    expect(f.state.broadcast).toBe(0);
    expect(ops.pending(f.actor)).toBeNull();
  });
  it("clears a declined prompt and allows only a new explicit attempt", async () => {
    const f = fixture();
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    f.prompt(async () => {
      throw Object.assign(new Error("Declined"), { code: 4001 });
    });
    await expect(ops.execute(review)).rejects.toThrow("Declined");
    expect(ops.pending(f.actor)).toBeNull();
    expect(f.state.broadcast).toBe(0);
  });
  it("persists before RPC and prevents duplicate issuance after response loss and reload", async () => {
    const f = fixture();
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    f.state.rpcFailure = true;
    expect((await ops.execute(review)).status).toBe("pending");
    const restored = f.create();
    expect(restored.pending(f.actor)?.submission?.hash).toBe(TX);
    await expect(restored.execute(review)).rejects.toThrow("Pending issuer");
    f.state.receiptFailure = true;
    expect((await restored.reconcile(f.actor))?.status).toBe("pending");
    expect(f.state.broadcast).toBe(1);
    f.state.receiptFailure = false;
    f.state.minted++;
    f.state.balance++;
    expect((await restored.reconcile(f.actor))?.status).toBe("confirmed");
    expect(restored.pending(f.actor)).toBeNull();
  });
  it("keeps ambiguous mined readback and does not resend", async () => {
    const f = fixture();
    f.state.apply = false;
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    await expect(ops.execute(review)).rejects.toThrow("reconciliation");
    expect(ops.pending(f.actor)).not.toBeNull();
    await expect(ops.execute(review)).rejects.toThrow("Pending issuer");
    expect(f.state.broadcast).toBe(1);
  });
  it("proves receipt failure before clearing a pending attempt for explicit retry", async () => {
    const f = fixture();
    f.state.revert = true;
    const ops = f.create();
    const review = await ops.review(f.actor, { kind: "issue", amount: 1n });
    await expect(ops.execute(review)).rejects.toBeInstanceOf(TransactionRevertedError);
    expect(ops.pending(f.actor)).toBeNull();
    f.state.revert = false;
    expect(
      (await ops.execute(await ops.review(f.actor, { kind: "issue", amount: 1n }))).status
    ).toBe("confirmed");
  });
  it("requires finite zero-first reserve approval and separates configuration from approval", async () => {
    const f = fixture();
    const ops = f.create();
    await expect(
      ops.review(f.actor, { kind: "approveReserve", amount: (1n << 256n) - 1n })
    ).rejects.toThrow("Finite approval");
    await expect(ops.review(f.actor, { kind: "configureReserve", enabled: true })).rejects.toThrow(
      "finite member allowance"
    );
    await ops.execute(await ops.review(f.actor, { kind: "approveReserve", amount: 40n }));
    expect(f.state.reserve).toBe(40n);
    expect(f.state.enabled).toBe(false);
    await expect(ops.review(f.actor, { kind: "approveReserve", amount: 30n })).rejects.toThrow(
      "zero allowance"
    );
    await ops.execute(await ops.review(f.actor, { kind: "configureReserve", enabled: true }));
    expect(f.state.enabled).toBe(true);
  });
  it("requires an explicit revoke action instead of a zero-sized approval", async () => {
    const f = fixture();
    await expect(
      f.create().review(f.actor, { kind: "approveReserve", amount: 0n })
    ).rejects.toThrow("Finite approval");
    await expect(
      f.create().review(f.actor, { kind: "approveExchange", amount: 0n })
    ).rejects.toThrow("Finite approval");
  });
  it("keeps bounded revoke available after partial approval even if business terms become ineligible", async () => {
    const f = fixture();
    const ops = f.create();
    await ops.execute(await ops.review(f.actor, { kind: "approveReserve", amount: 40n }));
    f.assets[0]!.service.capacityConfirmed = false;
    f.state.expired = true;
    f.state.paused = true;
    await ops.execute(await ops.review(f.actor, { kind: "revokeReserve" }));
    expect(f.state.reserve).toBe(0n);
  });
  it("binds exact booking consent and a monotone bounded return ceiling", async () => {
    const f = fixture();
    const ops = f.create();
    const bound = { setupId: f.identity.setupId, authorizationHash: f.identity.authorizationHash };
    await expect(
      ops.review(f.actor, { kind: "authorizeReturn", ...bound, ceiling: 5n })
    ).rejects.toThrow("bounded ceiling");
    await expect(
      ops.review(f.actor, { kind: "approveBooking", ...bound, authorizationHash: H })
    ).rejects.toThrow("authorization changed");
    await ops.execute(await ops.review(f.actor, { kind: "approveBooking", ...bound }));
    expect(f.state.issuerApproved).toBe(true);
    await expect(
      ops.review(f.actor, { kind: "authorizeReturn", ...bound, ceiling: 21n })
    ).rejects.toThrow("bounded ceiling");
    await ops.execute(
      await ops.review(f.actor, { kind: "authorizeReturn", ...bound, ceiling: 5n })
    );
    expect(f.state.ceiling).toBe(5n);
  });
  it.each([
    "quote",
    "minimum",
    "deadline",
    "allowance",
  ])("rejects stale exchange %s without inferring a conversion rate", async (kind) => {
    const f = fixture();
    f.state.pool = 10n;
    const action = { ...exchange };
    if (kind === "quote") f.state.quote = 10n;
    if (kind === "minimum") action.minimumOutput = 10n;
    if (kind === "deadline") action.deadline = 1000n;
    if (kind === "allowance") f.state.pool = 11n;
    await expect(f.create().review(f.actor, action)).rejects.toThrow();
    expect(f.state.broadcast).toBe(0);
  });
  it("executes exact holder exchange separately and requires actual settlement plus delivery", async () => {
    const f = fixture();
    const ops = f.create();
    await ops.execute(await ops.review(f.actor, { kind: "approveExchange", amount: 10n }));
    const r = await ops.review(f.actor, exchange);
    expect(r.call.args).toEqual([
      f.assets[1]!.token.address,
      f.assets[0]!.token.address,
      10n,
      f.actor.address,
      8n,
      1100n,
    ]);
    expect((await ops.execute(r)).status).toBe("confirmed");
    expect(f.state.pool).toBe(0n);
  });
  it("does not clear a swap whose mined receipt lacks the exact output delivery", async () => {
    const f = fixture();
    f.state.pool = 10n;
    f.state.pending = true;
    const ops = f.create();
    expect((await ops.execute(await ops.review(f.actor, exchange))).status).toBe("pending");
    f.clearLogs();
    await expect(ops.reconcile(f.actor)).rejects.toThrow("delivery");
    expect(ops.pending(f.actor)).not.toBeNull();
  });
  it("requires delivery of the settlement's actual output, beyond the minimum protection", async () => {
    const f = fixture();
    f.state.pool = 10n;
    f.state.delivered = 8n;
    f.state.eventDelivered = 9n;
    const ops = f.create();
    await expect(ops.execute(await ops.review(f.actor, exchange))).rejects.toThrow("delivery");
    expect(ops.pending(f.actor)).not.toBeNull();
  });
  it.each([
    "own",
    "foreign",
    "wrong-sender",
  ] as const)("scopes passkey exchange settlement to %s operation logs", async (kind) => {
    const f = fixture("passkey");
    f.state.pool = 10n;
    f.state.pending = true;
    const ops = f.create();
    expect((await ops.execute(await ops.review(f.actor, exchange))).status).toBe("pending");
    f.scopeLogs(kind);
    if (kind === "own") expect((await ops.reconcile(f.actor))?.status).toBe("pending");
    // The generic sender must first establish this UserOperation's canonical transaction.
    f.sender.reconcileBroadcast = async () => ({
      status: "confirmed",
      transactionHash: TX,
      currentStateMatchesReceipt: true,
    });
    if (kind === "own") expect((await ops.reconcile(f.actor))?.status).toBe("confirmed");
    else {
      await expect(ops.reconcile(f.actor)).rejects.toThrow();
      expect(ops.pending(f.actor)).not.toBeNull();
    }
  });
  it("prepares owner Safe governance drafts without granting the steward or member admission authority", () => {
    const f = fixture();
    const drafts = serviceIssuerGovernanceDrafts(f.route, f.actor.assetId);
    expect(drafts.map((d) => [d.kind, d.call.functionName, d.owner])).toEqual([
      ["owner-safe-draft", "setIssuerAuthority", account(9)],
      ["owner-safe-draft", "register", account(9)],
      ["owner-safe-draft", "setLimitFor", account(9)],
      ["owner-safe-draft", "setPriceIndexValue", account(9)],
    ]);
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });
  it("prepares delisting as a zero pool holding limit that leaves balances, bookings and authority alone", () => {
    const f = fixture();
    // Delisting must stay possible when the reviewed terms no longer pass for new issuance.
    f.route.assets[0]!.service.capacityConfirmed = false;
    const draft = serviceIssuerDelistingDraft(f.route, f.actor.assetId);
    expect(draft).toMatchObject({
      kind: "owner-safe-draft",
      purpose: "pool-delist",
      owner: f.route.pool.limiter.owner,
    });
    expect(draft.call).toMatchObject({
      address: f.route.pool.limiter.address,
      account: f.route.pool.limiter.owner,
      chainId: 100,
      value: 0n,
      functionName: "setLimitFor",
      args: [f.route.assets[0]!.token.address, f.route.pool.deployment.address, 0n],
    });
    const untouched = [
      f.route.assets[0]!.token.address,
      f.route.pool.registry.address,
      f.route.pool.deployment.address,
      f.route.service.destination.address,
      f.route.adapter.address,
      f.route.adapterSource.address,
    ];
    expect(untouched).not.toContain(draft.call.address);
    expect(f.sender.sendContractCall).not.toHaveBeenCalled();
  });
});
