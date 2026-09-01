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
        "Tracker for the Commitment Pooling plan, mirrored into Linear for visibility. This issue carries the overall status; the scope, lane detail, and handoffs live in the plan hub.\n\nPlan hub: `.plans/active/commitment-pooling/`",
      labels: ["plans", "architecture"],
    },
  },
  {
    // The exemption needs `plans` AND `architecture`: plan-hub stamps `plans`
    // on every mirror, so the roadmap parent's architecture label is what
    // separates it from an ordinary lane issue.
    name: "long roadmap parent carrying plans and architecture",
    input: {
      title: "Commitment Pooling roadmap",
      description: `${"Where the work stands and what needs a person. ".repeat(80)}`,
      labels: ["plans", "architecture"],
    },
  },
  {
    name: "six headings sits on the backstop, not over it",
    input: {
      title: "Reconcile work status on app resume",
      description: "## Problem\nx\n\n## Done when\ny\n\n## Source\nz\n\n## Context\na\n\n## Risks\nb\n\n## Rollout\nc",
    },
  },
  {
    // The call-report parent legitimately runs long (coverage rollups plus a
    // slice index). The dated title is the exemption signal — labels can be
    // opaque IDs here just like the roadmap case above.
    name: "QA session report title earns the length exemption",
    input: {
      title: "QA session 2026-08-31",
      description: "Where the work stands and what needs a person. ".repeat(80),
    },
  },
  {
    name: "a bulleted list is not an empty-placeholder section",
    input: {
      title: "Populate chapter pages with steward content",
      description: `${BODY_OK}\n\n- First concrete outcome\n- Second concrete outcome`,
    },
  },
  {
    name: "namespaced label forms also earn the length exemption",
    input: {
      title: "Commitment Pooling roadmap",
      description: "Where the work stands and what needs a person. ".repeat(80),
      labels: ["source:plans", "activity:architecture"],
    },
  },
  {
    name: "non-ASCII title that is not an emoji (pt locale)",
    input: { title: "Área de jardim não carrega no Portugues", description: BODY_OK },
  },
  {
    // Quoting the retired shape in an example is describing it, not adopting
    // it, so the metadata rule reads fence-stripped prose like the others.
    name: "fenced example quoting legacy metadata lines",
    input: {
      title: "Document the retired mirror format for stewards",
      description:
        "Stewards keep reproducing the old mirror shape from memory.\n\n```markdown\nSource: notes.md\nLane: ui\n```",
    },
  },
  {
    // save_issue accepts label IDs, which the gate cannot resolve — so the
    // roadmap title is the fallback signal for the length exemption.
    name: "roadmap identified by title when labels are opaque IDs",
    input: {
      title: "Commitment Pooling roadmap",
      description: "Where the work stands and what needs a person. ".repeat(80),
      labels: ["a1b2c3d4-0000-0000-0000-000000000001"],
    },
  },
  {
    name: "update may carry no description at all",
    input: { id: "PRD-800", title: "Allow cancelling garden edits after changing the image" },
  },
  {
    // Banned tokens hold for prose, not for code examples quoting them — the
    // same describing-vs-adopting rule the fenced-metadata fixture above pins.
    name: "fenced example quoting a banned internals token",
    input: {
      title: "Fix the plan hub crash on corrupted status",
      description:
        "Running linear-sync on a corrupted hub throws before the manifest builds.\n\n```\nTypeError: cannot read status.json#execution_sub_lanes\n```\n\nSeen on the 2026-08-27 sync run.",
    },
  },
  {
    name: "fenced example quoting a screen code",
    input: {
      title: "Document the screen-code map for stewards",
      description:
        "The retired screen codes still appear in exported notes and confuse new stewards.\n\n```\nW26 recognition-blocked\n```",
    },
  },
  {
    // Four leading spaces is indented code in Markdown, not a heading; the
    // emoji-heading rule uses the same 0-3 space bound as the heading counter.
    name: "indented emoji code line is not an emoji heading",
    input: {
      title: "Client errors spiked overnight",
      description: "Errors spiked overnight and users see blank gardens.\n\n    ## 🔴 Counts\n99 in 24h.",
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
    expect: /category prefix/,
  },
  {
    name: "plan-prefixed title",
    input: { title: "plan: Community Needs & Signals", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    name: "priority-prefixed title",
    input: { title: "P1 Fix the approval revert", description: BODY_OK },
    expect: /priority field/,
  },
  {
    name: "bracketed priority prefix",
    input: { title: "[P1] Fix the approval revert", description: BODY_OK },
    expect: /priority field/,
  },
  {
    // Every prefix rule is anchored, so an untrimmed title would slip all of
    // them while reaching Linear looking just as prefixed.
    name: "prefix hidden behind leading whitespace",
    input: { title: "  [tracking] Fix the stuck cancel button", description: BODY_OK },
    expect: /\[tracking\]/,
  },
  {
    name: "lane prefix hidden behind a leading tab",
    input: { title: "\tQA Pass 2: Commitment Pooling", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    // Named in AGENTS.md's prohibited-shorthand list alongside §-citations.
    name: "register-number shorthand in the body",
    input: { title: "Freeze the roster on confirmation", description: "Per register #90 the roster freezes." },
    expect: /internal shorthand/,
  },
  {
    name: "decision-log number in the body",
    input: { title: "Freeze the roster on confirmation", description: "Decision Log 4 settled this." },
    expect: /internal shorthand/,
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
    // The field label makes it metadata, not the inline-code formatting.
    name: "metadata opener without backticks",
    input: {
      title: "Run the community rollout for Commitment Pooling",
      description: "Source plan: .plans/active/commitment-pooling/\n\nSome prose.",
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
    name: "more than six headings",
    input: {
      title: "Prevent duplicate role assignment",
      description: "## Summary\na\n## Surface\nb\n## Suggested fix\nc\n## Safe evidence\nd\n## Source\ne\n## Repro\nf\n## Notes\ng",
    },
    expect: /headings \(backstop 6\)/,
  },
  {
    name: "defect body past the word ceiling without the plans label",
    input: {
      title: "Fix the admin approval revert",
      description: "The admin work approval reverts with a garden membership error. ".repeat(70),
    },
    expect: /words \(backstop 600/,
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
  {
    name: "Recurring: routine title prefix",
    input: { title: "Recurring: Failed to request credential", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    name: "lowercase lane prefix (the check is case-insensitive)",
    input: { title: "docs: Commitment Pooling", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    // Named in the contract's prohibited list, so the gate must know it.
    name: "event-tag title prefix",
    input: { title: "ETHOnline: Publish Needs with honest queue states", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    name: "work-type title prefix",
    input: { title: "Bug: Garden edit cancel stops responding", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    name: "package-name title prefix",
    input: { title: "Admin: work queue renders empty after approval", description: BODY_OK },
    expect: /category prefix/,
  },
  {
    name: "emoji-led title",
    input: { title: "🔴 Client errors spiked", description: BODY_OK },
    expect: /Title starts with an emoji/,
  },
  {
    name: "emoji-led heading",
    input: { title: "Client errors spiked overnight", description: "## 🔴 Counts\n99 in 24h." },
    expect: /emoji heading/,
  },
  {
    name: "create with a title and no body at all",
    input: { title: "Fix the stuck cancel button" },
    expect: /no body/,
  },
  {
    // A body of spaces and newlines is as unreadable as no body; `-z` alone
    // treats it as present.
    name: "create whose body is only whitespace",
    input: { title: "Fix the stuck cancel button", description: "   \n\t  \n" },
    expect: /no body/,
  },
  {
    // An update is exempt from carrying a body, but not from the title rules —
    // otherwise a rename could reintroduce a prefix that creates reject.
    name: "rename that reintroduces a retired prefix",
    input: { id: "PRD-800", title: "[tracking] Reintroduce the bad prefix" },
    expect: /\[tracking\]/,
  },
  {
    // Patching is a write like any other; the absolute rules must survive it.
    name: "patch smuggling plan-hub internals into an existing body",
    input: { id: "PRD-800", patch: [{ op: "append", text: "Lane truth is in status.json#execution_sub_lanes.docs." }] },
    expect: /Patched text cites plan-hub internals/,
  },
  {
    name: "patch smuggling a screen code",
    input: { id: "PRD-800", patch: [{ op: "replace", old_string: "x", new_string: "Covers W26 repair." }] },
    expect: /Patched text uses screen codes/,
  },
  {
    // Erasing the body via patch must cost the same as `description: ""`,
    // which is rejected — otherwise the patch path is the cheaper way to do it.
    name: "patch erasing a block of the body",
    input: {
      id: "PRD-800",
      patch: [
        {
          op: "replace",
          old_string:
            "Editing a garden and changing its image makes the edit impossible to cancel — the operator has to reload.",
          new_string: "",
        },
      ],
    },
    expect: /deletes \d+ words of the body/,
  },
  {
    name: "emoji heading at H1 (not just H2)",
    input: { title: "Client errors spiked overnight", description: "# 🔴 Counts\n99 exceptions in 24h." },
    expect: /emoji heading/,
  },
  {
    // An absent description means "leave the body alone"; an explicit empty one
    // means "erase it", and only the second breaks the contract.
    name: "update that blanks an existing body",
    input: { id: "PRD-800", description: "" },
    expect: /erases the body/,
  },
  {
    // Markdown renders up to three leading spaces as a heading, so the count
    // has to see them or the cap is trivially bypassed.
    name: "indented headings still count toward the backstop",
    input: { title: "Fix the stuck cancel button", description: "   ## A\nx\n   ## B\ny\n   ## C\nz\n   ## D\nw\n   ## E\nv\n   ## F\nu\n   ## G\nt" },
    expect: /headings \(backstop 6\)/,
  },
  {
    // A tab delimits an ATX heading just as a space does.
    name: "tab-delimited headings count toward the backstop",
    input: { title: "Fix the stuck cancel button", description: "##\tA\nx\n##\tB\ny\n##\tC\nz\n##\tD\nw\n##\tE\nv\n##\tF\nu\n##\tG\nt" },
    expect: /headings \(backstop 6\)/,
  },
  {
    name: "list-form empty placeholder",
    input: { title: "Fix the stuck cancel button", description: "## Reproduction\n- needs repro\n\n## Expected\n* TBD" },
    expect: /empty section placeholder/,
  },
  {
    name: "lowercase empty placeholder",
    input: { title: "Fix the stuck cancel button", description: "## Reproduction\ntbd\n\n## Expected\nn/a" },
    expect: /empty section placeholder/,
  },
  {
    // plan-hub stamps `plans` on lane mirrors too, so the exemption must not
    // key off it alone — a build lane is ordinary work and obeys the ceiling.
    name: "long lane mirror does not inherit the roadmap exemption",
    input: {
      title: "Build the contracts for Commitment Pooling",
      description: "Where the work stands and what needs a person. ".repeat(80),
      labels: ["plans", "build"],
    },
    expect: /words \(backstop 600/,
  },
  {
    // The QA-report exemption requires the dated title. A vague "QA session"
    // title without the date is an ordinary issue and obeys the backstop.
    name: "dateless QA session title does not earn the exemption",
    input: {
      title: "QA session notes",
      description: "Where the work stands and what needs a person. ".repeat(80),
    },
    expect: /words \(backstop 600/,
  },
  {
    // \r must count as whitespace: a CRLF-only body is as empty as no body.
    name: "create whose body is only CRLF whitespace",
    input: { title: "Fix the stuck cancel button", description: "\r\n\r\n" },
    expect: /no body/,
  },
  {
    // Deletions are summed across ops: each op here removes only four words,
    // so a per-op maximum would wave the pair through while the body loses
    // eight words with nothing replacing them.
    name: "patch erasing the body across several small deletions",
    input: {
      id: "PRD-800",
      patch: [
        { op: "replace", old_string: "Editing a garden and", new_string: "" },
        { op: "replace", old_string: "changing its image makes", new_string: "" },
      ],
    },
    expect: /deletes 8 words of the body/,
  },
  {
    // The stack rule holds on fragments: restoring a metadata stack by patch
    // must cost the same as writing it into a fresh body.
    name: "patch stacking metadata lines",
    input: {
      id: "PRD-800",
      patch: [{ op: "append", text: "Lane: ui\nOwner: human" }],
    },
    expect: /Patched text stacks 2 metadata lines/,
  },
  {
    // An append cannot remove content, so seven appended headings prove the
    // resulting body exceeds the six-heading backstop whatever it held before.
    name: "append fragment that alone breaches the heading backstop",
    input: {
      id: "PRD-800",
      patch: [{ op: "append", text: "## A\nx\n## B\ny\n## C\nz\n## D\nw\n## E\nv\n## F\nu\n## G\nt" }],
    },
    expect: /Appended text alone carries 7 headings/,
  },
  {
    name: "append fragment that alone breaches the word cap",
    input: {
      id: "PRD-800",
      patch: [
        { op: "append", text: "Where the work stands and what needs a person. ".repeat(80) },
      ],
    },
    expect: /Appended text alone is \d+ words/,
  },
];

// --- Emoji detection must not over-match -----------------------------------
// The symbol and punctuation blocks share a UTF-8 lead byte, so a lead-byte
// test rejects ordinary prose. These pin both directions.

const emojiTitles = [
  "🔴 Client errors spiked",
  "✅ Verified the fix",
  "⚡ Speed regression on load",
];
for (const t of emojiTitles) {
  test(`rejects: emoji-led title ${JSON.stringify(t.slice(0, 2))}`, () => {
    const { code, stderr } = runGate({ title: t, description: BODY_OK });
    assert.equal(code, 2);
    assert.match(stderr, /Title starts with an emoji/);
  });
}

const proseTitles = [
  "“Offline mode” fails for gardeners",
  "— dash-led title from a pasted note",
  "…ellipsis-led title",
  "Área de jardim não carrega",
  // A bare digit or the word form must not be mistaken for a keycap emoji.
  "2 gardens cannot submit work offline",
  "Copyright notice shows the wrong year",
  // The rule is emoji-LED, so a sequence appearing later in an otherwise
  // compliant title is fine. Only the first grapheme is inspected.
  "A ©️ licensing notice is wrong",
  "The 1️⃣ step in onboarding is broken",
];
for (const t of proseTitles) {
  test(`accepts: non-emoji punctuation title ${JSON.stringify(t.slice(0, 2))}`, () => {
    const { code, stderr } = runGate({ title: t, description: BODY_OK });
    assert.equal(code, 0, `punctuation must not read as an emoji, got:\n${stderr}`);
  });
}

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
    // A replace fragment cannot reveal the size of the resulting document, so
    // the cumulative caps are not evaluated on it — the absolute rules are,
    // and append fragments that alone breach a cap are rejected below. A
    // small clean append passes.
    name: "patch edit whose inserted text is clean",
    input: { id: "PRD-800", patch: [{ op: "append", text: "Fixed in the 2026-08-27 deploy." }] },
  },
  {
    // Six appended headings cannot prove the result exceeds the backstop of
    // six, so the fragment passes; only self-sufficient breaches reject.
    name: "append fragment at the heading backstop",
    input: { id: "PRD-800", patch: [{ op: "append", text: "## A\nx\n## B\ny\n## C\nz\n## D\nw\n## E\nv\n## F\nu" }] },
  },
  {
    // A replace fragment can shrink what it touches, so a long new_string is
    // not proof the resulting body exceeds the word cap.
    name: "long replace fragment stays exempt from the caps",
    input: {
      id: "PRD-800",
      patch: [
        {
          op: "replace",
          old_string: "x",
          new_string: "Where the work stands and what needs a person. ".repeat(80),
        },
      ],
    },
  },
  {
    // Ordinary editing. Only a large unreplaced deletion is destructive.
    name: "patch deleting a stray word",
    input: { id: "PRD-800", patch: [{ op: "replace", old_string: " actually", new_string: "" }] },
  },
  {
    name: "rename to a clean title with no description",
    input: { id: "PRD-800", title: "Allow cancelling garden edits after changing the image" },
  },
  {
    // A PR or issue reference is legitimate and useful; only the named
    // shorthand forms (register #N, decision log N) are banned.
    name: "body citing a pull request number",
    input: {
      title: "Fix the admin approval revert",
      description: "Regressed in #778 — the pre-flight simulation now reverts on a garden-membership check.",
    },
  },
  {
    // Must not read as a priority prefix.
    name: "title beginning with a P-and-digit word",
    input: { title: "P2P sync fails between two devices", description: BODY_OK },
  },
  {
    // A horizontal rule sits after a blank line, so it is not a Setext heading
    // and must not be counted as one.
    name: "horizontal rule separating paragraphs",
    input: {
      title: "Fix the stuck cancel button",
      description: `${BODY_OK}\n\n---\n\nThe image upload path is the trigger.`,
    },
  },
  {
    // Linear renders a fence as code, so `##` comment lines inside one are not
    // headings. Blocking this valid body is the expensive kind of mistake.
    name: "fenced shell example containing hash comments",
    input: {
      title: "Document the deploy steps for new stewards",
      description:
        "The deploy runbook is undocumented, so a new steward cannot ship without pairing.\n\n```bash\n## step one\n## step two\n## step three\n## step four\n```",
    },
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
