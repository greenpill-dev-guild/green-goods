import { describe, expect, it, vi } from "vitest";
import { createCommitmentDocumentStore } from "../modules/commitment-pooling/document-store";
import type { IpfsGateway, IpfsReadOptions } from "../modules/data/ipfs/gateway";
import type { IpfsPinner, JsonUploadContext } from "../modules/data/ipfs/upload";

function dependencies(options: {
  gatewayRead?: (identifier: string, readOptions?: IpfsReadOptions) => Promise<unknown>;
  pinJson?: (
    document: Record<string, unknown>,
    context?: JsonUploadContext
  ) => Promise<{ cid: string }>;
  demoDocument?: Record<string, unknown> | null;
}) {
  const gatewayRead = options.gatewayRead ?? vi.fn();
  const pinJson = options.pinJson ?? vi.fn();
  const gateway: IpfsGateway = {
    readFile: vi.fn(),
    readJson: <T>(identifier: string, readOptions?: IpfsReadOptions) =>
      gatewayRead(identifier, readOptions) as Promise<T>,
  };
  const pinner: IpfsPinner = {
    pinFile: vi.fn(),
    pinJson: (document, context) => pinJson(document, context) as Promise<{ cid: string }>,
  };
  return {
    gatewayRead,
    pinJson,
    store: createCommitmentDocumentStore({
      gateway,
      pinner,
      demoReader: vi.fn().mockResolvedValue(options.demoDocument ?? null),
    }),
  };
}

describe("CommitmentDocumentStore", () => {
  it("keeps demo-document selection inside the read adapter", async () => {
    const { gatewayRead, store } = dependencies({
      demoDocument: { version: 1, purpose: "Fixture charter" },
    });

    await expect(store.readJson("bafy-demo-charter")).resolves.toEqual({
      version: 1,
      purpose: "Fixture charter",
    });
    expect(gatewayRead).not.toHaveBeenCalled();
  });

  it("falls through to the injected gateway for non-demo CIDs", async () => {
    const gatewayRead = vi.fn().mockResolvedValue({ version: 1, reason: "Plans changed" });
    const { store } = dependencies({ gatewayRead, demoDocument: null });

    await expect(store.readJson("bafy-reason")).resolves.toEqual({
      version: 1,
      reason: "Plans changed",
    });
    expect(gatewayRead).toHaveBeenCalledWith("bafy-reason", {});
  });

  it("returns the CID from the injected pinner and preserves upload context", async () => {
    const pinJson = vi.fn().mockResolvedValue({ cid: "bafy-charter" });
    const { store } = dependencies({ pinJson });

    await expect(
      store.pinJson(
        { version: 1, purpose: "Neighbourly help" },
        { source: "pool-console", metadataType: "commitment-pool-charter" }
      )
    ).resolves.toBe("bafy-charter");
    expect(pinJson).toHaveBeenCalledWith(
      { version: 1, purpose: "Neighbourly help" },
      { source: "pool-console", metadataType: "commitment-pool-charter" }
    );
  });
});
