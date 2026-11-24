// DOCS-002: choosing a search result opens its page but left focus on the body, so the next Tab
// went to Skip to content. The local search plugin marks the pages it opens with `_highlight`
// (one per search term) and adds the heading's anchor when the result is a section, so a route
// reached from search moves focus to that heading, or to the page's title.
const SEARCH_PARAM = "_highlight";

export type SearchFocusTarget = {kind: "anchor"; id: string} | {kind: "title"} | null;

export function searchFocusTarget(location: {search: string; hash: string}): SearchFocusTarget {
  if (!new URLSearchParams(location.search).has(SEARCH_PARAM)) return null;
  const anchor = location.hash.replace(/^#/, "");
  if (!anchor) return {kind: "title"};
  try {
    return {kind: "anchor", id: decodeURIComponent(anchor)};
  } catch {
    return {kind: "anchor", id: anchor};
  }
}
