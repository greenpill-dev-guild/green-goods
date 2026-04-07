/**
 * Deployment View Decomposition Tests
 *
 * RED phase — static file analysis verifying that the Deployment view
 * has been decomposed into sub-components with appropriate separation
 * of concerns.
 *
 * NOTE: The sub-component files ALREADY EXIST in the current codebase.
 * These tests verify the decomposition contract (existence, imports,
 * and size constraints) that must be maintained going forward.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const deploymentDir = resolve(__dirname, "../../views/Deployment");

function readDeploymentFile(filename: string): string {
  const filepath = resolve(deploymentDir, filename);
  return readFileSync(filepath, "utf-8");
}

function fileExists(filename: string): boolean {
  return existsSync(resolve(deploymentDir, filename));
}

function lineCount(filename: string): number {
  const content = readDeploymentFile(filename);
  return content.split("\n").length;
}

describe("Deployment view decomposition", () => {
  it("DeploymentRunnerPanel.tsx exists", () => {
    expect(fileExists("DeploymentRunnerPanel.tsx")).toBe(true);
  });

  it("DeploymentJobMonitor.tsx exists", () => {
    expect(fileExists("DeploymentJobMonitor.tsx")).toBe(true);
  });

  it("DeploymentAllowlistManager.tsx exists", () => {
    expect(fileExists("DeploymentAllowlistManager.tsx")).toBe(true);
  });

  it("Main Deployment file imports all 3 sub-components", () => {
    const mainFile = readDeploymentFile("index.tsx");

    expect(mainFile).toContain("DeploymentRunnerPanel");
    expect(mainFile).toContain("DeploymentJobMonitor");
    expect(mainFile).toContain("DeploymentAllowlistManager");
  });

  it("Each sub-component file is < 400 lines", () => {
    const files = [
      "DeploymentRunnerPanel.tsx",
      "DeploymentJobMonitor.tsx",
      "DeploymentAllowlistManager.tsx",
    ];

    for (const file of files) {
      const lines = lineCount(file);
      expect(lines, `${file} has ${lines} lines (max 400)`).toBeLessThan(400);
    }
  });
});
