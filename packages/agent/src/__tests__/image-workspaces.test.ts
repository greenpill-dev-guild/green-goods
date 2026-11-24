// TEST-QUALITY: allow-small-test-file - no other suite covers the Agent image's build context;
// these two cases read the Dockerfile and .dockerignore, not runtime code, so they join no runtime suite.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// fly.toml builds the Agent image from the repository root, and `bun install --frozen-lockfile`
// refuses the lockfile when a workspace it lists has no manifest in the image. A new workspace
// once failed every Fly deploy that way while CI stayed green, because no CI job builds the image.
// These checks fail the pull request that adds the workspace instead.
const root = new URL("../../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** Bun's workspace folders: each root `workspaces` entry, `dir/*` expanded to folders with a manifest. */
function workspaceFolders(): string[] {
  const { workspaces } = JSON.parse(read("package.json")) as { workspaces: string[] };
  return workspaces.flatMap((entry) => {
    if (!entry.endsWith("/*")) return [entry];
    const parent = entry.slice(0, -2);
    return readdirSync(new URL(`${parent}/`, root), { withFileTypes: true })
      .filter(
        (folder) =>
          folder.isDirectory() && existsSync(new URL(`${parent}/${folder.name}/package.json`, root))
      )
      .map((folder) => `${parent}/${folder.name}`);
  });
}

/** The COPY sources of each Dockerfile stage that runs `bun install`. */
function installStageSources(): string[][] {
  return read("packages/agent/Dockerfile")
    .split(/^FROM /m)
    .filter((stage) => stage.includes("bun install"))
    .map((stage) =>
      [...stage.matchAll(/^COPY (?!--from=)(.+)$/gm)].flatMap((copy) =>
        (copy[1] ?? "").trim().split(/\s+/).slice(0, -1)
      )
    );
}

describe("Agent image build context", () => {
  const folders = workspaceFolders();

  it("copies every workspace manifest into each install stage", () => {
    const stages = installStageSources();
    expect(stages.length).toBeGreaterThan(0);
    const missing = stages.flatMap((sources, stage) =>
      folders
        .filter(
          (folder) => !sources.includes(folder) && !sources.includes(`${folder}/package.json`)
        )
        .map((folder) => `install stage ${stage + 1}: ${folder}`)
    );
    expect(missing).toEqual([]);
  });

  it("keeps every workspace manifest in the root .dockerignore allowlist", () => {
    const allowed = new Set(
      read(".dockerignore")
        .split("\n")
        .map((line) => line.trim())
    );
    const missing = folders.filter(
      (folder) => !allowed.has(`!${folder}/package.json`) && !allowed.has(`!${folder}/**`)
    );
    expect(missing).toEqual([]);
  });
});
