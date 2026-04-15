import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, GreenWillRegistry, GreenWillSupportRouter } = TestHelpers;

const CHAIN_ID = 42161;

function addr(index: number): string {
  return Addresses.mockAddresses[index] || `0x${index.toString().padStart(40, "0")}`;
}

function txHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function bytes32(label: string): string {
  return `0x${Buffer.from(label).toString("hex").padEnd(64, "0")}`;
}

function mockEvent(
  chainId: number,
  timestamp: number,
  opts: { srcAddress?: string; txHash?: string; logIndex?: number; blockNumber?: number } = {}
) {
  return {
    chainId,
    block: { timestamp, number: opts.blockNumber ?? 0 },
    srcAddress: opts.srcAddress ?? addr(99),
    transaction: { hash: opts.txHash ?? txHash(timestamp) },
    logIndex: opts.logIndex ?? 0,
  };
}

const BADGE_ID = bytes32("GENESIS");
const OWNER = addr(10);
const VALIDATOR = addr(11);
const ISSUER = addr(12);
const LOCK = addr(13);
const GARDEN = addr(14);
const ASSET = addr(15);
const VAULT = addr(16);

describe("GreenWillRegistry.BadgeClassConfigured", () => {
  it("stores badge definitions with chain-scoped ids", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GreenWillRegistry.BadgeClassConfigured.createMockEvent({
      badgeId: BADGE_ID,
      slug: "genesis",
      validator: VALIDATOR,
      authorizedIssuer: ISSUER,
      unlockLock: LOCK,
      claimable: true,
      active: true,
      metadataURI: "ipfs://genesis",
      mockEventData: mockEvent(CHAIN_ID, 10_000, { txHash: txHash(100), logIndex: 1 }),
    });

    const result = await GreenWillRegistry.BadgeClassConfigured.processEvent({ event, mockDb });
    const definition = result.entities.GreenWillBadgeDefinition.get(
      `${CHAIN_ID}-${BADGE_ID.toLowerCase()}`
    );

    assert.ok(definition);
    assert.equal(definition.chainId, CHAIN_ID);
    assert.equal(definition.badgeId, BADGE_ID.toLowerCase());
    assert.equal(definition.slug, "genesis");
    assert.equal(definition.validator, VALIDATOR.toLowerCase());
    assert.equal(definition.authorizedIssuer, ISSUER.toLowerCase());
    assert.equal(definition.unlockLock, LOCK.toLowerCase());
    assert.equal(definition.claimable, true);
    assert.equal(definition.active, true);
    assert.equal(definition.metadataURI, "ipfs://genesis");
  });
});

describe("GreenWillRegistry.BadgeIssued", () => {
  it("materializes canonical ownership and grant history", async () => {
    let mockDb = MockDb.createMockDb();

    const configureEvent = GreenWillRegistry.BadgeClassConfigured.createMockEvent({
      badgeId: BADGE_ID,
      slug: "genesis",
      validator: VALIDATOR,
      authorizedIssuer: ISSUER,
      unlockLock: LOCK,
      claimable: true,
      active: true,
      metadataURI: "ipfs://genesis",
      mockEventData: mockEvent(CHAIN_ID, 10_000, { txHash: txHash(100), logIndex: 1 }),
    });
    mockDb = await GreenWillRegistry.BadgeClassConfigured.processEvent({
      event: configureEvent,
      mockDb,
    });

    const issueEvent = GreenWillRegistry.BadgeIssued.createMockEvent({
      badgeId: BADGE_ID,
      account: OWNER,
      sourceRef: bytes32("SOURCE"),
      issuer: ISSUER,
      unlockTokenId: 1n,
      mockEventData: mockEvent(CHAIN_ID, 11_000, { txHash: txHash(101), logIndex: 2 }),
    });
    const result = await GreenWillRegistry.BadgeIssued.processEvent({ event: issueEvent, mockDb });

    const ownership = result.entities.GreenWillBadgeOwnership.get(
      `${CHAIN_ID}-${BADGE_ID.toLowerCase()}-${OWNER.toLowerCase()}`
    );
    const grant = result.entities.GreenWillBadgeGrant.get(`${CHAIN_ID}-${txHash(101)}-2`);
    const definition = result.entities.GreenWillBadgeDefinition.get(
      `${CHAIN_ID}-${BADGE_ID.toLowerCase()}`
    );

    assert.ok(ownership);
    assert.equal(ownership.owner, OWNER.toLowerCase());
    assert.equal(ownership.badgeId, BADGE_ID.toLowerCase());
    assert.equal(ownership.sourceRef, bytes32("SOURCE").toLowerCase());
    assert.equal(ownership.issuer, ISSUER.toLowerCase());
    assert.equal(ownership.unlockTokenId, 1n);

    assert.ok(grant);
    assert.equal(grant.badgeId, BADGE_ID.toLowerCase());
    assert.equal(grant.owner, OWNER.toLowerCase());
    assert.equal(grant.txHash, txHash(101));

    assert.ok(definition);
    assert.equal(definition.holderCount, 1);
    assert.equal(definition.grantCount, 1);
  });
});

describe("GreenWillSupportRouter.SupportRouted", () => {
  it("stores routed support history without depending on vault deposit logs", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GreenWillSupportRouter.SupportRouted.createMockEvent({
      supporter: OWNER,
      garden: GARDEN,
      asset: ASSET,
      vault: VAULT,
      amount: 25n,
      shares: 25n,
      badgeIssued: true,
      mockEventData: mockEvent(CHAIN_ID, 12_000, { txHash: txHash(102), logIndex: 3 }),
    });

    const result = await GreenWillSupportRouter.SupportRouted.processEvent({ event, mockDb });
    const support = result.entities.GreenWillRoutedSupport.get(`${CHAIN_ID}-${txHash(102)}-3`);

    assert.ok(support);
    assert.equal(support.chainId, CHAIN_ID);
    assert.equal(support.supporter, OWNER.toLowerCase());
    assert.equal(support.garden, GARDEN.toLowerCase());
    assert.equal(support.asset, ASSET.toLowerCase());
    assert.equal(support.vault, VAULT.toLowerCase());
    assert.equal(support.amount, 25n);
    assert.equal(support.shares, 25n);
    assert.equal(support.badgeIssued, true);
  });
});
