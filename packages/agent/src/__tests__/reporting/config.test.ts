import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { startReporting } from "../../runtime/reporting-startup";
import { loadReportingConfig } from "../../services/reporting/config";

/** Reporting configuration holds only secrets; its key list is what turns reporting on. */
const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");

const keys = { AGENT_REPORTING_KEYS: `k1:${key(1)}` };

const base = { isProduction: true, dataDir: "/data" };

describe("reporting configuration", () => {
  it("keeps reporting data beside the Agent database, on the Agent's volume", () => {
    const config = loadReportingConfig(
      { ...keys, AGENT_REPORTING_DB_PATH: "data/elsewhere.db" },
      base
    );
    expect(config?.dbPath).toBe("/data/reporting.db");
    expect(config?.mediaDir).toBe("/data/reporting-media");
  });

  it("stays off without its key list, whatever else is set", () => {
    expect(loadReportingConfig({}, base)).toBeNull();
    expect(
      loadReportingConfig(
        { AGENT_REPORTING_ENABLED: "true", AGENT_REPORTING_TRANSPORT: "whatsapp" },
        base
      )
    ).toBeNull();
    expect(loadReportingConfig(keys, base)?.keys).toBe(keys.AGENT_REPORTING_KEYS);
  });

  it("links to the installed app's origin in production and the local Client elsewhere", () => {
    const beta = { ...keys, AGENT_REPORTING_BROWSER_ORIGIN: "https://beta.greengoods.app" };
    expect(loadReportingConfig(beta, base)?.browserOrigin).toBe("https://www.greengoods.app");
    expect(loadReportingConfig(keys, { ...base, isProduction: false })?.browserOrigin).toBe(
      "https://localhost:3001"
    );
  });

  it("uses a model provider only when this build pins its model, whatever the environment says", () => {
    const withKeys = {
      ...keys,
      AGENT_REPORTING_OPENAI_API_KEY: "sk-live",
      AGENT_REPORTING_JEV_API_KEY: "jev-live",
      AGENT_REPORTING_OPENAI_MODEL: "unreviewed-model",
    };
    const unpinned = loadReportingConfig(withKeys, base);
    expect(unpinned?.openai).toBeNull();
    expect(unpinned?.interpretation).toEqual({ provider: "none" });

    const pinned = loadReportingConfig(withKeys, base, {
      extraction: "reviewed-model",
      transcription: null,
      jev: "reviewed-jev",
    });
    expect(pinned?.openai).toEqual({
      apiKey: "sk-live",
      baseUrl: "https://api.openai.com/v1",
      model: "reviewed-model",
      transcriptionModel: null,
    });
    expect(pinned?.interpretation).toMatchObject({ provider: "jev", model: "reviewed-jev" });
  });

  it("does not start reporting before a chat channel is available", () => {
    expect(
      startReporting({
        env: { ...keys, AGENT_REPORTING_TRANSPORT: "whatsapp" },
        chain: arbitrum,
        chainId: 42161,
        rpcUrl: "https://rpc.test",
        isProduction: true,
        dataDir: "/data",
      })
    ).toBeNull();
  });
});
