import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
const SOCIAL_CARD_FONT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "assets/fonts/social"
);
const SOCIAL_CARD_FONT_FILES = {
  frauncesNormal: "fraunces-normal-400.ttf",
  frauncesItalic: "fraunces-italic-400.ttf",
  interNormal: "inter-normal-400.ttf",
} as const;

type SocialCardFontKey = keyof typeof SOCIAL_CARD_FONT_FILES;
type SocialCardFontPath = {
  toPathData(decimalPlaces?: number): string;
};
type SocialCardGlyph = {
  advanceWidth: number;
  getPath(
    x: number,
    y: number,
    fontSize: number,
    options?: Record<string, never>,
    font?: SocialCardFont
  ): SocialCardFontPath;
};
export type SocialCardFont = {
  ascender: number;
  unitsPerEm: number;
  charToGlyph(char: string): SocialCardGlyph;
  getKerningValue(leftGlyph: SocialCardGlyph, rightGlyph: SocialCardGlyph): number;
};
type SocialCardFonts = Record<SocialCardFontKey, SocialCardFont>;
const require = createRequire(import.meta.url);
const opentype = require("opentype.js") as {
  parse(buffer: ArrayBuffer): SocialCardFont;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function readSocialCardFonts(): Promise<SocialCardFonts> {
  const entries = await Promise.all(
    Object.entries(SOCIAL_CARD_FONT_FILES).map(async ([key, fileName]) => {
      const file = await readFile(join(SOCIAL_CARD_FONT_DIR, fileName));
      return [key, opentype.parse(toArrayBuffer(file))] as const;
    })
  );

  return Object.fromEntries(entries) as SocialCardFonts;
}

function textTopToBaseline(font: SocialCardFont, top: number, fontSize: number): number {
  return top + (font.ascender / font.unitsPerEm) * fontSize;
}

function getTextPathData(
  font: SocialCardFont,
  text: string,
  x: number,
  baseline: number,
  fontSize: number
): string {
  const scale = fontSize / font.unitsPerEm;
  const paths: string[] = [];
  let currentX = x;
  let previousGlyph: SocialCardGlyph | null = null;

  for (const char of Array.from(text)) {
    const glyph = font.charToGlyph(char);
    if (previousGlyph) {
      currentX += font.getKerningValue(previousGlyph, glyph) * scale;
    }
    paths.push(
      glyph.getPath(Math.round(currentX), Math.round(baseline), fontSize, {}, font).toPathData(2)
    );
    currentX += glyph.advanceWidth * scale;
    previousGlyph = glyph;
  }

  return paths.join(" ");
}

function getTextAdvanceWidth(font: SocialCardFont, text: string, fontSize: number): number {
  const scale = fontSize / font.unitsPerEm;
  let width = 0;
  let previousGlyph: SocialCardGlyph | null = null;

  for (const char of Array.from(text)) {
    const glyph = font.charToGlyph(char);
    if (previousGlyph) {
      width += font.getKerningValue(previousGlyph, glyph) * scale;
    }
    width += glyph.advanceWidth * scale;
    previousGlyph = glyph;
  }

  return width;
}

function renderFontPath({
  font,
  text,
  x,
  top,
  fontSize,
  fill,
}: {
  font: SocialCardFont;
  text: string;
  x: number;
  top: number;
  fontSize: number;
  fill: string;
}): string {
  if (!text) return "";

  const baseline = textTopToBaseline(font, top, fontSize);
  const pathData = getTextPathData(font, text, x, baseline, fontSize);
  if (pathData.includes("NaN")) {
    throw new Error(`Social preview font path generation failed for text: ${text}`);
  }
  return `<path d="${escapeHtml(pathData)}" fill="${fill}"/>`;
}

function renderTitleLinePath(
  line: string,
  {
    x,
    top,
    fonts,
    accent,
  }: { x: number; top: number; fonts: SocialCardFonts; accent?: string }
): string {
  if (!accent) {
    return renderFontPath({
      font: fonts.frauncesNormal,
      text: line,
      x,
      top,
      fontSize: HERO_TITLE_SIZE,
      fill: HERO_CARD_TITLE_COLOR,
    });
  }

  const exactAccentStart = line.indexOf(accent);
  if (exactAccentStart !== -1) {
    const before = line.slice(0, exactAccentStart);
    const after = line.slice(exactAccentStart + accent.length);
    const accentX = x + getTextAdvanceWidth(fonts.frauncesNormal, before, HERO_TITLE_SIZE);
    const afterX = accentX + getTextAdvanceWidth(fonts.frauncesItalic, accent, HERO_TITLE_SIZE);

    return [
      renderFontPath({
        font: fonts.frauncesNormal,
        text: before,
        x,
        top,
        fontSize: HERO_TITLE_SIZE,
        fill: HERO_CARD_TITLE_COLOR,
      }),
      renderFontPath({
        font: fonts.frauncesItalic,
        text: accent,
        x: accentX,
        top,
        fontSize: HERO_TITLE_SIZE,
        fill: HERO_CARD_ACCENT_COLOR,
      }),
      renderFontPath({
        font: fonts.frauncesNormal,
        text: after,
        x: afterX,
        top,
        fontSize: HERO_TITLE_SIZE,
        fill: HERO_CARD_TITLE_COLOR,
      }),
    ].join("");
  }

  const accentWords = accent.split(/\s+/).filter(Boolean);
  if (accentWords.length <= 1) {
    return renderFontPath({
      font: fonts.frauncesNormal,
      text: line,
      x,
      top,
      fontSize: HERO_TITLE_SIZE,
      fill: HERO_CARD_TITLE_COLOR,
    });
  }

  const pattern = new RegExp(
    `\\b(${accentWords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "g"
  );
  const paths: string[] = [];
  let currentX = x;
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    if (match.index === undefined) continue;

    const before = line.slice(lastIndex, match.index);
    paths.push(
      renderFontPath({
        font: fonts.frauncesNormal,
        text: before,
        x: currentX,
        top,
        fontSize: HERO_TITLE_SIZE,
        fill: HERO_CARD_TITLE_COLOR,
      })
    );
    currentX += getTextAdvanceWidth(fonts.frauncesNormal, before, HERO_TITLE_SIZE);

    paths.push(
      renderFontPath({
        font: fonts.frauncesItalic,
        text: match[0],
        x: currentX,
        top,
        fontSize: HERO_TITLE_SIZE,
        fill: HERO_CARD_ACCENT_COLOR,
      })
    );
    currentX += getTextAdvanceWidth(fonts.frauncesItalic, match[0], HERO_TITLE_SIZE);
    lastIndex = match.index + match[0].length;
  }

  const after = line.slice(lastIndex);
  paths.push(
    renderFontPath({
      font: fonts.frauncesNormal,
      text: after,
      x: currentX,
      top,
      fontSize: HERO_TITLE_SIZE,
      fill: HERO_CARD_TITLE_COLOR,
    })
  );

  return paths.join("");
}

export function renderSocialCardTextPaths(
  preview: PublicSocialPreview,
  fonts: SocialCardFonts
): string {
  const titleLines = preview.cardTitleLines ?? [preview.cardTitle];
  const ledeLines = preview.cardLedeLines ?? [preview.cardLede];

  return [
    ...titleLines.map((line, index) =>
      renderTitleLinePath(line, {
        x: HERO_TITLE_X,
        top: HERO_TITLE_Y + index * HERO_TITLE_LINE_HEIGHT,
        fonts,
        accent: preview.cardTitleAccent,
      })
    ),
    ...ledeLines.map((line, index) =>
      renderFontPath({
        font: fonts.interNormal,
        text: line,
        x: HERO_TITLE_X,
        top: HERO_LEDE_Y + index * HERO_LEDE_LINE_HEIGHT,
        fontSize: HERO_LEDE_SIZE,
        fill: HERO_CARD_LEDE_COLOR,
      })
    ),
  ].join("");
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

function createSocialCardFrameSvg(preview: PublicSocialPreview, fonts: SocialCardFonts): string {
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
  ${renderSocialCardTextPaths(preview, fonts)}
</svg>`;
}

async function generateSocialCard(
  preview: PublicSocialPreview,
  publicDir: string,
  outputDir: string,
  fonts: SocialCardFonts
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
      { input: Buffer.from(createSocialCardFrameSvg(preview, fonts)), left: 0, top: 0 },
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
      const socialCardFonts = await readSocialCardFonts();

      await Promise.all(
        GENERATED_CARD_KEYS.map((key) =>
          generateSocialCard(publicSocialPreviews[key], publicDir, outputDir, socialCardFonts)
        )
      );
      await writeRouteShells(outputDir);
    },
  };
}
