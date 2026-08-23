// Client initialization & status
export {
  type IpfsConfig,
  type IpfsInitStatus,
  initializeIpfs,
  initializeIpfsFromEnv,
  getIpfsInitStatus,
  IPFS_FALLBACK_GATEWAYS,
} from "./client";

// Upload functions & context types
export {
  type FileUploadContext,
  type IpfsPinner,
  ipfsPinner,
  type JsonUploadContext,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./upload";

export { createGatewayChain, type IpfsGateway, type IpfsReadOptions } from "./gateway";

// Resolution, parsing, fetching
export {
  canonicalizeIPFSIdentifier,
  getFileByHash,
  type GetFileByHashOptions,
  getIPFSFallbackGateways,
  getJsonByHash,
  parseIPFSReference,
  resolveAvatarUrl,
  resolveImageUrl,
  resolveIPFSUrl,
  tryParseJson,
} from "./resolve";
