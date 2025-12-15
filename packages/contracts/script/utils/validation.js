/**
 * ConfigValidator - Centralized configuration validation
 *
 * Extracted from deploy.js to provide reusable validation
 * for garden configs, action configs, and capital types.
 */

// Capital enum mapping
const CAPITAL_MAPPING = {
  SOCIAL: 0,
  MATERIAL: 1,
  FINANCIAL: 2,
  LIVING: 3,
  INTELLECTUAL: 4,
  EXPERIENTIAL: 5,
  SPIRITUAL: 6,
  CULTURAL: 7,
};

class ConfigValidator {
  /**
   * Validate garden configuration
   * @param {Object} config - Garden configuration object
   * @throws {Error} If validation fails
   */
  validateGardenConfig(config) {
    const required = ["name", "description", "location", "bannerImage", "gardeners", "operators"];
    const missing = required.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    // Validate addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;

    const invalidGardeners = config.gardeners.filter((addr) => !addressRegex.test(addr));
    if (invalidGardeners.length > 0) {
      throw new Error(`Invalid gardener addresses: ${invalidGardeners.join(", ")}`);
    }

    const invalidOperators = config.operators.filter((addr) => !addressRegex.test(addr));
    if (invalidOperators.length > 0) {
      throw new Error(`Invalid operator addresses: ${invalidOperators.join(", ")}`);
    }

    return true;
  }

  /**
   * Validate actions configuration
   * @param {Object} config - Actions configuration object with 'actions' array
   * @throws {Error} If validation fails
   */
  validateActionsConfig(config) {
    if (!config.actions || !Array.isArray(config.actions)) {
      throw new Error('Config must have an "actions" array');
    }

    if (config.actions.length === 0) {
      throw new Error("At least one action must be provided");
    }

    config.actions.forEach((action, index) => {
      this.validateSingleAction(action, index);
    });

    return true;
  }

  /**
   * Validate a single action
   * @param {Object} action - Action configuration object
   * @param {number} index - Action index (for error messages)
   * @throws {Error} If validation fails
   */
  validateSingleAction(action, index) {
    const required = ["title", "instructions", "startTime", "endTime", "capitals", "media"];
    const missing = required.filter((field) => !action[field]);

    if (missing.length > 0) {
      throw new Error(`Action ${index}: Missing required fields: ${missing.join(", ")}`);
    }

    // Validate capitals
    const invalidCapitals = action.capitals.filter((capital) => !Object.hasOwn(CAPITAL_MAPPING, capital));
    if (invalidCapitals.length > 0) {
      throw new Error(`Action ${index}: Invalid capitals: ${invalidCapitals.join(", ")}`);
    }

    // Validate dates
    const startTime = new Date(action.startTime);
    const endTime = new Date(action.endTime);
    const now = new Date();

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new Error(`Action ${index}: Invalid date format. Use ISO 8601 format`);
    }

    if (startTime >= endTime) {
      throw new Error(`Action ${index}: Start time must be before end time`);
    }

    // Warn if endTime is in the past or very close to now
    if (endTime <= now) {
      throw new Error(
        `Action ${index} "${action.title}": End time ${action.endTime} is in the past! ` +
          `Current time: ${now.toISOString()}`,
      );
    }

    const hoursUntilEnd = (endTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilEnd < 24) {
      console.warn(`⚠️  Warning: Action ${index} "${action.title}" ends in less than 24 hours (${action.endTime})`);
    }

    // Validate media
    if (!Array.isArray(action.media) || action.media.length === 0) {
      throw new Error(`Action ${index}: Media must be a non-empty array`);
    }

    return true;
  }

  /**
   * Parse capital strings to enum values
   * @param {string[]} capitalStrings - Array of capital type strings
   * @returns {number[]} Array of capital enum values
   * @throws {Error} If invalid capital type
   */
  parseCapitals(capitalStrings) {
    return capitalStrings.map((capital) => {
      const upperCapital = capital.toUpperCase();
      if (CAPITAL_MAPPING[upperCapital] !== undefined) {
        return CAPITAL_MAPPING[upperCapital];
      }
      throw new Error(`Invalid capital type: ${capital}`);
    });
  }

  /**
   * Get capital mapping object
   * @returns {Object} Capital enum mapping
   */
  getCapitalMapping() {
    return { ...CAPITAL_MAPPING };
  }

  /**
   * Validate Ethereum address format
   * @param {string} address - Address to validate
   * @returns {boolean} True if valid
   */
  isValidAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate array of Ethereum addresses
   * @param {string[]} addresses - Array of addresses
   * @returns {string[]} Array of invalid addresses (empty if all valid)
   */
  getInvalidAddresses(addresses) {
    return addresses.filter((addr) => !this.isValidAddress(addr));
  }
}

module.exports = { ConfigValidator, CAPITAL_MAPPING };
