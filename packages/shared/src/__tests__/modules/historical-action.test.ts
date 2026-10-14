import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Abi,
  type AbiEvent,
  type Address,
  type Hex,
  type PublicClient,
  encodeAbiParameters,
  encodeEventTopics,
  getAbiItem,
} from "viem";
import { ActionRegistryABI, EASABI, getNetworkContracts } from "../../utils/blockchain/contracts";
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
const getLogs = vi.fn();
const reader = { query } as GraphQLReader;
const client = { getTransactionReceipt, readContract, getLogs } as unknown as Pick<
  PublicClient,
  "getTransactionReceipt" | "readContract" | "getLogs"
>;
const inputs = [
  {
    key: "yield",
    title: "Fruit weight",
    type: "number",
    options: [],
    unit: "kg",
    placeholder: "",
    required: false,
  },
];

const blockHash = `0x${"5".repeat(64)}` as Hex;
function eventLog(
  abi: Abi,
  eventName: string,
  args: Record<string, unknown>,
  logIndex: number,
  address: Address
) {
  const event = getAbiItem({ abi, name: eventName }) as AbiEvent;
  const dataInputs = event.inputs.filter((input) => !input.indexed);
  return {
    address,
    blockHash,
    blockNumber: 123n,
    transactionHash: txid as Hex,
    transactionIndex: logIndex < 10 ? 1 : logIndex < 20 ? 2 : 3,
    logIndex,
    removed: false,
    topics: encodeEventTopics({ abi, eventName, args }),
    data: encodeAbiParameters(
      dataInputs,
      dataInputs.map((input) => args[input.name!])
    ),
  };
}
function update(instructions: string, logIndex: number, actionUID = 7n) {
  return eventLog(
    ActionRegistryABI,
    "ActionInstructionsUpdated",
    {
      owner: row.attester,
      actionUID,
      instructions,
    },
    logIndex,
    getNetworkContracts(42161).actionRegistry
  );
}

describe("historical action instructions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query.mockResolvedValue({ data: { attestations: [row] } });
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      blockNumber: 123n,
      blockHash,
      transactionIndex: 2,
      logs: [
        eventLog(
          EASABI,
          "Attested",
          {
            recipient: row.recipient,
            attester: row.attester,
            uid: workUID,
            schemaUID: getEASConfig(42161).WORK.uid,
          },
          15,
          getEASConfig(42161).EAS.address as Address
        ),
      ],
    });
    getLogs.mockResolvedValue([]);
    readContract.mockImplementation(async ({ blockNumber }) => ({
      title: "Harvest",
      slug: "custom.harvest",
      instructions: blockNumber === 122n ? "old-instructions" : "new-instructions",
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

  it("uses the pre-block state when the action does not change before the Work", async () => {
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
      expect.objectContaining({ blockNumber: 122n, args: [7n], functionName: "getAction" })
    );
    expect(action?.inputs).toEqual(inputs);
    expect(getFileByHash).toHaveBeenCalledWith("old-instructions", { timeoutMs: 5000 });
  });

  it("replays earlier transactions and earlier logs in the Work transaction, never later updates", async () => {
    getLogs.mockResolvedValue([
      update("new-instructions", 20),
      update("new-instructions", 17),
      update("old-instructions", 12),
      update("new-instructions", 5),
      update("unrelated", 13, 8n),
    ]);
    const action = await getActionAtWork(7, workUID, 42161, reader, client);
    expect(action?.inputs).toEqual(inputs);
    expect(getLogs).toHaveBeenCalledWith({
      address: getNetworkContracts(42161).actionRegistry,
      blockHash,
    });
    expect(getFileByHash).toHaveBeenCalledWith("old-instructions", { timeoutMs: 5000 });
  });

  it("uses a registration earlier in the submission block", async () => {
    readContract.mockResolvedValue({ title: "", slug: "", instructions: "" });
    getLogs.mockResolvedValue([
      eventLog(
        ActionRegistryABI,
        "ActionRegistered",
        {
          owner: row.attester,
          actionUID: 7n,
          startTime: 0n,
          endTime: 10n,
          title: "Harvest",
          slug: "custom.harvest",
          instructions: "old-instructions",
          capitals: [],
          media: [],
          domain: 1,
        },
        5,
        getNetworkContracts(42161).actionRegistry
      ),
    ]);
    expect((await getActionAtWork(7, workUID, 42161, reader, client))?.inputs).toEqual(inputs);
  });

  it("fails closed when the receipt does not prove the requested attestation position", async () => {
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      blockNumber: 123n,
      blockHash,
      logs: [],
    });
    await expect(getActionAtWork(7, workUID, 42161, reader, client)).rejects.toThrow("position");
    expect(readContract).not.toHaveBeenCalled();
  });

  it.each([
    null,
    3,
    "bad",
    {},
    { ...inputs[0], type: "unknown" },
    { ...inputs[0], options: [null] },
    { ...inputs[0], optionLabels: { clay: 3 } },
    { ...inputs[0], type: "repeater", repeaterFields: [null] },
    {
      ...inputs[0],
      type: "repeater",
      repeaterFields: [{ ...inputs[0], type: "repeater", repeaterFields: [false] }],
    },
  ])("rejects malformed historical inputs before localization: %j", async (invalid) => {
    getFileByHash.mockResolvedValue({
      data: JSON.stringify({ uiConfig: { details: { inputs: [invalid] } } }),
    });
    await expect(getActionAtWork(7, workUID, 42161, reader, client)).rejects.toThrow(
      "invalid entries"
    );
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
