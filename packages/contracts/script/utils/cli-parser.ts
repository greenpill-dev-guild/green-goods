/**
 * CLI Parser - Argument parsing utilities
 *
 * Extracts common CLI argument parsing logic
 */

export interface ParsedOptions {
  network: string;
  broadcast: boolean;
  verify: boolean;
  updateSchemasOnly: boolean;
  force: boolean;
  dryRun: boolean;
  skipEnvio: boolean;
  skipVerification: boolean;
  startIndexer: boolean;
  saveReport: boolean;
  help?: boolean;
  error?: string;
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
      verify: true,
      updateSchemasOnly: false,
      force: false,
      dryRun: false,
      skipEnvio: false,
      skipVerification: false,
      startIndexer: false,
      saveReport: false,
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      // Skip command (first non-flag argument)
      if (i === 1 && !arg.startsWith("-")) continue;

      switch (arg) {
        case "--network":
        case "-n":
          options.network = args[++i];
          break;
        case "--broadcast":
        case "-b":
          options.broadcast = true;
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
        // Skip next arg if this is a flag that takes a value
        if (arg === "--network" || arg === "-n" || arg === "--chain") {
          i++;
        }
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
