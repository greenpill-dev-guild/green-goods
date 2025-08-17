import { describe, it, expect, vi } from "vitest";

vi.mock("../../modules/pinata", () => ({
  pinata: {
    upload: { private: { file: vi.fn(), json: vi.fn() } },
    gateways: { public: { get: vi.fn(async (h: string) => ({ data: `mock:${h}` })) } },
  },
  uploadFileToIPFS: vi.fn(async (f: File) => ({ IpfsHash: `hash:${f.name}` })),
  uploadJSONToIPFS: vi.fn(async (j: any) => ({ IpfsHash: `hash:${Object.keys(j).length}` })),
  getFileByHash: vi.fn(async (hash: string) => ({ data: `mock:${hash}` })),
}));

import { getFileByHash, uploadJSONToIPFS, uploadFileToIPFS } from "../../modules/pinata";

describe("modules/pinata", () => {
  it("fetches file by hash (mocked)", async () => {
    const file = await getFileByHash("abc");
    expect(file).toHaveProperty("data");
  });

  it("uploads json and file (mocked)", async () => {
    const j = await uploadJSONToIPFS({ foo: "bar" } as any);
    expect(j).toHaveProperty("IpfsHash");
    const f = await uploadFileToIPFS(new File(["hi"], "hi.txt"));
    expect(f).toHaveProperty("IpfsHash");
  });
});
