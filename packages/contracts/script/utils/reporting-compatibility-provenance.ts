import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";

/** Public source-only inputs. Never reads environment files or signing material. */
export function reportingSourceDigest(root: string, inputs: string[]): { sourceDigest: string; sourceFiles: string[] } {
  const files = new Set<string>();
  const visit = (relative: string): void => {
    const file = path.resolve(root, relative);
    if (!relative || path.relative(root, file).startsWith("..") || path.isAbsolute(relative))
      throw new Error("Reporting proof source escapes the repository");
    let current = root;
    for (const segment of path.relative(root, file).split(path.sep)) {
      current = path.join(current, segment);
      if (lstatSync(current).isSymbolicLink()) throw new Error("Reporting proof refuses symlinked source");
    }
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("Reporting proof refuses symlinked source");
    if (stat.isDirectory()) {
      for (const name of readdirSync(file).sort()) visit(path.join(relative, name));
    } else if (stat.isFile() && /\.(?:ts|tsx|mjs|json|sol|toml|lock|css|md)$/u.test(relative)) {
      files.add(relative);
    } else throw new Error("Reporting proof requires public source files");
  };
  for (const input of inputs) visit(input);
  const sourceFiles = [...files].sort();
  if (!sourceFiles.length) throw new Error("Reporting proof has no source inputs");
  const digest = createHash("sha256");
  for (const file of sourceFiles) {
    digest.update(file);
    digest.update("\0");
    digest.update(
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest(),
    );
  }
  return { sourceDigest: `sha256:${digest.digest("hex")}`, sourceFiles };
}
