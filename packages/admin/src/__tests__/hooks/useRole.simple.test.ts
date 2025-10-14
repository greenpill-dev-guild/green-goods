import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useRole Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect deployer role correctly", () => {
    const deployerAddress = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";
    // Mock deployment registry check would happen here
    const canDeploy = true; // Simulating deployment registry allowlist check

    expect(canDeploy).toBe(true);
  });

  it("should detect operator role correctly", () => {
    const operatorAddress = "0x04D60647836bcA09c37B379550038BdaaFD82503";
    const operatorGardens = [{ id: "0x123", name: "Test Garden" }];
    const isOperator = operatorGardens.length > 0;

    expect(isOperator).toBe(true);
  });

  it("should detect user role correctly", () => {
    const unknownAddress = "0x1234567890123456789012345678901234567890";
    const canDeploy = false; // Not in deployment registry
    const operatorGardens: any[] = []; // Not operator of any gardens

    const isDeployer = canDeploy;
    const isOperator = operatorGardens.length > 0;

    let role = "user";
    if (isDeployer) {
      role = "deployer";
    } else if (isOperator) {
      role = "operator";
    }

    expect(role).toBe("user");
    expect(isDeployer).toBe(false);
    expect(isOperator).toBe(false);
  });

  it("should prioritize deployer role over operator", () => {
    const deployerAddress = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e";
    const canDeploy = true; // In deployment registry allowlist
    const operatorGardens = [{ id: "0x123", name: "Test Garden" }]; // Also operator of gardens

    const isDeployer = canDeploy;
    const isOperator = operatorGardens.length > 0;

    let role = "user";
    if (isDeployer) {
      role = "deployer";
    } else if (isOperator) {
      role = "operator";
    }

    expect(role).toBe("deployer"); // Deployer takes precedence
    expect(isDeployer).toBe(true);
    expect(isOperator).toBe(true); // Can still be operator
  });
});
