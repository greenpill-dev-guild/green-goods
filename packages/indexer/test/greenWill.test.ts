import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, GreenWill } = TestHelpers;

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

describe("GreenWill.BadgeClassConfigured", () => {
  it("stores badge definitions with chain-scoped ids", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GreenWill.BadgeClassConfigured.createMockEvent({
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

    const result = await GreenWill.BadgeClassConfigured.processEvent({ event, mockDb });
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

describe("GreenWill.BadgeIssued", () => {
  it("materializes canonical ownership and grant history", async () => {
    let mockDb = MockDb.createMockDb();

    const configureEvent = GreenWill.BadgeClassConfigured.createMockEvent({
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
    mockDb = await GreenWill.BadgeClassConfigured.processEvent({
      event: configureEvent,
      mockDb,
    });

    const issueEvent = GreenWill.BadgeIssued.createMockEvent({
      badgeId: BADGE_ID,
      account: OWNER,
      sourceRef: bytes32("SOURCE"),
      issuer: ISSUER,
      unlockTokenId: 1n,
      mockEventData: mockEvent(CHAIN_ID, 11_000, { txHash: txHash(101), logIndex: 2 }),
    });
    const result = await GreenWill.BadgeIssued.processEvent({ event: issueEvent, mockDb });

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
