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
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_PINATA_GATEWAY_URL: import.meta.env.VITE_PINATA_GATEWAY_URL,
});
