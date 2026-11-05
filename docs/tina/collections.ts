import type { Collection, TinaField, Template } from "tinacms";

const hidden = { component: "hidden" };
const hiddenStrings = (...names: string[]): TinaField[] => names.map(name => ({ type: "string", name, ui: hidden }));
const prose: TinaField = { type: "rich-text", name: "children", label: "Content", parser: { type: "mdx" }, overrides: { toolbar: ["link", "bold", "italic", "ul", "ol", "quote"] } };
const inlineTemplates: (Template & { inline: boolean })[] = [
  { name: "InlineLabel", label: "App button label", inline: true, fields: [{ ...prose, label: "Label" }] },
  { name: "ContentLink", label: "Link", inline: true, fields: [
    { type: "string", name: "href", label: "Link address", required: true },
    { ...prose, label: "Link text" },
    ...hiddenStrings("target", "rel"),
    { type: "boolean", name: "download", ui: hidden },
  ] },
];
const content = { ...prose, templates: inlineTemplates };
const managedBlock = (name: string, label: string): Template => ({ name, label, fields: hiddenStrings("placeholder") });

export const communityBody: TinaField = {
  type: "rich-text", name: "body", label: "Page content", isBody: true,
  parser: { type: "mdx" },
  overrides: { toolbar: ["heading", "link", "image", "quote", "ul", "ol", "bold", "italic", "code", "codeBlock", "mermaid", "table"] },
  templates: [
    { name: "GuideImage", label: "Image and caption", ui: { defaultItem: { className: "gg-figure", loading: "lazy" } }, fields: [
      { type: "image", name: "src", label: "Image", required: true },
      { type: "string", name: "alt", label: "Image description", required: true },
      { ...content, label: "Caption" },
      ...hiddenStrings("className", "maxWidth", "width", "height", "loading", "fetchPriority", "decoding"),
    ] },
    { name: "Callout", label: "Callout", ui: { defaultItem: { kind: "note" } }, fields: [
      { type: "string", name: "title", label: "Title" },
      content,
      ...hiddenStrings("kind"),
    ] },
    { name: "AnchoredHeading", label: "Heading", fields: [
      { type: "string", name: "text", label: "Heading", isTitle: true, required: true },
      ...hiddenStrings("level", "id"),
    ] },
    { name: "NextBestAction", label: "Next step", fields: [
      { type: "string", name: "title", label: "Title" },
      { type: "string", name: "why", label: "Description" },
      { type: "string", name: "actionLabel", label: "Link text" },
      { type: "string", name: "actionHref", label: "Link address" },
      { type: "object", name: "alternatives", label: "Related links", list: true, fields: [
        { type: "string", name: "label", label: "Link text" },
        { type: "string", name: "href", label: "Link address" },
      ] },
    ] },
    { name: "FaqQuestion", label: "FAQ question and answer", fields: [
      { type: "string", name: "question", label: "Question", isTitle: true, required: true },
      { ...content, label: "Answer" },
      ...hiddenStrings("id"),
    ] },
    managedBlock("Hero", "Role guide links"),
    managedBlock("StewardPathNav", "Steward guide links"),
    managedBlock("BrandAssets", "Brand asset downloads"),
    { name: "StatusBadge", label: "Feature status", fields: hiddenStrings("status") },
    { name: "TermAnchor", label: "Existing page link", fields: hiddenStrings("id", "to") },
    ...inlineTemplates,
  ],
};

// Metadata stays in the schema so a content save retains it, but only copy is exposed.
export const communityFields: TinaField[] = [
  { type: "string", name: "title", label: "Title", isTitle: true, required: true },
  { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
  communityBody,
  ...hiddenStrings("sidebar_label", "slug", "audience", "owner", "feature_status", "goal", "difficulty", "estimated_time", "prereqs", "next_steps", "persona_context", "last_verified"),
  { type: "string", name: "keywords", list: true, ui: hidden },
  { type: "string", name: "source_of_truth", list: true, ui: hidden },
  { type: "image", name: "image", ui: hidden },
  { type: "number", name: "sidebar_position", ui: hidden },
  { type: "boolean", name: "hide_title", ui: hidden },
  { type: "boolean", name: "hide_table_of_contents", ui: hidden },
];

// Tina's rich-text embed insertion accepts object defaults, not factories. Assign new
// fragment IDs at save time, preserving every existing link without exposing IDs in the form.
export function prepareCommunityValues(values: Record<string, unknown>): Record<string, unknown> {
  const prepare = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(prepare);
    if (!value || typeof value !== "object") return value;
    const node = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, prepare(item)]));
    if (node.type === "mdxJsxFlowElement" && ["AnchoredHeading", "FaqQuestion", "TermAnchor"].includes(node.name as string)) {
      const props = (node.props ?? {}) as Record<string, unknown>;
      node.props = { ...props, id: props.id || `section-${crypto.randomUUID()}` };
      if (node.name === "AnchoredHeading" && !props.level) (node.props as Record<string, unknown>).level = "2";
    }
    return node;
  };
  return { ...values, body: prepare(values.body) };
}

const communityUi: NonNullable<Collection["ui"]> = {
  allowedActions: { create: false, delete: false },
  beforeSubmit: async ({ values }) => prepareCommunityValues(values),
};

export const communityCollections: Collection[] = [
  { name: "community", label: "Community pages and guides", path: "docs/community", format: "mdx",
    match: { include: "**/!(*.generated)" },
    ui: communityUi, fields: communityFields },
  { name: "communityReference", label: "Community FAQ and Brand", path: "docs/reference", format: "mdx",
    match: { include: "{faq,brand,brand-voice}" },
    ui: communityUi, fields: communityFields },
];
