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

// Words that run the rest of the command without a shell string, with the options that take a
// value: the set the machine-wide guards strip, so .agents/policy.json rules match alike, plus xargs.
const WRAPPERS = new Map([
  ["env", ["-u", "--unset", "-C", "--chdir"]],
  // xargs is the floor's own addition; GNU's -e, -i and -l take only attached values.
  ["xargs", ["-a", "--arg-file", "-d", "--delimiter", "-E", "-I", "-J", "-L", "-n", "--max-args", "-P", "--max-procs", "-R", "-S", "-s", "--max-chars"]],
  ["command", []],
  ["builtin", []],
  ["exec", ["-a"]],
  ["time", []],
  ["nohup", []],
  ["nice", ["-n", "--adjustment"]],
  ["timeout", ["-s", "--signal", "-k", "--kill-after"]],
  ["caffeinate", ["-t", "-w"]],
  ["sudo", ["-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-C", "--close-from", "-D", "--chdir", "-r", "--role", "-t", "--type", "-U", "--other-user", "-T", "--command-timeout"]],
  ["npx", ["-p", "--package", "-c", "--call", "-w", "--workspace"]],
  ["bunx", ["-p", "--package"]],
  ["bun x", ["-p", "--package"]],
  ["npm exec", ["-p", "--package", "-c", "--call", "-w", "--workspace"]],
  ["pnpm dlx", ["--package"]],
  ["pnpm exec", []],
  ["yarn dlx", ["-p", "--package"]],
  ["yarn exec", []],
]);
const PACKAGE_RUNNERS = new Set(["npx", "bunx", "bun x", "npm exec", "pnpm dlx", "pnpm exec", "yarn dlx", "yarn exec"]);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z_0-9]*=/;

function executableWords(words) {
  const args = words.filter((word) => !word.inputFile);
  for (;;) {
    while (args.length && ASSIGNMENT.test(args[0].value)) args.shift();
    const head = basename(args[0]?.value ?? "");
    const wrapper = [`${head} ${args[1]?.value}`, head].find((name) => WRAPPERS.has(name));
    if (!wrapper) return args;
    args.splice(0, wrapper.split(" ").length);
    const valueOptions = WRAPPERS.get(wrapper);
    while (args.length && (args[0].value.startsWith("-") || (wrapper === "env" && ASSIGNMENT.test(args[0].value)))) {
      const [option] = args.splice(0, 1);
      if (option.value === "--") break;
      // `command -v` and `command -V` look the name up and run nothing.
      if (wrapper === "command" && /^-[A-Za-z]*[vV]/.test(option.value)) return [];
      // `env -S` splits its string into the command it runs, so it is a command of its own too.
      // Short flags combine, so `-iS 'cmd'` and `-iS'cmd'` split too; `-u` and `-C` take the rest
      // of their group as a value (`-uDISPLAY`), so a group stops at them.
      const shortSplit = /^-[A-BD-Za-tv-z]*S/.exec(option.value);
      if (wrapper === "env" && (/^--split-string(=|$)/.test(option.value) || shortSplit)) {
        const attached = option.value.startsWith("--")
          ? option.value.slice("--split-string=".length)
          : option.value.slice(shortSplit[0].length);
        const split = option.value.includes("=") || attached ? { value: attached } : args.shift();
        const rest = args.filter((word) => !word.dynamic).map((word) => word.value).join(" ");
        return Object.assign([], { call: split && !split.dynamic ? `${split.value} ${rest}`.trim() : "" });
      }
      // A package runner's call string is a command of its own, evaluated by evaluateCommand.
      if (PACKAGE_RUNNERS.has(wrapper) && /^(-c|--call)(=|$)/.test(option.value)) {
        const call = option.value.includes("=") ? { value: option.value.slice(option.value.indexOf("=") + 1) } : args.shift();
        return Object.assign([], { call: call && !call.dynamic ? call.value : "" });
      }
      if (valueOptions.includes(option.value)) args.shift();
    }
    if (wrapper === "timeout") args.shift();
    // A package runner names a package, maybe with a version: `vercel@62.1.0` runs `vercel`.
    if (PACKAGE_RUNNERS.has(wrapper) && args[0]) args[0] = { ...args[0], value: args[0].value.replace(/^(@?[^@]+)@.*$/, "$1") };
  }
}

/**
 * The subcommand Bun runs: its first word that is not an option. A global option's separate value
 * still applies but is not the subcommand, so `bun --cwd dir test` runs `dir`'s `test` script,
 * while `bun --cwd=dir test` and `bun --bun test` run the test runner.
 */
function bunSubcommand(values) {
  return values.slice(1).find((value) => !value.startsWith("-"));
}

function isSecretFile(value) {
  const name = basename(value);
  return /^\.env(?:\..+)?$/.test(name) && name !== ".env.example";
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
  if (executable === "bun" && bunSubcommand(values) === "test") {
    return deny("Use `bun run test` instead of `bun test`; Green Goods relies on the Vitest wrapper.");
  }
  if (executable === "forge" && ["build", "test"].includes(values[1])) {
    return {
      action: harness === "claude" ? "warn" : "block",
      message: "Use Green Goods bun wrappers instead of direct forge build/test commands.",
    };
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
  // The last occurrence wins, as the contracts scripts read repeated options.
  const option = (name) => {
    let value;
    values.forEach((arg, index) => {
      if (arg === name) value = values[index + 1] ?? "";
      else if (arg.startsWith(`${name}=`)) value = arg.slice(name.length + 1);
    });
    return value;
  };
  // A contracts broadcast or Safe signature asks unless its last network is a test network; any
  // other command asks only when it names a live network. The contracts scripts read the last of
  // `--network` and `-n`, and some default to a live chain or follow `--rpc-url` or `--chain-id`,
  // so an override always asks. The release operator broadcasts whatever its stage needs. Help and
  // explain never broadcast.
  const runner = ["bun", "npm", "pnpm", "node", "bash", "sh", "tsx"].includes(executable);
  const contractsAt = (index) => values[index] === "contracts" && (values[index + 1] === "--" ? index + 2 : index + 1);
  const help = values.some((arg) => ["--help", "-h", "--explain"].includes(arg)) ||
    values.some((_, index) => contractsAt(index) && values[contractsAt(index)] === "help");
  let lastNetwork;
  values.forEach((arg, index) => {
    if (arg === "--network" || arg === "-n") lastNetwork = values[index + 1] ?? "";
    else if (arg.startsWith("--network=")) lastNetwork = arg.slice("--network=".length);
  });
  const broadcasting = /^(broadcast(-\S+)?|sign-safe)$/.test(option("--mode") ?? "") ||
    values.some((arg) => /^(--broadcast(-\S+)?|--sign-safe|-b)$/.test(arg));
  const liveNetwork = /^(mainnet|arbitrum|celo|gnosis)$/.test(lastNetwork ?? "");
  const testNetwork = /^(localhost|sepolia)$/.test(lastNetwork ?? "");
  const contractsCommand = values.some((arg) => arg === "contracts" || /(?:^|\/)script\/\S+\.(?:ts|mjs|js)$/.test(arg));
  const networkOverride = values.some((arg) => /^--(rpc-url|chain-id)(=|$)/.test(arg));
  const releaseOperator =
    values.some((_, index) => contractsAt(index) && values[contractsAt(index)] === "release" && values[contractsAt(index) + 1] === "operator") ||
    (["bun", "node", "tsx"].includes(executable) && /(?:^|\/)release-operator\.(?:ts|mjs|js)$/.test(values[values[1] === "run" ? 2 : 1] ?? ""));
  const productionBroadcast = runner && !help && (releaseOperator ||
    (broadcasting && (liveNetwork || (contractsCommand && (networkOverride || !testNetwork)))));
  const production = ((operation || contractsOperation) && mainnet) || productionBroadcast ||
    (executable === "vercel" && values.includes("--prod")) ||
    (["fly", "flyctl"].includes(executable) && values[1] === "deploy");
  if (production) return {
    action: harness === "claude" ? "warn" : "block",
    message: "PRODUCTION DEPLOYMENT: requires explicit out-of-band confirmation before proceeding.",
  };
  return null;
}

/** The words of each simple command after wrappers, as `.agents/policy.json` rules see them. */
export function commandValues(command) {
  return scanCommands(command).commands.map((words) => executableWords(words).map((word) => word.dynamic ? "" : word.value));
}

export function evaluateCommand(command, harness, depth = 0) {
  const { commands, partial } = scanCommands(command);
  const decisions = [];
  let nestedPartial = false;
  for (const words of commands) {
    // The outer command keeps its own checks (an input redirect is a read) before its call string.
    const decision = commandDecision(words, harness);
    if (decision) decisions.push(decision);
    const { call } = executableWords(words);
    if (call === undefined) continue;
    if (call && depth < 3) {
      const nested = evaluateCommand(call, harness, depth + 1);
      decisions.push(...nested.decisions);
      nestedPartial ||= nested.partial;
    } else nestedPartial = true;
  }
  const opaqueProgram = commands.some((words) => {
    const args = executableWords(words);
    return args[0]?.dynamic || ["eval", "bash", "sh", "zsh", "if", "for", "while", "case", "function"]
      .includes(basename(args[0]?.value ?? ""));
  });
  return { decisions, partial: partial || opaqueProgram || nestedPartial };
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
