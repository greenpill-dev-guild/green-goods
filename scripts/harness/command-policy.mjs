#!/usr/bin/env node
// Local guardrails for ordinary shell commands, not a shell interpreter or security sandbox.
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function scanCommands(source) {
  const commands = [];
  let words = [];
  let cursor = 0;
  let partial = false;
  const heredocs = [];
  const finish = () => {
    if (words.length) commands.push(words);
    words = [];
  };

  // Consume substitutions as opaque data. Never evaluate them or misread their
  // contents as top-level command arguments. Native permissions still apply.
  function substitution(open, close) {
    let depth = 1;
    let quote = "";
    cursor += 2;
    while (cursor < source.length && depth) {
      const char = source[cursor++];
      if (char === "\\" && quote !== "'") cursor++;
      else if (quote) { if (char === quote) quote = ""; }
      else if (char === "'" || char === '"') quote = char;
      else if (char === open) depth++;
      else if (char === close) depth--;
    }
    partial = true;
  }

  function word() {
    let value = "";
    let quote = "";
    let quoted = false;
    let dynamic = false;
    while (cursor < source.length) {
      const char = source[cursor];
      if (!quote && /[\s;&|<>()]/.test(char)) break;
      if (char === "\\" && quote !== "'") {
        const next = source[cursor + 1];
        if (next === "\n") cursor += 2;
        else if (next === undefined) { partial = true; cursor++; }
        else if (!quote || /[$`"\\]/.test(next)) { value += next; cursor += 2; }
        else { value += char; cursor++; }
      } else if (char === quote) { quote = ""; cursor++; }
      else if (!quote && (char === "'" || char === '"')) { quote = char; quoted = true; cursor++; }
      else if (quote !== "'" && char === "$" && /[({]/.test(source[cursor + 1] ?? "")) {
        substitution(source[cursor + 1], source[cursor + 1] === "(" ? ")" : "}");
        dynamic = true;
      } else if (quote !== "'" && char === "`") {
        cursor++;
        while (cursor < source.length && source[cursor] !== "`") {
          cursor += source[cursor] === "\\" ? 2 : 1;
        }
        if (source[cursor] === "`") cursor++;
        dynamic = true;
        partial = true;
      } else {
        if (quote !== "'" && char === "$") dynamic = true;
        value += char;
        cursor++;
      }
    }
    if (quote) partial = true;
    return { value, dynamic, quoted };
  }

  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\n") {
      finish();
      cursor++;
      for (const { delimiter, stripTabs } of heredocs.splice(0)) {
        let closed = false;
        while (cursor < source.length) {
          const end = source.indexOf("\n", cursor);
          const line = source.slice(cursor, end < 0 ? source.length : end);
          cursor = end < 0 ? source.length : end + 1;
          if ((stripTabs ? line.replace(/^\t+/, "") : line) === delimiter) { closed = true; break; }
        }
        if (!closed) partial = true;
      }
    } else if (/\s/.test(char)) cursor++;
    else if (char === "#") {
      const end = source.indexOf("\n", cursor);
      cursor = end < 0 ? source.length : end;
    } else if (/[;&|()]/.test(char)) { finish(); cursor++; }
    else if (/[<>]/.test(char) || /^\d+[<>]/.test(source.slice(cursor))) {
      const redirect = source.slice(cursor).match(/^\d*(<<<|<<-|<<|>>|<>|[<>]&?)/)[0];
      cursor += redirect.length;
      const operator = redirect.replace(/^\d+/, "");
      while (/[ \t]/.test(source[cursor] ?? "")) cursor++;
      const target = word();
      if (/<<-?$/.test(operator)) {
        heredocs.push({ delimiter: target.value, stripTabs: operator.endsWith("-") });
        // Expansion in an unquoted heredoc, and shell programs reading stdin,
        // are outside this guard's bounded command analysis.
        if (!target.quoted) partial = true;
      } else if (operator.startsWith("<") && target.value) {
        // An input redirect is a file read, even when the executable is innocuous.
        if (!operator.startsWith("<<<")) words.push({ ...target, inputFile: true });
      }
    } else {
      const next = word();
      if (next.value || next.quoted || next.dynamic) words.push(next);
    }
  }
  finish();
  if (heredocs.length) partial = true;
  return { commands, partial };
}

function executableWords(words) {
  const args = words.filter((word) => !word.inputFile);
  while (args.length && /^[A-Za-z_][A-Za-z_0-9]*=/.test(args[0].value)) args.shift();
  // These wrappers preserve the command's meaning without executing a shell string.
  while (["env", "command", "exec"].includes(args[0]?.value)) {
    args.shift();
    while (args[0] && (args[0].value === "--" || /^[A-Za-z_][A-Za-z_0-9]*=/.test(args[0].value))) args.shift();
  }
  return args;
}

function isSecretFile(value) {
  const name = basename(value);
  return /^\.env(?:\..+)?$/.test(name) && ![".env.schema", ".env.example", ".env.template"].includes(name);
}

function readOperands(executable, args) {
  let needsProgram = ["grep", "rg", "sed", "awk"].includes(executable);
  const files = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") {
      files.push(...args.slice(index + 1 + (needsProgram ? 1 : 0)));
      break;
    }
    if (["-e", "--regexp", "--expression", "-f", "--file"].includes(arg)) {
      needsProgram = false;
      if (["-f", "--file"].includes(arg)) files.push(args[index + 1] ?? "");
      index++;
    } else if (/^--(regexp|expression)=|^-e./.test(arg)) needsProgram = false;
    else if (["-g", "--glob", "-t", "--type", "-T", "--type-not", "-m", "--max-count"].includes(arg) ||
      (["head", "tail"].includes(executable) && ["-n", "-c", "--lines", "--bytes"].includes(arg))) index++;
    else if (arg.startsWith("-")) continue;
    else if (needsProgram) needsProgram = false;
    else files.push(arg);
  }
  return files;
}

function commandDecision(words, harness) {
  const args = executableWords(words);
  const values = args.map((word) => word.dynamic ? "" : word.value);
  const executable = basename(values[0] ?? "");
  const deny = (message) => ({ action: "block", message });
  if (executable === "bun" && values[1] === "test") {
    return deny("Use `bun run test` instead of `bun test`; Green Goods relies on the Vitest wrapper.");
  }
  if (harness === "codex" && executable === "forge" && ["build", "test"].includes(values[1])) {
    return deny("Use Green Goods bun wrappers instead of direct forge build/test commands.");
  }
  if (executable === "git") {
    const gitArgs = values.slice(1);
    while (["-C", "-c", "--git-dir", "--work-tree"].includes(gitArgs[0])) gitArgs.splice(0, 2);
    const forced = gitArgs.some((arg) => /^--force(?:$|=|-)|^-[^-]*f/.test(arg));
    const [, ...refspecs] = gitArgs.slice(1).filter((arg) => arg && !arg.startsWith("-"));
    const primary = refspecs.some((arg) => /^(?:\+?[^:]+:)?(?:refs\/heads\/)?(?:main|master)$/.test(arg));
    if (gitArgs[0] === "push" && forced && primary) return deny("Never force push to main/master.");
  }
  const readers = ["cat", "head", "tail", "less", "more", "source", ".", "bat", "grep", "rg", "sed", "awk"];
  const inputRead = words.some((word) => word.inputFile && !word.dynamic && isSecretFile(word.value));
  if (inputRead || (readers.includes(executable) && readOperands(executable, values.slice(1)).some(isSecretFile))) {
    return deny("Direct .env file access via Bash is not allowed. Use schema/example files or ask for a non-secret value.");
  }
  // Only an executable or a runner's script name supplies the operation. A
  // search pattern, commit message, or interpreter program is not a deployment.
  const script = executable === "bun" || executable === "npm" || executable === "pnpm"
    ? values[values[1] === "run" ? 2 : 1]
    : ["node", "bash", "sh"].includes(executable) ? values[1] : executable;
  const operation = /(?:^|[/:._-])(deploy|upgrade)(?:$|[/:._-])/i.test(script ?? "");
  const mainnet = values.some((arg) => /(?:^|[/:=._-])mainnet(?:$|[/:._-])/i.test(arg));
  const contractsOperation = values[2] === "contracts" && values.some((arg) => /^(deploy|upgrade)$/.test(arg));
  const production = ((operation || contractsOperation) && mainnet) ||
    (executable === "vercel" && values.includes("--prod")) ||
    (harness === "codex" && executable === "fly" && values[1] === "deploy");
  if (production) return {
    action: harness === "claude" ? "warn" : "block",
    message: "PRODUCTION DEPLOYMENT: requires explicit out-of-band confirmation before proceeding.",
  };
  return null;
}

export function evaluateCommand(command, harness) {
  const { commands, partial } = scanCommands(command);
  const decisions = commands.map((words) => commandDecision(words, harness)).filter(Boolean);
  const opaqueProgram = commands.some((words) => {
    const args = executableWords(words);
    return args[0]?.dynamic || ["eval", "bash", "sh", "zsh", "if", "for", "while", "case", "function"]
      .includes(basename(args[0]?.value ?? ""));
  });
  return { decisions, partial: partial || opaqueProgram };
}

function main() {
  const harness = process.argv[2];
  if (!["claude", "codex"].includes(harness)) {
    console.error("Command policy: expected claude or codex harness.");
    process.exitCode = 2;
    return;
  }
  let event;
  try { event = JSON.parse(readFileSync(0, "utf8")); }
  catch {
    console.error("Command policy: invalid event input; no policy decision. Normal permissions apply.");
    return;
  }
  const command = event?.tool_input?.command;
  if (typeof command !== "string") {
    console.error("Command policy: command unavailable; no policy decision. Normal permissions apply.");
    return;
  }
  const { decisions, partial } = evaluateCommand(command, harness);
  for (const { action, message } of decisions) {
    if (action === "block") { console.error(`BLOCKED: ${message}`); process.exitCode = 2; }
    else console.log(message);
  }
  if (partial) console.error("Command policy: shell syntax only partially inspected; normal permissions still apply.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
