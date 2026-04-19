/**
 * Client Package Configuration
 *
 * Side-effect module: initializes IPFS upload/gateway settings from environment.
 * Imported as `import "@/config"` in main.tsx.
 */
import { initializeIpfsFromEnv } from "@green-goods/shared";

// Initialize IPFS upload/gateway settings from environment
void initializeIpfsFromEnv(import.meta.env);
