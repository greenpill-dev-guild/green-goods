import { z } from "zod";
import fs from "node:fs";
import * as path from "node:path";

import { schemaRegistry } from "../services/eas";

// EAS schema is an array of [type, name] tuples. E.g. "uint256 eventId, uint8 voteIndex"
const EasSchemaSchema = z.object({
  name: z.string(),
  description: z.string(),
  values: z
    .object({
      type: z.string(),
      name: z.string(),
    })
    .array(),
  resolver: z.string().optional(),
  UID: z.string().optional(),
  parsed: z.string().optional(),
});

export type EasSchema = z.infer<typeof EasSchemaSchema>;

export const schemasToEas = async (
  filePath: string,
  options: { force?: boolean }
) => {
  const { force } = options;

  const _schemaRegistry = schemaRegistry();
  // Read the JSON file
  const _path = path.join(process.cwd(), "src", filePath);
  const data = fs.readFileSync(_path, "utf-8");

  // Parse the file content into an array of Metric objects
  const schemas: EasSchema[] = JSON.parse(data).map((schema: unknown) => {
    return EasSchemaSchema.parse(schema);
  });

  let updated = false;

  // Iterate over the array and store each schema  using the EAS service
  const updatedMetrics = await Promise.all(
    schemas.map(async (schema) => {
      // Skip if the metric already has a UID
      if (!force && schema?.UID) {
        return schema;
      }

      const schemaToStore = schema.values
        .map(({ type, name }) => `${type} ${name}`)
        .join(", ");

      console.log(schemaToStore);

      const tx = await _schemaRegistry.register({
        schema: schemaToStore,
        resolverAddress: schema.resolver,
        revocable: true,
      });

      const uid = await tx.wait();
      schema.parsed = schemaToStore;
      schema.UID = uid; // Attach the UID to the metric object

      console.log(`Stored schema with UID ${uid}`);
      updated = true;
      return schema;
    })
  );

  // Write the updated metrics back to the JSON file
  if (updated) fs.writeFileSync(_path, JSON.stringify(updatedMetrics, null, 2));
};
