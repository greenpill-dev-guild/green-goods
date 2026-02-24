#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

interface SchemaField {
  name: string;
  type: string;
}

interface SchemaEntry {
  fields: SchemaField[];
}

interface SchemaConfig {
  schemas: Record<string, SchemaEntry>;
}

function loadSchemaConfig(): SchemaConfig {
  const candidates = [
    path.join(process.cwd(), "config/schemas.json"),
    path.join(process.cwd(), "packages/contracts/config/schemas.json"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const raw = fs.readFileSync(candidate, "utf8");
    return JSON.parse(raw) as SchemaConfig;
  }

  throw new Error("Unable to locate config/schemas.json");
}

function buildSchemaString(fields: SchemaField[]): string {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("Schema fields are missing or empty");
  }

  return fields
    .map((field) => {
      if (!field?.type || !field?.name) {
        throw new Error("Schema field must include both type and name");
      }
      return `${field.type} ${field.name}`;
    })
    .join(",");
}

function main(): void {
  const schemaName = process.argv[2];
  if (!schemaName) {
    throw new Error("Usage: bun run script/utils/generate-schemas.ts <schemaName>");
  }

  const config = loadSchemaConfig();
  const schema = config.schemas?.[schemaName];
  if (!schema) {
    throw new Error(`Schema not found: ${schemaName}`);
  }

  process.stdout.write(buildSchemaString(schema.fields));
}

main();
