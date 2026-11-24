import assert from "node:assert/strict";
import {describe, test} from "node:test";

import {searchFocusTarget} from "./searchFocusTarget";

// DOCS-002: a page opened from a search result takes focus, so the next Tab moves through its
// content instead of starting again at Skip to content.
describe("searchFocusTarget", () => {
  test("focuses the anchored heading a search result opened at", () => {
    assert.deepEqual(searchFocusTarget({search: "?_highlight=garden", hash: "#create-a-garden"}), {
      kind: "anchor",
      id: "create-a-garden",
    });
    assert.deepEqual(searchFocusTarget({search: "?_highlight=a&_highlight=b", hash: "#caf%C3%A9"}), {
      kind: "anchor",
      id: "café",
    });
  });

  test("focuses the page's title when the result opened the page itself", () => {
    assert.deepEqual(searchFocusTarget({search: "?_highlight=vault", hash: ""}), {kind: "title"});
  });

  test("keeps an anchor that does not decode as written", () => {
    assert.deepEqual(searchFocusTarget({search: "?_highlight=x", hash: "#100%"}), {
      kind: "anchor",
      id: "100%",
    });
  });

  test("leaves focus alone on any navigation that did not come from search", () => {
    assert.equal(searchFocusTarget({search: "", hash: "#install"}), null);
    assert.equal(searchFocusTarget({search: "?tab=steward", hash: ""}), null);
  });
});
