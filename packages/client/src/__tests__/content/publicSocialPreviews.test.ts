import { describe, expect, it } from "vitest";
import {
  PUBLIC_SOCIAL_PREVIEW_ROUTE_KEYS,
  PUBLIC_SOCIAL_PREVIEW_ORIGIN,
  publicSocialPreviews,
  resolvePublicSocialPreview,
} from "../../content/publicSocialPreviews";
import { renderPublicSocialPreviewHtml } from "../../../vite/social-preview";

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

    expect(publicSocialPreviews.home.socialImagePath).toBe("/social-home-hero.png");
    expect(publicSocialPreviews.fund.socialImagePath).toBe("/social/fund.png");
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
});
