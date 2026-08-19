import * as fs from "node:fs";
import * as os from "node:os";
import * as nodePath from "node:path";
import { Interface, ZeroAddress, getAddress } from "ethers";
import { describe, expect, it } from "vitest";

import {
  ALLOWANCE_KEY,
  MAX_PERIOD_AMOUNT,
  PERIOD_DURATION,
  ROLE_KEY,
  buildTransferConditions,
  permissionsConfigHash,
} from "./garden-roles";
import {
  type RouteObservations,
  assertNextRouteBoundary,
  assertPlanUnblocked,
  buildRouteTransactions,
  evaluateRouteReadiness,
  loadRoutesCheckpoint,
  parseArguments,
  routePermissionsHash,
} from "./garden-routes";

const EXECUTOR = "0xB8a7F3c3DfA407c45e05b7B2381233101938a84F";
const ENTRIES = [
  {
    tokenId: 0,
    garden: "0xf401f34378384713222d1d21f63359cc4E8a858a",
    safe: "0xe41a1e446644034f24a4B2E1bfB28Fd414dBc66d",
  },
  {
    tokenId: 1,
    garden: "0xF7b892886998DAe960D64a9db488336684F137A0",
    safe: "0xa23716F7B0DBBB0387Fb1274f1Ae8247670dCC37",
  },
];

describe("route boundaries", () => {
  it("binds each Garden to its own Safe, modifier, and reviewed permission hash", () => {
    const transactions = buildRouteTransactions(ENTRIES, EXECUTOR);

    expect(transactions).toHaveLength(ENTRIES.length);
    expect(transactions.map((transaction) => transaction.step)).toEqual([1, 2]);
    for (const [index, transaction] of transactions.entries()) {
      expect(transaction.garden).toEqual(getAddress(ENTRIES[index].garden));
      expect(transaction.safe).toEqual(getAddress(ENTRIES[index].safe));
      expect(transaction.to).toEqual(getAddress(EXECUTOR));
      expect(transaction.value).toBe("0");
      // Each Garden gets its own modifier; a shared one would let two Gardens spend one allowance.
      expect(transaction.modifier).not.toEqual(transactions[(index + 1) % transactions.length].modifier);
    }
  });

  it("encodes exactly the reviewed configureGardenRoute arguments", () => {
    const [transaction] = buildRouteTransactions(ENTRIES, EXECUTOR);
    const decoded = new Interface([
      "function configureGardenRoute(address garden, address safe, address rolesModifier, bytes32 roleKey, bytes32 allowanceKey, bytes32 permissionsConfigHash)",
    ]).decodeFunctionData("configureGardenRoute", transaction.data);

    expect(getAddress(decoded[0])).toEqual(getAddress(ENTRIES[0].garden));
    expect(getAddress(decoded[1])).toEqual(getAddress(ENTRIES[0].safe));
    expect(getAddress(decoded[2])).toEqual(transaction.modifier);
    expect(decoded[3]).toEqual(ROLE_KEY);
    expect(decoded[4]).toEqual(ALLOWANCE_KEY);
    expect(decoded[5]).toEqual(transaction.permissionsConfigHash);
  });

  it("re-derives the permission hash from the reviewed tree rather than trusting a plan artifact", () => {
    const [transaction] = buildRouteTransactions(ENTRIES, EXECUTOR);
    const expected = permissionsConfigHash(ENTRIES[0].safe, transaction.modifier, buildTransferConditions());

    expect(transaction.permissionsConfigHash).toEqual(expected);
    expect(routePermissionsHash(ENTRIES[0].safe, transaction.modifier)).toEqual(expected);
    // A different Safe or modifier is a different permission, so a swapped pair cannot reuse a hash.
    expect(routePermissionsHash(ENTRIES[1].safe, transaction.modifier)).not.toEqual(expected);
  });
});

describe("write-once execution boundaries", () => {
  it("binds every broadcast to one explicit boundary", () => {
    expect(parseArguments(["plan"]).broadcast).toBe(false);
    expect(parseArguments(["configure", "--broadcast", "--step", "7"])).toMatchObject({
      command: "configure",
      broadcast: true,
      step: 7,
    });
    expect(() => parseArguments(["configure"])).toThrow(/requires --broadcast/);
    expect(() => parseArguments(["configure", "--broadcast"])).toThrow(/one explicit --step/);
    expect(() => parseArguments(["plan", "--broadcast"])).toThrow(/does not accept/);
    expect(() => parseArguments(["verify", "--step", "1"])).toThrow(/does not accept/);
    expect(() => parseArguments(["deploy"])).toThrow(/plan\|verify\|configure/);
  });

  it("refuses to broadcast a plan that still reports a chain-state problem", () => {
    expect(() => assertPlanUnblocked([])).not.toThrow();
    expect(() => assertPlanUnblocked(["Garden 3: Safe has not enabled the modifier"])).toThrow(
      /Garden 3: Safe has not enabled the modifier/,
    );
  });

  it("advances one boundary at a time and never skips or repeats", () => {
    expect(assertNextRouteBoundary(1, 0)).toBe(1);
    expect(assertNextRouteBoundary(5, 4)).toBe(5);
    expect(() => assertNextRouteBoundary(3, 0)).toThrow(/next uncheckpointed boundary 1/);
    expect(() => assertNextRouteBoundary(4, 4)).toThrow(/next uncheckpointed boundary 5/);
  });
});

describe("checkpoint integrity", () => {
  const withPlan = (run: (planPath: string) => void): void => {
    const directory = fs.mkdtempSync(nodePath.join(os.tmpdir(), "garden-routes-"));
    const planPath = nodePath.join(directory, "plan.json");
    fs.writeFileSync(planPath, `${JSON.stringify({ kind: "GARDEN_ROUTES_PLAN" }, null, 2)}\n`);
    try {
      run(planPath);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };

  it("starts empty and belongs to the exact reviewed plan", () => {
    withPlan((planPath) => {
      expect(loadRoutesCheckpoint(planPath).completed).toEqual([]);

      const checkpointPath = planPath.replace(/\.json$/u, ".checkpoint.json");
      fs.writeFileSync(
        checkpointPath,
        `${JSON.stringify({ schemaVersion: 1, planHash: `0x${"11".repeat(32)}`, completed: [] })}\n`,
      );
      // Regenerating the plan after a route is written must stop the lane, not resume against new
      // addresses -- these boundaries cannot be rewritten.
      expect(() => loadRoutesCheckpoint(planPath)).toThrow(/does not belong to the exact reviewed route plan/);
    });
  });

  it("rejects a checkpoint that is not a contiguous boundary prefix", () => {
    withPlan((planPath) => {
      const { planHash } = loadRoutesCheckpoint(planPath);
      fs.writeFileSync(
        planPath.replace(/\.json$/u, ".checkpoint.json"),
        `${JSON.stringify({
          schemaVersion: 1,
          planHash,
          completed: [
            { step: 1, garden: ENTRIES[0].garden, safe: ENTRIES[0].safe, transactionHash: "0x1", blockNumber: 1 },
            { step: 3, garden: ENTRIES[1].garden, safe: ENTRIES[1].safe, transactionHash: "0x2", blockNumber: 2 },
          ],
        })}\n`,
      );
      expect(() => loadRoutesCheckpoint(planPath)).toThrow(/contiguous boundary prefix/);
    });
  });
});

describe("route readiness", () => {
  const [transaction] = buildRouteTransactions(ENTRIES, EXECUTOR);
  const finished: RouteObservations = {
    modifierDeployed: true,
    avatar: transaction.safe,
    target: transaction.safe,
    modifierOwner: transaction.safe,
    executorIsRolesMember: true,
    executorDefaultRole: ROLE_KEY,
    allowanceRefill: MAX_PERIOD_AMOUNT,
    allowancePeriod: PERIOD_DURATION,
    modifierEnabledOnSafe: true,
    executorIsSafeOwner: false,
    existingRouteSafe: ZeroAddress,
    safeAssignedToGarden: ZeroAddress,
  };

  it("passes a Garden whose ceremony is complete", () => {
    expect(evaluateRouteReadiness(transaction, finished)).toEqual([]);
  });

  it("refuses a Safe that never enabled its modifier", () => {
    // The one binding configureGardenRoute cannot see. Without it the executor would happily record
    // a route that can never execute, and routes are write-once.
    const findings = evaluateRouteReadiness(transaction, { ...finished, modifierEnabledOnSafe: false });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/Safe has not enabled the modifier/);
  });

  it("refuses every other incomplete ceremony state on its own", () => {
    const cases: Array<[Partial<RouteObservations>, RegExp]> = [
      [{ modifierDeployed: false }, /is not deployed/],
      [{ avatar: EXECUTOR }, /modifier avatar is/],
      [{ target: EXECUTOR }, /modifier target is/],
      [{ modifierOwner: EXECUTOR }, /ownership has not transferred/],
      [{ executorIsRolesMember: false }, /not a Roles member/],
      [{ executorDefaultRole: `0x${"00".repeat(32)}` }, /default role is/],
      [{ allowanceRefill: 1n }, /allowance does not match/],
      [{ allowancePeriod: 1n }, /allowance does not match/],
      [{ executorIsSafeOwner: true }, /executor is a Safe owner/],
      [{ existingRouteSafe: EXECUTOR }, /already configured/],
      [{ safeAssignedToGarden: EXECUTOR }, /already assigned/],
    ];

    for (const [override, expected] of cases) {
      const findings = evaluateRouteReadiness(transaction, { ...finished, ...override });
      expect(findings, `${JSON.stringify(override, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`).toHaveLength(
        1,
      );
      expect(findings[0]).toMatch(expected);
    }
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const findings = evaluateRouteReadiness(transaction, {
      ...finished,
      modifierEnabledOnSafe: false,
      executorIsRolesMember: false,
      executorIsSafeOwner: true,
    });

    expect(findings).toHaveLength(3);
  });

  it("names the Garden in every finding so an eighteen-Garden plan stays readable", () => {
    const findings = evaluateRouteReadiness(transaction, { ...finished, modifierEnabledOnSafe: false });

    expect(findings.every((finding) => finding.startsWith(`Garden ${transaction.tokenId}:`))).toBe(true);
  });
});
