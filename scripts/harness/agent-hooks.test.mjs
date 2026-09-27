import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateCommand } from "./command-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const claude = JSON.parse(readFileSync(join(root, ".claude/settings.json"), "utf8"));
const codex = JSON.parse(readFileSync(join(root, ".codex/hooks.json"), "utf8"));

function invoke(command, input, env = {}) {
  const result = spawnSync("/bin/bash", ["-c", command], {
    cwd: root,
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.ifError(result.error);
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

function eventHook(eventName, input, env) {
  const hooks = claude.hooks[eventName].flatMap((entry) => entry.hooks);
  assert.equal(hooks.length, 1);
  return invoke(hooks[0].command, { hook_event_name: eventName, ...input }, env);
}

function commandHooks(harness, command) {
  const config = harness === "claude" ? claude : codex;
  return config.hooks.PreToolUse.filter((entry) => entry.matcher === "Bash")
    .flatMap((entry) => entry.hooks)
    .map((hook) => invoke(hook.command, { tool_name: "Bash", tool_input: { command } }));
}

test("completion reports documented stdin identity without interpreting failure words", () => {
  const result = eventHook("TaskCompleted", {
    task_id: "task-42", task_subject: "Fix failed uploads",
    task_description: "Regression proof covers the error and crash paths.", teammate_name: "builder",
  }, { CLAUDE_HOOK_EVENT_DETAILS: '{"subject":"stale event","id":"wrong"}' });
  assert.equal(result.code, 0);
  for (const text of ["task-42", "Fix failed uploads", "builder"]) assert.ok(result.output.includes(text));
  assert.doesNotMatch(result.output, /advisory pass|validation passed|stale event/);
});

test("idle is advisory even when legacy metadata describes a blocker", () => {
  const result = eventHook("TeammateIdle", { teammate_name: "reviewer", team_name: "team-one" }, {
    CLAUDE_HOOK_EVENT_DETAILS: '{"reason":"failed, blocked, timeout"}',
  });
  assert.equal(result.code, 0);
  assert.match(result.output, /reviewer/);
  assert.doesNotMatch(result.output, /retry|without error|passed/i);
});

test("advisory hooks tolerate missing fields, malformed events, and missing jq", () => {
  for (const event of ["TaskCompleted", "TeammateIdle"]) {
    const command = claude.hooks[event][0].hooks[0].command;
    for (const input of ["{", "null", "[]", "{}", ""]) {
      const result = invoke(command, input);
      assert.equal(result.code, 0, event);
      assert.match(result.output, /missing|invalid|unavailable/i);
    }
    // Use the script directly: the configured command needs bash on PATH.
    const script = join(root, ".claude/scripts", event === "TaskCompleted" ? "task-completion-gate.sh" : "teammate-idle-gate.sh");
    const noJq = invoke(`/bin/bash "${script}"`, "{}", { PATH: "/nonexistent" });
    assert.equal(noJq.code, 0);
    assert.match(noJq.output, /jq unavailable/i);
  }
});

const harmless = [
  "bun run test", "bun run contracts test", "cat .env.schema .env.example .env.template",
  "rg 'production deployment|deploy mainnet|bun test' AGENTS.md",
  "printf '%s\\n' 'vercel --prod; bun test; cat .env'",
  "git log --grep='deploy mainnet'", "git push origin feature/main --force",
  "git push main feature/fix --force", "rg '.env' README.md", "grep -e '.env' README.md",
  "rg --glob '.env' 'placeholder' docs", "cat <<-'DOC'\n\tbun test\n\tDOC\nbun run test",
  "cat <<'ONE' <<'TWO'\nbun test\nONE\nvercel --prod\nTWO\nbun run test",
  "git push origin feature/fix; printf '%s' 'main --force'",
  "cat <<'DOC'\nvercel --prod\nbun test\ncat .env\nDOC\nbun run test",
  "python3 - <<'PY'\nlabels = ['PRODUCTION DEPLOYMENT', 'Production/mainnet']\nPY",
  "# deploy mainnet\nbun run test # bun test",
];
for (const command of harmless) {
  test(`harmless shell input: ${command.split("\n")[0]}`, () => {
    for (const harness of ["claude", "codex"]) {
      for (const result of commandHooks(harness, command)) {
        assert.equal(result.code, 0, `${harness}: ${result.output}`);
        assert.doesNotMatch(result.output, /BLOCKED|PRODUCTION DEPLOYMENT/);
      }
    }
  });
}

for (const command of [
  "bun test", "bun run test && bun test", "bun run test\nbun test", "MODE=qa bun test",
  "bun test | cat", "'bun' 'test'", "bun te\\st", "bun \\\n test",
  "git push --force origin main", "git push origin HEAD:main --force-with-lease",
  "git -C /tmp push -f origin master", "cat '.env'", "head -n 1 /tmp/.env.production",
  "rg 'secret' .env", "grep -e 'secret' .env", "sed -n '1p' .env", "cat 0<.env",
  "cat .env.secrets", "cat .env.production.local",
  "cat <<'DOC'\nbun run test\nDOC\nbun test",
]) {
  test(`restricted command: ${command.split("\n")[0]}`, () => {
    for (const harness of ["claude", "codex"]) {
      assert.ok(commandHooks(harness, command).some((result) => result.code === 2), harness);
    }
  });
}

test("deployment and direct Forge enforcement retain the harness differences", () => {
  for (const command of ["vercel --prod", "bun run contracts deploy core --network mainnet --mode broadcast", "bun run contracts upgrade --network mainnet"]) {
    const warning = commandHooks("claude", command);
    assert.ok(warning.every((result) => result.code === 0));
    assert.ok(warning.some((result) => /PRODUCTION DEPLOYMENT/.test(result.output)));
    assert.ok(commandHooks("codex", command).some((result) => result.code === 2));
  }
  for (const command of ["forge build", "forge test", "fly deploy"]) {
    assert.ok(commandHooks("claude", command).every((result) => result.code === 0));
    assert.ok(commandHooks("codex", command).some((result) => result.code === 2));
  }
});

test("hook inspection never evaluates command input", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "agent-hook-input-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sentinel = join(directory, "must-not-exist");
  for (const harness of ["claude", "codex"]) {
    commandHooks(harness, `printf '%s' "$(touch '${sentinel}')"; touch '${sentinel}'`);
    assert.equal(existsSync(sentinel), false);
  }
});

test("shared policy decisions distinguish executable commands from data", () => {
  for (const command of ["bun test", "forge build", "git push origin main --force", "cat .env", "vercel --prod", "bun run test && bun test"]) {
    assert.ok(evaluateCommand(command, "codex").decisions.some((decision) => decision.action === "block"), command);
  }
  for (const command of harmless) assert.deepEqual(evaluateCommand(command, "codex").decisions, [], command);
  assert.equal(evaluateCommand("vercel --prod", "claude").decisions[0].action, "warn");
});

test("unsupported shell programs are explicitly partial and events never certify safety", () => {
  for (const command of ["bash -c 'bun test'", "eval '$PROGRAM'", "printf '%s' \"$(date)\""]) {
    assert.equal(evaluateCommand(command, "codex").partial, true);
  }
  for (const harness of ["claude", "codex"]) {
    for (const input of ["{", "null", "{}", '{"tool_input":{"command":42}}']) {
      const result = invoke(`node "${root}/scripts/harness/command-policy.mjs" ${harness}`, input);
      assert.equal(result.code, 0);
      assert.match(result.output, /no policy decision/i);
    }
  }
});
