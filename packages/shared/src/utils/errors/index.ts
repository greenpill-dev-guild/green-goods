/**
 * Error Utilities
 *
 * Centralized error handling, parsing, and formatting utilities.
 *
 * @module utils/errors
 */

export {
  parseContractError,
  isNotGardenerError,
  isAlreadyGardenerError,
  formatErrorForToast,
  parseAndFormatError,
  registerErrorSignature,
  type ParsedContractError,
} from "./contract-errors";

