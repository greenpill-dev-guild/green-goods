import { assertDependabotPr, manifestUpdates, syncPaths } from "./dependabot-sync.mjs";

// This job consumes data only. It never checks out or executes PR code, installs
// PR dependencies, applies patches, or force-pushes a branch.
export async function publishSync({ github, repository, number, bundle, trustedRoot }) {
  const [owner, repo] = repository.split("/");
  const coordinates = { owner, repo };
  if (bundle.repository !== repository || bundle.number !== number || !Array.isArray(bundle.files)) throw new Error("Artifact belongs to a different PR");
  const { data: pr } = await github.rest.pulls.get({ ...coordinates, pull_number: number });
  assertDependabotPr(pr, repository);
  if (pr.head.sha !== bundle.headSha) return { skipped: "PR head changed; a newer run will synchronize it" };
  const { manifests, allowed } = syncPaths(trustedRoot);
  const seen = new Set();
  const entries = [];
  for (const file of bundle.files) {
    if (!allowed.has(file.path) || seen.has(file.path) || typeof file.content !== "string") throw new Error("Unexpected artifact file");
    seen.add(file.path);
    const content = Buffer.from(file.content, "base64");
    if (content.toString("base64") !== file.content) throw new Error("Invalid artifact encoding");
    if (manifests.includes(file.path)) {
      const { data: original } = await github.rest.repos.getContent({ ...coordinates, path: file.path, ref: bundle.headSha });
      if (original.type !== "file" || original.encoding !== "base64") throw new Error("Expected a manifest file");
      manifestUpdates(JSON.parse(Buffer.from(original.content, "base64").toString()), JSON.parse(content.toString()));
    }
    entries.push({ path: file.path, content: file.content });
  }
  if (!entries.length) return { skipped: "Already synchronized" };
  const { data: parent } = await github.rest.git.getCommit({ ...coordinates, commit_sha: bundle.headSha });
  const tree = [];
  for (const entry of entries) {
    const { data: blob } = await github.rest.git.createBlob({ ...coordinates, content: entry.content, encoding: "base64" });
    tree.push({ path: entry.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const { data: nextTree } = await github.rest.git.createTree({ ...coordinates, base_tree: parent.tree.sha, tree });
  const { data: commit } = await github.rest.git.createCommit({
    ...coordinates,
    message: "chore(shared): synchronize Dependabot dependency files",
    tree: nextTree.sha,
    parents: [bundle.headSha],
  });
  // A concurrent update makes this fail as non-fast-forward. No newer work is lost.
  await github.rest.git.updateRef({ ...coordinates, ref: `heads/${pr.head.ref}`, sha: commit.sha, force: false });
  return { sha: commit.sha, files: entries.map((file) => file.path) };
}
