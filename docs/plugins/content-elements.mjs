/** Restore document structure before Docusaurus derives heading links and the table of contents. */
export default function contentElements() {
  return (tree) => {
    const transform = (parent) => {
      parent.children = parent.children.map(node => {
        if (node.type === "mdxJsxFlowElement" && node.name === "AnchoredHeading") {
          const attrs = Object.fromEntries(node.attributes.map(attr => [attr.name, attr.value]));
          const depth = Number(attrs.level);
          if (!Number.isInteger(depth) || depth < 1 || depth > 6 || !attrs.id || !attrs.text) {
            throw new Error("AnchoredHeading requires a level, stable id and heading text");
          }
          return { type: "heading", depth, data: { hProperties: { id: attrs.id } }, children: [{ type: "text", value: attrs.text }] };
        }
        if (node.children) transform(node);
        return node;
      });
    };
    transform(tree);
    // Keep each answer directly editable in Tina; the site owns the shared disclosure controls.
    if (tree.children.some(node => node.name === "FaqQuestion")) {
      const metadata = tree.children.filter(node => ["yaml", "toml", "mdxjsEsm"].includes(node.type));
      const content = tree.children.filter(node => !metadata.includes(node));
      tree.children = [...metadata, { type: "mdxJsxFlowElement", name: "FaqQuestions", attributes: [], children: content }];
    }
  };
}
