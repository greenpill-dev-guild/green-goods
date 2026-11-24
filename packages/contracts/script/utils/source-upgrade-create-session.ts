import fs from "node:fs";
import path from "node:path";
import { executeOperation } from "../cli/execute.mjs";
import { OPERATOR, resolveCommand, type Resolution } from "../cli/operations.mjs";
import { buildReadOnlyCastEnv, execCastCaptured } from "./cast-env";
import { withKeystorePassword } from "./keystore-session";
import { CONTRACTS_ROOT } from "./paths";
import { releaseJsonPath, releaseRevision } from "./release-inputs";
import { SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import type { SourceExecutionJournal } from "./source-upgrade-execution-types";
import type { SourceUpgradePlan } from "./source-upgrade-release";
import { voucherDigest } from "./voucher-release";

type Input = {
  options: Record<string, string | boolean | undefined>;
  plan: SourceUpgradePlan;
  revision: string;
  manifestPath: string;
};
type SessionPorts = {
  execute?: (resolution: Resolution, options: { env: NodeJS.ProcessEnv }) => Promise<{ code: number }>;
  unlock?: (run: (environment: NodeJS.ProcessEnv, signal: AbortSignal) => Promise<void>) => Promise<void>;
};

/** Password reuse changes only orchestration; every send still uses the canonical single-boundary CLI. */
export async function runSourceUpgradeCreateSession(input: Input, ports: SessionPorts = {}) {
  const { plan, options: o, revision, manifestPath } = input;
  const directory = path.join(CONTRACTS_ROOT, ".generated/source-upgrades");
  const required = (key: string) => {
    const value = o[key];
    if (typeof value !== "string" || !value) throw new Error(`Source CREATE session requires --${key}`);
    releaseJsonPath(directory, value);
    return value;
  };
  const planPath = required("plan"),
    rehearsal = required("rehearsal"),
    envelope = required("envelope");
  JSON.parse(fs.readFileSync(releaseJsonPath(directory, envelope), "utf8"));
  const assertInputs = () => {
    if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
      throw new Error("Source CREATE session revision changed");
    if (
      voucherDigest(JSON.parse(fs.readFileSync(releaseJsonPath(directory, planPath), "utf8"))) !== voucherDigest(plan)
    )
      throw new Error("Source CREATE session plan changed");
    for (const file of [SOURCE_EXECUTION_FILES.lock, SOURCE_EXECUTION_FILES.recoveryLock])
      if (fs.existsSync(path.join(directory, file)))
        throw new Error("Reconcile the existing source execution lock first");
  };
  const progress = () => {
    const file = path.join(directory, SOURCE_EXECUTION_FILES.journal);
    if (!fs.existsSync(file)) return { count: 0, receipt: undefined };
    const journal = JSON.parse(fs.readFileSync(file, "utf8")) as SourceExecutionJournal;
    if (
      journal.planHash !== voucherDigest(plan) ||
      journal.envelopeHash !==
        voucherDigest(JSON.parse(fs.readFileSync(releaseJsonPath(directory, envelope), "utf8"))) ||
      !Array.isArray(journal.completed) ||
      journal.completed.length > plan.deployments.length ||
      journal.pending ||
      !journal.completed.every((item, i) => item.step === i + 1 && /^0x[\da-f]{64}$/i.test(item.transactionHash))
    )
      throw new Error("Source CREATE session requires an unambiguous matching CREATE checkpoint prefix");
    return { count: journal.completed.length, receipt: journal.completed.at(-1)?.transactionHash };
  };
  const run = async (mode: "adopt" | "broadcast", step: number, environment: NodeJS.ProcessEnv, receipt?: string) => {
    assertInputs();
    const resolution = resolveCommand([
      "release",
      "source-upgrades",
      "--mode",
      mode,
      "--plan",
      planPath,
      "--rehearsal",
      rehearsal,
      "--envelope",
      envelope,
      "--manifest",
      path.relative(CONTRACTS_ROOT, manifestPath),
      ...(o["resume-plan"] ? ["--resume-plan"] : []),
      "--step",
      String(step),
      "--expected-nonce",
      String(plan.deployments[step - 1].nonce),
      ...(receipt ? ["--receipt", receipt] : []),
    ]);
    if ("help" in resolution) throw new Error("Source CREATE session requires a concrete boundary");
    const result = await (ports.execute ?? executeOperation)(resolution, { env: environment });
    if (result.code !== 0)
      throw new Error(`Source CREATE session stopped at boundary ${step}; preserve its journal and locks`);
    assertInputs();
    if (progress().count !== step) throw new Error("Source CREATE session boundary did not persist its checkpoint");
  };
  assertInputs();
  const initial = progress();
  // Canonically reverify the saved prefix before asking for a password, including a completed lane.
  if (initial.count) await run("adopt", initial.count, buildReadOnlyCastEnv(), initial.receipt);
  if (initial.count < plan.deployments.length) {
    await (ports.unlock ?? withKeystorePassword)(async (environment, signal) => {
      signal.throwIfAborted();
      assertInputs();
      const signer = execCastCaptured(
        ["wallet", "address", "--account", "green-goods-deployer"],
        { cwd: CONTRACTS_ROOT, env: environment },
        "Source CREATE session unlock",
      ).trim();
      if (signer.toLowerCase() !== OPERATOR.toLowerCase()) throw new Error("Source CREATE session signer mismatch");
      for (let step = initial.count + 1; step <= plan.deployments.length; step++) {
        signal.throwIfAborted();
        await run("broadcast", step, environment);
      }
    });
  }
  return { state: "source-creates-verified", completed: plan.deployments.length, safeExecutionIncluded: false };
}
