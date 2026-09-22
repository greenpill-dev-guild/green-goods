import { afterEach, describe, expect, it, vi } from "vitest";
import { getPimlicoSponsorshipPolicyId } from "../../config/pimlico";

afterEach(() => vi.unstubAllEnvs());

describe("chain-specific sponsorship policies", () => {
  it.each([
    undefined,
    "",
    "   ",
  ])("gives Celo the same built-in general policy as Arbitrum when nothing is configured (%s)", (value) => {
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", value);
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", undefined);
    expect(getPimlicoSponsorshipPolicyId(42220)).toBe(getPimlicoSponsorshipPolicyId(42161));
    expect(getPimlicoSponsorshipPolicyId(42220)).toBe("sp_next_monster_badoon");
  });

  it("uses the general policy for Celo when no override is configured", () => {
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", undefined);
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", "general-policy");
    expect(getPimlicoSponsorshipPolicyId(42220)).toBe("general-policy");
    expect(getPimlicoSponsorshipPolicyId(42161)).toBe("general-policy");
  });

  it("prefers Celo's explicit override and preserves the primary policy", () => {
    vi.stubEnv("VITE_PIMLICO_CELO_SPONSORSHIP_POLICY_ID", "celo-policy");
    vi.stubEnv("VITE_PIMLICO_SPONSORSHIP_POLICY_ID", "arbitrum-policy");
    expect(getPimlicoSponsorshipPolicyId(42220)).toBe("celo-policy");
    expect(getPimlicoSponsorshipPolicyId(42161)).toBe("arbitrum-policy");
  });
});
