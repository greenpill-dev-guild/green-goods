#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PLANS_ROOT = join(REPO_ROOT, ".plans");
const CLAUDE_PLANS_ROOT = join(REPO_ROOT, ".claude", "plans");
const STAGE_DIRS = new Set(["ideas", "backlog", "active", "archive", "audits", "_templates", "_automation", "_backlog", "reviews"]);

function nowIso() {
  return new Date().toISOString();
}

function listFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .map((entry) => join(dir, entry))
    .filter((entryPath) => statSync(entryPath).isFile());
}

function isLegacyPlanFile(filePath) {
  const name = basename(filePath);
  if (name === "README.md") {
    return false;
  }

  return name.endsWith(".md") || name.endsWith(".todo.md");
}

function extractHeading(content, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function extractStatus(content) {
  const match = content.match(/^\*\*Status\*\*:\s*(.+)$/m) || content.match(/^##\s*Status:\s*(.+)$/mi) || content.match(/^>\s*\*\*Status\*\*:\s*(.+)$/mi);
  return match ? match[1].trim() : null;
}

function normalizeSlug(filePath) {
  const name = basename(filePath)
    .replace(/\.todo\.md$/, "")
    .replace(/\.md$/, "");

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function expectedBranch(lane, slug) {
  switch (lane) {
    case "ui":
      return `claude/ui/${slug}`;
    case "state_api":
      return `codex/state-api/${slug}`;
    case "contracts":
      return `codex/contracts/${slug}`;
    case "qa_pass_1":
      return `claude/qa-pass-1/${slug}`;
    case "qa_pass_2":
      return `codex/qa-pass-2/${slug}`;
    default:
      throw new Error(`Unknown lane ${lane}`);
  }
}

function buildStatus({ slug, title, stage, sourcePaths, importedFromClaude = false }) {
  const archiveLike = stage === "archive";
  const baseLaneStatus = archiveLike ? "n/a" : "blocked";
  const manualBlocked = archiveLike ? false : true;
  const now = nowIso();

  return {
    version: 1,
    feature: {
      slug,
      title,
      kind: importedFromClaude ? "legacy_agent_plan" : "legacy_plan",
      stage,
    },
    workflow: {
      overall_status: stage === "archive" ? "archived" : stage,
      priority: archiveLike ? "p3" : "p2",
      created_at: now,
      updated_at: now,
    },
    links: {
      brief: "brief.md",
      spec: "spec.md",
      plan: "plan.todo.md",
      eval: "eval.md",
    },
    notes: [
      "Imported from a legacy plan source.",
      "Classify lanes manually before letting automations act on this hub.",
      ...sourcePaths.map((source) => `Legacy source: ${source}`),
    ],
    lanes: {
      ui: {
        owner: "claude",
        status: baseLaneStatus,
        branch: expectedBranch("ui", slug),
        depends_on: [],
        handoff: "handoffs/claude-ui.md",
        skill_tags: ["ui", "frontend-design", "react"],
        manual_blocked: manualBlocked,
      },
      state_api: {
        owner: "codex",
        status: baseLaneStatus,
        branch: expectedBranch("state_api", slug),
        depends_on: [],
        handoff: "handoffs/codex-state-api.md",
        skill_tags: ["react", "tanstack-query", "data-layer"],
        manual_blocked: manualBlocked,
      },
      contracts: {
        owner: "codex",
        status: baseLaneStatus,
        branch: expectedBranch("contracts", slug),
        depends_on: [],
        handoff: "handoffs/codex-contracts.md",
        skill_tags: ["contracts"],
        manual_blocked: manualBlocked,
      },
      qa_pass_1: {
        owner: "claude",
        status: baseLaneStatus,
        ready_when_dependencies_met: true,
        manual_blocked: manualBlocked,
        branch: expectedBranch("qa_pass_1", slug),
        depends_on: ["ui", "state_api", "contracts"],
        handoff: "handoffs/claude-qa-pass-1.md",
        skill_tags: ["testing", "review"],
      },
      qa_pass_2: {
        owner: "codex",
        status: baseLaneStatus,
        ready_when_dependencies_met: true,
        manual_blocked: manualBlocked,
        branch: expectedBranch("qa_pass_2", slug),
        branch_trigger: expectedBranch("qa_pass_1", slug),
        depends_on: ["qa_pass_1"],
        handoff: "handoffs/codex-qa-pass-2.md",
        skill_tags: ["testing", "review"],
      },
    },
    history: [
      {
        timestamp: now,
        actor: "migration-script",
        lane: "system",
        status: "imported_legacy_plan",
        branch: null,
        note: importedFromClaude ? "Imported from .claude/plans for centralized visibility." : "Imported from legacy flat .plans layout.",
      },
    ],
  };
}

function detectStage({ filePath, content, sourceType }) {
  const status = (extractStatus(content) || "").toUpperCase();
  const name = basename(filePath).toLowerCase();

  if (sourceType === "claude") {
    return "archive";
  }

  if (name.startsWith("meeting-notes")) {
    return "archive";
  }

  if (status.includes("IMPLEMENTED") || status.includes("COMPLETE") || status.includes("REFERENCE")) {
    return "archive";
  }

  if (sourceType === "backlog") {
    return "backlog";
  }

  if (status.includes("ACTIVE") || status.includes("IN PROGRESS") || status.includes("READY")) {
    return "active";
  }

  if (status.includes("DRAFT") || status.includes("PLANNING") || status.includes("PLANNED") || status.includes("NOT STARTED")) {
    return "backlog";
  }

  if (name.includes("prompt")) {
    return "backlog";
  }

  return "backlog";
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeFile(path, contents) {
  writeFileSync(path, contents.endsWith("\n") ? contents : `${contents}\n`);
}

function createGeneratedBrief({ title, slug, stage, sources }) {
  return `# ${title}\n\n**Slug**: \`${slug}\`\n**Stage**: \`${stage}\`\n**Imported**: \`${nowIso()}\`\n\n## Legacy Migration Note\n\nThis hub was generated from an existing legacy plan artifact so the operational workspace lives in one place.\n\n## Source Files\n\n${sources.map((source) => `- \`${source}\``).join("\n")}\n\n## Next Step\n\nReview \`status.json\` and classify the lanes before letting automations act on this hub.\n`;
}

function createGeneratedSpec({ title, sources }) {
  return `# ${title} Spec\n\nThis spec file was generated during legacy plan migration.\n\n## Legacy Sources\n\n${sources.map((source) => `- \`${source}\``).join("\n")}\n\n## Follow-Up\n\nIf this item is still active, extract the real requirements and constraints from the legacy content into this file.\n`;
}

function createGeneratedPlan({ title, sources }) {
  return `# ${title} Plan\n\nThis plan file was generated during legacy plan migration.\n\n## Legacy Sources\n\n${sources.map((source) => `- \`${source}\``).join("\n")}\n\n## Follow-Up\n\nIf this item is still active, convert the legacy content into lane-specific implementation steps here.\n`;
}

function createGeneratedEval({ title, sources }) {
  return `# ${title} Evaluation Plan\n\nThis evaluation file was generated during legacy plan migration.\n\n## Legacy Sources\n\n${sources.map((source) => `- \`${source}\``).join("\n")}\n\n## Follow-Up\n\nAdd acceptance criteria and validation commands before using this hub for automation.\n`;
}

function migrateFlatPlans() {
  const groups = new Map();

  for (const filePath of listFiles(PLANS_ROOT)) {
    if (!isLegacyPlanFile(filePath)) {
      continue;
    }

    const relativePath = relative(REPO_ROOT, filePath);
    if (relativePath.split("/").length !== 2) {
      continue;
    }

    const slug = normalizeSlug(filePath);
    const entry = groups.get(slug) || [];
    entry.push({ filePath, sourceType: "root" });
    groups.set(slug, entry);
  }

  for (const filePath of listFiles(join(PLANS_ROOT, "_backlog"))) {
    if (!isLegacyPlanFile(filePath)) {
      continue;
    }

    const slug = normalizeSlug(filePath);
    const entry = groups.get(slug) || [];
    entry.push({ filePath, sourceType: "backlog" });
    groups.set(slug, entry);
  }

  let migrated = 0;

  for (const [slug, sources] of groups.entries()) {
    const sortedSources = [...sources].sort((left, right) => {
      if (left.sourceType === right.sourceType) return 0;
      return left.sourceType === "root" ? -1 : 1;
    });
    const primary = sortedSources[0];
    const primaryContent = readFileSync(primary.filePath, "utf8");
    const title = extractHeading(primaryContent, titleFromSlug(slug));
    const stage = detectStage({ filePath: primary.filePath, content: primaryContent, sourceType: primary.sourceType });
    const targetDir = join(PLANS_ROOT, stage, slug);

    if (existsSync(targetDir)) {
      continue;
    }

    ensureDir(targetDir);
    ensureDir(join(targetDir, "handoffs"));
    ensureDir(join(targetDir, "reports"));
    ensureDir(join(targetDir, "artifacts", "legacy-sources"));

    const sourcePaths = sortedSources.map((source) => relative(REPO_ROOT, source.filePath));

    writeFile(join(targetDir, "brief.md"), createGeneratedBrief({ title, slug, stage, sources: sourcePaths }));
    writeFile(join(targetDir, "eval.md"), createGeneratedEval({ title, sources: sourcePaths }));

    if (primary.filePath.endsWith(".todo.md")) {
      writeFile(join(targetDir, "plan.todo.md"), primaryContent);
      writeFile(join(targetDir, "spec.md"), createGeneratedSpec({ title, sources: sourcePaths }));
    } else {
      writeFile(join(targetDir, "spec.md"), primaryContent);
      writeFile(join(targetDir, "plan.todo.md"), createGeneratedPlan({ title, sources: sourcePaths }));
    }

    for (const source of sortedSources) {
      const sourceContent = readFileSync(source.filePath, "utf8");
      writeFile(join(targetDir, "artifacts", "legacy-sources", basename(source.filePath)), sourceContent);
    }

    const status = buildStatus({ slug, title, stage, sourcePaths });
    writeFile(join(targetDir, "status.json"), JSON.stringify(status, null, 2));

    for (const source of sortedSources) {
      rmSync(source.filePath, { force: true });
    }

    migrated += 1;
  }

  return migrated;
}

function importClaudePlans() {
  let imported = 0;

  for (const filePath of listFiles(CLAUDE_PLANS_ROOT)) {
    if (!filePath.endsWith(".md")) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const baseSlug = normalizeSlug(filePath);
    const slug = `claude-plan-${baseSlug}`;
    const title = extractHeading(content, titleFromSlug(baseSlug));
    const stage = "archive";
    const targetDir = join(PLANS_ROOT, stage, slug);

    if (existsSync(targetDir)) {
      continue;
    }

    ensureDir(targetDir);
    ensureDir(join(targetDir, "handoffs"));
    ensureDir(join(targetDir, "reports"));
    ensureDir(join(targetDir, "artifacts", "legacy-sources"));

    const sourcePath = relative(REPO_ROOT, filePath);

    writeFile(join(targetDir, "brief.md"), createGeneratedBrief({ title, slug, stage, sources: [sourcePath] }));
    writeFile(join(targetDir, "spec.md"), createGeneratedSpec({ title, sources: [sourcePath] }));
    writeFile(join(targetDir, "plan.todo.md"), content);
    writeFile(join(targetDir, "eval.md"), createGeneratedEval({ title, sources: [sourcePath] }));
    writeFile(join(targetDir, "artifacts", "legacy-sources", basename(filePath)), content);

    const status = buildStatus({
      slug,
      title,
      stage,
      sourcePaths: [sourcePath],
      importedFromClaude: true,
    });
    writeFile(join(targetDir, "status.json"), JSON.stringify(status, null, 2));
    imported += 1;
  }

  return imported;
}

const migratedFlat = migrateFlatPlans();
const importedClaude = importClaudePlans();

console.log(`Migrated ${migratedFlat} legacy flat plan group(s).`);
console.log(`Imported ${importedClaude} .claude/plans file(s) into archive hubs.`);
