import type { spawn } from "node:child_process";
import type { Resolution } from "./operations.mjs";

export function executeOperation(
  resolution: Resolution,
  options?: { env?: NodeJS.ProcessEnv; signalHost?: NodeJS.Process; spawnImpl?: typeof spawn },
): Promise<{ code: number; signal: string | null | undefined }>;
