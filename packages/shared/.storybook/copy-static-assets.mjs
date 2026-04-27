import { access, cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const storybookDir = dirname(fileURLToPath(import.meta.url));
const sharedRoot = resolve(storybookDir, "..");
const repoRoot = resolve(storybookDir, "../../..");
const outputDir = resolve(sharedRoot, "storybook-static");

const copies = [
  {
    from: resolve(repoRoot, "tmp/storybook-design-assets"),
    to: outputDir,
  },
];

await mkdir(outputDir, { recursive: true });

for (const { from, to } of copies) {
  try {
    await access(from);
  } catch {
    throw new Error(`Storybook static asset source is missing: ${from}`);
  }

  await cp(from, to, {
    recursive: true,
    force: true,
  });
}

console.log(`Copied Storybook static assets into ${outputDir}`);
