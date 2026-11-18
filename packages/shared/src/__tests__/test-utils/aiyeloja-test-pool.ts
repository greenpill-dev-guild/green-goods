import type { Address, Hex } from "viem";

interface DeploymentReceipt {
  transactionHash: Hex;
  blockNumber: bigint;
  blockHash: Hex;
}

interface DeployedProxy {
  address: Address;
  receipt: DeploymentReceipt;
}

/**
 * The Aiyeloja Family Garden's test exchange pool on Gnosis (PRD-1481), for test and QA
 * harnesses only. No App or Hub surface reads it, and none of its vouchers is listed in the
 * Green Goods or Tech and Sun pools. Any one of the test Safe's six owners can act for it, so it
 * only ever holds test value.
 *
 * Each contract is a factory proxy deployed by the release deployer at nonces 22 to 30, owned and
 * administered by the test Safe. Receipts were read from Gnosis on 17 November 2026 UTC, all with
 * status success. The contracts test `clc-aiyeloja-release.test.ts` checks these addresses against
 * the release tooling's CREATE2 plan.
 */
export const AIYELOJA_TEST_POOL = {
  chainId: 100,
  garden: "0xF7b892886998DAe960D64a9db488336684F137A0",
  safe: "0xdeB7d1990a643Aa4954ff179e9683Ed4693A955c",
  automation: "0x596d412815b063DFAEFeD1dabd2BBf2AD7503BA4",
  contracts: {
    index: {
      address: "0xD704cb01fBD230138a2330E0444066F29AeAebce",
      receipt: {
        transactionHash: "0xceabf36d3959c98e4217208a0215433f17ab00cd1b391d8ca4fc5ae5e58bae72",
        blockNumber: 49249861n,
        blockHash: "0x41047fb3e8c81ee84f9e64b24ab4238c241a212ced4d5c5059b874bc6a9892e5",
      },
    },
    limiter: {
      address: "0xa6eE169d938995bBFfaE88bD4343fC8c2678E2A4",
      receipt: {
        transactionHash: "0x41fc8b4c52b1cb892a785a3c73422c63e2d1b4802ea83c36c36a3c5941c1bde9",
        blockNumber: 49249865n,
        blockHash: "0xa0f9af4ea527d806f56f17a6279b6de18e08cdce0b4100aef071d43d5787839e",
      },
    },
    quoter: {
      address: "0x8C47BB9A452d14D4f462C131E0765Cdf1AC59Ea6",
      receipt: {
        transactionHash: "0x0b89aafc15003bf128b8e0bbbae19f77c4a92294817600d26776724000031d89",
        blockNumber: 49249869n,
        blockHash: "0xcd01e1d8e73a1d2c126964f213848222deec52d954628bea47456af3fe856e48",
      },
    },
    feePolicy: {
      address: "0x747899B5E51cA4eef2B315a9CAD6F5C266d17f96",
      receipt: {
        transactionHash: "0x1d0883fbc2bd7ec582527d18bb1234e640983cf460604598393353d23d1ee552",
        blockNumber: 49249873n,
        blockHash: "0x084caef1511124a64e9b06e1d8fe2940dadd32bdbf6266bb14940aaff564f196",
      },
    },
    protocolFee: {
      address: "0x93B481E4d846e19B12AC9Cd3a7E87eabFFf584AF",
      receipt: {
        transactionHash: "0x4fde2b148a39d8f7753976f2f6bab2646af504d310cc413c2abce626dbf6facb",
        blockNumber: 49249879n,
        blockHash: "0xa0e97df4ec90b7a43c8b487d7b322ff7ce0888b3f8261d4ea2a30ab41faecff7",
      },
    },
    pool: {
      address: "0x766b4531A9690Bf80e4331FC33d34030e6f14630",
      receipt: {
        transactionHash: "0x894e5b894138583354ca1508d159c1c519ce33a4a9010f54538b362ef65840b1",
        blockNumber: 49249884n,
        blockHash: "0xc550c7ab3ebeb6a2ba44f19ff744c8501d46c037c7ac160db3a4c205d2c0543e",
      },
    },
  },
  vouchers: {
    garden: {
      symbol: "AYTGV",
      address: "0x0528F69a3860ab9943Fe261aE0cd83B5DB9187ae",
      receipt: {
        transactionHash: "0xa6490e79a2a040a2bb6e0c20db804bb89112325c9f64d5231541ec4e347de8ec",
        blockNumber: 49249889n,
        blockHash: "0x38eb341bd294c52d7a0e51dc058066c1fbc14a3c7be14fadbd445ca692bf2412",
      },
    },
    "member-a": {
      symbol: "AYTMA",
      address: "0xC275702B4C91eFC7133a16FF31eae541A4160e9F",
      receipt: {
        transactionHash: "0x1c9b0888758620d9220cba576bb481a8f66d9375db25b865e88cf8e3a63131b7",
        blockNumber: 49249894n,
        blockHash: "0xc78be8b90c2cdfaf1472e47f5f108698b03c3bc42f8349a6f16a7e6c243f9b26",
      },
    },
    "member-b": {
      symbol: "AYTMB",
      address: "0xD7d7B21532C15E820678d807BC191945B0A135fF",
      receipt: {
        transactionHash: "0x3f08a5af2d3eb20adb83acc5a13269cbbccb88f8744fb579031c278e3c2b65ba",
        blockNumber: 49249900n,
        blockHash: "0xb1950eb4e62a4f6e5c041231b2d3c655b814cdb450635b7650468e0ab7bea1d5",
      },
    },
  },
} as const satisfies {
  chainId: 100;
  garden: Address;
  safe: Address;
  automation: Address;
  contracts: Record<
    "index" | "limiter" | "quoter" | "feePolicy" | "protocolFee" | "pool",
    DeployedProxy
  >;
  vouchers: Record<"garden" | "member-a" | "member-b", DeployedProxy & { symbol: string }>;
};
