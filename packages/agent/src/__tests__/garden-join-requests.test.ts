import { MemoryGardenJoinRequestStore } from "../services/garden-join-request-memory-store";
import { createGardenJoinRequestCipher } from "../services/garden-join-requests";
import { gardenJoinRequestStoreContract } from "./test-utils/garden-join-request-contract";

gardenJoinRequestStoreContract("memory garden join request store", () => {
  let requestId = 0;
  const store = new MemoryGardenJoinRequestStore(createGardenJoinRequestCipher("ab".repeat(32)), {
    id: () => `request-${++requestId}`,
  });
  return {
    store,
    inspectEncryptedRecords: () => store.inspectEncryptedRecords(),
    inspectProofKeys: () => store.inspectProofKeys(),
  };
});
