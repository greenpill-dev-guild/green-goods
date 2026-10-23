import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS,
  PUBLIC_SOCIAL_PREVIEW_ORIGIN,
  publicSocialPreviews,
  resolvePublicSocialPreview,
} from "../../content/publicSocialPreviews";
import {
  renderSocialCardTextPaths,
  renderPublicSocialPreviewHtml,
  type SocialCardFont,
} from "../../../vite/social-preview";

// The card's linen panel ends at x 576 (HERO_CARD_X + HERO_CARD_WIDTH in vite/social-preview.ts).
// Read here rather than exported: any edit under packages/client/vite/ adds the slow PWA preview check.
const SOCIAL_CARD_PANEL_RIGHT = 576;

function readSocialCardFont(fileName: string): SocialCardFont {
  const opentype = createRequire(import.meta.url)("opentype.js") as {
    parse(buffer: ArrayBuffer): SocialCardFont;
  };
  const file = readFileSync(
    new URL(`../../../vite/assets/fonts/social/${fileName}`, import.meta.url)
  );
  return opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
}

describe("public social previews", () => {
  it("covers exactly the approved editorial route previews", () => {
    expect(PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS).toEqual([
      "home",
      "fund",
      "impact",
      "actions",
      "gardens",
      "cookies",
    ]);
    expect(Object.keys(publicSocialPreviews)).toEqual([...PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS]);
  });

  it("uses the canonical production origin for urls and images", () => {
    for (const preview of Object.values(publicSocialPreviews)) {
      expect(preview.canonicalUrl).toMatch(new RegExp(`^${PUBLIC_SOCIAL_PREVIEW_ORIGIN}`));
      expect(preview.socialImageUrl).toMatch(new RegExp(`^${PUBLIC_SOCIAL_PREVIEW_ORIGIN}/`));
    }

    expect(publicSocialPreviews.home.socialImagePath).toBe("/social-home.png");
    expect(publicSocialPreviews.fund.socialImagePath).toBe("/social/fund.png");
  });

  it("splits each card title and lede into lines that spell them, titles with no closing period", () => {
    for (const preview of Object.values(publicSocialPreviews)) {
      expect(preview.cardTitle, preview.key).not.toMatch(/\.$/);
      if (preview.cardTitleLines) {
        expect(preview.cardTitleLines.join(" "), preview.key).toBe(preview.cardTitle);
      }
      if (preview.cardLedeLines) {
        expect(preview.cardLedeLines.join(" "), preview.key).toBe(preview.cardLede);
      }
    }
  });

  it("keeps every line drawn on a generated card inside its linen panel", () => {
    const fonts = {
      frauncesNormal: readSocialCardFont("fraunces-normal-400.ttf"),
      frauncesItalic: readSocialCardFont("fraunces-italic-400.ttf"),
      interNormal: readSocialCardFont("inter-normal-400.ttf"),
    };
    // The rightmost x among the glyph outlines the renderer drew: path data is x,y pairs.
    const inkRight = (svg: string) =>
      Math.max(
        ...[...svg.matchAll(/\sd="([^"]*)"/g)].flatMap(([, pathData]) =>
          (pathData.match(/-?\d+(?:\.\d+)?/g) ?? [])
            .map(Number)
            .filter((_, index) => index % 2 === 0)
        )
      );

    for (const preview of Object.values(publicSocialPreviews)) {
      if (!preview.socialImagePath.startsWith("/social/")) continue;
      for (const line of preview.cardTitleLines ?? [preview.cardTitle]) {
        const svg = renderSocialCardTextPaths(
          { ...preview, cardTitleLines: [line], cardLedeLines: [] },
          fonts
        );
        expect(inkRight(svg), `${preview.key} title: ${line}`).toBeLessThanOrEqual(
          SOCIAL_CARD_PANEL_RIGHT
        );
      }
      for (const line of preview.cardLedeLines ?? [preview.cardLede]) {
        const svg = renderSocialCardTextPaths(
          { ...preview, cardTitleLines: [], cardLedeLines: [line] },
          fonts
        );
        expect(inkRight(svg), `${preview.key} lede: ${line}`).toBeLessThanOrEqual(
          SOCIAL_CARD_PANEL_RIGHT
        );
      }
    }
  });

  it("resolves dynamic public urls to their generic route previews", () => {
    expect(resolvePublicSocialPreview("/gardens/decleanup").key).toBe("gardens");
    expect(resolvePublicSocialPreview("/gardens/decleanup?ref=x").key).toBe("gardens");
    expect(resolvePublicSocialPreview("/cookies?campaign=earth-week").key).toBe("cookies");
    expect(resolvePublicSocialPreview("/unknown").key).toBe("home");
  });

  it("replaces social tags without duplicating them or dropping app markup", () => {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Old title</title>
    <meta name="description" content="Old description" />
    <meta property="og:title" content="Old OG title" />
    <meta property="og:image" content="/old.png" />
    <meta name="twitter:title" content="Old Twitter title" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

    const result = renderPublicSocialPreviewHtml(html, publicSocialPreviews.fund);

    expect(result.match(/property="og:title"/g)).toHaveLength(1);
    expect(result.match(/property="og:image"/g)).toHaveLength(1);
    expect(result.match(/name="twitter:title"/g)).toHaveLength(1);
    expect(result.match(/name="description"/g)).toHaveLength(1);
    expect(result).toContain(`<title>${publicSocialPreviews.fund.title}</title>`);
    expect(result).toContain(`content="${publicSocialPreviews.fund.socialImageUrl}"`);
    expect(result).toContain('<div id="root"></div>');
    expect(result).toContain('<script type="module" src="/src/main.tsx"></script>');
  });

  it("renders social card text as font-derived paths instead of host font lookups", () => {
    const fakeFont = (label: string) => ({
      ascender: 1000,
      unitsPerEm: 1000,
      charToGlyph: (char: string) => ({
        advanceWidth: 10,
        getPath: (x: number, y: number, fontSize: number) => ({
          toPathData: () => `${label}:${char}:${x}:${y}:${fontSize}`,
        }),
      }),
      getKerningValue: () => 0,
    });

    const result = renderSocialCardTextPaths(publicSocialPreviews.fund, {
      frauncesNormal: fakeFont("normal"),
      frauncesItalic: fakeFont("italic"),
      interNormal: fakeFont("inter"),
    });

    expect(result).toContain("<path");
    expect(result).toContain("normal:A");
    expect(result).toContain("italic:g");
    expect(result).toContain("inter:D");
    expect(result).not.toContain("<text");
    expect(result).not.toContain("font-family");
    expect(result).not.toContain("Georgia");
    expect(result).not.toContain("Arial");
  });
});
