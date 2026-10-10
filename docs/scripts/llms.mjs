// Text transforms behind llms.txt and the per-page Markdown twins. The build plugin in
// plugins/llms-twins.mjs does the file work; these stay pure so they can be tested directly.

/** Where a page's Markdown twin is served: its URL plus `.md`, with the home page at `/index.md`. */
export function twinPath(permalink) {
  const clean = permalink.replace(/\/+$/, "");
  return `${clean || "/index"}.md`;
}

const FENCED_CODE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm;
// Top-level ES imports only: named, default, namespace, and side-effect forms. Named imports may
// span several lines inside their braces.
const IMPORT_STATEMENT =
  /^import\s+(?:(?:\{[^}]*\}|[\w$]+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+[\w$]+)\s+from\s+)?(["'])[^"'\n]+\1;?[ \t]*\n?/gm;

const PROJECTION_TAG = /^[ \t]*<IntegrationProjection\s+id="([^"]+)"\s*\/>[ \t]*$/gm;
const COPY_COMMAND_TAG = /<CopyCommand\s+command=(["'])(.*?)\1[^>]*\/>/g;
const STATUS_TABLE_TAG = /^[ \t]*<IntegrationStatusTable\s*\/>[ \t]*$/gm;
const ONBOARDING_TAG = /^[ \t]*<OnboardingProcedure\s*\/>[ \t]*$/gm;

/** The per-integration status table as Markdown, the same facts the IntegrationStatusTable renders. */
export function integrationStatusMarkdown(integrations) {
  const lines = ["| Integration | Networks with recorded components | Indexed contracts |", "|---|---|---|"];
  for (const [id, record] of Object.entries(integrations).sort(([a], [b]) => a.localeCompare(b))) {
    const networks = record.networks.length ? record.networks.map((network) => `${network.name} (${network.status})`).join(", ") : "None recorded";
    const indexed = record.indexedContracts.length ? record.indexedContracts.map((name) => `\`${name}\``).join(", ") : "none";
    lines.push(`| [${record.display}](/builders/integrations/${id}) | ${networks} | ${indexed} |`);
  }
  return lines.join("\n");
}

// The generator encodes these five characters inside a CopyCommand attribute (scripts/docs/renderers.mjs).
const decodeAttribute = (text) =>
  text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#124;", "|").replaceAll("&amp;", "&");

/** Each CopyCommand tag as the code span it renders, so a twin or an audit sees the command itself. */
export function inlineCopyCommands(text) {
  return text.replace(COPY_COMMAND_TAG, (_tag, _quote, command) => `\`${decodeAttribute(command)}\``);
}

/**
 * The deployment projection as Markdown, carrying the same facts the IntegrationProjection
 * component renders on the site, so an integration page's twin reads whole without the component.
 */
export function projectionMarkdown(integration) {
  const deployments = "[deployment status projection](/builders/reference/deployments)";
  const lines = ["## Checked-in deployment projection", ""];
  if (integration.networks.length === 0) {
    lines.push(
      `No checked-in deployment artifact records components for this integration on any supported network. Per-network state lives in the ${deployments}.`,
    );
  } else {
    lines.push("| Network | Status | Recorded components |", "|---|---|---|");
    for (const network of integration.networks) {
      const recorded = network.recorded.map((field) => `\`${field}\``).join(", ");
      lines.push(`| ${network.name} (\`${network.chainId}\`) | ${network.status} | ${recorded} |`);
    }
    if (integration.networks.length < integration.totalNetworks) {
      lines.push("", `Networks without recorded components are omitted; per-network state lives in the ${deployments}.`);
    }
  }
  if (integration.indexedContracts.length > 0) {
    const contracts = integration.indexedContracts.map((name) => `\`${name}\``).join(", ");
    lines.push("", "## Indexer boundary", "", `Configured indexer contracts: ${contracts}.`);
  }
  lines.push(
    "",
    "A deployment artifact does not by itself prove product activation, live indexing, or partner-service health. This projection regenerates from checked-in artifacts via `node scripts/docs/generate.mjs`.",
  );
  return lines.join("\n");
}

function outsideFencedCode(text, transform) {
  let result = "";
  let last = 0;
  for (const match of text.matchAll(FENCED_CODE)) {
    result += transform(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return result + transform(text.slice(last));
}

/**
 * A page's source as plain Markdown for agents: no frontmatter and no MDX import lines (code
 * examples keep theirs). Given the integration projections, each IntegrationProjection tag becomes
 * the Markdown of the data it renders; other components stay as written, so a reader can tell
 * where the site renders something interactive. Pages without their own H1 get one from the title.
 */
export function markdownTwin(source, title, { integrations = null, onboarding = null } = {}) {
  const withoutFrontmatter = source.replace(/^---\n[\s\S]*?\n---\n/, "");
  const expandProjections = (text) => {
    let result = text;
    if (integrations) {
      result = result
        .replace(PROJECTION_TAG, (tag, id) => {
          const integration = integrations[id];
          if (!integration) throw new Error(`Unknown integration projection id in a Markdown twin: ${id}`);
          return projectionMarkdown(integration);
        })
        .replace(STATUS_TABLE_TAG, () => integrationStatusMarkdown(integrations));
    }
    // ONBOARDING.md carries its own triple-backtick fences, so the twin wraps it in four.
    if (onboarding) result = result.replace(ONBOARDING_TAG, () => `\`\`\`\`markdown\n${onboarding.trimEnd()}\n\`\`\`\``);
    return result;
  };
  const body = outsideFencedCode(withoutFrontmatter, (text) => expandProjections(inlineCopyCommands(text.replace(IMPORT_STATEMENT, ""))))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${/^#\s/m.test(body) ? "" : `# ${title}\n\n`}${body}\n`;
}

/**
 * Cuts every HTML comment out of the text, including comments nested inside another one, and
 * drops the tail of a comment that never closes. A single regex replace would leave a dangling
 * `<!--` behind when comments nest, so this scans until none remain.
 */
function withoutHtmlComments(text) {
  let result = text;
  let start = result.indexOf("<!--");
  while (start !== -1) {
    const end = result.indexOf("-->", start + 4);
    result = end === -1 ? result.slice(0, start) : result.slice(0, start) + result.slice(end + 3);
    start = result.indexOf("<!--");
  }
  return result;
}

/**
 * The first real sentence of a twin, for the index: skips headings, comments, components, lists,
 * tables, callouts, and code, so generated banners never become a page's description.
 */
export function leadSentence(markdown) {
  const withoutCode = withoutHtmlComments(markdown.replace(FENCED_CODE, ""));
  for (const block of withoutCode.split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || /^(#|<|\||[-*+]\s|\d+\.\s|:::|>|!\[)/.test(text)) continue;
    const flat = text.replace(/\s+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    const sentence = flat.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? flat;
    return sentence.length > 220 ? `${sentence.slice(0, 217).trimEnd()}...` : sentence;
  }
  return "";
}

const SECTIONS = [
  { title: "Builders", matches: (permalink) => permalink.startsWith("/builders") },
  { title: "Community", matches: (permalink) => permalink.startsWith("/community") },
  { title: "Reference", matches: () => true },
];

const oneLine = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

/**
 * The llms.txt index: the hand-written site guidance, then every page grouped by section, each
 * linking its Markdown twin with the page's own description.
 */
export function renderLlmsIndex({ header, siteUrl, pages }) {
  const lines = [
    header.trim(),
    "",
    "Every page below is also published as Markdown: add `.md` to its URL, as these links do.",
  ];
  const remaining = [...pages].sort((a, b) => a.permalink.localeCompare(b.permalink));
  for (const section of SECTIONS) {
    const inSection = remaining.filter((page) => section.matches(page.permalink));
    if (!inSection.length) continue;
    for (const page of inSection) remaining.splice(remaining.indexOf(page), 1);
    lines.push("", `## ${section.title}`, "");
    for (const page of inSection) {
      const description = oneLine(page.description);
      lines.push(`- [${oneLine(page.title)}](${siteUrl}${twinPath(page.permalink)})${description ? `: ${description}` : ""}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
