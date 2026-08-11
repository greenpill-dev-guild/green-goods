#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const implementationLanguages = new Set([
  "css",
  "html",
  "javascript",
  "js",
  "jsx",
  "scss",
  "ts",
  "tsx",
  "typescript",
]);
const javascriptLanguages = new Set(["javascript", "js", "jsx", "ts", "tsx", "typescript"]);
const canonicalCustomProperty =
  /^--(?:spring|color|radius|shadow|blur|space|surface|tone|canvas|gg)-|^--e[0-9-]/i;
const cssNamedColors = new Set(
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(
    " ",
  ),
);
const colorProperty =
  /(?:\b(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|text-decoration-color|fill|stroke|box-shadow|text-shadow|backgroundColor|borderColor|outlineColor|textDecorationColor|boxShadow|textShadow)|--[a-z0-9-]+)\s*:\s*([^;}]+)/gi;
const colorAttribute =
  /\b(?:color|fill|stroke|background-color|border-color)\s*=\s*["']([^"']+)["']/gi;
const multilineGuardedProperty =
  /\b(?:transition(?:-duration)?|animation(?:-duration)?|transitionDuration|animationDuration|color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|text-decoration-color|fill|stroke|box-shadow|text-shadow|backgroundColor|borderColor|outlineColor|textDecorationColor|boxShadow|textShadow|border-radius|borderRadius)\s*:\s*$/i;

function withoutCustomPropertyDeclarations(line) {
  return line.replace(
    /(^|[{;]\s*)(--[a-z0-9-]+)\s*:[^;}]+;?/gi,
    (match, prefix, name) => (canonicalCustomProperty.test(name) ? prefix : match),
  );
}

function colorPropertyValues(line) {
  return [
    ...[...line.matchAll(colorProperty)].map((match) => match[1]),
    ...[...line.matchAll(colorAttribute)].map((match) => match[1]),
  ];
}

function hasRawHexColor(line) {
  if (/\b(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-f]{3,8}\]/i.test(line)) return true;
  return colorPropertyValues(line).some((value) => /#[0-9a-f]{3,8}\b/i.test(value));
}

function hasRawNamedColor(line) {
  for (const value of colorPropertyValues(line)) {
    const withoutResources = value
      .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, "")
      .replace(/\b(?:image-set|image|cross-fade)\s*\([^)]*\)/gi, "")
      .replace(/var\(\s*--[a-z0-9-]+(?:\s*,\s*([^)]*))?\)/gi, (_match, fallback = "") => fallback);
    for (const word of withoutResources.match(/[a-z][a-z0-9-]*/gi) ?? []) {
      if (cssNamedColors.has(word.toLowerCase())) return true;
    }
  }
  return false;
}

function implementationForLine(lines, index) {
  let implementation = lines[index].text.trim();
  if (multilineGuardedProperty.test(implementation)) {
    for (let next = index + 1; next < lines.length; next++) {
      const continuation = lines[next].text.trim();
      implementation += ` ${continuation}`;
      if (/[;,}]\s*$/.test(continuation)) break;
    }
  }
  return withoutCustomPropertyDeclarations(implementation);
}

function withoutImplementationComments(lines) {
  const visible = [];
  let inBlockComment = false;
  for (const entry of lines) {
    const source = entry.text;
    let text = "";
    let quote;
    let escaped = false;
    for (let index = 0; index < source.length; index++) {
      const character = source[index];
      const next = source[index + 1];
      if (inBlockComment) {
        if (character === "*" && next === "/") {
          inBlockComment = false;
          index++;
        }
        continue;
      }
      if (quote) {
        text += character;
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
        text += character;
        continue;
      }
      if (character === "/" && next === "*") {
        inBlockComment = true;
        index++;
        continue;
      }
      if (character === "/" && next === "/") break;
      text += character;
    }
    visible.push({ ...entry, rawText: source, text });
  }
  return visible;
}

function hasOnlyReducedMotionDurations(line) {
  const durations = [...line.matchAll(/\b([0-9]*\.?[0-9]+)(ms|s)\b/gi)];
  return (
    durations.length > 0 &&
    durations.every((match) => {
      const value = Number(match[1]);
      return match[2].toLowerCase() === "ms" ? value <= 0.01 : value === 0;
    })
  );
}

function hasRawRadius(line) {
  if (/\brounded-\[(?!var\()[^\]]*[0-9][^\]]*\]/i.test(line)) return true;
  for (const match of line.matchAll(/\b(?:border-radius|borderRadius)\s*:\s*["']?([^"';},]+)/gi)) {
    if (/\b(?:0|[0-9]*\.?[0-9]+(?:px|r?em|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc))\b/i.test(match[1])) {
      return true;
    }
  }
  return false;
}

const checks = [
  {
    label: "hardcoded transition duration",
    pattern:
      /\bduration-(?!\[?var)[0-9]+(?:ms|s)?\b|\bduration-\[(?!var\()[^\]]*\b[0-9]*\.?[0-9]+(?:ms|s)\b[^\]]*\]|\b(?:transition|animation)(?:-duration)?\s*:[^;}]*\b[0-9]*\.?[0-9]+(?:ms|s)\b|\b(?:transitionDuration|animationDuration|--[a-z0-9-]*(?:duration|transition|animation)[a-z0-9-]*)\s*:\s*["']?(?!var\()[0-9]*\.?[0-9]+(?:ms|s)\b/i,
  },
  { label: "hardcoded easing", pattern: /cubic-bezier\s*\(/i },
  {
    label: "raw hexadecimal color",
    test: hasRawHexColor,
  },
  { label: "raw named color", test: hasRawNamedColor },
  {
    label: "raw color function",
    pattern: /\b(?:rgba?|hsla?|oklch|lab|lch|hwb|color)\s*\((?!\s*var\()/i,
  },
  {
    label: "raw palette utility",
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:white|black|[a-z]+-[0-9]{2,3})(?:\/[0-9]+)?\b/i,
  },
  {
    label: "arbitrary numeric radius",
    test: hasRawRadius,
  },
  {
    label: "raw shadow",
    test: (line) => {
      const cssProperty = line.match(/\bbox-shadow\s*:\s*([^;}]+)/i)?.[1]?.trim();
      const customProperty = line.match(/--[a-z0-9-]*shadow[a-z0-9-]*\s*:\s*([^;}]+)/i)?.[1]?.trim();
      const jsMatch = line.match(
        /\bboxShadow\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^;}]+))/,
      );
      const jsProperty = jsMatch?.slice(1).find((value) => value !== undefined)?.trim();
      const isTokenOnly = (value) =>
        /^(?:var\(\s*--[a-z0-9-]+\s*\))(?:\s*,\s*var\(\s*--[a-z0-9-]+\s*\))*\s*(?:!important)?$/i.test(
          value,
        );
      for (const value of [cssProperty, customProperty, jsProperty]) {
        if (value && value !== "none" && !isTokenOnly(value)) return true;
      }
      const withoutTokenDropShadows = line.replace(
        /drop-shadow\s*\(\s*var\(\s*--[a-z0-9-]+\s*\)\s*\)/gi,
        "",
      );
      if (/drop-shadow\s*\(/i.test(withoutTokenDropShadows)) return true;
      for (const match of line.matchAll(/["'`]([^"'`]*)["'`]/g)) {
        if (/(?:^|\s)(?:drop-)?shadow-\[(?!var\()[^\]]+\](?=$|\s)/i.test(match[1])) {
          return true;
        }
        if (
          /(?:^|\s)(?:drop-)?shadow(?:-(?:sm|md|lg|xl|2xl|inner))?(?=$|\s)/i.test(match[1])
        ) {
          return true;
        }
      }
      return false;
    },
  },
];

function markdownFiles(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) markdownFiles(target, out);
    else if (entry.name.endsWith(".md")) out.push(target);
  }
  return out;
}

export function extractFencedBlocks(text) {
  const blocks = [];
  let current;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (!match) {
      if (current) current.lines.push({ line: index + 1, text: line });
      continue;
    }
    if (current) {
      if (match[1][0] === current.fence[0] && match[1].length >= current.fence.length) {
        blocks.push(current);
        current = undefined;
      } else {
        current.lines.push({ line: index + 1, text: line });
      }
      continue;
    }
    current = {
      fence: match[1],
      language: match[2].trim().split(/\s+/)[0].toLowerCase(),
      line: index + 1,
      lines: [],
    };
  }
  if (current) blocks.push({ ...current, unterminated: true });
  return blocks;
}

export function findDesignGuidanceViolations(text, relativePath) {
  const failures = [];
  for (const block of extractFencedBlocks(text)) {
    if (!implementationLanguages.has(block.language)) continue;
    if (block.unterminated) {
      failures.push(`${relativePath}:${block.line}: unterminated implementation fence`);
    }
    const implementationLines = withoutImplementationComments(block.lines);
    let reducedMotionDepth = 0;
    let motionConfigDepth = 0;
    for (const [entryIndex, entry] of implementationLines.entries()) {
      const line = entry.text.trim();
      if (!line) continue;
      const opensReducedMotion = line.includes("prefers-reduced-motion");
      const inReducedMotion = reducedMotionDepth > 0 || opensReducedMotion;
      const radiusExampleLine = entry.rawText.includes("design-guard: allow-radius-literal");
      const implementation = implementationForLine(implementationLines, entryIndex);
      const opensMotionConfig =
        javascriptLanguages.has(block.language) &&
        /\b(?:transition|animation)\s*(?::|=)\s*\{\{?/.test(implementation);
      const inMotionConfig = motionConfigDepth > 0 || opensMotionConfig;
      const hasNumericMotionDuration =
        inMotionConfig && /\bduration\s*:\s*["']?[0-9]*\.?[0-9]+\b/.test(implementation);
      for (const check of checks) {
        if (check.label === "arbitrary numeric radius" && radiusExampleLine) continue;
        if (
          check.label === "hardcoded transition duration" &&
          inReducedMotion &&
          hasOnlyReducedMotionDurations(implementation)
        ) {
          continue;
        }
        if (
          (check.label === "hardcoded transition duration" && hasNumericMotionDuration) ||
          (check.test ?? ((value) => check.pattern.test(value)))(implementation)
        ) {
          failures.push(`${relativePath}:${entry.line}: ${check.label} in implementation example`);
        }
      }
      if (inMotionConfig) {
        const opens = (implementation.match(/\{/g) ?? []).length;
        const closes = (implementation.match(/\}/g) ?? []).length;
        motionConfigDepth = Math.max(0, motionConfigDepth + opens - closes);
      }
      if (opensReducedMotion) reducedMotionDepth = 1;
      if (reducedMotionDepth > 0) {
        const opens = (line.match(/\{/g) ?? []).length;
        const closes = (line.match(/\}/g) ?? []).length;
        reducedMotionDepth += opens - closes - (opensReducedMotion ? 1 : 0);
        if (reducedMotionDepth < 0) reducedMotionDepth = 0;
      }
    }
  }
  return failures;
}

function main() {
  try {
    if (process.argv.length > 2) throw new Error(`unknown argument: ${process.argv[2]}`);
    const designDir = path.join(repoRoot, ".claude", "skills", "design");
    if (!fs.existsSync(designDir)) {
      throw new Error(
        `design guidance directory not found: ${path.relative(repoRoot, designDir)}`,
      );
    }
    const failures = [];
    for (const file of markdownFiles(designDir)) {
      failures.push(
        ...findDesignGuidanceViolations(
          fs.readFileSync(file, "utf8"),
          path.relative(repoRoot, file),
        ),
      );
    }
    if (failures.length > 0) {
      console.error(`check-guidance-examples: ${failures.length} failure(s):`);
      for (const failure of failures) console.error(`- ${failure}`);
      process.exit(1);
    }
    console.log("check-guidance-examples: design implementation fences use shared tokens.");
  } catch (error) {
    console.error(`check-guidance-examples: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
