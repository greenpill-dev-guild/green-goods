/**
 * Client Package Configuration
 *
 * Side-effect module: initializes Storacha IPFS from environment.
 * Imported as `import "@/config"` in main.tsx.
 */
import { initializeIpfsFromEnv } from "@green-goods/shared";

// Initialize Storacha IPFS from environment
void initializeIpfsFromEnv(import.meta.env);
