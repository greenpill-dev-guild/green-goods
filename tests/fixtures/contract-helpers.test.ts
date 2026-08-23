import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  parseAbiParameters,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import GardenTokenABI from "../../packages/contracts/abis/GardenToken.json";
import * as anvilForkFixture from "./anvil-fork";
import { createGarden, type CreateGardenParams, type GardenResult } from "./contract-helpers";

const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEPLOYER_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const GARDEN_TOKEN_ADDRESS = "0x1000000000000000000000000000000000000001";
const GARDEN_ACCOUNT_ADDRESS = "0x2000000000000000000000000000000000000002";
const TX_HASH = `0x${"ab".repeat(32)}` as const;

function gardenMintedLog() {
  return {
    address: GARDEN_TOKEN_ADDRESS,
    topics: encodeEventTopics({
      abi: GardenTokenABI,
      eventName: "GardenMinted",
      args: {
        tokenId: 42n,
        account: GARDEN_ACCOUNT_ADDRESS,
      },
    }),
    data: encodeAbiParameters(parseAbiParameters("string,string,string,string,bool"), [
      "Fixture Garden",
      "Canonical GardenConfig fixture",
      "",
      "ipfs://fixture-banner",
      true,
    ]),
  };
}

describe("fork contract helpers", () => {
  it("encodes the deployed mintGarden contract and parses GardenMinted", async () => {
    const writeContract = vi.fn().mockResolvedValue(TX_HASH);
    const context = {
      accounts: {
        deployer: {
          address: DEPLOYER_ADDRESS,
          account: privateKeyToAccount(DEPLOYER_PRIVATE_KEY),
        },
      },
      chain: { id: 11155111 },
      deployment: { gardenToken: GARDEN_TOKEN_ADDRESS },
      publicClient: {
        waitForTransactionReceipt: vi.fn().mockResolvedValue({ logs: [gardenMintedLog()] }),
      },
      testClient: {
        impersonateAccount: vi.fn().mockResolvedValue(undefined),
        stopImpersonatingAccount: vi.fn().mockResolvedValue(undefined),
      },
      walletClient: { writeContract },
    } as unknown as anvilForkFixture.AnvilForkContext;

    const result: GardenResult = await createGarden(context, {
      // Deliberately retained in the RED fixture: the repaired helper must ignore
      // the removed field and encode the canonical deployed GardenConfig instead.
      communityToken: "0x3000000000000000000000000000000000000003",
      name: "Fixture Garden",
      slug: "fixture-garden",
      description: "Canonical GardenConfig fixture",
      location: "",
      bannerImage: "ipfs://fixture-banner",
      weightScheme: 0,
      domainMask: 15,
    } as unknown as CreateGardenParams);

    const request = writeContract.mock.calls[0]?.[0];
    const calldata = encodeFunctionData({
      abi: request.abi,
      functionName: request.functionName,
      args: request.args,
    });

    expect(calldata.slice(0, 10)).toBe("0x197a8188");
    expect(request.args[0]).toEqual({
      name: "Fixture Garden",
      slug: "fixture-garden",
      description: "Canonical GardenConfig fixture",
      location: "",
      bannerImage: "ipfs://fixture-banner",
      metadata: "",
      openJoining: true,
      weightScheme: 0,
      domainMask: 15,
      gardeners: [],
      // mintGarden encodes this struct by field name — wire spelling.
      operators: [DEPLOYER_ADDRESS],
    });
    expect(result.address).toBe(GARDEN_ACCOUNT_ADDRESS);
    expect(result.tokenId).toBe(42n);
  });

  it("normalizes inherited fork signer code before transactions", async () => {
    type NormalizeForkAccounts = (
      testClient: {
        setCode: (params: { address: Address; bytecode: `0x${string}` }) => Promise<void>;
        setNonce: (params: { address: Address; nonce: number }) => Promise<void>;
      },
      accounts: readonly { address: Address }[]
    ) => Promise<void>;
    const normalizeForkAccounts = (
      anvilForkFixture as typeof anvilForkFixture & {
        normalizeForkAccounts?: NormalizeForkAccounts;
      }
    ).normalizeForkAccounts;

    expect(normalizeForkAccounts).toBeTypeOf("function");
    if (!normalizeForkAccounts) return;

    const setCode = vi.fn().mockResolvedValue(undefined);
    const setNonce = vi.fn().mockResolvedValue(undefined);
    const accounts = [
      { address: DEPLOYER_ADDRESS },
      { address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
    ] as const;

    await normalizeForkAccounts({ setCode, setNonce }, accounts);

    expect(setCode.mock.calls).toEqual(
      accounts.map(({ address }) => [{ address, bytecode: "0x" }])
    );
    expect(setNonce.mock.calls).toEqual(accounts.map(({ address }) => [{ address, nonce: 0 }]));
  });
});
