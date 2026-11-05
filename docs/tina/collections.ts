import type { Collection, TinaField } from "tinacms";

// Keep the complete MDX body as text: these pages contain imports, JSX style
// expressions and Docusaurus directives outside Tina's rich-text subset.
export const communityFields: TinaField[] = [
  { type: "string", name: "title", label: "Title", isTitle: true, required: true },
  { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
  { type: "string", name: "body", label: "Page content (MDX)", isBody: true,
    description: "Edit the page text here. Preserve imports, component tags and ::: callout markers. Preview the published page before editing its layout.",
    ui: { component: "textarea" } },
  ...["sidebar_label", "slug", "audience", "owner", "feature_status", "goal", "difficulty", "estimated_time", "prereqs", "next_steps", "persona_context"].map((name): TinaField => ({ type: "string", name, label: name.replaceAll("_", " ") })),
  { type: "datetime", name: "last_verified", label: "Last verified", ui: { component: "hidden" } },
  { type: "string", name: "keywords", label: "Search keywords", list: true },
  { type: "string", name: "source_of_truth", label: "Implementation sources", list: true },
  { type: "image", name: "image", label: "Social image" },
  { type: "number", name: "sidebar_position", label: "Sidebar position" },
  { type: "boolean", name: "hide_title", label: "Hide title" },
  { type: "boolean", name: "hide_table_of_contents", label: "Hide table of contents" },
];

export const communityCollections: Collection[] = [
  { name: "community", label: "Community pages and guides", path: "docs/community", format: "mdx",
    match: { include: "**/!(*.generated)" },
    ui: { allowedActions: { create: false, delete: false } }, fields: communityFields },
  { name: "communityReference", label: "Community FAQ and Brand", path: "docs/reference", format: "mdx",
    match: { include: "{faq,brand,brand-voice}" },
    ui: { allowedActions: { create: false, delete: false } }, fields: communityFields },
];
