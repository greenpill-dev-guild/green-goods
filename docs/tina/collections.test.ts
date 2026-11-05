import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { communityBody, communityCollections, communityFields, prepareCommunityValues } from "./collections";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import contentElements from "../plugins/content-elements.mjs";

// Exercise the actual parser used by the pinned Tina CLI, not a mock serializer.
import { parseFile, stringifyFile, transformDocument, transformDocumentIntoPayload } from "@tinacms/graphql";
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
const require = createRequire(realpathSync(fileURLToPath(import.meta.resolve("@tinacms/graphql"))));
const { parseMDX, serializeMDX } = require("@tinacms/mdx");
const transform = (source: string) => {
  const processor = unified().use(remarkParse).use(remarkMdx).use(contentElements);
  return processor.runSync(processor.parse(source)) as ReturnType<typeof processor.parse>;
};

describe("Community editor", () => {
  test("cloud image URLs preserve every authored image path on save", async () => {
    const { schema: cloudSchema } = JSON.parse(readFileSync(join(docsRoot, "tina/tina-lock.json"), "utf8"));
    const cloud = new TinaSchema(cloudSchema);
    const origin = "https://assets.tina.io/community-editor-test";
    const mediaRoot = `/${cloudSchema.config.media.tina.mediaRoot}`;
    for (const file of authored) {
      const original = parse(readFileSync(file, "utf8"));
      const path = relative(docsRoot, file);
      const payload = await transformDocumentIntoPayload(path, transformDocument(path, original, cloud), cloud, {
        useRelativeMedia: false, clientId: "community-editor-test", assetsHost: "assets.tina.io",
      }, true);
      const body = (payload._values as Record<string, unknown>).body;
      const saved = serializeMDX(body, communityBody, (url: string) => url.startsWith(origin) ? mediaRoot + url.slice(origin.length) : url);
      assert.deepEqual(parseMDX(saved, communityBody, (value: string) => value), parseMDX(original.$_body, communityBody, (value: string) => value), file);
    }
  });
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
  test("exposes only content and keeps technical metadata hidden", () => {
    assert.deepEqual(communityFields.filter(field => field.ui?.component !== "hidden").map(field => field.name), ["title", "description", "body"]);
    for (const file of authored) assert.match(parse(readFileSync(file, "utf8")).last_verified as string, /^\d{4}-\d{2}-\d{2}$/);
  });
  for (const file of authored) test(`rich-text save preserves ${relative(docsRoot, file)}`, () => {
    const inspect = (node: unknown, file: string) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { for (const child of node) inspect(child, file); return; }
      const record = node as Record<string, unknown>;
      assert.ok(!["invalid_markdown", "html", "html_inline"].includes(record.type as string), `${file}: ${record.type} ${record.message ?? ""}`);
      for (const value of Object.values(record)) inspect(value, file);
    };
    const original = parse(readFileSync(file, "utf8"));
    const tree = parseMDX(original.$_body, communityBody, (value: string) => value);
    inspect(tree, file);
    assert.deepEqual(prepareCommunityValues({ body: tree }).body, tree, `${file}: existing fragment IDs`);
    const saved = serializeMDX(tree, communityBody, (value: string) => value);
    assert.deepEqual(parseMDX(saved, communityBody, (value: string) => value), tree, file);
    const document = parse(stringifyFile({ ...original, $_body: saved }, ".mdx", false));
    assert.deepEqual({ ...document, $_body: undefined }, { ...original, $_body: undefined }, file);
  });
  test("new FAQ questions and anchored headings receive stable IDs without changing metadata", () => {
    const body = parseMDX('<FaqQuestion question="New question?">\n\nAn answer.\n\n</FaqQuestion>\n\n<AnchoredHeading text="New heading" />', communityBody, (value: string) => value);
    const values = { title: "Example", sidebar_position: 7, last_verified: "2026-10-12", body };
    const prepared = prepareCommunityValues(values);
    const nodes = (prepared.body as typeof body).children.filter((node: any) => node.name);
    assert.equal(nodes.length, 2);
    for (const node of nodes) assert.match(node.props.id, /^section-[0-9a-f-]{36}$/);
    assert.notEqual(nodes[0].props.id, nodes[1].props.id);
    assert.equal(nodes[1].props.level, "2");
    assert.equal(body.children[0].props.id, undefined);
    assert.deepEqual(prepareCommunityValues(prepared), prepared);
    assert.deepEqual({ ...prepared, body: undefined }, { ...values, body: undefined });
  });
  test("restores stable headings before Docusaurus derives the table of contents", () => {
    const tree = transform('<AnchoredHeading text="A garden" id="what-a-garden-is" level="2" />');
    assert.deepEqual(tree.children, [{ type: "heading", depth: 2, data: { hProperties: { id: "what-a-garden-is" } }, children: [{ type: "text", value: "A garden" }] }]);
    assert.throws(() => transform('<AnchoredHeading text="Broken" level="9" />'), /AnchoredHeading requires/);
  });
  test("supplies FAQ controls while leaving question bodies editable separately", () => {
    const source = '## Getting started\n\n<FaqQuestion id="first" question="First?">\n\nAnswer with a [link](/faq).\n\n</FaqQuestion>';
    const tree = transform(source);
    assert.equal(tree.children.length, 1);
    const wrapper = tree.children[0] as any;
    assert.equal(wrapper.name, "FaqQuestions");
    assert.equal(wrapper.children[0].type, "heading");
    assert.equal(wrapper.children[1].name, "FaqQuestion");
    assert.equal(wrapper.children[1].children[0].children[1].url, "/faq");
    assert.equal(transform("## Ordinary guide").children[0].type, "heading");
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
