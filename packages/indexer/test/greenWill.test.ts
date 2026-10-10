import assert from "assert";
import { addr, CHAINS, mockEvent, txHash } from "./helpers/events";
import { assertProjection } from "./helpers/projections";
import { createTestIndexer, GreenWill } from "./v3";

const CHAIN_ID = CHAINS.arbitrum;

function bytes32(label: string): string {
  return `0x${Buffer.from(label).toString("hex").padEnd(64, "0")}`;
}

const BADGE_ID = bytes32("GENESIS");
const OWNER = addr(10);
const VALIDATOR = addr(11);
const ISSUER = addr(12);
const LOCK = addr(13);

describe("GreenWill.BadgeClassConfigured", () => {
  it("stores badge definitions with chain-scoped ids", async () => {
    const mockDb = createTestIndexer();

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
    const definition = await result.GreenWillBadgeDefinition.get(
      `${CHAIN_ID}-${BADGE_ID.toLowerCase()}`
    );

    assertProjection(definition, {
      chainId: CHAIN_ID,
      badgeId: BADGE_ID.toLowerCase(),
      slug: "genesis",
      validator: VALIDATOR.toLowerCase(),
      authorizedIssuer: ISSUER.toLowerCase(),
      unlockLock: LOCK.toLowerCase(),
      claimable: true,
      active: true,
      metadataURI: "ipfs://genesis",
    });
  });
});

describe("GreenWill.BadgeIssued", () => {
  it("materializes canonical ownership and grant history", async () => {
    let mockDb = createTestIndexer();

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

    const ownership = await result.GreenWillBadgeOwnership.get(
      `${CHAIN_ID}-${BADGE_ID.toLowerCase()}-${OWNER.toLowerCase()}`
    );
    const grant = await result.GreenWillBadgeGrant.get(`${CHAIN_ID}-${txHash(101)}-2`);
    const definition = await result.GreenWillBadgeDefinition.get(
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
