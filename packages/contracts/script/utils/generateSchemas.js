#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

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
  const schemasArray = JSON.parse(fs.readFileSync(configPath, "utf8"));

  // Convert array to object with schema strings generated
  const schemasObj = {};

  for (const schemaConfig of schemasArray) {
    if (schemaConfig.fields && Array.isArray(schemaConfig.fields)) {
      schemaConfig.generatedSchema = generateSchemaString(schemaConfig.fields);
    }
    schemasObj[schemaConfig.id] = schemaConfig;
  }

  return { schemas: schemasObj };
}

/**
 * Get a specific schema by ID
 * @param {string} configPath - Path to schemas.json file
 * @param {string} schemaId - ID of the schema to retrieve
 * @returns {Object} - Schema object with generated schema string
 */
function getSchemaById(configPath, schemaId) {
  const schemasArray = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const schema = schemasArray.find((s) => s.id === schemaId);

  if (!schema) {
    throw new Error(`Schema '${schemaId}' not found`);
  }

  if (schema.fields && Array.isArray(schema.fields)) {
    schema.generatedSchema = generateSchemaString(schema.fields);
  }

  return schema;
}

/**
 * Get all available schema IDs
 * @param {string} configPath - Path to schemas.json file
 * @returns {Array} - Array of schema IDs
 */
function getSchemaIds(configPath) {
  const schemasArray = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return schemasArray.map((s) => s.id);
}

/**
 * Main function - if called directly, output schema strings for specific schema
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node generateSchemas.js <schemaId>");

    const configPath = path.join(__dirname, "../../config/schemas.json");
    try {
      const availableIds = getSchemaIds(configPath);
      console.error("Available schemas:", availableIds.join(", "));
    } catch (error) {
      console.error("Error loading schemas:", error.message);
    }

    process.exit(1);
  }

  const schemaId = args[0];
  const configPath = path.join(__dirname, "../../config/schemas.json");

  try {
    const schema = getSchemaById(configPath, schemaId);

    if (schema.generatedSchema) {
      console.log(schema.generatedSchema);
    } else {
      console.error(`No fields found for schema '${schemaId}'`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error loading schema:", error.message);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = {
  generateSchemaString,
  loadSchemasWithGenerated,
  getSchemaById,
  getSchemaIds,
};

// Run main function if called directly
if (require.main === module) {
  main();
}
