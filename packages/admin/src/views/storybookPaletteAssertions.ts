import { expect } from "storybook/test";

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const DARK_CANVAS: Rgba = { r: 22, g: 25, b: 33, a: 1 };
const BACKDROP_STYLE_PROPERTY = ["backdrop", "filter"].join("-");
const WEBKIT_BACKDROP_STYLE_PROPERTY = ["-webkit", BACKDROP_STYLE_PROPERTY].join("-");

function parseAlpha(value: string | undefined): number {
  if (!value) return 1;
  if (value.endsWith("%")) return Number.parseFloat(value) / 100;
  return Number.parseFloat(value);
}

function parseCssColor(value: string): Rgba | null {
  const normalized = value.trim();
  if (!normalized || normalized === "transparent") return null;

  const match = normalized.match(/^rgba?\((.+)\)$/);
  if (!match) return null;

  const parts = match[1]
    .replace(/\s*\/\s*/, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;

  const [r, g, b] = parts.slice(0, 3).map((part) => Number.parseFloat(part));
  const a = parseAlpha(parts[3]);
  if ([r, g, b, a].some((part) => Number.isNaN(part))) return null;

  return { r, g, b, a };
}

function blend(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top.a + bottom.a * (1 - top.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };

  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha,
    a: alpha,
  };
}

function resolveCanvasFallback(): Rgba {
  return document.documentElement.getAttribute("data-theme") === "dark" ||
    document.body.getAttribute("data-theme") === "dark"
    ? DARK_CANVAS
    : WHITE;
}

function resolveBackground(element: Element | null): Rgba {
  if (!(element instanceof HTMLElement)) return resolveCanvasFallback();

  const parentBackground = resolveBackground(element.parentElement);
  const color = parseCssColor(window.getComputedStyle(element).backgroundColor);
  if (!color || color.a === 0) return parentBackground;
  if (color.a === 1) return color;

  return blend(color, parentBackground);
}

function relativeChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * relativeChannel(r) + 0.7152 * relativeChannel(g) + 0.0722 * relativeChannel(b);
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function isVisible(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    styles.display !== "none" &&
    styles.visibility !== "hidden" &&
    Number.parseFloat(styles.opacity || "1") > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function chromeBackdropValue(element: Element): string {
  const styles = window.getComputedStyle(element);
  return (
    styles.getPropertyValue(BACKDROP_STYLE_PROPERTY) ||
    styles.getPropertyValue(WEBKIT_BACKDROP_STYLE_PROPERTY) ||
    "none"
  );
}

function expectTransparentAppBarRoot(appBar: HTMLElement) {
  const styles = window.getComputedStyle(appBar);
  const rawBackgroundColor = styles.backgroundColor.trim();
  const backgroundColor = parseCssColor(styles.backgroundColor);

  expect(styles.backgroundImage).toBe("none");
  expect(rawBackgroundColor === "transparent" || backgroundColor?.a === 0).toBe(true);
  expect(styles.borderBottomWidth).toBe("0px");
  expect(styles.boxShadow).toBe("none");
  expect(chromeBackdropValue(appBar)).toBe("none");
}

export async function withTemporaryDocumentTheme(
  theme: "light" | "dark",
  callback: () => Promise<void>
) {
  const previousHtmlTheme = document.documentElement.getAttribute("data-theme");
  const previousBodyTheme = document.body.getAttribute("data-theme");

  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);

  try {
    await callback();
  } finally {
    if (previousHtmlTheme === null) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", previousHtmlTheme);
    }

    if (previousBodyTheme === null) {
      document.body.removeAttribute("data-theme");
    } else {
      document.body.setAttribute("data-theme", previousBodyTheme);
    }
  }
}

export function expectElementContrast(
  element: HTMLElement,
  { label, minRatio = 4.5 }: { label: string; minRatio?: number }
) {
  const foreground = parseCssColor(window.getComputedStyle(element).color);
  const background = resolveBackground(element);

  expect(foreground, `${label} has a computed foreground color`).not.toBeNull();
  const ratio = contrastRatio(blend(foreground as Rgba, background), background);
  expect(
    ratio,
    `${label} contrast ratio ${ratio.toFixed(2)} should be >= ${minRatio}`
  ).toBeGreaterThanOrEqual(minRatio);
}

export function expectAllVisibleSelectorContrast(
  root: ParentNode,
  selector: string,
  { label, minRatio = 4.5 }: { label: string; minRatio?: number }
) {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
  expect(elements.length, `${label} should have visible elements`).toBeGreaterThan(0);

  elements.forEach((element, index) => {
    expectElementContrast(element, { label: `${label} ${index + 1}`, minRatio });
  });
}

export function expectAdminShellDarkPalette(root: ParentNode) {
  const appBar = root.querySelector<HTMLElement>('[data-component="AppBar"][data-slot="root"]');
  const gardenChip = root.querySelector<HTMLElement>('[data-component="GardenChip"]');

  expect(appBar).not.toBeNull();
  expect(gardenChip).not.toBeNull();

  expectTransparentAppBarRoot(appBar as HTMLElement);
  expectElementContrast(gardenChip as HTMLElement, { label: "GardenChip" });
}
