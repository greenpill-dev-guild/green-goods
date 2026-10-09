import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// A test file that uses one of these changes module or global state for whatever runs after it in
// the same worker: `vi.mock` does not re-apply to a module another file already loaded, stubbed
// globals or env survive the file, a module-registry reset re-evaluates modules under every later
// file, and IndexedDB databases outlive the file that opened them. A global assigned directly, or
// through `Object.defineProperty`, is a stub `unstubGlobals` cannot undo. Such files keep their own
// module graph (`isolate: true`); every other Node test can share one graph, which skips
// re-importing the modules each file needs. Running the shared graph found the last three:
// job-queue-blocked-open and draft-migration broke later files, and ipfs.module restored a `fetch`
// captured while Vitest collected it. That is the native `fetch` when the file runs first in its
// worker, so a gateway retry reached the network and its response failed a later file.
const ISOLATION_CALL = new RegExp(
  [
    String.raw`\bvi\s*\.\s*(?:mock|doMock|hoisted|stubGlobal|stubEnv|resetModules|isolateModules|unmock|doUnmock)\s*\(`,
    String.raw`\b(?:indexedDB|IDBFactory)\b|fake-indexeddb`,
    String.raw`\b(?:globalThis|global|window|self)\s*(?:\.\s*[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=(?!=)`,
    String.raw`\(\s*(?:globalThis|global|window|self)\s+as\s+[^()]*(?:\([^()]*\)[^()]*)*\)\s*(?:\.\s*[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=(?!=)`,
    String.raw`\bObject\s*\.\s*defineProperty\s*\(\s*(?:globalThis|global|window|self|navigator)\b`,
  ].join("|"),
);
// A leak the scan cannot see, such as a dependency that changes a built-in when it loads, is
// declared in the file: `// @shared-graph isolate: <reason>`. The shared-graph setup fails any file
// that leaves a built-in changed, so a missing marker fails that file instead of a later one.
const ISOLATE_MARKER = /@shared-graph\s+isolate\b/;
// A `.test.ts` file may declare a DOM environment in its docblock; it is a DOM test and needs the
// DOM setup, whatever its path.
const DOM_ENVIRONMENT = /@vitest-environment\s+(jsdom|happy-dom)\b/;

// A helper that a test imports runs inside that test's file, so its mocks, stubs, IndexedDB use and
// global writes count as the test's own. Helpers live under __tests__/ or __mocks__/; production
// modules are not scanned here, because the shared-graph setup gives every file fresh copies of them.
const TEST_SUPPORT = /(^|\/)(__tests__|__mocks__)\//;
const LOCAL_IMPORT =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\sfrom\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bvi\s*\.\s*importActual\s*\(\s*["']([^"']+)["']/g;
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx"];

/** Whether a test file's source asks for its own module graph under the rules above. */
export function needsOwnGraph(source) {
  return ISOLATE_MARKER.test(source) || ISOLATION_CALL.test(source);
}

function resolveLocal(specifier, fromFile, root) {
  let base;
  if (specifier.startsWith(".")) base = path.join(path.dirname(fromFile), specifier);
  else if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
  else return null;
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Why a test file (a path relative to `root`) needs its own module graph, or null when it can share
 * one: its own source, or a test-support module it imports directly or through other helpers, uses
 * one of the rules above.
 */
export function ownGraphReason(file, { root, readSource = (absolute) => readFileSync(absolute, "utf8") }) {
  const start = path.resolve(root, file);
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    const source = readSource(current);
    if (needsOwnGraph(source)) {
      return current === start
        ? "its own code mocks, stubs, resets modules, uses IndexedDB, writes a global or carries an isolation marker"
        : `it imports ${path.relative(root, current).split(path.sep).join("/")}, which does`;
    }
    for (const match of source.matchAll(LOCAL_IMPORT)) {
      const resolved = resolveLocal(match[1] ?? match[2] ?? match[3], current, root);
      const relative = resolved && path.relative(root, resolved).split(path.sep).join("/");
      if (!resolved || seen.has(resolved) || !TEST_SUPPORT.test(relative)) continue;
      seen.add(resolved);
      queue.push(resolved);
    }
  }
  return null;
}

/**
 * Splits the files matched by the Node test globs in `include` (relative to `root`) into DOM tests
 * (a docblock DOM environment), Node tests that can share one module graph, and Node tests that
 * must stay isolated. Paths come back relative to `root`, sorted, ready for a project's `include`.
 */
export function partitionNodeTests({ root, include }) {
  const files = [...new Set(include.flatMap((pattern) => globSync(pattern, { cwd: root })))]
    .map((file) => file.split(path.sep).join("/"))
    .sort();
  const sharedGraph = [];
  const isolated = [];
  const dom = [];
  for (const file of files) {
    const source = readFileSync(path.join(root, file), "utf8");
    if (DOM_ENVIRONMENT.test(source)) dom.push(file);
    else (ownGraphReason(file, { root }) ? isolated : sharedGraph).push(file);
  }
  return { sharedGraph, isolated, dom };
}
