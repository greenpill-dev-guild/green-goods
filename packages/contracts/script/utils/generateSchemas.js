#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Generate EAS schema string from fields array
 * @param {Array} fields - Array of field objects with name and type properties
 * @returns {string} - EAS schema string in format "type1 name1,type2 name2,..."
 */
function generateSchemaString(fields) {
  return fields.map((field) => `${field.type} ${field.name}`).join(",");
}

/**
 * Load schemas from config file and generate schema strings
 * @param {string} configPath - Path to schemas.json file
 * @returns {Object} - Object with schema strings added to each schema
 */
function loadSchemasWithGenerated(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Generate schema strings for each schema
  for (const [, schemaConfig] of Object.entries(config.schemas)) {
    if (schemaConfig.fields && Array.isArray(schemaConfig.fields)) {
      schemaConfig.generatedSchema = generateSchemaString(schemaConfig.fields);
    }
  }

  return config;
}

/**
 * Main function - if called directly, output schema strings for specific schema
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node generateSchemas.js <schemaName>");
    console.error("Available schemas: gardenAssessment, work, workApproval");
    process.exit(1);
  }

  const schemaName = args[0];
  const configPath = path.join(__dirname, "../../config/schemas.json");

  try {
    const config = loadSchemasWithGenerated(configPath);

    if (!config.schemas[schemaName]) {
      console.error(`Schema '${schemaName}' not found`);
      process.exit(1);
    }

    const schema = config.schemas[schemaName];
    if (schema.generatedSchema) {
      console.log(schema.generatedSchema);
    } else {
      console.error(`No fields found for schema '${schemaName}'`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error loading schemas:", error.message);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = {
  generateSchemaString,
  loadSchemasWithGenerated,
};

// Run main function if called directly
if (require.main === module) {
  main();
}
