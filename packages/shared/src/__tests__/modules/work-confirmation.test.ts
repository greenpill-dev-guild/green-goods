import { describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Log } from "viem";
import type { EASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import {
  readConfirmedWork,
  AwaitingWorkConfirmation,
  WorkTransactionReverted,
  reconcileWorkTransaction,
  claimWorkJobs,
} from "../../modules/work/work-confirmation";
const hash = `0x${"12".repeat(32)}` as const;
describe("work confirmation", () => {
  it.each(["success", "reverted"])("classifies a %s receipt", async (status) => {
    expect(await reconcileWorkTransaction(hash, 11155111, async () => ({ status }))).toBe(
      status === "success" ? "confirmed" : "reverted"
    );
  });
  it("does not infer failure from missing receipts or network errors", async () => {
    expect(
      await reconcileWorkTransaction(hash, 11155111, async () => {
        throw new Error("not found");
      })
    ).toBe("unresolved");
  });
  it("preserves opaque wallet identifiers without a receipt query", async () => {
    const read = vi.fn();
    expect(await reconcileWorkTransaction("0xsafe", 11155111, read)).toBe("unresolved");
    expect(read).not.toHaveBeenCalled();
  });
  it("excludes a batch and an ordinary attempt on the same job", () => {
    const release = claimWorkJobs(["a", "b"]);
    expect(release).not.toBeNull();
    expect(claimWorkJobs(["b"])).toBeNull();
    release!();
    const next = claimWorkJobs(["b"]);
    expect(next).not.toBeNull();
    next!();
  });
});

describe("receipt-confirmed work cards", () => {
  const garden = "0x2222222222222222222222222222222222222222" as const;
  const owner = "0x1111111111111111111111111111111111111111" as const;
  const emitter = "0x3333333333333333333333333333333333333333" as const;
  const schema = `0x${"44".repeat(32)}` as const;
  const uid = `0x${"55".repeat(32)}` as const;
  const otherUid = `0x${"66".repeat(32)}` as const;
  const published = {
    data: "0x1234" as const,
    metadata: { title: "Planting", clientWorkId: "receipt-copy", details: { count: 3 } },
    media: ["uploaded-photo"],
  };
  const job = {
    id: "receipt-job",
    kind: "work",
    userAddress: owner,
    chainId: 11155111,
    createdAt: 1,
    attempts: 0,
    synced: false,
    payload: {
      gardenAddress: garden,
      actionUID: 1,
      feedback: "Done",
      uploadCheckpoint: { submittedAt: "2026-10-06", files: {}, published },
    },
  };
  const config = { EAS: { address: emitter }, WORK: { uid: schema, schema: "" } } as EASConfig;
  function log(id = uid, overrides: Record<string, string> = {}): Log {
    return {
      address: overrides.address ?? emitter,
      data: encodeAbiParameters([{ type: "bytes32" }], [id]),
      topics: encodeEventTopics({
        abi: EASABI,
        eventName: "Attested",
        args: {
          recipient: overrides.recipient ?? garden,
          attester: overrides.attester ?? owner,
          schemaUID: overrides.schema ?? schema,
        },
      }),
    } as Log;
  }
  const attestation = (id = uid, data: `0x${string}` = published.data) => ({
    uid: id,
    schema,
    recipient: garden,
    attester: owner,
    data,
    time: 1800000000n,
  });
  it("matches the exact published bytes in a batched receipt and retains the uploaded preview", async () => {
    const read = vi.fn(async (id) => attestation(id, id === uid ? published.data : "0x5678"));
    const work = await readConfirmedWork(job, hash, 11155111, {
      easConfig: config,
      receipt: async () => ({ status: "success", logs: [log(otherUid), log()] }),
      attestation: read,
    });
    expect(work).toMatchObject({
      id: uid,
      media: published.media,
      status: "pending",
      createdAt: 1800000000,
    });
    expect(JSON.parse(work!.metadata)).toEqual(published.metadata);
  });
  it.each([
    "address",
    "recipient",
    "attester",
    "schema",
  ])("refuses a receipt with another %s", async (field) => {
    const value = field === "schema" ? otherUid : "0x9999999999999999999999999999999999999999";
    const read = vi.fn();
    await expect(
      readConfirmedWork(job, hash, 11155111, {
        easConfig: config,
        receipt: async () => ({ status: "success", logs: [log(uid, { [field]: value })] }),
        attestation: read,
      })
    ).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
    expect(read).not.toHaveBeenCalled();
  });
  it.each(["pending", "reverted"])("never publishes a %s receipt", async (status) => {
    await expect(
      readConfirmedWork(job, hash, 11155111, {
        easConfig: config,
        receipt: async () => ({ status, logs: [log()] }),
      })
    ).rejects.toBeInstanceOf(
      status === "reverted" ? WorkTransactionReverted : AwaitingWorkConfirmation
    );
  });
  it("keeps an interrupted attestation read unresolved instead of erasing or resending the work", async () => {
    await expect(
      readConfirmedWork(job, hash, 11155111, {
        easConfig: config,
        receipt: async () => ({ status: "success", logs: [log()] }),
        attestation: async () => {
          throw new Error("RPC unavailable");
        },
      })
    ).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
  });
  it("does not assign an ambiguous duplicate identity", async () => {
    await expect(
      readConfirmedWork(job, hash, 11155111, {
        easConfig: config,
        receipt: async () => ({ status: "success", logs: [log(), log(otherUid)] }),
        attestation: async (id) => attestation(id),
      })
    ).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
  });
  it("refuses another chain or a checkpoint belonging to a different local work identity", async () => {
    await expect(readConfirmedWork(job, hash, 42161, { easConfig: config })).rejects.toBeInstanceOf(
      AwaitingWorkConfirmation
    );
    await expect(
      readConfirmedWork(
        { ...job, payload: { ...job.payload, clientWorkId: "another-work" } },
        hash,
        11155111,
        { easConfig: config }
      )
    ).rejects.toBeInstanceOf(AwaitingWorkConfirmation);
  });
});
