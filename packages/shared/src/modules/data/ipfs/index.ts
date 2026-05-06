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
  type JsonUploadContext,
  uploadFileToIPFS,
  uploadJSONToIPFS,
} from "./upload";

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
  toCanonicalIPFSUri,
  tryParseJson,
} from "./resolve";
