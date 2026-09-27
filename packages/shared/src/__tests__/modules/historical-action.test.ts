import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";
import { getActionAtWork } from "../../modules/data/historical-action";
import type { GraphQLReader } from "../../modules/data/graphql-client";
import { getEASConfig } from "../../config/blockchain";

const { getFileByHash } = vi.hoisted(() => ({ getFileByHash: vi.fn() }));
vi.mock("../../modules/data/ipfs/resolve", () => ({
  getFileByHash,
  resolveIPFSUrl: (cid: string) => `ipfs://${cid}`,
}));

const workUID = `0x${"1".repeat(64)}`;
const txid = `0x${"2".repeat(64)}`;
const row = {
  id: workUID,
  txid,
  attester: `0x${"3".repeat(40)}`,
  recipient: `0x${"4".repeat(40)}`,
  timeCreated: 1700000000,
  decodedDataJson: JSON.stringify([{ name: "actionUID", value: { value: "7" } }]),
};
const query = vi.fn();
const getTransactionReceipt = vi.fn();
const readContract = vi.fn();
const reader = { query } as GraphQLReader;
const client = { getTransactionReceipt, readContract } as unknown as Pick<
  PublicClient,
  "getTransactionReceipt" | "readContract"
>;
const inputs = [{ key: "yield", title: "Fruit weight", type: "number", options: [], unit: "kg" }];

describe("historical action instructions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query.mockResolvedValue({ data: { attestations: [row] } });
    getTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 123n });
    readContract.mockImplementation(async ({ blockNumber }) => ({
      title: "Harvest",
      slug: "custom.harvest",
      instructions: blockNumber === 123n ? "old-instructions" : "new-instructions",
    }));
    getFileByHash.mockImplementation(async (cid) => ({
      data: JSON.stringify({
        uiConfig: {
          details: {
            inputs: cid === "old-instructions" ? inputs : [{ ...inputs[0], title: "Tree count" }],
          },
        },
      }),
    }));
  });

  it("uses the Work transaction block after the current action's meanings change", async () => {
    const action = await getActionAtWork(7, workUID, 42161, reader, client);
    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      {
        where: {
          id: { equals: workUID },
          schemaId: { equals: getEASConfig(42161).WORK.uid },
          revoked: { equals: false },
        },
      },
      "getActionAtWork"
    );
    expect(getTransactionReceipt).toHaveBeenCalledWith({ hash: txid });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ blockNumber: 123n, args: [7n], functionName: "getAction" })
    );
    expect(action?.inputs).toEqual(inputs);
    expect(getFileByHash).toHaveBeenCalledWith("old-instructions", { timeoutMs: 5000 });
  });

  it("rejects an attestation for a different action before reading its instructions", async () => {
    await expect(getActionAtWork(8, workUID, 42161, reader, client)).rejects.toThrow(
      "requested action"
    );
    expect(readContract).not.toHaveBeenCalled();
  });

  it("never substitutes current instructions when archive state is unavailable", async () => {
    readContract.mockRejectedValue(new Error("Historical state unavailable"));
    await expect(getActionAtWork(7, workUID, 42161, reader, client)).rejects.toThrow(
      "Historical state unavailable"
    );
    expect(readContract).toHaveBeenCalledTimes(1);
    expect(getFileByHash).not.toHaveBeenCalled();
  });

  it("rejects legacy instruction files without recorded definitions instead of using today's template", async () => {
    getFileByHash.mockResolvedValue({ data: JSON.stringify({ description: "No definitions" }) });
    await expect(getActionAtWork(7, workUID, 42161, reader, client)).rejects.toThrow(
      "no recorded input definitions"
    );
  });
});
