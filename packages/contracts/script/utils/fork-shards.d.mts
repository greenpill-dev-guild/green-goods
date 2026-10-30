export interface ForkShard {
  chain?: string;
  description: string;
  glob: string;
  runner?: string;
  productionTargets?: readonly string[];
  testEnv?: Record<string, string>;
  requiredPositiveIntegerEnv?: readonly string[];
  requiredAddressEnv?: readonly string[];
  extraRuns?: ReadonlyArray<{ profile?: string; chain?: string; glob: string; matchTest: string; description: string }>;
}

export const SHARDS: Readonly<Record<string, ForkShard>>;
export const SHARD_ORDER: readonly string[];
export const MANUAL_FORK_FILES: Readonly<Record<string, string>>;
