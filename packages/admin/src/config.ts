/**
 * Admin Package Configuration
 *
 * Side-effect module: initializes Storacha IPFS from environment variables.
 * Import this module for its side effect (e.g., `import "@/config"`).
 */
import { initializeIpfsFromEnv } from "@green-goods/shared";

// Initialize Storacha IPFS from environment
void initializeIpfsFromEnv(import.meta.env);
