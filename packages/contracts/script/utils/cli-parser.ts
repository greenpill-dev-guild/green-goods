/**
 * CLI Parser - Argument parsing utilities
 *
 * Extracts common CLI argument parsing logic
 */

export interface ParsedOptions {
  network: string;
  broadcast: boolean;
  saveArtifacts: boolean;
  verify: boolean;
  updateSchemasOnly: boolean;
  force: boolean;
  dryRun: boolean;
  pureSimulation: boolean;
  skipEnvio: boolean;
  skipVerification: boolean;
  startIndexer: boolean;
  saveReport: boolean;
  overrideSepoliaGate: boolean;
  sender?: string;
  deploymentSalt?: string;
  help?: boolean;
  error?: string;
}

/** Flags that consume the next argument as their value */
const VALUE_FLAGS = new Set(["--network", "-n", "--chain", "--salt", "--sender"]);

/** Flags whose values contain secrets and must be redacted in logs */
const SENSITIVE_FLAGS = new Set(["--private-key", "--etherscan-api-key", "--account", "--sender"]);

/**
 * Redact sensitive flag values from a forge argument list for safe logging.
 * Returns a new array with secret values replaced by "[REDACTED]".
 *
 * @param args - The full argument list passed to forge
 * @returns A copy with sensitive values replaced
 */
export function redactSensitiveArgs(args: string[]): string[] {
  const redacted: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    redacted.push(arg);
    if (SENSITIVE_FLAGS.has(arg) && i + 1 < args.length) {
      redacted.push("[REDACTED]");
      i++;
    }
  }
  return redacted;
}

export class CliParser {
  /**
   * Parse command line arguments into structured options
   * @param args - process.argv array
   * @returns Parsed options
   */
  parseOptions(args: string[]): ParsedOptions {
    const options: ParsedOptions = {
      network: "localhost",
      broadcast: false,
      saveArtifacts: false,
      verify: true,
      updateSchemasOnly: false,
      force: false,
      dryRun: false,
      pureSimulation: false,
      skipEnvio: false,
      skipVerification: false,
      startIndexer: false,
      saveReport: false,
      overrideSepoliaGate: false,
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      // Skip command (first non-flag argument)
      if (i === 1 && !arg.startsWith("-")) continue;

      switch (arg) {
        case "--network":
        case "-n":
          if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
            return { ...options, error: `${arg} requires a network name` };
          }
          options.network = args[++i];
          break;
        case "--broadcast":
        case "-b":
          options.broadcast = true;
          break;
        case "--save-artifacts":
          options.saveArtifacts = true;
          break;
        case "--update-schemas":
          options.updateSchemasOnly = true;
          break;
        case "--force":
          options.force = true;
          break;
        case "--dry-run":
          options.dryRun = true;
          break;
        case "--pure-simulation":
          options.pureSimulation = true;
          break;
        case "--skip-envio":
          options.skipEnvio = true;
          break;
        case "--skip-verification":
          options.skipVerification = true;
          break;
        case "--start-indexer":
          options.startIndexer = true;
          break;
        case "--save-report":
          options.saveReport = true;
          break;
        case "--override-sepolia-gate":
          options.overrideSepoliaGate = true;
          break;
        case "--salt":
          if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
            return { ...options, error: `${arg} requires a salt value` };
          }
          options.deploymentSalt = args[++i];
          break;
        case "--sender":
          if (i + 1 >= args.length || args[i + 1].startsWith("-")) {
            return { ...options, error: `${arg} requires an address value` };
          }
          options.sender = args[++i];
          break;
        case "--help":
        case "-h":
          return { ...options, help: true };
        default:
          if (arg.startsWith("-")) {
            console.error(`Unknown option: ${arg}`);
            return { ...options, error: `Unknown option: ${arg}` };
          }
      }
    }

    // Auto-disable verification for localhost
    if (options.network === "localhost") {
      options.verify = false;
    }

    return options;
  }

  /**
   * Extract command from arguments
   * @param args - process.argv array
   * @returns Command name or null
   */
  getCommand(args: string[]): string | null {
    if (args.length < 3) return null;
    const potentialCommand = args[2];
    return potentialCommand.startsWith("-") ? null : potentialCommand;
  }

  /**
   * Extract positional argument (e.g., config file path)
   * @param args - process.argv array
   * @param position - Position after command (0-indexed)
   * @returns Argument value or null
   */
  getPositionalArg(args: string[], position = 0): string | null {
    let foundArgs = 0;
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      // Skip flags and their values
      if (arg.startsWith("-")) {
        if (VALUE_FLAGS.has(arg)) i++;
        continue;
      }

      if (foundArgs === position) {
        return arg;
      }
      foundArgs++;
    }
    return null;
  }
}
