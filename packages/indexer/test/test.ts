import assert from "assert";
import { TestHelpers, Action, Garden } from "generated";
const { MockDb, Addresses, ActionRegistry, GardenToken, GardenAccount } = TestHelpers;

describe("Action Registry Test", () => {
  it("A new action is registered", async () => {
    // Initializing the mock database
    const mockDbInitial = MockDb.createMockDb();

    // Initializing values for mock event
    const userAddress = Addresses.defaultAddress;
    const action = {
      title: "Hi there",
      instructions: "Instructions",
      media: ["https://example.com/image.jpg"],
      startTime: BigInt(0),
      endTime: BigInt(0),
      capitals: [],
      ownerAddress: userAddress,
    };

    // Creating a mock event
    const mockNewGreetingEvent = ActionRegistry.ActionRegistered.createMockEvent({
      actionUID: BigInt(0),
      ...action,
    });

    // Processing the mock event on the mock database
    const updatedMockDb = await ActionRegistry.ActionRegistered.processEvent({
      event: mockNewGreetingEvent,
      mockDb: mockDbInitial,
    });

    // Getting the entity from the mock database
    const actualActionEntity = updatedMockDb.entities.Action.get("0");

    // Expected entity that should be created
    const expectedActionEntity: Action = {
      id: "0",
      createdAt: actualActionEntity?.createdAt ?? 0,
      ...action,
    };

    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(expectedActionEntity, actualActionEntity);
  });
});

describe("Garden Token Test", () => {
  it("A new garden is minted", async () => {
    // Initializing the mock database
    const mockDbInitial = MockDb.createMockDb();

    // Initializing values for mock event
    const userAddress = Addresses.defaultAddress;
    const garden = {
      account: "0x0000000000000000000000000000000000000000",
      bannerImage: "https://example.com/image.jpg",
      name: "My Garden",
      description: "Description",
      location: "Location",
      gardeners: [userAddress],
      operators: [userAddress],
      tokenID: BigInt(0),
    };

    // Creating a mock event
    const mockNewGardenEvent = GardenToken.GardenMinted.createMockEvent({
      ...garden,
      gardenOperators: garden.operators,
    });

    // Processing the mock event on the mock database
    const updatedMockDb = await GardenToken.GardenMinted.processEvent({
      event: mockNewGardenEvent,
      mockDb: mockDbInitial,
    });

    // Getting the entity from the mock database
    const actualGardenEntity = updatedMockDb.entities.Garden.get(garden.account);

    // Expected entity that should be created
    const expectedGardenEntity: Garden = {
      id: garden.account,
      tokenAddress: actualGardenEntity?.tokenAddress ?? "",
      createdAt: actualGardenEntity?.createdAt ?? 0,
      bannerImage: garden.bannerImage,
      name: garden.name,
      description: garden.description,
      location: garden.location,
      gardeners: garden.gardeners,
      operators: garden.operators,
      tokenID: garden.tokenID,
    };

    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(expectedGardenEntity, actualGardenEntity);
  });
});
