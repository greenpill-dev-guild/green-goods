import {
  initializePinata,
  getFileByHash as sharedGetFileByHash,
  resolveIPFSUrl as sharedResolveIPFSUrl,
  uploadFileToIPFS as sharedUploadFileToIPFS,
  uploadJSONToIPFS as sharedUploadJSONToIPFS,
} from "@green-goods/shared/modules";

const GATEWAY_BASE_URL = "https://greengoods.mypinata.cloud";

// Initialize Pinata SDK with admin configuration
export const pinata = initializePinata({
  jwt: import.meta.env.VITE_PINATA_JWT as string,
  gatewayBaseUrl: GATEWAY_BASE_URL,
});

// Wrapper functions with admin gateway URL pre-applied
export function resolveIPFSUrl(url: string): string {
  return sharedResolveIPFSUrl(url, GATEWAY_BASE_URL);
}

// Re-export other utilities for convenience
export const getFileByHash = sharedGetFileByHash;
export const uploadFileToIPFS = sharedUploadFileToIPFS;
export const uploadJSONToIPFS = sharedUploadJSONToIPFS;
