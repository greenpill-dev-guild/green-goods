// Writes output/index.html: the player with the walkthrough's chapters, screens, copy and
// measured boxes inlined. Screens stay files beside it (output/screens/<id>.webp).
// Usage: node .plans/ideas/garden-reporting/artifacts/walkthrough/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTERS, END, PERSONA, SCREENS } from "./screens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const boxes = JSON.parse(readFileSync(join(here, "output", "boxes.json"), "utf8"));
const missing = SCREENS.filter((screen) => !boxes[screen.id]).map((screen) => screen.id);
if (missing.length > 0) throw new Error(`not captured: ${missing.join(", ")}`);

const data = {
  persona: PERSONA,
  end: END,
  chapters: CHAPTERS,
  screens: SCREENS.map((screen) => ({
    id: screen.id,
    chapter: screen.chapter,
    extra: Boolean(screen.extra),
    title: screen.title,
    caption: screen.caption,
    hint: screen.hint,
    alt: screen.alt,
    src: `screens/${screen.id}.webp`,
    hotspot: boxes[screen.id].hotspot,
    back: boxes[screen.id].back,
    fresh: boxes[screen.id].fresh,
  })),
};
const template = readFileSync(join(here, "player.html"), "utf8");
// The JSON sits inside a script: escape "<" so no string can close it.
const json = JSON.stringify(data).replace(/</g, "\\u003c");
writeFileSync(join(here, "output", "index.html"), template.replace("/*__DATA__*/null", json));
console.log(`index.html: ${data.screens.length} screens, ${data.chapters.length} chapters`);
