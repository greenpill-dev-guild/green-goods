export type PackageCommand = "build" | "test" | "fork" | "audit" | "format" | "lint" | "clean";

export type CleanScope = "artifacts" | "test-cache";

/** A step that spawns a process. */
export interface SpawnStep {
  command: string;
  args: string[];
  env: Record<string, string>;
  clean?: undefined;
}

/** A step that removes build artifacts in process rather than spawning one. */
export interface CleanStep {
  clean: CleanScope;
  command?: undefined;
  args?: undefined;
  env?: undefined;
}

export type PackageStep = SpawnStep | CleanStep;

/** What `resolvePackageCommand` returns for a command it will run. */
export interface PackagePlan {
  command: PackageCommand;
  cwd: string;
  steps: PackageStep[];
  loadRootEnvironment: boolean;
  explain: boolean;
  help?: undefined;
}

/** What it returns for `--help`: the command's usage line and no steps. */
export interface PackageHelp {
  help: string;
  steps: PackageStep[];
  command?: undefined;
  cwd?: undefined;
  loadRootEnvironment?: undefined;
  explain?: undefined;
}

export const CONTRACTS_ROOT: string;
export const COMMAND_HELP: Record<PackageCommand, string>;

export function resolvePackageCommand(
  command: string,
  argv: string[],
  env?: Record<string, string | undefined>,
): PackagePlan | PackageHelp;

export function cleanArtifacts(scope: CleanScope, cwd: string): void;

export function executePackagePlan(
  plan: PackagePlan,
  dependencies?: {
    env?: Record<string, string | undefined>;
    /** node:child_process spawn, or a stand-in for it in tests. */
    spawnImpl?: (...args: never[]) => unknown;
    clean?: (scope: CleanScope, cwd: string) => void;
  },
): Promise<{ code: number; signal?: string | null }>;
