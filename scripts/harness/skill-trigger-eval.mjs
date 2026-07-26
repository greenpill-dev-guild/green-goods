#!/usr/bin/env node
// On-demand skill trigger-routing eval (DeepMind-minimal shape).
//
// HONESTY NOTE — what this measures: whether a cheap model, given ONLY the
// .claude/skills/*/SKILL.md frontmatter descriptions, routes realistic queries
// to the intended skill. It is NOT the harness's real trigger mechanism and
// proves nothing about skill *behavior*. Its job is catching description
// regressions — a trimmed description that stops firing, or a greedy one that
// swallows another skill's queries. Run it after any description/trigger edit.
//
// Caller: `bun run eval:skills` (root package.json). NOT in CI — it needs a
// logged-in `claude` CLI and spends real tokens (one batched call per run).
// Fixtures: scripts/data/skill-trigger-eval.json. EVAL_MODEL overrides the
// model (default haiku; use sonnet to arbitrate a disputed case).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = path.join(repoRoot, "scripts", "data", "skill-trigger-eval.json");
const { cases } = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const skillsDir = path.join(repoRoot, ".claude", "skills");
const skills = [];
for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
  if (!fs.existsSync(skillPath)) continue;
  const fm = fs.readFileSync(skillPath, "utf8").match(/^---\n([\s\S]*?)\n---/);
  const desc = fm?.[1].match(/^description:\s*(.*(?:\n(?![a-z-]+:).*)*)/m)?.[1];
  if (desc) skills.push({ name: entry.name, description: desc.replace(/\s+/g, " ").trim() });
}
if (skills.length === 0) {
  console.error("skill-trigger-eval: no skills found under .claude/skills — aborting");
  process.exit(2);
}

const prompt = [
  "You are the skill router for a coding-agent harness. Below are the available skills",
  "with their trigger descriptions, then a list of user queries.",
  "For EACH query, decide which single skill's description best says it should fire.",
  'If no skill should fire, answer "none". Judge ONLY from the descriptions.',
  "",
  "Skills:",
  ...skills.map((s) => `- ${s.name}: ${s.description}`),
  "",
  "Queries:",
  ...cases.map((c) => `${c.id}: ${c.query}`),
  "",
  'Respond with ONLY a strict JSON array, no prose, no code fences:',
  '[{"id": "<query id>", "skill": "<skill name or none>"}]',
].join("\n");

function runModel() {
  const raw = execFileSync(
    "claude",
    ["-p", prompt, "--model", process.env.EVAL_MODEL ?? "haiku", "--output-format", "json"],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 300_000 },
  );
  const outer = JSON.parse(raw);
  let text = (outer.result ?? "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const answers = JSON.parse(text);
  if (!Array.isArray(answers)) throw new Error("model response is not a JSON array");
  const byId = new Map(answers.map((a) => [a.id, String(a.skill ?? "none")]));
  const missing = cases.filter((c) => !byId.has(c.id)).map((c) => c.id);
  if (missing.length > 0) throw new Error(`missing ids in response: ${missing.join(", ")}`);
  return byId;
}

let byId;
let lastError;
for (let attempt = 1; attempt <= 2; attempt++) {
  try {
    byId = runModel();
    break;
  } catch (error) {
    lastError = error;
    console.error(`skill-trigger-eval: attempt ${attempt} failed — ${error.message}`);
  }
}
if (!byId) {
  console.error("skill-trigger-eval: could not get a parseable, complete response after retry.");
  console.error(String(lastError));
  process.exit(2);
}

let failures = 0;
console.log(`skill-trigger-eval: ${cases.length} cases, ${skills.length} skills, model=${process.env.EVAL_MODEL ?? "haiku"}`);
for (const c of cases) {
  const actual = byId.get(c.id);
  const accepted = Array.isArray(c.expect) ? c.expect : [c.expect];
  const pass = accepted.includes(actual);
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${c.id.padEnd(10)} expected ${accepted.join("|")} got ${actual}`);
}
console.log(
  failures === 0
    ? `skill-trigger-eval: all ${cases.length} cases routed as expected.`
    : `skill-trigger-eval: ${failures}/${cases.length} cases misrouted — a description edit likely changed routing.`,
);
process.exit(failures === 0 ? 0 : 1);
