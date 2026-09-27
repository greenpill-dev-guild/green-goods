import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { startReporting } from "../../runtime/reporting-startup";
import { loadReportingConfig, ReportingConfigError } from "../../services/reporting/config";

/** Reporting configuration fails closed; only a named transport turns it on. */
const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");

const complete = {
  AGENT_REPORTING_TRANSPORT: "whatsapp",
  AGENT_REPORTING_KEYS: `k1:${key(1)}`,
  AGENT_REPORTING_BROWSER_ORIGIN: "https://greengoods.app",
  AGENT_REPORTING_GARDENS:
    "tas|0x00000000000000000000000000000000000000A1|TAS;aiyeloja|0x00000000000000000000000000000000000000B2|Aiyeloja Family Garden",
};

const base = { chainId: 42161, isProduction: true, dataDir: "/data" };

describe("reporting configuration", () => {
  it("keeps reporting data beside the Agent database, on the Agent's volume", () => {
    const loaded = loadReportingConfig(
      { ...complete, AGENT_REPORTING_DB_PATH: "data/elsewhere.db" },
      base
    );
    expect(loaded?.config.dbPath).toBe("/data/reporting.db");
    expect(loaded?.config.mediaDir).toBe("/data/reporting-media");
  });

  it("stays off unless a transport is named", () => {
    expect(loadReportingConfig({}, base)).toBeNull();
    expect(loadReportingConfig({ AGENT_REPORTING_TRANSPORT: " " }, base)).toBeNull();
    expect(loadReportingConfig({ AGENT_REPORTING_ENABLED: "true" }, base)).toBeNull();
    expect(loadReportingConfig(complete, base)?.transport).toBe("whatsapp");
  });

  it("names every missing required setting", () => {
    expect(() => loadReportingConfig({ AGENT_REPORTING_TRANSPORT: "whatsapp" }, base)).toThrow(
      /AGENT_REPORTING_KEYS.*AGENT_REPORTING_BROWSER_ORIGIN.*AGENT_REPORTING_GARDENS/
    );
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
    expect(
      loadReportingConfig(loopback, { ...base, isProduction: false })?.config.browserOrigin
    ).toBe("http://127.0.0.1:8787");
  });

  it("refuses malformed gardens", () => {
    expect(() =>
      loadReportingConfig({ ...complete, AGENT_REPORTING_GARDENS: "tas|not-an-address|TAS" }, base)
    ).toThrow(ReportingConfigError);
  });

  it("uses a model provider only when this build pins its model, whatever the environment says", () => {
    const keys = {
      ...complete,
      AGENT_REPORTING_OPENAI_API_KEY: "sk-live",
      AGENT_REPORTING_JEV_API_KEY: "jev-live",
      AGENT_REPORTING_OPENAI_MODEL: "unreviewed-model",
    };
    const unpinned = loadReportingConfig(keys, base)?.config;
    expect(unpinned?.openai).toBeNull();
    expect(unpinned?.interpretation).toEqual({ provider: "none" });

    const pinned = loadReportingConfig(keys, base, {
      extraction: "reviewed-model",
      transcription: null,
      jev: "reviewed-jev",
    })?.config;
    expect(pinned?.openai).toEqual({
      apiKey: "sk-live",
      baseUrl: "https://api.openai.com/v1",
      model: "reviewed-model",
      transcriptionModel: null,
    });
    expect(pinned?.interpretation).toMatchObject({ provider: "jev", model: "reviewed-jev" });
  });

  it("does not start reporting without a transport adapter", () => {
    expect(
      startReporting({
        env: complete,
        chain: arbitrum,
        chainId: 42161,
        rpcUrl: "https://rpc.test",
        isProduction: true,
        dataDir: "/data",
      })
    ).toBeNull();
  });
});
