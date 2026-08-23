import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import type { JSXAttribute, Node, ObjectExpression } from "@babel/types";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";

type LocaleCatalog = Record<string, string>;
type SourceMessageRef = {
  id: string;
  file: string;
  line: number;
};

const repoRoot = path.resolve(process.cwd(), "../..");
const sourceRoots = [
  path.join(repoRoot, "packages/shared/src"),
  path.join(repoRoot, "packages/client/src"),
  path.join(repoRoot, "packages/admin/src"),
];
const knownDynamicMessageIds = [
  ...["approved", "rejected", "pending", "syncing", "uploading", "sync_failed", "offline"].map(
    (status) => `app.admin.work.filter.${status}`
  ),
  ...[
    "activity",
    "assessments",
    "cookie-jars",
    "decisions",
    "governance",
    "health",
    "history",
    "hypercerts",
    "members",
    "metadata",
    "payouts",
    "pools",
    "queue",
    "reporting",
    "roles",
    "treasury",
    "yield",
  ].flatMap((section) => [
    `app.garden.detail.section.${section}.title`,
    `app.garden.detail.section.${section}.description`,
  ]),
  ...[
    "expired",
    "failed",
    "funded",
    "funded_late",
    "pending_onchain",
    "pending_provider",
    "refunded",
    "started",
  ].map((status) => `public.fund.receipt.status.${status}`),
  ...["donate", "endow"].map((intent) => `public.fund.receipt.intent.${intent}`),
];
const sourceFilePattern = /\.tsx?$/;
const ignoredSourcePattern =
  /(__tests__|\.test\.|\.spec\.|\.stories\.|\.d\.ts$|storybook-static|generated)/;
const descriptorIdPropNames = new Set([
  "labelId",
  "titleId",
  "descriptionId",
  "ledeId",
  "routesId",
  "bestForId",
  "learnMoreId",
  "placeholderId",
  "messageId",
  "helpId",
  "emptyId",
  "errorId",
  "successId",
  "ariaLabelId",
  "actionLabelId",
]);
const sourceMessageTriggerTokens = [
  "formatMessage",
  "defineMessage",
  "defineMessages",
  "FormattedMessage",
  "defaultMessage",
  ...descriptorIdPropNames,
];
const allowedIdenticalLocalizedKeys = new Set([
  "app.admin.nav.cookieJars",
  "app.community.weightScheme.linear",
  "cockpit.community.stats.pools",
  "public.fund.vaults.vaultCount",
  // Vault checkout reuses the product term "Endowment" untranslated, matching the
  // surrounding es/pt vault copy (e.g. "Endowment confirmado."); the app.* namespace
  // still translates it (es: "Dotación"), so this stays key-scoped rather than global.
  "public.vaults.cardEndow.positionHolder",
  "public.vaults.cardEndow.status.deposit",
]);
const allowedIdenticalProductValues = new Set([
  "%",
  "0x...",
  "Admin",
  "APR",
  "Card Endow",
  "Cookie Jar",
  "Cookie Jars",
  "Cookies",
  "DAI",
  "Decentral Park",
  "Docs",
  "EAS",
  "Email",
  "ENS",
  "Endow",
  "Endowments",
  "ETH",
  "Feedback",
  "GitHub",
  "Green Goods",
  // The product noun the team already uses untranslated in Spanish and
  // Portuguese copy ("las pools", "as pools").
  "Pool",
  "Greenpill Network",
  "GreenWill",
  "ha",
  "Hub",
  "Hypercert",
  "Hypercert {id}",
  "Hypercerts",
  "IoT",
  "IPFS",
  "kg",
  "kWh",
  "Linear (1-2-3)",
  "m²",
  "ManeNet DAO",
  "Marketplace",
  "Offline",
  "Onchain",
  "Order ID",
  "Pools",
  "Protocol Guild",
  "Slug",
  "Solar",
  "Stablecoin",
  "Telegram",
  "Thirdweb Bridge",
  "Token",
  "Tokens",
  "tokens",
  "Tx",
  "Twitter",
  "USDC",
  "Vault",
  "Vaults",
  "WETH",
  "§ 01 Cookie jars",
  "§ 01: Cookie jars",
]);
// "{hours} h" / "{hours}h" — the hour symbol "h" is identical across en/es/pt, so a
// compact "{n} h" value is legitimately locale-identical (the optional space matches
// the actual en.json formatting).
const allowedIdenticalValuePatterns = [/^[\d\W]+$/, /^\d+d$/, /^\{[^}]+\}$/, /^\{[^}]+\} ?h$/];

/**
 * A value made only of ICU placeholders and whitespace, like `{count} {unit}`.
 *
 * These carry no words to translate, so every locale is legitimately identical;
 * the letters the has-letters check sees are inside the braces.
 *
 * Written as a linear scan rather than `(?:\s*\{[^}]+\}\s*)+`, which CodeQL
 * flagged: whitespace between repetitions can be matched by either the trailing
 * or the leading `\s*`, and that ambiguity backtracks exponentially on input
 * like `{{|}}` repeated. Stripping the tokens has no such shape.
 */
function isPlaceholderOnlyValue(value: string): boolean {
  if (!value.includes("{")) return false;
  // Symbols and punctuation outside the placeholders (`× {count}`, `{start} – {end}`)
  // are no more translatable than the whitespace; only letters are words.
  return !/\p{L}/u.test(value.replace(/\{[^}]*\}/g, ""));
}
const localeAllowedIdenticalValues: Record<string, Set<string>> = {
  es: new Set([
    " - Error",
    "Actor",
    "Cultural",
    "Error",
    "Error:",
    "Material",
    "No",
    "Roles",
    "Social",
    "Variable",
    "Video",
    "error",
  ]),
  pt: new Set(["Cultural", "Material", "Social", "Status", "hubs"]),
};

function isAllowedIdenticalLocalizedValue(locale: string, key: string, value: string): boolean {
  return (
    allowedIdenticalLocalizedKeys.has(key) ||
    allowedIdenticalProductValues.has(value) ||
    allowedIdenticalValuePatterns.some((pattern) => pattern.test(value)) ||
    isPlaceholderOnlyValue(value) ||
    (localeAllowedIdenticalValues[locale]?.has(value) ?? false)
  );
}

function propName(name: Node | undefined): string | undefined {
  if (!name) return undefined;
  if (name.type === "Identifier") return name.name;
  if (name.type === "StringLiteral" || name.type === "NumericLiteral") {
    return String(name.value);
  }
  return undefined;
}

function stringLiteral(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

function getObjectProp(obj: ObjectExpression, name: string): Node | undefined {
  for (const property of obj.properties) {
    if (property.type === "ObjectProperty" && propName(property.key) === name) {
      return property.value;
    }
  }
  return undefined;
}

function calleeName(node: Node): string | undefined {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && node.property.type === "Identifier") {
    return node.property.name;
  }
  return undefined;
}

function jsxTagName(node: Node): string | undefined {
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") return node.property.name;
  return undefined;
}

function jsxString(attr: JSXAttribute): string | undefined {
  if (!attr.value) return undefined;
  if (attr.value.type === "StringLiteral") return attr.value.value;
  if (attr.value.type === "JSXExpressionContainer") return stringLiteral(attr.value.expression);
  return undefined;
}

function lineOf(node: Node): number {
  return node.loc?.start.line ?? 1;
}

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "build", "coverage"].includes(entry.name)) {
        walkSourceFiles(filePath, files);
      }
      continue;
    }
    if (sourceFilePattern.test(entry.name) && !ignoredSourcePattern.test(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function containsSourceMessageTrigger(source: string): boolean {
  return sourceMessageTriggerTokens.some((token) => source.includes(token));
}

function collectSourceMessageRefs(): SourceMessageRef[] {
  const refs = new Map<string, SourceMessageRef>();

  const add = (id: string | undefined, file: string, node: Node) => {
    if (!id?.includes(".")) return;
    const line = lineOf(node);
    refs.set(`${id}:${file}:${line}`, {
      id,
      file: path.relative(repoRoot, file),
      line,
    });
  };

  for (const file of sourceRoots.flatMap((root) => walkSourceFiles(root))) {
    const contents = fs.readFileSync(file, "utf8");
    if (!containsSourceMessageTrigger(contents)) continue;

    const source = parse(contents, {
      sourceFilename: file,
      sourceType: "unambiguous",
      plugins: file.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"],
    });

    traverse(source, {
      CallExpression(path) {
        const name = calleeName(path.node.callee);
        const firstArg = path.node.arguments[0];
        if (
          (name === "formatMessage" || name === "defineMessage") &&
          firstArg?.type === "ObjectExpression"
        ) {
          const id = getObjectProp(firstArg, "id");
          add(stringLiteral(id), file, id ?? firstArg);
        }
        if (name === "defineMessages" && firstArg?.type === "ObjectExpression") {
          for (const property of firstArg.properties) {
            if (property.type !== "ObjectProperty" || property.value.type !== "ObjectExpression") {
              continue;
            }
            const id = getObjectProp(property.value, "id");
            add(stringLiteral(id), file, id ?? property.value);
          }
        }
      },
      ObjectExpression(path) {
        const id = getObjectProp(path.node, "id");
        if (stringLiteral(id) && getObjectProp(path.node, "defaultMessage")) {
          add(stringLiteral(id), file, id ?? path.node);
        }

        for (const property of path.node.properties) {
          if (property.type !== "ObjectProperty") continue;
          const name = propName(property.key);
          if (name && descriptorIdPropNames.has(name)) {
            add(stringLiteral(property.value), file, property);
          }
        }
      },
      JSXOpeningElement(path) {
        if (jsxTagName(path.node.name) !== "FormattedMessage") return;
        for (const property of path.node.attributes) {
          if (property.type === "JSXAttribute" && property.name.name === "id") {
            add(jsxString(property), file, property);
          }
        }
      },
    });
  }

  return [...refs.values()].sort(
    (a, b) => a.id.localeCompare(b.id) || a.file.localeCompare(b.file)
  );
}

function getSuspiciousEnglishFallbacks(locale: string, catalog: LocaleCatalog) {
  return Object.entries(en as LocaleCatalog)
    .filter(([key, value]) => {
      const hasLetters = /[A-Za-z]/.test(value);
      return (
        catalog[key] === value &&
        hasLetters &&
        !isAllowedIdenticalLocalizedValue(locale, key, value)
      );
    })
    .map(([key, value]) => `${locale}:${key} -> ${value}`);
}

/**
 * Translation coverage tests to ensure all locales have parity with English.
 *
 * These tests verify:
 * 1. Key parity — all keys in en.json exist in es.json and pt.json
 * 2. No extra keys — no keys in es.json or pt.json that don't exist in en.json
 * 3. No empty values — all translated values are non-empty strings
 */
describe("i18n locale coverage", () => {
  const enKeys = Object.keys(en).sort();
  const esKeys = Object.keys(es).sort();
  const ptKeys = Object.keys(pt).sort();

  describe("Spanish (es) coverage", () => {
    it("should have all English keys", () => {
      const missingKeys = enKeys.filter((key) => !esKeys.includes(key));
      expect(missingKeys, `Missing keys in es.json: ${missingKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have extra keys beyond English", () => {
      const extraKeys = esKeys.filter((key) => !enKeys.includes(key));
      expect(extraKeys, `Extra keys in es.json: ${extraKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have empty translation values", () => {
      const emptyKeys = Object.entries(es)
        .filter(([, value]) => typeof value === "string" && value.trim() === "")
        .map(([key]) => key);
      expect(emptyKeys, `Empty values in es.json: ${emptyKeys.join(", ")}`).toHaveLength(0);
    });
  });

  describe("Portuguese (pt) coverage", () => {
    it("should have all English keys", () => {
      const missingKeys = enKeys.filter((key) => !ptKeys.includes(key));
      expect(missingKeys, `Missing keys in pt.json: ${missingKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have extra keys beyond English", () => {
      const extraKeys = ptKeys.filter((key) => !enKeys.includes(key));
      expect(extraKeys, `Extra keys in pt.json: ${extraKeys.join(", ")}`).toHaveLength(0);
    });

    it("should not have empty translation values", () => {
      const emptyKeys = Object.entries(pt)
        .filter(([, value]) => typeof value === "string" && value.trim() === "")
        .map(([key]) => key);
      expect(emptyKeys, `Empty values in pt.json: ${emptyKeys.join(", ")}`).toHaveLength(0);
    });
  });

  describe("English (en) baseline", () => {
    it("should not have empty translation values", () => {
      const emptyKeys = Object.entries(en)
        .filter(([, value]) => typeof value === "string" && value.trim() === "")
        .map(([key]) => key);
      expect(emptyKeys, `Empty values in en.json: ${emptyKeys.join(", ")}`).toHaveLength(0);
    });

    it("should have a reasonable number of keys", () => {
      // Sanity check — if key count drops significantly, something is wrong
      expect(enKeys.length).toBeGreaterThan(400);
    });
  });

  describe("Key count parity", () => {
    it("should have equal key counts across all locales", () => {
      expect(esKeys.length).toBe(enKeys.length);
      expect(ptKeys.length).toBe(enKeys.length);
    });
  });

  describe("Source usage coverage", () => {
    it("recognizes every direct source message form before parsing", () => {
      const directForms = [
        'intl.formatMessage({ id: "app.direct.format" })',
        'defineMessage({ id: "app.direct.define" })',
        'defineMessages({ direct: { id: "app.direct.group" } })',
        'const descriptor = { id: "app.direct.descriptor", defaultMessage: "Direct" }',
        'const config = { titleId: "app.direct.title" }',
        '<FormattedMessage id="app.direct.component" />',
      ];

      expect(directForms.every(containsSourceMessageTrigger)).toBe(true);
    });

    it("should include every statically declared source message id in all locales", () => {
      const refs = collectSourceMessageRefs();
      const catalogs: Record<string, LocaleCatalog> = { en, es, pt };
      const missing = refs.flatMap((ref) =>
        Object.entries(catalogs)
          .filter(([, catalog]) => !(ref.id in catalog))
          .map(([locale]) => `${locale}:${ref.id} at ${ref.file}:${ref.line}`)
      );

      expect(missing, `Missing source message ids:\n${missing.join("\n")}`).toHaveLength(0);
    }, 30_000);

    it("should include known dynamic message id families in all locales", () => {
      const catalogs: Record<string, LocaleCatalog> = { en, es, pt };
      const missing = knownDynamicMessageIds.flatMap((id) =>
        Object.entries(catalogs)
          .filter(([, catalog]) => !(id in catalog))
          .map(([locale]) => `${locale}:${id}`)
      );

      expect(missing, `Missing dynamic message ids:\n${missing.join("\n")}`).toHaveLength(0);
    });
  });

  describe("Localized value quality", () => {
    it("should not leave Spanish or Portuguese multi-word strings identical to English", () => {
      const suspicious = [
        ...getSuspiciousEnglishFallbacks("es", es),
        ...getSuspiciousEnglishFallbacks("pt", pt),
      ];

      expect(
        suspicious,
        `Likely English fallbacks in localized catalogs:\n${suspicious.join("\n")}`
      ).toHaveLength(0);
    });
  });
});
