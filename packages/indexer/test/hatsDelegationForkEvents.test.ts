// TEST-QUALITY: allow-small-test-file - One ordered fork-log replay requires external rehearsal output; hatsModule.test.ts covers individual handler cases without that input.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AbiCoder, Interface } from "ethers";
import type { Address } from "viem";
import { seedGarden } from "./helpers/garden";
import { mockEvent } from "./helpers/events";
import { createTestIndexer, HatsModule, indexedAddress } from "./v3";

const path = process.env.HATS_DELEGATION_LOGS;
// This integration proof consumes raw EVM logs from the exact-packet fork test, never invented events.
(path ? describe : describe.skip)("Hats delegation fork-log projection", () => {
  it("projects the actual eighteen-garden grant/revoke sequence and actor audit", async () => {
    const logs = AbiCoder.defaultAbiCoder().decode(
      ["tuple(bytes32[] topics,bytes data,address emitter)[]"],
      readFileSync(path!, "utf8").trim()
    )[0] as { topics: string[]; data: string; emitter: string }[];
    const abi = new Interface([
      "event ProtocolRoleHatsUpdated(uint256 team,uint256 productLead,uint256 agents,uint256 deployer)",
      "event RoleGranted(address indexed garden,address indexed account,uint8 role)",
      "event RoleRevoked(address indexed garden,address indexed account,uint8 role)",
      "event RoleManaged(address indexed garden,address indexed actor,address indexed account,uint8 role,bool granted)",
    ]);
    let db = createTestIndexer();
    const gardens = new Set<string>();
    let grants = 0;
    let revocations = 0;
    let audits = 0;
    let configurations = 0;
    for (const [logIndex, log] of logs.entries()) {
      if (log.emitter.toLowerCase() !== indexedAddress("HatsModule", 42161).toLowerCase()) continue;
      let parsed;
      try {
        parsed = abi.parseLog({ topics: Array.from(log.topics), data: log.data });
      } catch {
        continue;
      }
      if (!parsed) continue;
      const params = Object.fromEntries(
        parsed.fragment.inputs.map((field, index) => [field.name, parsed.args[index]])
      );
      // Normalize ABI addresses to the lower-case identity used by the existing roster fixtures.
      for (const field of parsed.fragment.inputs) {
        if (field.type === "address") params[field.name] = String(params[field.name]).toLowerCase();
      }
      if (params.role !== undefined) params.role = BigInt(params.role);
      if (typeof params.garden === "string" && !gardens.has(params.garden.toLowerCase())) {
        gardens.add(params.garden.toLowerCase());
        db = seedGarden(db, params.garden as Address);
      }
      // Vm.recordLogs has no mined tx/block envelope. Explicitly synthetic replay metadata.
      const metadata = mockEvent(42161, 2_000_000_000, { logIndex });
      if (parsed.name === "ProtocolRoleHatsUpdated") {
        db = await HatsModule.ProtocolRoleHatsUpdated.processEvent({
          event: HatsModule.ProtocolRoleHatsUpdated.createMockEvent({
            ...params,
            mockEventData: metadata,
          }),
          mockDb: db,
        });
        configurations++;
      } else if (parsed.name === "RoleManaged") {
        db = await HatsModule.RoleManaged.processEvent({
          event: HatsModule.RoleManaged.createMockEvent({ ...params, mockEventData: metadata }),
          mockDb: db,
        });
        const audit = await db.GardenRoleOperation.get(
          `42161:${metadata.transaction.hash}:${logIndex}`
        );
        assert.equal(audit?.actor, String(params.actor).toLowerCase());
        audits++;
      } else {
        const api = parsed.name === "RoleGranted" ? HatsModule.RoleGranted : HatsModule.RoleRevoked;
        db = await api.processEvent({
          event: api.createMockEvent({ ...params, mockEventData: metadata }),
          mockDb: db,
        });
        if (params.role === 2n) {
          const row = await db.Garden.get(String(params.garden).toLowerCase());
          const present = row?.operators.includes(String(params.account).toLowerCase());
          assert.equal(present, parsed.name === "RoleGranted");
          if (parsed.name === "RoleGranted") grants++;
          else revocations++;
        }
      }
    }
    assert.equal(gardens.size, 18);
    assert.equal(grants, 18);
    assert.equal(revocations, 18);
    assert.equal(audits, 36);
    assert.equal(configurations, 1);
  });
});
