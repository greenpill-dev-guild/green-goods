import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { communityCollections, communityFields } from "./collections";

// Exercise the actual parser used by the pinned Tina CLI, not a mock serializer.
import { parseFile, stringifyFile } from "@tinacms/graphql";
import { TinaSchema } from "@tinacms/schema-tools";
const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = new TinaSchema({ collections: communityCollections });
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? pages(path) : path.endsWith(".mdx") ? [path] : [];
  });
}
const authored = [...pages(join(docsRoot, "docs/community")), ...["faq", "brand", "brand-voice"].map((name) => join(docsRoot, `docs/reference/${name}.mdx`))];
const parse = (source: string) => parseFile<Record<string, unknown> & { $_body: string }>(source, ".mdx", (y: any) => y.object({}));

describe("Community editor", () => {
  test("covers every Community landing page, nested guide and authored sidebar reference", () => {
    for (const file of authored) assert.ok(schema.getCollectionByFullPath(relative(docsRoot, file)));
  });
  test("excludes generated references and builder content", () => {
    for (const file of ["docs/reference/glossary.generated.mdx", "docs/community/example.generated.mdx", "docs/builders/getting-started.mdx"])
      assert.ok(!communityCollections.some((collection) => schema.matchFiles({collection, files: [file]}).length));
  });
  test("models every existing metadata key so editing does not drop frontmatter", () => {
    const keys = new Set(communityFields.map((field) => field.name));
    for (const file of authored) for (const key of Object.keys(parse(readFileSync(file, "utf8"))))
      assert.ok(key === "$_body" || keys.has(key), `${file}: ${key}`);
  });
  test("round-trips every page body and metadata through Tina's file serializer", () => {
    for (const file of authored) {
      const original = parse(readFileSync(file, "utf8"));
      const saved = parse(stringifyFile(original, ".mdx", false));
      assert.equal(saved["$_body"].trim(), original["$_body"].trim(), file);
      const { $_body: savedBody, ...savedMetadata } = saved;
      const { $_body: originalBody, ...originalMetadata } = original;
      assert.deepEqual(savedMetadata, originalMetadata, file);
    }
  });
});
