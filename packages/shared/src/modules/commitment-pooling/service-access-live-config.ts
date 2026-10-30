import type { Hex } from "viem";
import type { Address } from "../../types/domain";

export interface ServiceDeploymentPin {
  address: Address;
  owner: Address;
  receipt: {
    transactionHash: Hex;
    blockNumber: bigint;
    blockHash: Hex;
    kind?: "safe-upgrade" | "create2";
  };
  runtimeCodeHash: Hex;
  implementation: { address: Address; runtimeCodeHash: Hex };
}

export interface ServiceLiveRoute {
  id: string;
  revision: number;
  sourceChainId: 42161;
  core: ServiceDeploymentPin;
  source: ServiceDeploymentPin & { guardian: Address; router: Address; remoteSelector: bigint };
  destination: ServiceDeploymentPin & {
    guardian: Address;
    router: Address;
    remoteSelector: bigint;
  };
  walletState?: Record<
    "adapter" | "registry" | "limiter" | "pool",
    Omit<ServiceDeploymentPin, "receipt">
  >;
  assets: readonly {
    token: Address;
    issuer: Address;
    symbol: string;
    decimals: number;
    issuerName?: string;
    garden?: Address;
    runtimeCodeHash: Hex;
    implementation: { address: Address; runtimeCodeHash: Hex };
  }[];
  buyerGardens: readonly { address: Address; name: string }[];
}

const GREEN_GOODS_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const PAUSE_GUARDIAN = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const ERC1967_PROXY_RUNTIME = "0x60fd6321ecf59eb9beedf71da3689269f96cf3565fa30dc5dc84d89842516fe7";
const CLC_TOKEN_PROXY_RUNTIME =
  "0x6b4490b96bd93ffcfea327772b10b51a4d013ef39d6ab274bc2883d1d16f2293";
const CLC_TOKEN_IMPLEMENTATION = {
  address: "0x34445d13F112A11f72C1d353a7dcdc407F3df2d8",
  runtimeCodeHash: "0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91",
} as const;

/** Populate only from verified live deployment/adoption receipts; rehearsal addresses never belong here. */
export const SERVICE_LIVE_ROUTES: readonly ServiceLiveRoute[] = [
  {
    // releaseId of deployments/42161-pilot-downstream.json and 100-pilot-downstream.json.
    id: "green-goods-tech-and-sun-voucher-pilot",
    revision: 2,
    sourceChainId: 42161,
    // Public Gnosis pilot downstream record: reserve adapter, token index, limiter and pool.
    // Current proxy implementations and owners verified against the public Gnosis deployment.
    walletState: {
      adapter: {
        address: "0x80a906C175ea875af8a2afcA8F91F60b201dc824",
        owner: GREEN_GOODS_SAFE,
        runtimeCodeHash: "0x60fd6321ecf59eb9beedf71da3689269f96cf3565fa30dc5dc84d89842516fe7",
        implementation: {
          address: "0x021368bf9958f4d535d39d571bc45f74d20e4666",
          runtimeCodeHash: "0x1a384cfbcf8d8bfe9eee1a652f9135ae8d3f0bb7e7a851144ec8b6ecacd19010",
        },
      },
      registry: {
        address: "0xf685212bB309F36F74B53ba0c9f1E49B4222d036",
        owner: GREEN_GOODS_SAFE,
        runtimeCodeHash: "0x6b4490b96bd93ffcfea327772b10b51a4d013ef39d6ab274bc2883d1d16f2293",
        implementation: {
          address: "0x0ceb18ba6562d3227717d98c044a5849be8362ef",
          runtimeCodeHash: "0x7d87c5eb290d28f0961269d99ccb278992b7a1e1ad358abb35156a80bc7f3db5",
        },
      },
      limiter: {
        address: "0xbA96741cc022F48a1F936a085b7549AEa3B01b9C",
        owner: GREEN_GOODS_SAFE,
        runtimeCodeHash: "0x6b4490b96bd93ffcfea327772b10b51a4d013ef39d6ab274bc2883d1d16f2293",
        implementation: {
          address: "0x258aad6c933f70d7f071e112800a41fb60434048",
          runtimeCodeHash: "0x4703592f66925654d50872a319602d2ec144698515abc9e4df00c36d5b4a3d32",
        },
      },
      pool: {
        address: "0x6AFc963B583fBB536F05B2D7ae832880662b98A4",
        owner: GREEN_GOODS_SAFE,
        runtimeCodeHash: "0x6b4490b96bd93ffcfea327772b10b51a4d013ef39d6ab274bc2883d1d16f2293",
        implementation: {
          address: "0x9e694d342cab02e295262b2290b0e64a0334160d",
          runtimeCodeHash: "0xc353aac7dd541d1c50c7eeb20a15a44ea9f93524f23a26217a557667ddd87847",
        },
      },
    },
    // 42161-latest.json's Pooling proxy, created through the CREATE2 deployer; its voucher
    // implementation is the Safe's 24 October source upgrade (Safe nonce 33).
    core: {
      address: "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a",
      owner: GREEN_GOODS_SAFE,
      receipt: {
        transactionHash: "0xf7c81fd3d697b77ac06d5834bc1fef317f7a74f95d8d31e6e6d7a319fe6cb2c6",
        blockNumber: 493952807n,
        blockHash: "0x43b6f9da114b16aeff823f8530fa470a57d03b8865dab0aeeecb877853896f2b",
        kind: "create2",
      },
      runtimeCodeHash: ERC1967_PROXY_RUNTIME,
      implementation: {
        address: "0xC186ee4BaA1094E73d33b8AFB519DF73Fe4F6c4d",
        runtimeCodeHash: "0xe2772f488b36763a6b846938d33743b72a6896538b13ee9645388d3b637e80fb",
      },
    },
    source: {
      address: "0xB9D3fBeaEb9Ba5635ce2FCb630af7c55c11f9BE6",
      owner: GREEN_GOODS_SAFE,
      receipt: {
        transactionHash: "0x1f126613b0f1dd7f8d6170c0d93636d305466be9ce4f74d333851e8e71dea2f3",
        blockNumber: 517974714n,
        blockHash: "0x2df101b6b1bd6758440fd4974859dae2a0e990f60b985e7d7462571712454e4f",
      },
      runtimeCodeHash: ERC1967_PROXY_RUNTIME,
      implementation: {
        address: "0x9e01FCAC06cd016B45c28fB992d69D177FaC2DcD",
        runtimeCodeHash: "0x705ee957769b8efc8dd3ec8cb16e0eb4d282befe67c5b8e2d2098bf4b2240122",
      },
      guardian: PAUSE_GUARDIAN,
      router: "0x141fa059441E0ca23ce184B6A78bafD2A517DdE8",
      remoteSelector: 465200170687744372n,
    },
    destination: {
      address: "0x742c8935d314363e8c16df5b0791525109Fb9387",
      owner: GREEN_GOODS_SAFE,
      receipt: {
        transactionHash: "0xa8f6972088526fbb41c5348eb8e5361425ad9da09439f06e0269c06253293ce1",
        blockNumber: 48925705n,
        blockHash: "0xdad1c7a4452276a57b7055812d30be629fb49724ae0d5dfb9ac65a86c90f8ab4",
      },
      runtimeCodeHash: ERC1967_PROXY_RUNTIME,
      implementation: {
        address: "0x988ea667E47f5079d8d6c3Fd6cD3743E34bc1E4E",
        runtimeCodeHash: "0xfc6b433991381543d8dfcbb0dfd949ed9cf4e0a912a7c107ba1579cd48155d12",
      },
      guardian: PAUSE_GUARDIAN,
      router: "0x4aAD6071085df840abD9Baf1697d5D5992bDadce",
      remoteSelector: 4949039107694359620n,
    },
    assets: [
      {
        token: "0xbaF8c6f7c0cA8310Df725D90023C188FA8f1B590",
        issuer: GREEN_GOODS_SAFE,
        symbol: "GGV",
        issuerName: "Green Goods",
        garden: "0xf401f34378384713222d1d21f63359cc4E8a858a",
        decimals: 6,
        runtimeCodeHash: CLC_TOKEN_PROXY_RUNTIME,
        implementation: CLC_TOKEN_IMPLEMENTATION,
      },
      {
        token: "0xB89300F212fcbdF3D5b73eADE290b3c0d6292143",
        issuer: "0x9BE5f0D6B95Ea3735df71023F5dFED53b4c1aABf",
        symbol: "TSV",
        issuerName: "Tech and Sun",
        garden: "0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3",
        decimals: 6,
        runtimeCodeHash: CLC_TOKEN_PROXY_RUNTIME,
        implementation: CLC_TOKEN_IMPLEMENTATION,
      },
    ],
    // The pilot cohort's garden, and the core's root garden.
    buyerGardens: [
      { address: "0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3", name: "TAS HUB" },
      {
        address: "0xf401f34378384713222d1d21f63359cc4E8a858a",
        name: "Green Goods Community Garden",
      },
    ],
  },
];
