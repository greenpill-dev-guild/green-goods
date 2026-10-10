import assert from "node:assert/strict";
import {describe, test} from "node:test";

import {expandedIdMap, rewriteIdReferences} from "./diagramIds";

describe("expanded diagram ids", () => {
  const idMap = expandedIdMap(["mermaid-1", "mermaid-1_flowchart-pointEnd", "clip-a"]);

  test("gives every id a new name", () => {
    assert.equal(idMap.get("mermaid-1"), "mermaid-1-expanded");
    assert.equal(idMap.get("mermaid-1_flowchart-pointEnd"), "mermaid-1_flowchart-pointEnd-expanded");
  });

  test("rewrites marker, paint, and href references to the renamed ids", () => {
    assert.equal(
      rewriteIdReferences("url(#mermaid-1_flowchart-pointEnd)", idMap),
      "url(#mermaid-1_flowchart-pointEnd-expanded)",
    );
    assert.equal(rewriteIdReferences("url(#clip-a)", idMap), "url(#clip-a-expanded)");
    assert.equal(rewriteIdReferences("#clip-a", idMap), "#clip-a-expanded");
  });

  test("rewrites the stylesheet's scoped selectors without touching longer ids or colors", () => {
    const css = "#mermaid-1 .node rect{fill:#fff;} #mermaid-1_flowchart-pointEnd{stroke:#333;}";
    assert.equal(
      rewriteIdReferences(css, idMap),
      "#mermaid-1-expanded .node rect{fill:#fff;} #mermaid-1_flowchart-pointEnd-expanded{stroke:#333;}",
    );
  });

  test("leaves text alone when nothing was renamed", () => {
    assert.equal(rewriteIdReferences("url(#other)", idMap), "url(#other)");
    assert.equal(rewriteIdReferences("url(#mermaid-1)", new Map()), "url(#mermaid-1)");
  });
});
