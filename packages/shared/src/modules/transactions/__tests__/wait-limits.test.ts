/**
 * Guard: every wait for a receipt in Shared names its limit (PRD-1551).
 *
 * A wait with no limit leaves the person watching a spinner that never ends: viem waits forever
 * when given `timeout: 0`, and the wallet's answer to a Safe send is a proposal hash that never
 * gets a receipt at all. So a call to one of the receipt waits below must say how long it waits:
 *
 * - its options, written where it is called, name a `timeout` that is not 0; or
 * - it sits directly inside `withTimeout(...)`, which ends it; or
 * - it only forwards its own function's parameters, as a sender's default adapter does: then its
 *   callers name the limit, and the parameter's type requires one.
 *
 * Senders are held to the same rule by `sender-conformance.test.ts`, which also fails a sender
 * that is missing from its cases.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(__dirname, "../../..");

/** viem's and wagmi's waits, and Shared's own wrapper around viem's. */
const RECEIPT_WAITS: ReadonlySet<string> = new Set([
  "waitForReceipt",
  "waitForTransactionReceipt",
  "waitForUserOperationReceipt",
  "waitForCallsStatus",
]);

/**
 * Ports named like a wait that are not one: each takes a hash, not options, and its one
 * implementation, in the same file, calls a wait this guard reads. Keyed `file:line callee`;
 * an entry whose call is gone fails the guard, so the list cannot outlive its reason.
 */
const PORTS_NAMED_LIKE_A_WAIT: ReadonlyMap<string, string> = new Map([
  [
    "modules/garden/create-garden-command.ts ports.reader.waitForReceipt",
    "createDefaultCreateGardenPorts waits with TX_RECEIPT_TIMEOUT_MS",
  ],
]);

const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod",
]);

/** A Babel node, read only for the fields this guard needs. */
interface AstNode {
  type: string;
  loc?: { start: { line: number } };
  [field: string]: unknown;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

function isProductionSource(name: string): boolean {
  return (
    /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !/\.(test|spec|stories)\.tsx?$/.test(name)
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return entry.name === "__tests__" || entry.name === "node_modules"
        ? []
        : sourceFiles(join(directory, entry.name));
    return isProductionSource(entry.name) ? [join(directory, entry.name)] : [];
  });
}

function unwrapped(node: AstNode): AstNode {
  let inner = node;
  while (
    (inner.type === "TSNonNullExpression" ||
      inner.type === "ParenthesizedExpression" ||
      inner.type === "AwaitExpression") &&
    isNode(inner.expression ?? inner.argument)
  )
    inner = (inner.expression ?? inner.argument) as AstNode;
  return inner;
}

function calleeName(call: AstNode): string | undefined {
  const callee = unwrapped(call.callee as AstNode);
  if (callee.type === "Identifier") return callee.name as string;
  if (
    (callee.type === "MemberExpression" || callee.type === "OptionalMemberExpression") &&
    isNode(callee.property) &&
    callee.property.type === "Identifier"
  )
    return callee.property.name as string;
  return undefined;
}

function keyName(property: AstNode): string | undefined {
  const key = property.key as AstNode | undefined;
  if (!key) return undefined;
  if (key.type === "Identifier") return key.name as string;
  if (key.type === "StringLiteral") return key.value as string;
  return undefined;
}

function namesALimit(argument: AstNode): boolean {
  if (argument.type !== "ObjectExpression") return false;
  return (argument.properties as AstNode[]).some((property) => {
    if (property.type !== "ObjectProperty" || keyName(property) !== "timeout") return false;
    const value = property.value as AstNode;
    return !(value.type === "NumericLiteral" && value.value === 0);
  });
}

function isInsideWithTimeout(call: AstNode, ancestors: readonly AstNode[]): boolean {
  let child = call;
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const parent = ancestors[index];
    if (parent.type === "AwaitExpression" || parent.type === "TSNonNullExpression") {
      child = parent;
      continue;
    }
    return (
      parent.type === "CallExpression" &&
      (parent.arguments as AstNode[])[0] === child &&
      calleeName(parent) === "withTimeout"
    );
  }
  return false;
}

function forwardsOwnParameters(call: AstNode, ancestors: readonly AstNode[]): boolean {
  const scope = [...ancestors].reverse().find((node) => FUNCTION_TYPES.has(node.type));
  if (!scope) return false;
  const parameters = new Set(
    (scope.params as AstNode[]).flatMap((parameter) =>
      parameter.type === "Identifier" ? [parameter.name as string] : []
    )
  );
  const args = call.arguments as AstNode[];
  return (
    args.length > 0 &&
    args.every(
      (argument) => argument.type === "Identifier" && parameters.has(argument.name as string)
    )
  );
}

/** The callee as written, such as `ports.reader.waitForReceipt`. */
function calleeText(call: AstNode, text: string): string {
  const callee = call.callee as AstNode & { start: number; end: number };
  return text.slice(callee.start, callee.end).replace(/\s+/g, "");
}

/** Each receipt wait in `text` that names no limit, as `file:line callee`. */
function unlimitedWaits(file: string, text: string): string[] {
  const program = parse(text, {
    sourceType: "module",
    plugins: ["typescript", ...(file.endsWith(".tsx") ? (["jsx"] as const) : [])],
  });
  const found: string[] = [];
  const visit = (node: AstNode, ancestors: AstNode[]) => {
    if (node.type === "CallExpression" || node.type === "OptionalCallExpression") {
      const name = calleeName(node);
      if (
        name &&
        RECEIPT_WAITS.has(name) &&
        !(node.arguments as AstNode[]).some(namesALimit) &&
        !isInsideWithTimeout(node, ancestors) &&
        !forwardsOwnParameters(node, ancestors)
      )
        found.push(
          `${relative(SOURCE_ROOT, file)}:${node.loc?.start.line} ${calleeText(node, text)}`
        );
    }
    const inner = [...ancestors, node];
    for (const [field, value] of Object.entries(node)) {
      if (field === "loc" || field === "extra") continue;
      if (Array.isArray(value)) for (const item of value) if (isNode(item)) visit(item, inner);
      if (isNode(value)) visit(value, inner);
    }
  };
  visit(program.program as unknown as AstNode, []);
  return found;
}

describe("receipt waits in Shared", () => {
  it("each name a limit", () => {
    const files = sourceFiles(SOURCE_ROOT);
    expect(files.length).toBeGreaterThan(100);
    // Only a file that names a wait can call one; parsing every file is too slow under load.
    const naming = new RegExp(`\\b(${[...RECEIPT_WAITS].join("|")})\\b`);
    const unlimited = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return naming.test(text) ? unlimitedWaits(file, text) : [];
    });
    const withoutLine = (found: string) => found.replace(/:\d+ /, " ");
    expect(unlimited.filter((found) => !PORTS_NAMED_LIKE_A_WAIT.has(withoutLine(found)))).toEqual(
      []
    );
    // Each port is still there, so its entry still has a reason to exist.
    expect(new Set(unlimited.map(withoutLine))).toEqual(new Set(PORTS_NAMED_LIKE_A_WAIT.keys()));
  });

  it.each([
    ["no options", "await waitForReceipt(config, { hash, chainId });"],
    ["a limit of 0", "await client.waitForTransactionReceipt({ hash, timeout: 0 });"],
    ["options built elsewhere", "await waitForReceipt(config, options);"],
    ["a batch status", "await deps.waitForCallsStatus!(config, { id, throwOnFailure: false });"],
  ])("fails a wait with %s", (_case, call) => {
    expect(unlimitedWaits("probe.ts", `async function send(hash) { ${call} }`)).toHaveLength(1);
  });

  it.each([
    ["a stated limit", "await waitForReceipt(config, { hash, timeout: TX_RECEIPT_TIMEOUT_MS });"],
    ["a limit in a variable", "await client.waitForTransactionReceipt({ hash, timeout });"],
    ["withTimeout around it", "await withTimeout(client.waitForTransactionReceipt({ hash }), 1);"],
  ])("passes a wait with %s", (_case, call) => {
    expect(unlimitedWaits("probe.ts", `async function send(hash, timeout) { ${call} }`)).toEqual(
      []
    );
  });

  it("passes an adapter that forwards its caller's options", () => {
    const adapter = "const wait = (config, params) => waitForCallsStatus(config, params);";
    expect(unlimitedWaits("probe.ts", adapter)).toEqual([]);
  });
});
