// Finds the Shared source files that sign, send a transaction, move funds, or change auth,
// session or queue state, so the validation selector can keep all of them critical.
//
// Dependency-free on purpose: CI Gate runs the selector tests with Node alone. Biome formats
// Shared source, so every top-level statement starts at column 0. The analyzer splits a file into
// those statements, blanks comments and strings, and reads imports, exports and calls lexically.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const SHARED_SOURCE_ROOT = "packages/shared/src";

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const NOT_CALLS = new Set([
  "if", "for", "while", "switch", "catch", "function", "return", "typeof", "await", "yield",
  "new", "super", "import", "void", "delete", "in", "of", "else", "do", "case", "throw",
]);

export function isSharedSourcePath(relativePath) {
  return (
    relativePath.startsWith(`${SHARED_SOURCE_ROOT}/`) &&
    SOURCE_EXTENSIONS.some((extension) => relativePath.endsWith(extension)) &&
    !relativePath.endsWith(".d.ts") &&
    !/(^|\/)(__tests__|__mocks__)\//.test(relativePath) &&
    !/\.(test|spec|stories)\.tsx?$/.test(relativePath)
  );
}

function listSharedSource(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relativePath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(relativePath);
      } else if (isSharedSourcePath(relativePath)) {
        files.push(relativePath);
      }
    }
  };
  walk(SHARED_SOURCE_ROOT);
  return files.sort();
}

// Replaces comments and string/template contents with spaces, keeping line structure and the
// specifier strings of import/export statements, which the analyzer reads back.
export function blankNonCode(source) {
  let output = "";
  let index = 0;
  let lastSignificant = "";
  const keepSpecifier = () => /(?:\bfrom|\bimport)\s*\(?\s*$/.test(output.slice(-40));
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      output += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    if (char === '"' || char === "'") {
      const keep = keepSpecifier();
      let end = index + 1;
      while (end < source.length && source[end] !== char && source[end] !== "\n") {
        end += source[end] === "\\" ? 2 : 1;
      }
      const body = source.slice(index + 1, end);
      output += char + (keep ? body : body.replace(/[^\n]/g, " ")) + char;
      index = end + 1;
      lastSignificant = char;
      continue;
    }
    if (char === "`") {
      // Template bodies are blanked, but ${...} expressions stay code.
      output += "`";
      index += 1;
      let depth = 0;
      while (index < source.length) {
        const current = source[index];
        if (depth === 0 && current === "`") break;
        if (depth === 0 && current === "\\") {
          output += "  ";
          index += 2;
          continue;
        }
        if (depth === 0 && current === "$" && source[index + 1] === "{") {
          output += "${";
          index += 2;
          depth = 1;
          continue;
        }
        if (depth > 0) {
          if (current === "{") depth += 1;
          if (current === "}") depth -= 1;
          output += current;
        } else {
          output += current === "\n" ? "\n" : " ";
        }
        index += 1;
      }
      output += "`";
      index += 1;
      lastSignificant = "`";
      continue;
    }
    if (char === "/" && (lastSignificant === "" || "(,=:[!&|?{};+-*%<>~^".includes(lastSignificant))) {
      // A regular expression literal: blank it so quotes or slashes inside cannot mislead.
      let end = index + 1;
      let inClass = false;
      while (end < source.length && source[end] !== "\n") {
        if (source[end] === "\\") {
          end += 2;
          continue;
        }
        if (source[end] === "[") inClass = true;
        else if (source[end] === "]") inClass = false;
        else if (source[end] === "/" && !inClass) break;
        end += 1;
      }
      output += `/${" ".repeat(Math.max(0, end - index - 1))}/`;
      index = end + 1;
      lastSignificant = "/";
      continue;
    }
    output += char;
    if (!/\s/.test(char)) lastSignificant = char;
    index += 1;
  }
  return output;
}

function splitStatements(code) {
  const statements = [];
  let current = null;
  for (const line of code.split("\n")) {
    const opensStatement = /^[A-Za-z_$@]/.test(line);
    if (opensStatement || current === null) {
      if (current) statements.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current) statements.push(current);
  return statements.map((lines) => lines.join("\n")).filter((text) => text.trim());
}

function parseImportClause(clause, source, imports) {
  let rest = clause.trim();
  if (rest.startsWith("type ")) return;
  const namespace = rest.match(/(?:^|,)\s*\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespace) imports.set(namespace[1], { source, imported: "*" });
  const named = rest.match(/\{([\s\S]*)\}/);
  if (named) {
    for (const entry of named[1].split(",")) {
      const text = entry.trim();
      if (!text || text.startsWith("type ")) continue;
      const [imported, local] = text.split(/\s+as\s+/).map((part) => part.trim());
      imports.set(local ?? imported, { source, imported });
    }
    rest = rest.replace(named[0], "");
  }
  const defaultName = rest.replace(/\*\s+as\s+[A-Za-z_$][\w$]*/, "").match(/^\s*([A-Za-z_$][\w$]*)/);
  if (defaultName) imports.set(defaultName[1], { source, imported: "default" });
}

function declaredNames(statement) {
  const head = statement.replace(/^export\s+(default\s+)?/, "").replace(/^(declare\s+|abstract\s+|async\s+)+/, "");
  if (/^(type|interface)\s/.test(head)) return { typeOnly: true, names: [] };
  const fn = head.match(/^function\s*\*?\s*([A-Za-z_$][\w$]*)/);
  if (fn) return { names: [fn[1]] };
  const cls = head.match(/^class\s+([A-Za-z_$][\w$]*)/);
  if (cls) return { names: [cls[1]] };
  const enumDecl = head.match(/^(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/);
  if (enumDecl) return { names: [enumDecl[1]] };
  const variable = head.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
  if (variable) return { names: [variable[1]] };
  return { names: [] };
}

const CALL_OPEN = String.raw`\s*(?:<[^<>()]*(?:<[^<>()]*>[^<>()]*)*>)?\s*(?:\?\.)?\s*\(`;
const CALL = new RegExp(String.raw`(^|[^.\w$])(?:new\s+)?([A-Za-z_$][\w$]*)${CALL_OPEN}`, "g");
const NAMESPACE_CALL = new RegExp(String.raw`\b([A-Za-z_$][\w$]*)\s*\??\.\s*([A-Za-z_$][\w$]*)${CALL_OPEN}`, "g");
const MEMBER_CALL = new RegExp(String.raw`\.\s*([A-Za-z_$][\w$]*)${CALL_OPEN}`, "g");

function analyzeStatement(statement) {
  // Spread and rest dots are not member access: `...createReads(` is a call of createReads.
  const text = statement.replaceAll("...", "   ");
  const calls = new Set();
  const memberCalls = new Set();
  const namespaceCalls = [];
  const destructured = new Set();
  const references = new Set();
  for (const match of text.matchAll(CALL)) if (!NOT_CALLS.has(match[2])) calls.add(match[2]);
  for (const match of text.matchAll(NAMESPACE_CALL)) namespaceCalls.push([match[1], match[2]]);
  for (const match of text.matchAll(MEMBER_CALL)) memberCalls.add(match[1]);
  for (const match of text.matchAll(/\{([^{}]*)\}\s*=[^=>]/g)) {
    for (const entry of match[1].split(",")) {
      const key = entry.trim().split(/\s*[:=]\s*/)[0].replace(/^\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(key)) destructured.add(key);
    }
  }
  for (const match of text.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)/g)) references.add(match[2]);
  return { calls, memberCalls, namespaceCalls, destructured, references };
}

export function parseModule(source) {
  const code = blankNonCode(source);
  const module = { imports: new Map(), exports: new Map(), stars: [], declarations: new Map(), dynamic: [] };
  let anonymous = 0;
  for (const statement of splitStatements(code)) {
    const importMatch = statement.match(/^import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']/);
    if (importMatch) {
      parseImportClause(importMatch[1], importMatch[2], module.imports);
      continue;
    }
    if (/^import\s+["']/.test(statement)) continue;
    const reexport = statement.match(/^export\s+(type\s+)?(\*(?:\s+as\s+([A-Za-z_$][\w$]*))?|\{([\s\S]*?)\})\s*from\s+["']([^"']+)["']/);
    if (reexport) {
      const [, typeOnly, , namespace, list, source] = reexport;
      if (typeOnly) continue;
      if (list === undefined && namespace) module.exports.set(namespace, { kind: "reexport", source, imported: "*" });
      else if (list === undefined) module.stars.push(source);
      else {
        for (const entry of list.split(",")) {
          const text = entry.trim();
          if (!text || text.startsWith("type ")) continue;
          const [imported, exported] = text.split(/\s+as\s+/).map((part) => part.trim());
          module.exports.set(exported ?? imported, { kind: "reexport", source, imported });
        }
      }
      continue;
    }
    const localList = statement.match(/^export\s+(type\s+)?\{([\s\S]*?)\}\s*;?\s*$/);
    if (localList) {
      if (localList[1]) continue;
      for (const entry of localList[2].split(",")) {
        const text = entry.trim();
        if (!text || text.startsWith("type ")) continue;
        const [local, exported] = text.split(/\s+as\s+/).map((part) => part.trim());
        module.exports.set(exported ?? local, { kind: "local", local });
      }
      continue;
    }
    const { typeOnly, names } = declaredNames(statement);
    if (typeOnly) continue;
    const info = analyzeStatement(statement);
    const keys = names.length > 0 ? names : [`<statement ${anonymous++}>`];
    for (const key of keys) module.declarations.set(key, info);
    if (/^export\s+default\b/.test(statement)) module.exports.set("default", { kind: "local", local: keys[0] });
    else if (/^export\s/.test(statement)) for (const name of names) module.exports.set(name, { kind: "local", local: name });
  }
  for (const match of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) module.dynamic.push(match[1]);
  return module;
}

/**
 * Analyzes every Shared source file under `root`. A declaration invokes a primitive when it calls
 * or constructs one (imported directly, through re-exports, under an alias, or from a namespace
 * import), calls a primitive member such as `.sendContractCall(`, destructures a primitive member
 * name, or calls a declaration that invokes. Forwarding a member without calling it does not
 * propagate, so hubs like `useAuth()` do not make every reader critical.
 */
export function analyzeSharedMutationSurface({ root, primitives, files }) {
  const external = new Map(Object.entries(primitives.external).map(([name, list]) => [name, new Set(list)]));
  const internal = new Map(
    Object.entries(primitives.internal).map(([file, list]) => [`${SHARED_SOURCE_ROOT}/${file}`, new Set(list)]),
  );
  const members = new Set(primitives.members);
  // Modules are parsed on first use, so a caller that asks about a few files reads only their
  // import closure.
  const parsed = new Map();
  const moduleAt = (file) => {
    if (!parsed.has(file)) {
      const absolute = path.join(root, file);
      parsed.set(file, isSharedSourcePath(file) && existsSync(absolute) ? parseModule(readFileSync(absolute, "utf8")) : null);
    }
    return parsed.get(file);
  };
  const modules = { get: (file) => moduleAt(file) ?? undefined };

  const resolve = (specifier, fromFile) => {
    let base;
    if (specifier.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
    else if (specifier.startsWith("@/")) base = `${SHARED_SOURCE_ROOT}/${specifier.slice(2)}`;
    else return { external: specifier };
    for (const suffix of RESOLVE_SUFFIXES) {
      const candidate = `${base}${suffix}`;
      if (moduleAt(candidate)) return { file: candidate };
    }
    return { unresolved: base };
  };

  const exportMemo = new Map();
  const declarationMemo = new Map();
  const sourceInvokes = (specifier, fromFile, imported, stack) => {
    const target = resolve(specifier, fromFile);
    if (target.external) {
      const names = external.get(target.external);
      if (!names) return false;
      return imported === "*" ? names.size > 0 : names.has(imported);
    }
    return target.file ? exportInvokes(target.file, imported, stack) : false;
  };
  function exportInvokes(file, name, stack = new Set()) {
    const key = `${file}#${name}`;
    if (exportMemo.has(key)) return exportMemo.get(key);
    if (stack.has(key)) return false;
    stack.add(key);
    const module = modules.get(file);
    let result = internal.get(file)?.has(name) ?? false;
    if (!result && module) {
      if (name === "*") {
        result =
          [...module.exports.keys()].some((exported) => exportInvokes(file, exported, stack)) ||
          module.stars.some((star) => sourceInvokes(star, file, "*", stack));
      } else {
        const entry = module.exports.get(name);
        if (entry?.kind === "local") result = declarationInvokes(file, entry.local, stack);
        else if (entry?.kind === "reexport") result = sourceInvokes(entry.source, file, entry.imported, stack);
        else result = module.stars.some((star) => sourceInvokes(star, file, name, stack));
      }
    }
    stack.delete(key);
    exportMemo.set(key, result);
    return result;
  }
  const importInvokes = (file, local, stack) => {
    const entry = modules.get(file).imports.get(local);
    return entry ? sourceInvokes(entry.source, file, entry.imported, stack) : false;
  };
  function declarationInvokes(file, name, stack = new Set()) {
    const key = `${file}::${name}`;
    if (declarationMemo.has(key)) return declarationMemo.get(key);
    if (stack.has(key)) return false;
    stack.add(key);
    const module = modules.get(file);
    const info = module?.declarations.get(name);
    let result = internal.get(file)?.has(name) ?? false;
    if (!result && info) {
      result = [...info.memberCalls, ...info.destructured].some((member) => members.has(member));
      for (const callee of info.calls) {
        if (result) break;
        if (callee === name) continue;
        if (module.imports.has(callee)) result = importInvokes(file, callee, stack);
        else if (module.declarations.has(callee)) result = declarationInvokes(file, callee, stack);
      }
      for (const [namespace, property] of info.namespaceCalls) {
        if (result) break;
        const entry = module.imports.get(namespace);
        if (entry?.imported === "*") result = sourceInvokes(entry.source, file, property, stack);
      }
      for (const reference of info.references) {
        if (result) break;
        if (reference !== name && module.declarations.has(reference)) result = declarationInvokes(file, reference, stack);
      }
    } else if (!result && module?.imports.has(name)) {
      result = importInvokes(file, name, stack);
    }
    stack.delete(key);
    declarationMemo.set(key, result);
    return result;
  }

  const invoking = new Map();
  const subjects = files ?? listSharedSource(root);
  for (const file of subjects) {
    const module = moduleAt(file);
    if (!module) continue;
    const reasons = [];
    for (const [name, info] of module.declarations) {
      if (!declarationInvokes(file, name)) continue;
      const evidence = [
        ...[...info.memberCalls].filter((member) => members.has(member)).map((member) => `.${member}()`),
        ...[...info.destructured].filter((member) => members.has(member)).map((member) => `{ ${member} }`),
        ...[...info.calls].filter((callee) => module.imports.has(callee) && importInvokes(file, callee, new Set()))
          .map((callee) => `${callee}() from ${module.imports.get(callee).source}`),
        ...info.namespaceCalls
          .filter(([namespace, property]) => {
            const entry = module.imports.get(namespace);
            return entry?.imported === "*" && sourceInvokes(entry.source, file, property, new Set());
          })
          .map(([namespace, property]) => `${namespace}.${property}()`),
      ];
      reasons.push(`${name}: ${evidence.join(", ") || "calls a local declaration that invokes"}`);
    }
    for (const specifier of module.dynamic) {
      const target = resolve(specifier, file);
      if ((target.external && external.has(target.external)) || (target.file && exportInvokes(target.file, "*"))) {
        reasons.push(`dynamic import of ${specifier}`);
      }
    }
    if (reasons.length > 0) invoking.set(file, reasons);
  }
  return { files: subjects, invoking };
}

// The changed paths whose current content invokes a primitive, for the selector's escalation.
export function mutationPathsAmong(changedPaths, { root, primitives }) {
  const candidates = [...new Set(changedPaths.filter(isSharedSourcePath))].sort();
  if (candidates.length === 0) return [];
  const { invoking } = analyzeSharedMutationSurface({ root, primitives, files: candidates });
  return candidates.filter((file) => invoking.has(file));
}
