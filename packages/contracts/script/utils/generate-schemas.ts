#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

export interface SchemaField {
  name: string;
  type: string;
}

export interface SchemaConfig {
  name?: string;
  description?: string;
  fields: SchemaField[];
  generatedSchema?: string;
}

export interface SchemasFile {
  schemas: Record<string, SchemaConfig>;
}

/**
 * Generate EAS schema string from fields array
 */
export function generateSchemaString(fields: SchemaField[]): string {
  return fields.map((field) => `${field.type} ${field.name}`).join(",");
}

/**
 * Load schemas from config file and generate schema strings
 */
export function loadSchemasWithGenerated(configPath: string): { schemas: Record<string, SchemaConfig> } {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as SchemasFile;
  const schemasObj = config.schemas || {};

  // Generate schema strings for each schema
  for (const schemaConfig of Object.values(schemasObj)) {
    if (schemaConfig.fields && Array.isArray(schemaConfig.fields)) {
      schemaConfig.generatedSchema = generateSchemaString(schemaConfig.fields);
    }
  }

  return { schemas: schemasObj };
}

/**
 * Get a specific schema by ID
 */
export function getSchemaById(configPath: string, schemaId: string): SchemaConfig {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as SchemasFile;
  const schemasObj = config.schemas || {};

  // Map common aliases to actual schema keys
  const schemaMap: Record<string, string> = {
    assessment: "assessment",
    work: "work",
    workApproval: "workApproval",
  };

  const actualSchemaKey = schemaMap[schemaId] || schemaId;
  const schema = schemasObj[actualSchemaKey];

  if (!schema) {
    throw new Error(`Schema '${schemaId}' not found (tried key: '${actualSchemaKey}')`);
  }

  if (schema.fields && Array.isArray(schema.fields)) {
    schema.generatedSchema = generateSchemaString(schema.fields);
  }

  return schema;
}

/**
 * Get all available schema IDs
 */
export function getSchemaIds(configPath: string): string[] {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as SchemasFile;
  const schemasObj = config.schemas || {};
  return Object.keys(schemasObj);
}

/**
 * Main function - if called directly, output schema strings for specific schema
 */
function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun generate-schemas.ts <schemaId>");

    const configPath = path.join(__dirname, "../../config/schemas.json");
    try {
      const availableIds = getSchemaIds(configPath);
      console.error("Available schemas:", availableIds.join(", "));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Error loading schemas:", errorMsg);
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error loading schema:", errorMsg);
    process.exit(1);
  }
}

// Run main function if called directly
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generate-schemas.ts");
if (isMain) {
  main();
}
