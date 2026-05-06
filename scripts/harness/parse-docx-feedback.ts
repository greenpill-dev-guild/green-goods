#!/usr/bin/env bun
/**
 * Parse a Google Doc downloaded as .docx and emit a single markdown file with
 * body + comments + tracked-changes (suggestions), suitable for an agent to
 * iterate through.
 *
 * Usage:
 *   bun .plans/doc-feedback-extract/parse-docx-feedback.ts <doc.docx> [--out <path>] [--json]
 *
 * Get the input file via Google Docs → File → Download → Microsoft Word (.docx).
 * No OAuth, no API calls. Requires the `unzip` binary (preinstalled on macOS).
 *
 * Output markers:
 *   {++inserted++}     — accepted/proposed insertion (Word <w:ins>)
 *   {--deleted--}      — proposed deletion (Word <w:del>)
 *   [^N: anchored text] — span of text with comment id N attached
 *
 * Each comment in the "## Comments" section reprints its anchor as a blockquote
 * and is keyed by `[^N]` so an agent can grep body↔comment.
 */

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Comment {
  id: string;
  author: string;
  date: string;
  text: string;
  anchor?: string;
}

type ParaToken =
  | { kind: "text"; value: string }
  | { kind: "ins"; value: string }
  | { kind: "del"; value: string }
  | { kind: "commentStart"; id: string }
  | { kind: "commentEnd"; id: string }
  | { kind: "tab" }
  | { kind: "break" };

interface Paragraph {
  style: string | null;
  tokens: ParaToken[];
}

function readZipEntry(zipPath: string, entry: string): string | null {
  const r = spawnSync("unzip", ["-p", zipPath, entry], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 50 * 1024 * 1024,
  });
  return r.status === 0 && r.stdout ? r.stdout : null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replaceAll("&amp;", "\x00")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    )
    .replaceAll("\x00", "&");
}

const PARA_RE = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;

const TOKEN_RE = new RegExp(
  [
    String.raw`<w:t\b[^>]*>[\s\S]*?<\/w:t>`,
    String.raw`<w:delText\b[^>]*>[\s\S]*?<\/w:delText>`,
    String.raw`<w:ins\b[^>]*>`,
    String.raw`<\/w:ins>`,
    String.raw`<w:del\b[^>]*>`,
    String.raw`<\/w:del>`,
    String.raw`<w:commentRangeStart\b[^/]*\/?>`,
    String.raw`<w:commentRangeEnd\b[^/]*\/?>`,
    String.raw`<w:tab\s*\/?>`,
    String.raw`<w:br\s*\/?>`,
  ].join("|"),
  "g",
);

function tokenizeParagraph(inner: string): ParaToken[] {
  const tokens: ParaToken[] = [];
  let inIns = 0;
  for (const m of inner.matchAll(TOKEN_RE)) {
    const s = m[0];
    if (s.startsWith("<w:t>") || s.startsWith("<w:t ")) {
      const inside = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/.exec(s);
      const text = inside ? decodeXmlEntities(inside[1]) : "";
      tokens.push({ kind: inIns > 0 ? "ins" : "text", value: text });
    } else if (s.startsWith("<w:delText")) {
      const inside = /<w:delText\b[^>]*>([\s\S]*?)<\/w:delText>/.exec(s);
      tokens.push({
        kind: "del",
        value: inside ? decodeXmlEntities(inside[1]) : "",
      });
    } else if (s.startsWith("<w:ins")) {
      inIns++;
    } else if (s.startsWith("</w:ins>")) {
      inIns = Math.max(0, inIns - 1);
    } else if (s.startsWith("<w:commentRangeStart")) {
      const id = /w:id="([^"]+)"/.exec(s)?.[1] ?? "";
      tokens.push({ kind: "commentStart", id });
    } else if (s.startsWith("<w:commentRangeEnd")) {
      const id = /w:id="([^"]+)"/.exec(s)?.[1] ?? "";
      tokens.push({ kind: "commentEnd", id });
    } else if (s.startsWith("<w:tab")) {
      tokens.push({ kind: "tab" });
    } else if (s.startsWith("<w:br")) {
      tokens.push({ kind: "break" });
    }
  }
  return tokens;
}

function parseDocument(xml: string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const m of xml.matchAll(PARA_RE)) {
    const inner = m[1];
    const styleMatch = /<w:pStyle\s+w:val="([^"]+)"\s*\/?>/.exec(inner);
    out.push({
      style: styleMatch ? styleMatch[1] : null,
      tokens: tokenizeParagraph(inner),
    });
  }
  return out;
}

const COMMENT_RE = /<w:comment\b([^>]*)>([\s\S]*?)<\/w:comment>/g;

function parseComments(xml: string | null): Map<string, Comment> {
  const map = new Map<string, Comment>();
  if (!xml) return map;
  for (const m of xml.matchAll(COMMENT_RE)) {
    const attrs = m[1];
    const inner = m[2];
    const id = /w:id="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const author = /w:author="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const date = /w:date="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const paraTexts: string[] = [];
    for (const pm of inner.matchAll(PARA_RE)) {
      const parts: string[] = [];
      for (const tm of pm[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)) {
        parts.push(decodeXmlEntities(tm[1]));
      }
      paraTexts.push(parts.join(""));
    }
    const text = paraTexts.join("\n").trim();
    map.set(id, { id, author, date, text });
  }
  return map;
}

function headingPrefix(style: string | null): string {
  if (!style) return "";
  if (/^Title$/i.test(style) || /^Heading1$/i.test(style)) return "# ";
  if (/^Subtitle$/i.test(style) || /^Heading2$/i.test(style)) return "## ";
  if (/^Heading3$/i.test(style)) return "### ";
  if (/^Heading4$/i.test(style)) return "#### ";
  if (/^Heading5$/i.test(style)) return "##### ";
  if (/^Heading6$/i.test(style)) return "###### ";
  return "";
}

function renderParagraph(
  p: Paragraph,
  anchorAccum: Map<string, string[]>,
): string {
  const buf: string[] = [];
  const active = new Set<string>();
  for (const t of p.tokens) {
    switch (t.kind) {
      case "text":
        buf.push(t.value);
        for (const id of active) anchorAccum.get(id)!.push(t.value);
        break;
      case "ins":
        buf.push(`{++${t.value}++}`);
        for (const id of active) anchorAccum.get(id)!.push(t.value);
        break;
      case "del":
        buf.push(`{--${t.value}--}`);
        break;
      case "commentStart":
        active.add(t.id);
        if (!anchorAccum.has(t.id)) anchorAccum.set(t.id, []);
        buf.push(`[^${t.id}:`);
        break;
      case "commentEnd":
        active.delete(t.id);
        buf.push(`]`);
        break;
      case "tab":
        buf.push("\t");
        break;
      case "break":
        buf.push("\n");
        break;
    }
  }
  return headingPrefix(p.style) + buf.join("");
}

function main(): void {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === "-h" || args[0] === "--help") {
    console.error(
      "Usage: bun parse-docx-feedback.ts <doc.docx> [--out <path>] [--json]",
    );
    process.exit(args.length ? 0 : 1);
  }
  const docxPath = resolve(args[0]);
  if (!existsSync(docxPath)) {
    console.error(`File not found: ${docxPath}`);
    process.exit(1);
  }
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const wantJson = args.includes("--json");

  const documentXml = readZipEntry(docxPath, "word/document.xml");
  if (!documentXml) {
    console.error("Could not read word/document.xml — is this a valid .docx?");
    process.exit(1);
  }
  const commentsXml = readZipEntry(docxPath, "word/comments.xml");

  const paragraphs = parseDocument(documentXml);
  const comments = parseComments(commentsXml);

  const anchorAccum = new Map<string, string[]>();
  const renderedParas = paragraphs.map((p) => renderParagraph(p, anchorAccum));
  for (const [id, parts] of anchorAccum) {
    const c = comments.get(id);
    if (c) c.anchor = parts.join("").trim();
  }

  const insCount = paragraphs.reduce(
    (n, p) => n + p.tokens.filter((t) => t.kind === "ins").length,
    0,
  );
  const delCount = paragraphs.reduce(
    (n, p) => n + p.tokens.filter((t) => t.kind === "del").length,
    0,
  );

  if (wantJson) {
    const payload = JSON.stringify(
      { paragraphs, comments: [...comments.values()] },
      null,
      2,
    );
    if (outPath) writeFileSync(outPath, payload);
    else process.stdout.write(payload);
    return;
  }

  const md: string[] = [];
  md.push(`# Doc Feedback`);
  md.push("");
  md.push(`Source: \`${args[0]}\``);
  md.push(
    `Comments: **${comments.size}** · Inserted runs: ${insCount} · Deleted runs: ${delCount}`,
  );
  md.push("");
  md.push("## Body");
  md.push("");
  md.push(
    "Markers — `{++inserted++}` `{--deleted--}` `[^N: anchored text]` (N is comment id; see Comments below).",
  );
  md.push("");
  md.push(renderedParas.join("\n\n"));
  md.push("");
  md.push(`## Comments (${comments.size})`);
  md.push("");
  if (comments.size === 0) {
    md.push("_None_");
  } else {
    for (const c of comments.values()) {
      md.push(`### [^${c.id}] ${c.author} · ${c.date}`);
      if (c.anchor) {
        md.push("");
        md.push(`> ${c.anchor.replaceAll("\n", "\n> ")}`);
      }
      md.push("");
      md.push(c.text || "_(empty)_");
      md.push("");
    }
  }

  const output = md.join("\n");
  if (outPath) {
    writeFileSync(outPath, output);
    console.error(`Wrote ${outPath} (${output.length} bytes)`);
  } else {
    process.stdout.write(output);
  }
}

main();
