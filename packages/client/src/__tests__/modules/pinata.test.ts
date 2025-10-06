import { describe, it, vi } from "vitest";

// Mock the pinata module to prevent real API calls
vi.mock("../../modules/pinata", () => ({
  getFileByHash: vi.fn().mockResolvedValue({
    data: "mocked file content",
    url: "https://mock-gateway.pinata.cloud/ipfs/bafybeie6wzt62apqp57vtpdtkuth6cakc5ir64nfzd3jpjpmw36r3hbriq",
  }),
}));

import {
  getFileByHash,
  // uploadFileToIPFS,
  // uploadFilesToIPFS,
  // uploadJSONToIPFS,
} from "../../modules/data/pinata";

describe("pinata", () => {
  it("should get file by hash", async () => {
    const file = await getFileByHash("bafybeie6wzt62apqp57vtpdtkuth6cakc5ir64nfzd3jpjpmw36r3hbriq");

    console.log(file);
  });

  // it("should upload file to IPFS", async () => {
  //   const file = await uploadFileToIPFS(new File(["hello"], "hello.txt"));
  // });

  // it("should upload files to IPFS", async () => {
  //   const files = await uploadFilesToIPFS([
  //     new File(["hello"], "hello.txt"),
  //     new File(["world"], "world.txt"),
  //   ]);
  // });

  // it("should upload JSON to IPFS", async () => {
  //   const json = await uploadJSONToIPFS({ hello: "world" });
  // });
});
