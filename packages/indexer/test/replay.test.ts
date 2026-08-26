import assert from "node:assert/strict";

import { Addresses, createTestIndexer } from "./v3";

const CHAIN_ID = 42161 as const;
const START_BLOCK = 433_713_812;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function address(index: number) {
  return Addresses.mockAddresses[index] ?? (`0x${index.toString(16).padStart(40, "0")}` as const);
}

function hash(index: number) {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

async function runRepresentativeReplay(indexer = createTestIndexer()) {
  const garden = address(10);
  const vault = address(11);
  const asset = address(12);
  const owner = address(13);
  const badgeId = hash(500);
  const projectUID = hash(600);

  const result = await indexer.process({
    chains: {
      [CHAIN_ID]: {
        startBlock: START_BLOCK,
        endBlock: START_BLOCK,
        simulate: [
          {
            contract: "GardenToken",
            event: "GardenMinted",
            params: {
              tokenId: 1n,
              account: garden,
              name: "Replay Garden",
              description: "Deterministic replay fixture",
              location: "Earth",
              bannerImage: "ipfs://replay",
              openJoining: true,
            },
            transaction: { hash: hash(1) },
            logIndex: 1,
          },
          {
            contract: "GardenAccount",
            event: "NameUpdated",
            srcAddress: garden,
            params: { updater: owner, newName: "Replay Garden Updated" },
            transaction: { hash: hash(2) },
            logIndex: 2,
          },
          {
            contract: "KarmaGAPModule",
            event: "GAPProjectCreated",
            params: { projectUID, garden, projectName: "Replay Garden" },
            transaction: { hash: hash(20) },
            logIndex: 20,
          },
          {
            contract: "KarmaGAPModule",
            event: "KarmaSyncRecorded",
            params: {
              garden,
              projectUID,
              account: owner,
              operation: 3n,
              outcome: 1n,
              sourceUID: hash(601),
              resultUID: hash(602),
              reason: "",
            },
            transaction: { hash: hash(21) },
            logIndex: 21,
          },
          {
            contract: "HatsModule",
            event: "RoleGranted",
            params: { garden, account: owner, role: 0n },
            transaction: { hash: hash(3) },
            logIndex: 3,
          },
          {
            contract: "ActionRegistry",
            event: "ActionRegistered",
            params: {
              owner,
              actionUID: 7n,
              startTime: 10n,
              endTime: 20n,
              title: "Replay action",
              slug: "replay.action",
              instructions: "Repeat safely",
              capitals: [0n, 2n],
              media: ["ipfs://action"],
              domain: 3n,
            },
            transaction: { hash: hash(4) },
            logIndex: 4,
          },
          {
            contract: "OctantModule",
            event: "VaultCreated",
            params: { garden, vault, asset },
            transaction: { hash: hash(5) },
            logIndex: 5,
          },
          {
            contract: "OctantVault",
            event: "Deposit",
            srcAddress: vault,
            params: { sender: owner, owner, assets: 100n, shares: 100n },
            transaction: { hash: hash(6) },
            logIndex: 6,
          },
          {
            contract: "YieldSplitter",
            event: "YieldSplit",
            params: {
              garden,
              asset,
              cookieJarAmount: 10n,
              fractionsAmount: 20n,
              juiceboxAmount: 30n,
              totalYield: 60n,
            },
            transaction: { hash: hash(7) },
            logIndex: 7,
          },
          {
            contract: "HypercertMinter",
            event: "TransferSingle",
            params: {
              operator: owner,
              from: ZERO_ADDRESS,
              to: owner,
              id: 9n,
              value: 1_000n,
            },
            transaction: { hash: hash(8) },
            logIndex: 8,
          },
          {
            contract: "GreenWill",
            event: "BadgeClassConfigured",
            params: {
              badgeId,
              slug: "replay-badge",
              validator: ZERO_ADDRESS,
              authorizedIssuer: owner,
              unlockLock: ZERO_ADDRESS,
              claimable: true,
              active: true,
              metadataURI: "ipfs://badge",
            },
            transaction: { hash: hash(9) },
            logIndex: 9,
          },
          {
            contract: "CookieJarFactory",
            event: "MetadataUpdated",
            params: {
              jarAddress: address(14),
              metadata: JSON.stringify({
                kind: "green-goods.campaign-cookie-jar",
                version: 1,
                slug: "replay-campaign",
                title: "Replay Campaign",
              }),
            },
            transaction: { hash: hash(10) },
            logIndex: 10,
          },
        ],
      },
    },
  });

  return { indexer, result };
}

async function snapshotRepresentativeEntities(
  indexer: ReturnType<typeof createTestIndexer>
): Promise<Record<string, unknown[]>> {
  const entityStores = [
    "Action",
    "CampaignCookieJar",
    "Garden",
    "GardenVault",
    "GardenVaultIndex",
    "Gardener",
    "GreenWillBadgeDefinition",
    "Hypercert",
    "KarmaProjectAccess",
    "KarmaSyncRecord",
    "VaultAddressIndex",
    "VaultDeposit",
    "VaultEvent",
    "YieldAllocation",
  ] as const;

  const snapshot: Record<string, unknown[]> = {};
  for (const entityStore of entityStores) {
    snapshot[entityStore] = (await indexer[entityStore].getAll()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  }

  return snapshot;
}

describe("Envio v3 replay", () => {
  it("produces identical entities from the configured start block on a clean replay", async () => {
    const firstReplay = await runRepresentativeReplay();
    const secondReplay = await runRepresentativeReplay();
    const firstSnapshot = await snapshotRepresentativeEntities(firstReplay.indexer);
    const secondSnapshot = await snapshotRepresentativeEntities(secondReplay.indexer);

    assert.deepEqual(secondSnapshot, firstSnapshot);
  });

  it("rejects a repeated range without mutating existing entities", async () => {
    const replay = await runRepresentativeReplay();
    const before = await snapshotRepresentativeEntities(replay.indexer);

    await assert.rejects(
      () => runRepresentativeReplay(replay.indexer),
      /startBlock .* must be greater than previously processed endBlock/
    );

    const after = await snapshotRepresentativeEntities(replay.indexer);
    assert.deepEqual(after, before);
  });
});
