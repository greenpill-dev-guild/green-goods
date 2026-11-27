/** Reusable validation for garden configs, action configs, and capital types. */

export interface GardenConfig {
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  [key: string]: unknown;
}

export interface ActionMedia {
  url: string;
  type?: string;
}

/** One input of an action's form, as `uiConfig.details.inputs` declares it. */
export interface ActionInput {
  key: string;
  type: string;
  options?: string[];
}

/** A number an action's reports add up to, read from one or more of its inputs. */
export interface ActionMetricOutput {
  key: string;
  unit: string;
  aggregation: string;
  derivedFrom: string[];
  /**
   * Counts only the reports whose select input holds one of these options, such as one
   * milestone type: `{ "milestoneType": ["Solar kW installed"] }`.
   */
  when?: Record<string, string[]>;
}

export interface ActionConfig {
  title: string;
  slug: string;
  domain: string;
  description: string;
  startTime: string;
  endTime: string;
  capitals: string[];
  media: (string | ActionMedia)[];
  uiConfig?: { details?: { inputs?: ActionInput[] } };
  metricOutputs?: ActionMetricOutput[];
}

/** A share of something else, not a second measure of the number it reads. */
const RATIO_UNITS = new Set(["%"]);

/**
 * What is wrong with an action's metric outputs. One input read alone by outputs in different
 * units means the same number counts as each unit, unless every such pair is split by a
 * condition on the same select input with no option in common: a 20 kWh battery would
 * otherwise add 20 kW of solar. A condition has to name a select input and its options.
 */
export function metricOutputProblems(action: ActionConfig): string[] {
  const outputs = action.metricOutputs ?? [];
  const inputs = action.uiConfig?.details?.inputs ?? [];
  const problems: string[] = [];
  for (const output of outputs) {
    for (const [inputKey, values] of Object.entries(output.when ?? {})) {
      const input = inputs.find((candidate) => candidate.key === inputKey);
      if (input?.type !== "select") {
        problems.push(`${output.key}: its condition names "${inputKey}", which is not a select input`);
        continue;
      }
      for (const value of values) {
        if (!input.options?.includes(value)) {
          problems.push(`${output.key}: "${value}" is not an option of "${inputKey}"`);
        }
      }
    }
  }
  const readAlone = outputs.filter((output) => output.derivedFrom.length === 1 && !RATIO_UNITS.has(output.unit));
  for (const [index, left] of readAlone.entries()) {
    for (const right of readAlone.slice(index + 1)) {
      if (left.derivedFrom[0] !== right.derivedFrom[0] || left.unit === right.unit) continue;
      const split = Object.keys(left.when ?? {}).some((inputKey) => {
        const other = right.when?.[inputKey];
        return other !== undefined && left.when![inputKey].every((value) => !other.includes(value));
      });
      if (!split) {
        problems.push(
          `${left.key} (${left.unit}) and ${right.key} (${right.unit}) both read "${left.derivedFrom[0]}" ` +
            "with no condition that keeps them apart",
        );
      }
    }
  }
  return problems;
}

export interface ActionsConfig {
  actions: ActionConfig[];
}

// Capital enum mapping
export const CAPITAL_MAPPING: Record<string, number> = {
  SOCIAL: 0,
  MATERIAL: 1,
  FINANCIAL: 2,
  LIVING: 3,
  INTELLECTUAL: 4,
  EXPERIENTIAL: 5,
  SPIRITUAL: 6,
  CULTURAL: 7,
};

// Domain enum mapping (matches Solidity Domain enum)
export const DOMAIN_MAPPING: Record<string, number> = {
  SOLAR: 0,
  AGRO: 1,
  EDU: 2,
  WASTE: 3,
};

export class ConfigValidator {
  /**
   * Validate garden configuration
   * @param config - Garden configuration object
   * @throws Error if validation fails
   */
  validateGardenConfig(config: GardenConfig): boolean {
    const required: (keyof GardenConfig)[] = ["name", "description", "location", "bannerImage"];
    const missing = required.filter((field) => !config[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    return true;
  }

  /**
   * Validate actions configuration
   * @param config - Actions configuration object with 'actions' array
   * @throws Error if validation fails
   */
  validateActionsConfig(config: ActionsConfig): boolean {
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
   * @param action - Action configuration object
   * @param index - Action index (for error messages)
   * @throws Error if validation fails
   */
  validateSingleAction(action: ActionConfig, index: number): boolean {
    const required: (keyof ActionConfig)[] = ["title", "slug", "domain", "startTime", "endTime", "capitals"];
    const missing = required.filter((field) => !action[field]);

    if (missing.length > 0) {
      throw new Error(`Action ${index}: Missing required fields: ${missing.join(", ")}`);
    }

    // Validate slug format (domain.action_name)
    if (!/^[a-z]+\.[a-z_]+$/.test(action.slug)) {
      throw new Error(`Action ${index}: Invalid slug format "${action.slug}". Expected "domain.action_name"`);
    }

    // Validate domain
    if (!Object.hasOwn(DOMAIN_MAPPING, action.domain)) {
      throw new Error(
        `Action ${index}: Invalid domain "${action.domain}". Valid: ${Object.keys(DOMAIN_MAPPING).join(", ")}`,
      );
    }

    // Validate slug prefix matches domain
    const slugDomain = action.slug.split(".")[0].toUpperCase();
    if (slugDomain !== action.domain) {
      throw new Error(`Action ${index}: Slug prefix "${slugDomain}" doesn't match domain "${action.domain}"`);
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

    // Validate media (allow empty arrays for the new schema)
    if (!Array.isArray(action.media)) {
      throw new Error(`Action ${index}: Media must be an array`);
    }

    const metricProblems = metricOutputProblems(action);
    if (metricProblems.length > 0) {
      throw new Error(`Action ${index} "${action.slug}": ${metricProblems.join("; ")}`);
    }

    return true;
  }

  /**
   * Parse capital strings to enum values
   * @param capitalStrings - Array of capital type strings
   * @returns Array of capital enum values
   * @throws Error if invalid capital type
   */
  parseCapitals(capitalStrings: string[]): number[] {
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
   * @returns Capital enum mapping
   */
  getCapitalMapping(): Record<string, number> {
    return { ...CAPITAL_MAPPING };
  }

  /**
   * Validate Ethereum address format
   * @param address - Address to validate
   * @returns True if valid
   */
  isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Validate array of Ethereum addresses
   * @param addresses - Array of addresses
   * @returns Array of invalid addresses (empty if all valid)
   */
  getInvalidAddresses(addresses: string[]): string[] {
    return addresses.filter((addr) => !this.isValidAddress(addr));
  }
}
