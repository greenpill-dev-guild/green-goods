/**
 * A public record page names itself in the document head (PUB-032): its own title, description,
 * canonical URL and sharing image, in place of the route shell's, and the shell's come back once
 * the page closes.
 *
 * @vitest-environment happy-dom
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PublicPageHead } from "../../components/Public/PublicPageHead";

const SHELL = {
  title: "Gardens | Green Goods",
  description: "Explore community-led projects.",
  url: "https://www.greengoods.app/gardens",
  image: "https://www.greengoods.app/social/gardens.png",
};

const meta = (selector: string) => document.head.querySelector<HTMLMetaElement>(selector)?.content;
const canonical = () =>
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute("href");

function shellHead() {
  document.head.innerHTML = [
    `<meta name="description" content="${SHELL.description}">`,
    `<link rel="canonical" href="${SHELL.url}">`,
    `<meta property="og:title" content="${SHELL.title}">`,
    `<meta property="og:description" content="${SHELL.description}">`,
    `<meta property="og:url" content="${SHELL.url}">`,
    `<meta property="og:image" content="${SHELL.image}">`,
    `<meta name="twitter:title" content="${SHELL.title}">`,
    `<meta name="twitter:description" content="${SHELL.description}">`,
    `<meta name="twitter:image" content="${SHELL.image}">`,
  ].join("");
  document.title = SHELL.title;
}

describe("PublicPageHead", () => {
  beforeEach(shellHead);
  afterEach(cleanup);

  it("names the page it heads, for the tab, search and sharing", () => {
    render(
      <PublicPageHead
        title="Vida Verde | Green Goods"
        description="A community garden in Lisbon."
        url="https://www.greengoods.app/gardens/vida-verde"
        image="https://gateway.example/ipfs/banner"
      />
    );
    expect(document.title).toBe("Vida Verde | Green Goods");
    expect(meta('meta[name="description"]')).toBe("A community garden in Lisbon.");
    expect(canonical()).toBe("https://www.greengoods.app/gardens/vida-verde");
    expect(meta('meta[property="og:title"]')).toBe("Vida Verde | Green Goods");
    expect(meta('meta[property="og:url"]')).toBe("https://www.greengoods.app/gardens/vida-verde");
    expect(meta('meta[property="og:image"]')).toBe("https://gateway.example/ipfs/banner");
    expect(meta('meta[name="twitter:description"]')).toBe("A community garden in Lisbon.");
  });

  it("keeps the shell's image and description when the page has none", () => {
    render(
      <PublicPageHead title="Vida Verde | Green Goods" url="https://www.greengoods.app/gardens/x" />
    );
    expect(meta('meta[property="og:image"]')).toBe(SHELL.image);
    expect(meta('meta[name="description"]')).toBe(SHELL.description);
  });

  it("gives the shell its own head back once the page closes", () => {
    const { unmount } = render(
      <PublicPageHead
        title="Vida Verde | Green Goods"
        description="A community garden in Lisbon."
        url="https://www.greengoods.app/gardens/vida-verde"
      />
    );
    unmount();
    expect(document.title).toBe(SHELL.title);
    expect(meta('meta[name="description"]')).toBe(SHELL.description);
    expect(canonical()).toBe(SHELL.url);
    expect(meta('meta[property="og:url"]')).toBe(SHELL.url);
  });

  it("adds a canonical link when the shell has none", () => {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    const { unmount } = render(
      <PublicPageHead title="Vida Verde | Green Goods" url="https://www.greengoods.app/gardens/v" />
    );
    expect(canonical()).toBe("https://www.greengoods.app/gardens/v");
    unmount();
    expect(canonical()).toBeUndefined();
  });
});
