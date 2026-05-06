#!/usr/bin/env bun

/**
 * Backward-compat shim that delegates to ./deploy/cli.
 */

import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

import { DeploymentCLI } from "./deploy/cli";

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("deploy.ts");
if (isMain) {
  const cli = new DeploymentCLI();
  cli.run(process.argv).catch((error) => {
    console.error("Deploy failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

// Export for programmatic use
export { DeploymentCLI };
