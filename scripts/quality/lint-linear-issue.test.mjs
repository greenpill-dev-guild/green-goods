// Fixture tests for the Linear issue-contract gate
// (`.claude/scripts/lint-linear-issue.sh`), the PreToolUse hook that blocks
// `save_issue` writes breaking `.claude/context/linear-routing-rules.md`
// § Issue structure.
//
// Two failure modes matter equally here and both are covered below:
//
//  1. **Fails open** — a rule stops firing and unreadable issues reach Linear
//     again. Every rule has a rejecting fixture.
//  2. **Fails closed on good input** — a rule over-matches and an agent is
//     stuck in a retry loop it cannot satisfy. The `accepts` block pins the
//     shapes that MUST stay writable, including this repo's own generated plan
//     mirrors: an early draft banned any `Handoff:` line and would have
//     blocked every mirror `plan-hub.mjs` emits.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GATE = resolve(repoRoot, ".claude/scripts/lint-linear-issue.sh");

function runGate(toolInput, toolName = "mcp__linear-server__save_issue") {
  const result = spawnSync("bash", [GATE], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    encoding: "utf8",
  });
  return { code: result.status, stderr: result.stderr ?? "" };
}

const BODY_OK = "Editing a garden and changing its image makes the edit impossible to cancel — the operator has to reload.";

// --- Writes the gate must ALLOW ------------------------------------------
// Over-matching here is as damaging as under-matching: a blocked agent cannot
// file the issue at all.

const accepts = [
  {
    name: "plain defect with prose, Done when, and a source line",
    input: {
      title: "Allow cancelling garden edits after changing the image",
      description: `${BODY_OK}\n\n**Done when**\n- Cancel dismisses the dialog after an image change.\n\nReported in QA sync 2026-07-29.`,
    },
  },
  {
    name: "generated plan-mirror lane body (one trailing Handoff link)",
    input: {
      title: "Build the contracts for Commitment Pooling",
      description:
        "The scope, acceptance criteria, and validation for this lane live in its handoff. This issue tracks its status and dependencies.\n\nHandoff: `.plans/active/commitment-pooling/handoffs/codex-contracts.md`",
      labels: ["plans", "green-goods"],
    },
  },
  {
    name: "generated plan-mirror parent body (one trailing Plan hub link)",
    input: {
      title: "Commitment Pooling roadmap",
      description:
        "Tracker for the Commitment Pooling plan, mirrored into Linear for visibility. Status, dates, and dependencies live on this issue.\n\nPlan hub: `.plans/active/commitment-pooling/`",
      labels: ["plans"],
    },
  },
  {
    name: "long umbrella tracker carrying the plans label",
    input: {
      title: "Commitment Pooling roadmap",
      description: `${"Where the work stands and what needs a person. ".repeat(60)}`,
      labels: ["plans"],
    },
  },
  {
    name: "three headings sits on the cap, not over it",
    input: {
      title: "Reconcile work status on app resume",
      description: "## Problem\nx\n\n## Done when\ny\n\n## Source\nz",
    },
  },
  {
    name: "a bulleted list is not an empty-placeholder section",
    input: {
      title: "Populate chapter pages with steward content",
      description: `${BODY_OK}\n\n- First concrete outcome\n- Second concrete outcome`,
    },
  },
];

for (const { name, input } of accepts) {
  test(`accepts: ${name}`, () => {
    const { code, stderr } = runGate(input);
    assert.equal(code, 0, `expected the gate to allow this write, got:\n${stderr}`);
  });
}

// --- Writes the gate must REJECT -----------------------------------------
// Each fixture also asserts the reason, so a rule that starts firing for the
// wrong cause is caught rather than passing on a coincidental block.

const rejects = [
  {
    name: "retired [tracking] title prefix",
    input: { title: "[tracking] Cover first-upload gas", description: BODY_OK },
    expect: /\[tracking\]/,
  },
  {
    name: "lane-prefixed title",
    input: { title: "QA Pass 2: Commitment Pooling", description: BODY_OK },
    expect: /lane or record-type prefix/,
  },
  {
    name: "plan-prefixed title",
    input: { title: "plan: Community Needs & Signals", description: BODY_OK },
    expect: /lane or record-type prefix/,
  },
  {
    name: "priority-prefixed title",
    input: { title: "P1 Fix the approval revert", description: BODY_OK },
    expect: /priority field/,
  },
  {
    name: "body opening with lane metadata",
    input: {
      title: "Run the community rollout for Commitment Pooling",
      description: "Source plan: `.plans/active/commitment-pooling/`\n\nSome prose.",
    },
    expect: /opens with lane metadata/,
  },
  {
    name: "body stacking several metadata lines",
    input: {
      title: "Run the community rollout for Commitment Pooling",
      description: "Some prose first.\n\nLane: `community`\nOwner/status: `claude` / `blocked`\nHandoff: `x.md`",
    },
    expect: /stacks \d+ metadata lines/,
  },
  {
    name: "plan-hub internals cited in the body",
    input: {
      title: "Write the documentation for Commitment Pooling",
      description: "Lane truth lives in status.json#execution_sub_lanes.docs and the handoff.",
    },
    expect: /plan-hub internals/,
  },
  {
    name: "more than three headings",
    input: {
      title: "Prevent duplicate role assignment",
      description: "## Summary\na\n## Surface\nb\n## Suggested fix\nc\n## Safe evidence\nd\n## Source\ne",
    },
    expect: /headings \(cap 3\)/,
  },
  {
    name: "defect body past the word ceiling without the plans label",
    input: {
      title: "Fix the admin approval revert",
      description: "The admin work approval reverts with a garden membership error. ".repeat(45),
    },
    expect: /words \(cap 300/,
  },
  {
    name: "screen codes",
    input: { title: "Repair the recognition-blocked flow", description: "QA must cover W26 recognition-blocked repair." },
    expect: /screen codes/,
  },
  {
    name: "spec citation",
    input: { title: "Repair the recognition-blocked flow", description: "Per the interface spec §5.1 the roster freezes." },
    expect: /spec citation/,
  },
  {
    name: "empty placeholder section",
    input: { title: "Fix the stuck cancel button", description: "## Reproduction\nneeds repro\n\n## Expected\n—" },
    expect: /empty section placeholder/,
  },
];

for (const { name, input, expect } of rejects) {
  test(`rejects: ${name}`, () => {
    const { code, stderr } = runGate(input);
    assert.equal(code, 2, `expected the gate to block this write, got exit ${code}`);
    assert.match(stderr, expect);
    assert.match(stderr, /linear-routing-rules\.md/, "a block must cite the contract so the agent can fix it");
  });
}

// --- Calls the gate must ignore ------------------------------------------
// The hook sees every MCP tool call, and most carry no prose to judge.
// Blocking a state transition or a patch edit would wedge routine work.

const ignores = [
  {
    name: "property-only update (state transition)",
    input: { id: "PRD-800", state: "Done" },
  },
  {
    name: "patch edit carrying no full description",
    input: { id: "PRD-800", patch: [{ op: "append", text: "## a\n## b\n## c\n## d\n## e" }] },
  },
  {
    name: "label-only update",
    input: { id: "PRD-800", labels: ["qa", "admin"] },
  },
];

for (const { name, input } of ignores) {
  test(`ignores: ${name}`, () => {
    const { code } = runGate(input);
    assert.equal(code, 0);
  });
}

test("ignores tool calls that are not save_issue", () => {
  const { code } = runGate(
    { title: "plan: whatever", description: "## a\n## b\n## c\n## d\n## e" },
    "mcp__linear-server__save_project",
  );
  assert.equal(code, 0, "a project write must not be judged by the issue contract");
});
