import { describe, expect, it } from "vitest";
import {
  agentMessage,
  agentRateLimitMessage,
  formatAgentWaitTime,
  normalizeAgentLocale,
} from "../i18n";

describe("agent i18n", () => {
  it("normalizes regional Spanish and Portuguese locales", () => {
    expect(normalizeAgentLocale("es-MX")).toBe("es");
    expect(normalizeAgentLocale("pt-BR")).toBe("pt");
    expect(normalizeAgentLocale("fr-FR")).toBe("en");
  });

  it("keeps default English copy stable", () => {
    expect(agentMessage(undefined, "common.startFirst")).toBe(
      "Please run /start first to create your wallet."
    );
  });

  it("returns localized handler and rate-limit copy", () => {
    expect(agentMessage("es", "common.startFirst")).toContain("Ejecuta /start");
    expect(agentMessage("pt-BR", "common.startFirst")).toContain("Execute /start");
    expect(agentRateLimitMessage("es", "wallet")).toContain("billetera");
    expect(agentRateLimitMessage("pt", "wallet")).toContain("carteira");
  });

  it("formats localized wait times", () => {
    expect(formatAgentWaitTime("es", 1000)).toBe("1 segundo");
    expect(formatAgentWaitTime("pt", 120000)).toBe("2 minutos");
  });
});
