/**
 * CLI Parser - Argument parsing utilities
 *
 * Extracts common CLI argument parsing logic
 */

class CliParser {
  /**
   * Parse command line arguments into structured options
   * @param {string[]} args - process.argv array
   * @returns {Object} Parsed options
   */
  parseOptions(args) {
    const options = {
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
          return { help: true };
        default:
          if (arg.startsWith("-")) {
            console.error(`Unknown option: ${arg}`);
            return { error: `Unknown option: ${arg}` };
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
   * @param {string[]} args - process.argv array
   * @returns {string|null} Command name
   */
  getCommand(args) {
    if (args.length < 3) return null;
    const potentialCommand = args[2];
    return potentialCommand.startsWith("-") ? null : potentialCommand;
  }

  /**
   * Extract positional argument (e.g., config file path)
   * @param {string[]} args - process.argv array
   * @param {number} position - Position after command (0-indexed)
   * @returns {string|null} Argument value
   */
  getPositionalArg(args, position = 0) {
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

module.exports = { CliParser };
