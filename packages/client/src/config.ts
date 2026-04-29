/**
 * Client Package Configuration
 *
 * Side-effect module: initializes IPFS upload/gateway settings from environment.
 * Imported as `import "@/config"` in main.tsx.
 */
import { initializeIpfsFromEnv } from "@green-goods/shared";

// Initialize IPFS upload/gateway settings from environment
void initializeIpfsFromEnv({
  MODE: import.meta.env.MODE,
  VITE_PINATA_API_URL: import.meta.env.VITE_PINATA_API_URL,
  VITE_PINATA_GATEWAY_URL: import.meta.env.VITE_PINATA_GATEWAY_URL,
  VITE_PINATA_JWT: import.meta.env.VITE_PINATA_JWT,
});
