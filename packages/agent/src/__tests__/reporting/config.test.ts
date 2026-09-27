import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { startReporting } from "../../runtime/reporting-startup";
import { loadReportingConfig, ReportingConfigError } from "../../services/reporting/config";

/** Reporting configuration fails closed and starts every risky capability off. */
const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");

const complete = {
  AGENT_REPORTING_ENABLED: "true",
  AGENT_REPORTING_ENCRYPTION_KEYS: `k1:${key(1)}`,
  AGENT_REPORTING_ENCRYPTION_KEY_VERSION: "k1",
  AGENT_REPORTING_LOOKUP_KEYS: `h1:${key(2)}`,
  AGENT_REPORTING_LOOKUP_KEY_VERSION: "h1",
  AGENT_REPORTING_BROWSER_ORIGIN: "https://greengoods.app",
  AGENT_REPORTING_GARDENS:
    "tas|0x00000000000000000000000000000000000000A1|TAS;aiyeloja|0x00000000000000000000000000000000000000B2|Aiyeloja Family Garden",
};

const base = { chainId: 42161, isProduction: true };

describe("reporting configuration", () => {
  it("stays off unless explicitly enabled", () => {
    expect(loadReportingConfig({}, base)).toBeNull();
    expect(loadReportingConfig({ AGENT_REPORTING_ENABLED: "yes" }, base)).toBeNull();
  });

  it("names every missing required setting", () => {
    expect(() => loadReportingConfig({ AGENT_REPORTING_ENABLED: "true" }, base)).toThrow(
      /AGENT_REPORTING_ENCRYPTION_KEYS.*AGENT_REPORTING_GARDENS/
    );
  });

  it("starts model processing and publication paused, with gardens on the default chain", () => {
    const config = loadReportingConfig(complete, base);
    expect(config?.initialControls).toEqual({
      intake: false,
      model_processing: false,
      publication: false,
      outbound_messages: true,
    });
    expect(config?.gardens).toEqual([
      {
        key: "tas",
        chainId: 42161,
        address: "0x00000000000000000000000000000000000000a1",
        label: "TAS",
      },
      {
        key: "aiyeloja",
        chainId: 42161,
        address: "0x00000000000000000000000000000000000000b2",
        label: "Aiyeloja Family Garden",
      },
    ]);
    expect({
      voice: config?.voiceEnabled,
      documents: config?.documentsEnabled,
      conversion: config?.conversionEnabled,
    }).toEqual({
      voice: false,
      documents: false,
      conversion: false,
    });
  });

  it("requires an exact https origin and never a loopback origin in production", () => {
    for (const origin of [
      "https://greengoods.app/agent",
      "http://greengoods.app",
      "greengoods.app",
    ]) {
      expect(() =>
        loadReportingConfig({ ...complete, AGENT_REPORTING_BROWSER_ORIGIN: origin }, base)
      ).toThrow(ReportingConfigError);
    }
    const loopback = { ...complete, AGENT_REPORTING_BROWSER_ORIGIN: "http://127.0.0.1:8787" };
    expect(() => loadReportingConfig(loopback, base)).toThrow(ReportingConfigError);
    expect(loadReportingConfig(loopback, { ...base, isProduction: false })?.browserOrigin).toBe(
      "http://127.0.0.1:8787"
    );
  });

  it("refuses an OpenAI key without an explicitly chosen model and malformed gardens", () => {
    expect(() =>
      loadReportingConfig({ ...complete, AGENT_REPORTING_OPENAI_API_KEY: "sk-live" }, base)
    ).toThrow(/AGENT_REPORTING_OPENAI_MODEL/);
    expect(() =>
      loadReportingConfig({ ...complete, AGENT_REPORTING_GARDENS: "tas|not-an-address|TAS" }, base)
    ).toThrow(ReportingConfigError);
  });

  it("does not start reporting without a transport adapter", () => {
    expect(
      startReporting({
        env: { ...complete, AGENT_REPORTING_TRANSPORT: "whatsapp" },
        chain: arbitrum,
        chainId: 42161,
        rpcUrl: "https://rpc.test",
        isProduction: true,
      })
    ).toBeNull();
  });
});
