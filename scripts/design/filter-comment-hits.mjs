#!/usr/bin/env node
import { parseSync } from "@babel/core";
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function cssComments(source) {
  const comments = [];
  let quote = null;
  let url = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "\\") {
      index++;
    } else if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (url) {
      if (char === ")") url = false;
    } else if (/^url\(/i.test(source.slice(index, index + 4)) &&
      (index === 0 || !/[\w-]/.test(source[index - 1]))) {
      const first = source.slice(index + 4).trimStart()[0];
      // Quoted url() is a normal function: comments after its string are trivia.
      if (first !== '"' && first !== "'") {
        url = true;
        index += 3;
      }
    } else if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) throw new Error("Unterminated CSS comment");
      comments.push({ start: index, end: end + 2 });
      index = end + 1;
    }
  }
  return comments;
}

function codeLines(file) {
  const source = readFileSync(file, "utf8");
  const extension = extname(file);
  const comments = extension === ".css" ? cssComments(source) : parseSync(source, {
    filename: file,
    configFile: false,
    babelrc: false,
    sourceType: "unambiguous",
    parserOpts: { plugins: extension === ".tsx" ? ["typescript", "jsx"] : ["typescript"] },
  }).comments;
  const masked = source.split("");
  for (const { start, end } of comments) {
    for (let index = start; index < end; index++) {
      if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
    }
  }
  return masked.join("").split(/\r?\n/);
}

// Keep grep's original rows so existing exact debt receipts do not change shape.
// A second grep checks the same POSIX expression against code with comments masked.
export function filterCommentHits(input, pattern, root = process.cwd()) {
  if (!pattern) throw new Error("A nonempty grep expression is required");
  const packageRoot = realpathSync(resolve(root, "packages"));
  const cache = new Map();
  const rows = input.split("\n").filter(Boolean);
  const lines = rows.map((row) => {
    const match = /^([^:]+):(\d+):(.*)$/.exec(row);
    if (!match) throw new Error("Expected path:line:source grep input");
    const file = realpathSync(resolve(root, match[1]));
    if (!file.startsWith(`${packageRoot}${sep}`) || ![".ts", ".tsx", ".css"].includes(extname(file))) {
      throw new Error("Token scan input must be a source file within packages");
    }
    if (!cache.has(file)) cache.set(file, codeLines(file));
    const line = cache.get(file)[Number(match[2]) - 1];
    if (line === undefined) throw new Error("Token scan input has an invalid line number");
    return line;
  });
  const result = spawnSync("grep", ["-nE", "--", pattern], {
    input: rows.length ? `${lines.join("\n")}\n` : "",
    encoding: "utf8",
    maxBuffer: Buffer.byteLength(input) * 2 + 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) {
    throw result.error ?? new Error(`Token expression failed: ${result.stderr.trim()}`);
  }
  return result.stdout.split("\n").filter(Boolean).map((row) => {
    const index = Number(row.slice(0, row.indexOf(":"))) - 1;
    return rows[index];
  }).join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: filter-comment-hits.mjs <grep-expression>");
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const output = filterCommentHits(Buffer.concat(chunks).toString("utf8"), process.argv[2]);
    if (output) process.stdout.write(`${output}\n`);
  } catch (error) {
    process.stderr.write(`Token source scan failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}
