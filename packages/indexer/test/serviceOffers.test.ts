import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as yaml from "js-yaml";
import { parseAbi, type Abi, type AbiEvent, type AbiParameter } from "viem";

import { cosmoId, type CosmoEvent } from "../src/handlers/cosmo-local-projections";
import { projectServiceOffer } from "../src/handlers/service-offers";
import { createTestIndexer } from "./v3";

const CORE = "0x000000000000000000000000000000000000c001";
const BUYER = "0x000000000000000000000000000000000000b001";
const GARDEN = "0x000000000000000000000000000000000000a001";
const CLAIM = `0x${"ab".repeat(32)}`;
const HASH = `0x${"cd".repeat(32)}`;
const EXACT = 9_007_199_254_740_993n;

function event(eventName: string, params: CosmoEvent["params"], block = 1): CosmoEvent {
  return {
    eventName,
    chainId: 42161,
    srcAddress: CORE,
    params,
    block: { number: block, timestamp: block },
    transaction: { hash: `0x${String(block).padStart(64, "0")}` },
    logIndex: 0,
  };
}
function requested(claimHash = CLAIM, requestNonce = EXACT) {
  return event("ServiceClaimConsentRequested", {
    commitmentId: 1n,
    buyer: BUYER,
    claimHash,
    revision: EXACT,
    requestNonce,
    buyerGarden: GARDEN,
    voucherHolder: BUYER,
  });
}

describe("opt-in service offer facts", () => {
  it("matches every additive event field, tuple component and indexed flag to frozen contract ABIs", async () => {
    const config = yaml.load(
      await readFile(new URL("../config.yaml", import.meta.url), "utf8")
    ) as {
      contracts: Array<{ name: string; events: Array<{ event: string }> }>;
      chains: Array<{ id: number; contracts: Array<{ name: string; address?: string }> }>;
    };
    function parameterShape(parameter: AbiParameter): unknown {
      return {
        name: parameter.name,
        type: parameter.type,
        indexed: "indexed" in parameter && parameter.indexed === true,
        components:
          "components" in parameter ? parameter.components.map(parameterShape) : undefined,
      };
    }
    const boundaries = [
      ["CommitmentPoolingModule", "ICommitmentServiceOffers", 4],
      ["CommitmentPoolingModule", "ICommitmentVoucherAcceptance", 5],
      ["SettlementModule", "ISettlementPersonalServicePurchases", 4],
      ["VoucherRedemptionModule", "VoucherRedemptionModule", 11],
      ["GnosisVoucherEscrow", "GnosisVoucherEscrow", 21],
      ["VoucherEntitlementModule", "VoucherEntitlementModule", 10],
    ] as const;
    for (const [contract, abiName, count] of boundaries) {
      const abi = JSON.parse(
        await readFile(new URL(`../../contracts/abis/${abiName}.json`, import.meta.url), "utf8")
      ) as Abi;
      const expected = abi.filter((entry): entry is AbiEvent => entry.type === "event");
      const definitions = config.contracts.find((candidate) => candidate.name === contract)!;
      const additive = definitions.events
        .filter(({ event: signature }) =>
          expected.some((item) => signature.startsWith(`${item.name}(`))
        )
        .filter(
          ({ event: signature }) =>
            !signature.startsWith("OwnershipTransferred(") &&
            !signature.startsWith("Initialized(") &&
            !signature.startsWith("Upgraded(") &&
            !signature.startsWith("VoucherUpgrade")
        );
      assert.equal(additive.length, count, contract);
      for (const { event: signature } of additive) {
        const signatures: string[] = [`event ${signature}`];
        const parsed = parseAbi(signatures)[0] as AbiEvent;
        const canonical = expected.find((item) => item.name === parsed.name)!;
        assert.deepEqual(
          parsed.inputs.map(parameterShape),
          canonical.inputs.map(parameterShape),
          `${contract}.${parsed.name}`
        );
      }
    }
    assert.deepEqual(
      config.chains.map(({ id }) => id),
      [42161, 11155111, 42220, 100]
    );
    // Both Arbitrum source proxies are static, so their initializer events are indexed; the escrow
    // is pinned on Gnosis only.
    const registered = (name: string) =>
      config.chains
        .filter(({ contracts }) => contracts.some((contract) => contract.name === name))
        .map(({ id, contracts }) => ({
          id,
          address: contracts.find((contract) => contract.name === name)?.address,
        }));
    assert.deepEqual(registered("VoucherEntitlementModule"), [
      { id: 42161, address: "0x9eeA83dc46433F646707076294627E49692CC6Ed" },
    ]);
    assert.deepEqual(registered("VoucherRedemptionModule"), [
      { id: 42161, address: "0xB9D3fBeaEb9Ba5635ce2FCb630af7c55c11f9BE6" },
    ]);
    assert.deepEqual(registered("GnosisVoucherEscrow"), [
      { id: 100, address: "0x742c8935d314363e8c16df5b0791525109Fb9387" },
    ]);
  });

  it("projects exact revision/price without inventing full terms or Legacy mode", async () => {
    const db = createTestIndexer();
    await projectServiceOffer(
      event("ServiceOfferTermsSet", {
        commitmentId: 1n,
        revision: EXACT,
        termsHash: HASH,
        route: 2n,
        gdPrice: EXACT,
      }),
      db
    );
    const revision = await db.ServiceOfferRevision.get(cosmoId(42161, CORE, `1-${EXACT}`));
    assert.ok(revision);
    assert.equal(revision.revision, EXACT);
    assert.equal(revision.gdPrice, EXACT);
    assert.equal(revision.paymentRoute, 2);
    assert.equal("voucherToken" in revision, false);
    assert.equal(await db.ServiceOfferRevision.get(cosmoId(42161, CORE, "9-0")), undefined);
  });

  it("keeps identical business IDs isolated by chain and module", async () => {
    const db = createTestIndexer();
    for (const variant of [
      requested(),
      { ...requested(), chainId: 100 },
      { ...requested(), srcAddress: GARDEN },
    ]) {
      await projectServiceOffer(variant, db);
    }
    assert.equal((await db.ServiceClaimConsent.getAll()).length, 3);
    assert.equal((await db.ServiceClaimConsent.get(cosmoId(100, CORE, CLAIM)))?.buyer, BUYER);
  });

  it("backfills request facts after accepted and withdrawn observations without erasing them", async () => {
    const db = createTestIndexer();
    await projectServiceOffer(
      event(
        "ServiceClaimConsentAccepted",
        { commitmentId: 1n, buyer: BUYER, claimHash: CLAIM, revision: EXACT, requestNonce: EXACT },
        3
      ),
      db
    );
    await projectServiceOffer(
      event(
        "ServiceClaimConsentWithdrawn",
        { commitmentId: 1n, buyer: BUYER, claimHash: CLAIM },
        4
      ),
      db
    );
    await projectServiceOffer(requested(), db);
    const consent = await db.ServiceClaimConsent.get(cosmoId(42161, CORE, CLAIM));
    assert.ok(consent);
    assert.equal(consent.requestSeen, true);
    assert.equal(consent.acceptedSeen, true);
    assert.equal(consent.withdrawnSeen, true);
    assert.equal(consent.requestNonce, EXACT);
    assert.equal(consent.buyerGarden, GARDEN);
  });

  it("separates a withdrawn request from the next exact nonce and deduplicates replay", async () => {
    const db = createTestIndexer();
    const nextHash = `0x${"ef".repeat(32)}`;
    await projectServiceOffer(requested(), db);
    await projectServiceOffer(
      event(
        "ServiceClaimConsentWithdrawn",
        { commitmentId: 1n, buyer: BUYER, claimHash: CLAIM },
        2
      ),
      db
    );
    await projectServiceOffer(requested(nextHash, EXACT + 1n), db);
    await projectServiceOffer(requested(), db);
    assert.equal((await db.ServiceClaimConsent.getAll()).length, 2);
    assert.equal(
      (await db.ServiceClaimConsent.get(cosmoId(42161, CORE, CLAIM)))?.withdrawnSeen,
      true
    );
    assert.equal(
      (await db.ServiceClaimConsent.get(cosmoId(42161, CORE, nextHash)))?.withdrawnSeen,
      false
    );
  });
});
