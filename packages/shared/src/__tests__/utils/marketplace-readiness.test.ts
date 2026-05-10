/**
 * Marketplace readiness tests.
 *
 * @vitest-environment node
 */

import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { NetworkContracts } from "../../types/contracts";
import {
  deriveMarketplaceReadiness,
  getMarketplaceReadiness,
  MARKETPLACE_READINESS_REQUIRED_FIELDS,
} from "../../utils/blockchain/contracts";
import { ZERO_ADDRESS } from "../../utils/blockchain/address";

const VALID_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;

const READY_CONTRACTS = {
  gardenToken: VALID_ADDRESS,
  actionRegistry: VALID_ADDRESS,
  workResolver: VALID_ADDRESS,
  workApprovalResolver: VALID_ADDRESS,
  deploymentRegistry: VALID_ADDRESS,
  octantModule: VALID_ADDRESS,
  hatsModule: VALID_ADDRESS,
  karmaGAPModule: VALID_ADDRESS,
  eas: VALID_ADDRESS,
  easSchemaRegistry: VALID_ADDRESS,
  communityToken: VALID_ADDRESS,
  erc4337EntryPoint: VALID_ADDRESS,
  multicallForwarder: VALID_ADDRESS,
  cookieJarFactory: VALID_ADDRESS,
  cookieJarModule: VALID_ADDRESS,
  yieldSplitter: VALID_ADDRESS,
  gardensModule: VALID_ADDRESS,
  greenGoodsENS: VALID_ADDRESS,
  hypercertExchange: "0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83" as Address,
  hypercertMinter: "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07" as Address,
  transferManager: "0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB" as Address,
  marketplaceAdapter: "0xE396137ef12c30075fd0B8509C6e389750f36159" as Address,
  hypercertsModule: "0x9CB6300cb0DD64dfe577944d7a8AF70799Fe3ef0" as Address,
  strategyHypercertFractionOffer: "0xecab24cade0261fc6513ca13bb3d10f760af3da8" as Address,
  greenWill: VALID_ADDRESS,
} satisfies NetworkContracts;

describe("marketplace readiness", () => {
  it("marks Arbitrum available only when every deployment artifact marketplace field is nonzero", () => {
    const readiness = getMarketplaceReadiness(42161);

    expect(readiness.status).toBe("available");
    expect(readiness.available).toBe(true);
    expect(readiness.missingFields).toEqual([]);

    if (!readiness.available) {
      throw new Error("Expected Arbitrum marketplace readiness to be available");
    }

    expect(readiness.addresses).toMatchObject({
      marketplaceAdapter: "0xE396137ef12c30075fd0B8509C6e389750f36159",
      hypercertsModule: "0x9CB6300cb0DD64dfe577944d7a8AF70799Fe3ef0",
      hypercertExchange: "0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83",
      hypercertMinter: "0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07",
      transferManager: "0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB",
      strategyHypercertFractionOffer: "0xecab24cade0261fc6513ca13bb3d10f760af3da8",
    });
  });

  it.each(
    MARKETPLACE_READINESS_REQUIRED_FIELDS
  )("fails closed when %s is missing or zero", (field) => {
    const readiness = deriveMarketplaceReadiness(42161, {
      ...READY_CONTRACTS,
      [field]: ZERO_ADDRESS,
    });

    expect(readiness.status).toBe("unavailable");
    expect(readiness.available).toBe(false);
    expect(readiness.missingFields).toEqual([field]);
    expect(readiness.reason).toContain(field);
  });

  it("reports every missing marketplace artifact field together", () => {
    const readiness = deriveMarketplaceReadiness(42161, {
      ...READY_CONTRACTS,
      marketplaceAdapter: ZERO_ADDRESS,
      hypercertsModule: ZERO_ADDRESS,
      hypercertExchange: ZERO_ADDRESS,
      hypercertMinter: ZERO_ADDRESS,
      transferManager: ZERO_ADDRESS,
      strategyHypercertFractionOffer: ZERO_ADDRESS,
    });

    expect(readiness.status).toBe("unavailable");
    expect(readiness.available).toBe(false);
    expect(readiness.missingFields).toEqual(MARKETPLACE_READINESS_REQUIRED_FIELDS);
  });
});
