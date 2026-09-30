/**
 * Guard: every theme animation the client uses has keyframes behind it.
 *
 * The shared theme declares `--animate-*` tokens, and each one names a keyframes
 * rule. A token without its keyframes still computes to that animation name, so
 * nothing looks wrong until something waits for the animation to end. Radix keeps
 * a closing accordion panel mounted until `animationend`: with no `accordion-up`
 * keyframes that event never came, and an opened Help question could not close.
 * The keyframes were dropped when the client's animation tokens moved into the
 * shared theme, which carries the tokens only. jsdom runs no animations, so the
 * component tests cannot see this; the stylesheet has to be checked instead.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(__dirname, "../..");
const SHARED_STYLES = resolve(SOURCE_ROOT, "../../shared/src/styles");

const readCss = (path: string) => readFileSync(path, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");

function filesUnder(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : filesUnder(path, keep);
    return keep(name) ? [path] : [];
  });
}

/** `--animate-accordion-up: accordion-up 0.2s ease-out` → accordion-up → accordion-up. */
const themeAnimations = new Map(
  Array.from(
    readCss(join(SHARED_STYLES, "theme.css")).matchAll(
      /--animate-([a-z0-9-]+)\s*:\s*([a-z0-9-]+)/g
    ),
    ([, token, keyframes]) => [token, keyframes] as const
  )
);

/** Every stylesheet the client bundles: the two shared imports plus its own. */
const shippedKeyframes = new Set(
  [
    join(SHARED_STYLES, "theme.css"),
    join(SHARED_STYLES, "utilities.css"),
    ...filesUnder(SOURCE_ROOT, (name) => name.endsWith(".css")),
  ].flatMap((path) =>
    Array.from(readCss(path).matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g), ([, name]) => name)
  )
);

describe("client animation keyframes", () => {
  it("reads the shared theme's animation tokens", () => {
    expect(themeAnimations.get("accordion-up")).toBe("accordion-up");
    expect(themeAnimations.get("accordion-down")).toBe("accordion-down");
  });

  it("ships keyframes for every theme animation used in client source", () => {
    const sources = filesUnder(
      SOURCE_ROOT,
      (name) => /\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)
    );
    const missing = sources.flatMap((file) => {
      const used = new Set(
        Array.from(
          readFileSync(file, "utf-8").matchAll(/animate-([a-z0-9-]+)/g),
          ([, token]) => token
        )
      );
      return [...used]
        .filter((token) => themeAnimations.has(token))
        .filter((token) => !shippedKeyframes.has(themeAnimations.get(token) as string))
        .map((token) => `${relative(SOURCE_ROOT, file)}: animate-${token}`);
    });
    expect(missing).toEqual([]);
  });
});
