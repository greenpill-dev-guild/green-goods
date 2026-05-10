import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import {
  PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS,
  publicSocialPreviews,
  type PublicSocialPreview,
  type PublicSocialPreviewRouteKey,
} from "../src/content/publicSocialPreviews";

const SOCIAL_META_NAMES = [
  "description",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
];

const SOCIAL_META_PROPERTIES = [
  "og:title",
  "og:description",
  "og:url",
  "og:site_name",
  "og:type",
  "og:image",
  "og:image:alt",
  "og:image:type",
  "og:image:width",
  "og:image:height",
];

const ROUTE_SHELL_KEYS = PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS.filter(
  (key) => key !== "home"
) as Exclude<PublicSocialPreviewRouteKey, "home">[];

const GENERATED_CARD_KEYS = PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS.filter((key) =>
  publicSocialPreviews[key].socialImagePath.startsWith("/social/")
);

const SOCIAL_CARD_WIDTH = 1200;
const SOCIAL_CARD_HEIGHT = 630;
const HERO_CARD_X = 40;
const HERO_CARD_Y = 181.640625;
const HERO_CARD_WIDTH = 536;
const HERO_CARD_HEIGHT = 398.359375;
const HERO_CARD_PADDING = 40;
const HERO_TITLE_X = HERO_CARD_X + HERO_CARD_PADDING;
const HERO_TITLE_Y = HERO_CARD_Y + HERO_CARD_PADDING;
const HERO_TITLE_SIZE = 60;
const HERO_TITLE_LINE_HEIGHT = 62.4;
const HERO_LEDE_Y = 424.8125;
const HERO_LEDE_SIZE = 18;
const HERO_LEDE_LINE_HEIGHT = 28.8;
const HERO_CARD_FILL = "#f7f0e4";
const HERO_CARD_TITLE_COLOR = "#221f18";
const HERO_CARD_ACCENT_COLOR = "#167947";
const HERO_CARD_LEDE_COLOR = "#514a3d";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderLineWithAccent(line: string, accent?: string): string {
  if (!accent) return escapeHtml(line);

  const accentStart = line.indexOf(accent);
  if (accentStart !== -1) {
    const before = line.slice(0, accentStart);
    const after = line.slice(accentStart + accent.length);

    return [
      escapeHtml(before),
      `<tspan fill="${HERO_CARD_ACCENT_COLOR}" font-style="italic">`,
      escapeHtml(accent),
      "</tspan>",
      escapeHtml(after),
    ].join("");
  }

  const accentWords = accent.split(/\s+/).filter(Boolean);
  if (accentWords.length <= 1) return escapeHtml(line);

  const pattern = new RegExp(
    `\\b(${accentWords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "g"
  );
  const parts: string[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index === undefined) continue;
    parts.push(escapeHtml(line.slice(lastIndex, match.index)));
    parts.push(
      `<tspan fill="${HERO_CARD_ACCENT_COLOR}" font-style="italic">${escapeHtml(match[0])}</tspan>`
    );
    lastIndex = match.index + match[0].length;
  }
  parts.push(escapeHtml(line.slice(lastIndex)));

  return parts.join("");
}

function renderSvgLines(
  lines: readonly string[],
  {
    x,
    y,
    fontSize,
    lineHeight,
    fill,
    fontFamily,
    letterSpacing,
    accent,
  }: {
    x: number;
    y: number;
    fontSize: number;
    lineHeight: number;
    fill: string;
    fontFamily: string;
    letterSpacing?: number;
    accent?: string;
  }
): string {
  return lines
    .map((line, index) => {
      const lineY = y + index * lineHeight;
      const spacing = letterSpacing === undefined ? "" : ` letter-spacing="${letterSpacing}"`;
      return `<text x="${x}" y="${lineY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="400"${spacing} fill="${fill}" dominant-baseline="hanging" xml:space="preserve">${renderLineWithAccent(
        line,
        accent
      )}</text>`;
    })
    .join("");
}

function removeSocialMetadata(html: string): string {
  let next = html.replace(/<title>[\s\S]*?<\/title>\s*/i, "");
  next = next.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, "");

  for (const name of SOCIAL_META_NAMES) {
    next = next.replace(
      new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*>\\s*`, "gi"),
      ""
    );
  }

  for (const property of SOCIAL_META_PROPERTIES) {
    next = next.replace(
      new RegExp(`<meta\\s+[^>]*property=["']${property}["'][^>]*>\\s*`, "gi"),
      ""
    );
  }

  return next;
}

function buildSocialPreviewTags(preview: PublicSocialPreview): string {
  return [
    `    <title>${escapeHtml(preview.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(preview.description)}" />`,
    `    <link rel="canonical" href="${escapeHtml(preview.canonicalUrl)}" />`,
    `    <meta property="og:title" content="${escapeHtml(preview.title)}" />`,
    `    <meta property="og:site_name" content="Green Goods" />`,
    `    <meta property="og:type" content="website" />`,
    `    <meta property="og:url" content="${escapeHtml(preview.canonicalUrl)}" />`,
    `    <meta property="og:description" content="${escapeHtml(preview.description)}" />`,
    `    <meta property="og:image" content="${escapeHtml(preview.socialImageUrl)}" />`,
    `    <meta property="og:image:alt" content="${escapeHtml(preview.socialImageAlt)}" />`,
    `    <meta property="og:image:type" content="image/png" />`,
    `    <meta property="og:image:width" content="1200" />`,
    `    <meta property="og:image:height" content="630" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${escapeHtml(preview.title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(preview.description)}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(preview.socialImageUrl)}" />`,
    `    <meta name="twitter:image:alt" content="${escapeHtml(preview.socialImageAlt)}" />`,
  ].join("\n");
}

export function renderPublicSocialPreviewHtml(
  html: string,
  preview: PublicSocialPreview
): string {
  const withoutSocialMetadata = removeSocialMetadata(html);
  const tags = buildSocialPreviewTags(preview);

  if (!withoutSocialMetadata.includes("</head>")) {
    return `${tags}\n${withoutSocialMetadata}`;
  }

  return withoutSocialMetadata.replace(/\s*<\/head>/i, `\n${tags}\n  </head>`);
}

function createSocialCardFrameSvg(preview: PublicSocialPreview): string {
  const titleLines = preview.cardTitleLines ?? [preview.cardTitle];
  const ledeLines = preview.cardLedeLines ?? [preview.cardLede];

  return `<svg width="${SOCIAL_CARD_WIDTH}" height="${SOCIAL_CARD_HEIGHT}" viewBox="0 0 ${SOCIAL_CARD_WIDTH} ${SOCIAL_CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="heroShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#000000" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="${SOCIAL_CARD_WIDTH}" height="${SOCIAL_CARD_HEIGHT}" fill="url(#heroShade)"/>
  <rect x="${HERO_CARD_X}" y="${HERO_CARD_Y}" width="${HERO_CARD_WIDTH}" height="${HERO_CARD_HEIGHT}" fill="${HERO_CARD_FILL}" filter="url(#panelShadow)"/>
  ${renderSvgLines(titleLines, {
    x: HERO_TITLE_X,
    y: HERO_TITLE_Y,
    fontSize: HERO_TITLE_SIZE,
    lineHeight: HERO_TITLE_LINE_HEIGHT,
    fill: HERO_CARD_TITLE_COLOR,
    fontFamily: "Fraunces, Georgia, Cambria, Times New Roman, serif",
    letterSpacing: -1.08,
    accent: preview.cardTitleAccent,
  })}
  ${renderSvgLines(ledeLines, {
    x: HERO_TITLE_X,
    y: HERO_LEDE_Y,
    fontSize: HERO_LEDE_SIZE,
    lineHeight: HERO_LEDE_LINE_HEIGHT,
    fill: HERO_CARD_LEDE_COLOR,
    fontFamily: "Inter, Arial, Helvetica, sans-serif",
  })}
</svg>`;
}

async function generateSocialCard(
  preview: PublicSocialPreview,
  publicDir: string,
  outputDir: string
): Promise<void> {
  const { default: sharp } = await import("sharp");
  const heroPath = join(publicDir, preview.heroImagePath.replace(/^\//, ""));
  const imagePath = join(outputDir, preview.socialImagePath.replace(/^\//, ""));
  const logoPath = join(publicDir, "icon.png");
  const logoLayer = await sharp(logoPath).resize({ height: 38 }).png().toBuffer();

  await mkdir(dirname(imagePath), { recursive: true });

  await sharp(heroPath)
    .resize(SOCIAL_CARD_WIDTH, SOCIAL_CARD_HEIGHT, { fit: "cover" })
    .composite([
      { input: Buffer.from(createSocialCardFrameSvg(preview)), left: 0, top: 0 },
      { input: logoLayer, left: 40, top: 15 },
    ])
    .png()
    .toFile(imagePath);
}

async function writeRouteShells(outputDir: string): Promise<void> {
  const rootHtml = await readFile(join(outputDir, "index.html"), "utf8");

  await Promise.all(
    ROUTE_SHELL_KEYS.map(async (key) => {
      const preview = publicSocialPreviews[key];
      const shellPath = join(outputDir, preview.path.replace(/^\//, ""), "index.html");
      await mkdir(dirname(shellPath), { recursive: true });
      await writeFile(shellPath, renderPublicSocialPreviewHtml(rootHtml, preview));
    })
  );
}

function resolveOutputDir(config: ResolvedConfig): string {
  return isAbsolute(config.build.outDir)
    ? config.build.outDir
    : resolve(config.root, config.build.outDir);
}

export function createPublicSocialPreviewPlugin(isIPFSBuild: boolean): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "green-goods-public-social-previews",
    apply: "build",
    configResolved(config) {
      resolvedConfig = config;
    },
    transformIndexHtml(html) {
      if (isIPFSBuild) return html;
      return renderPublicSocialPreviewHtml(html, publicSocialPreviews.home);
    },
    async closeBundle() {
      if (isIPFSBuild) return;

      const outputDir = resolveOutputDir(resolvedConfig);
      const publicDir = join(resolvedConfig.root, "public");

      await Promise.all(
        GENERATED_CARD_KEYS.map((key) =>
          generateSocialCard(publicSocialPreviews[key], publicDir, outputDir)
        )
      );
      await writeRouteShells(outputDir);
    },
  };
}
