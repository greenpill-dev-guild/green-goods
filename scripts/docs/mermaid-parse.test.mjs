import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

import { renderProjection } from "./generator-core.mjs";
import { createProjections } from "./generate.mjs";
import { readJson } from "./source-readers.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

// Mermaid parses in the browser, so a bad generated diagram only shows up as a "Try again" box on
// the published page. This loads the docs site's own mermaid under a jsdom window and parses every
// generated block the way the page would.
async function loadMermaid() {
  let JSDOM;
  try {
    ({ JSDOM } = await import("jsdom"));
  } catch {
    return null;
  }
  let specifier;
  try {
    const require = createRequire(realpathSync(path.join(REPO_ROOT, "docs/node_modules/@docusaurus/theme-mermaid/package.json")));
    specifier = require.resolve("mermaid");
  } catch {
    return null;
  }
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  for (const key of ["DOMParser", "Element", "HTMLElement", "SVGElement", "Node", "NodeFilter", "MutationObserver", "getComputedStyle", "requestAnimationFrame"]) {
    if (!(key in globalThis) && key in dom.window) globalThis[key] = dom.window[key];
  }
  const mermaid = (await import(specifier)).default;
  mermaid.initialize({ startOnLoad: false });
  return mermaid;
}

function mermaidBlocks(markdown) {
  return [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
}

test("every generated diagram parses with the docs site's mermaid", async (t) => {
  const mermaid = await loadMermaid();
  if (!mermaid) {
    t.skip("mermaid or jsdom is not resolvable from this checkout; install docs dependencies to run this check");
    return;
  }
  const ontology = readJson(REPO_ROOT, "packages/shared/src/ontology/green-goods-ontology.json");
  const machinesById = new Map(ontology.state_machines.map((machine) => [machine.id, machine]));
  const projections = createProjections(REPO_ROOT).filter((item) => item.output.endsWith(".mdx"));
  let parsed = 0;
  for (const projection of projections) {
    const rendered = renderProjection(REPO_ROOT, projection);
    for (const block of mermaidBlocks(rendered)) {
      await assert.doesNotReject(mermaid.parse(block, { suppressErrors: false }), `${projection.output}: ${block.split("\n")[0]}`);
      parsed += 1;
    }
    if (!projection.output.endsWith("data-model.mdx")) continue;
    for (const [, id, block] of rendered.matchAll(/### ([\w-]+) \{#[\w-]+\}[\s\S]*?```mermaid\n(stateDiagram-v2[\s\S]*?)```/g)) {
      const diagram = await mermaid.mermaidAPI.getDiagramFromText(block);
      const stateMap = diagram.db.getStates();
      const states = new Set(stateMap instanceof Map ? stateMap.keys() : Object.keys(stateMap));
      const expected = new Set(machinesById.get(id).states.map((state) => state.name.replaceAll("-", "_")));
      assert.deepEqual([...states].sort(), [...expected].sort(), `${id} renders exactly the ontology's states`);
    }
  }
  assert.ok(parsed >= 8, `parsed ${parsed} diagrams`);
});
