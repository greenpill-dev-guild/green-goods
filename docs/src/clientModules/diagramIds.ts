// The expanded copy of a Mermaid diagram lives in the same document as the original, so every id
// it carries (the root, arrow markers, clip paths, gradients) needs a new name, and every reference
// to those ids has to follow. Kept free of the DOM so the rewriting can be tested directly.

export function expandedIdMap(ids: Iterable<string>, suffix = "-expanded"): Map<string, string> {
  const map = new Map<string, string>();
  for (const id of ids) {
    if (id) map.set(id, `${id}${suffix}`);
  }
  return map;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Rewrites every `#id` reference to a renamed id: `url(#id)` paints and markers, `#id` href
 * fragments, and `#id` selectors in Mermaid's embedded stylesheet. Only whole ids match, so
 * renaming `diagram` leaves `#diagram_marker` to its own entry, and colors like `#fff` stay put.
 */
export function rewriteIdReferences(text: string, idMap: Map<string, string>): string {
  if (idMap.size === 0) return text;
  const ids = [...idMap.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const pattern = new RegExp(`#(${ids.join("|")})(?![\\w-])`, "g");
  return text.replace(pattern, (_match, id: string) => `#${idMap.get(id)}`);
}
