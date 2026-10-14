import type { IpfsGateway, IpfsReadOptions } from "../data/ipfs/gateway";
import { getFileByHash, getJsonByHash } from "../data/ipfs/resolve";
import { type IpfsPinner, ipfsPinner, type JsonUploadContext } from "../data/ipfs/upload";
import { demoDocumentFor } from "./demo/demo-gate";

export interface CommitmentDocumentStore {
  pinJson(document: Record<string, unknown>, context?: JsonUploadContext): Promise<string>;
  readJson<T = unknown>(cid: string, options?: IpfsReadOptions): Promise<T>;
}

export interface CommitmentDocumentStoreDependencies {
  gateway?: IpfsGateway;
  pinner?: IpfsPinner;
  demoReader?: (cid: string) => Promise<Record<string, unknown> | null>;
}

const defaultGateway: IpfsGateway = {
  readFile: getFileByHash,
  readJson: getJsonByHash,
};

export function createCommitmentDocumentStore({
  gateway = defaultGateway,
  pinner = ipfsPinner,
  demoReader = demoDocumentFor,
}: CommitmentDocumentStoreDependencies = {}): CommitmentDocumentStore {
  return {
    pinJson: async (document, context) => (await pinner.pinJson(document, context)).cid,
    readJson: async <T>(cid: string, options: IpfsReadOptions = {}) => {
      const demoDocument = await demoReader(cid);
      return demoDocument !== null ? (demoDocument as T) : gateway.readJson<T>(cid, options);
    },
  };
}

export const commitmentDocumentStore = createCommitmentDocumentStore();
