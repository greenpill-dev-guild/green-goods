import type { ServiceIssuerRoute } from "@green-goods/shared/commitment-pooling";
import type { Address } from "@green-goods/shared/types/domain";
import { getAddress, type Hex } from "viem";

const account = (n: number): Address =>
  getAddress(`0x${n.toString(16).padStart(40, "0")}`) as Address;
const digest = (n: number): Hex => `0x${n.toString(16).padStart(64, "0")}`;
const member = account(1),
  ownerSafe = account(2),
  guardian = account(3),
  router = account(4);
type ServiceDeploymentPin = ServiceIssuerRoute["assets"][number]["token"];
const pin = (n: number, owner = ownerSafe): ServiceDeploymentPin => ({
  address: account(n),
  owner,
  runtimeCodeHash: digest(n),
  implementation: { address: account(n + 100), runtimeCodeHash: digest(n + 100) },
  receipt: { transactionHash: digest(n + 200), blockHash: digest(n + 300), blockNumber: 1n },
  factoryDeployment: { deployer: account(8), admin: owner, salt: digest(n), initializer: "0x" },
});

/** Fictional metadata only; never imported by the live issuer catalog. */
export function voucherIssuerStoryRoute(): ServiceIssuerRoute {
  const token = pin(10, member);
  return {
    service: {
      id: "fictional-member-issuer",
      revision: 1,
      sourceChainId: 42161,
      core: pin(11),
      source: { ...pin(12), guardian, router, remoteSelector: 100n },
      destination: { ...pin(13), guardian, router, remoteSelector: 42161n },
      assets: [
        {
          token: token.address,
          issuer: member,
          symbol: "DEMO",
          decimals: 6,
          runtimeCodeHash: token.runtimeCodeHash,
          implementation: token.implementation,
        },
      ],
      buyerGardens: [],
    },
    factory: { address: account(14), runtimeCodeHash: digest(14) },
    adapterSource: { ...pin(15), guardian, router, remoteSelector: 100n },
    adapter: { ...pin(16), guardian, router, sourcePeer: account(15), sourceSelector: 42161n },
    assets: [
      {
        id: "fictional-engineer",
        kind: "individual",
        ownerReserve: member,
        sourceAuthority: member,
        token,
        name: "Fictional integration lesson",
        symbol: "DEMO",
        decimals: 6,
        service: {
          unit: "minute",
          capacityConfirmed: true,
          terms: { reference: "https://example.org/fictional-lesson", digest: digest(20) },
          approval: { reference: "https://example.org/fictional-approval", digest: digest(21) },
        },
        initialSupply: 6_000_000n,
        adapterAllowance: 1_000_000n,
        poolHoldingCap: 6_000_000n,
        priceIndex: 2n,
        upgradeControl: { kind: "member", admin: member },
      },
    ],
    pool: {
      proxyAdmin: ownerSafe,
      deployment: pin(30),
      registry: pin(31),
      limiter: pin(32),
      quoter: pin(33),
      feePolicy: pin(34),
      protocolFee: pin(35),
      feeAddress: ownerSafe,
      feesDecoupled: true,
    },
  };
}
