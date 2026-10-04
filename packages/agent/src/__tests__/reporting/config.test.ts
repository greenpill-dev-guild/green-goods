import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { startReporting } from "../../runtime/reporting-startup";
import { loadReportingConfig, loadReportingProviders } from "../../services/reporting/config";

/** Reporting configuration holds only secrets; its key list is what turns reporting on. */
const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");

const keys = { AGENT_REPORTING_KEYS: `k1:${key(1)}` };

const base = { isProduction: true, dataDir: "/data" };

describe("reporting configuration", () => {
  it("loads pinned provider-only evaluation without enabling reporting or requiring wrapping keys", () => {
    const env = {
      AGENT_REPORTING_OPENAI_API_KEY: "openai-eval",
      AGENT_REPORTING_JEV_API_KEY: "jev-eval",
    };
    expect(loadReportingProviders(env).openai?.model).toBe("gpt-4.1-mini-2025-04-14");
    expect(loadReportingProviders(env).interpretation).toMatchObject({
      provider: "jev",
      model: "jev-1.13.0",
    });
    expect(loadReportingConfig(env, base)).toBeNull();
  });
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

  it("runs ceremonies on the public site unless the deployment names the beta site", () => {
    const origin = (env: Record<string, string>, isProduction = true) =>
      loadReportingConfig({ ...keys, ...env }, { ...base, isProduction })?.browserOrigin;
    expect(origin({})).toBe("https://www.greengoods.app");
    expect(origin({ AGENT_REPORTING_SITE: " " })).toBe("https://www.greengoods.app");
    expect(origin({ AGENT_REPORTING_SITE: "production" })).toBe("https://www.greengoods.app");
    expect(origin({ AGENT_REPORTING_SITE: "beta" })).toBe("https://beta.greengoods.app");
    // Outside production the Client dev server is the site, whichever one is named.
    expect(origin({}, false)).toBe("https://localhost:3001");
    expect(origin({ AGENT_REPORTING_SITE: "beta" }, false)).toBe("https://localhost:3001");
  });

  it("takes a site by name only: an address is ignored and an unknown name is refused", () => {
    const address = { ...keys, AGENT_REPORTING_BROWSER_ORIGIN: "https://beta.greengoods.app" };
    expect(loadReportingConfig(address, base)?.browserOrigin).toBe("https://www.greengoods.app");
    for (const name of ["https://beta.greengoods.app", "staging", "Beta", "constructor"]) {
      expect(() => loadReportingConfig({ ...keys, AGENT_REPORTING_SITE: name }, base)).toThrow(
        "AGENT_REPORTING_SITE must be one of: production, beta"
      );
    }
    // Without the key list reporting is off, so the site is never read.
    expect(loadReportingConfig({ AGENT_REPORTING_SITE: "staging" }, base)).toBeNull();
  });

  it("uses a model provider only when this build pins its model, whatever the environment says", () => {
    const withKeys = {
      ...keys,
      AGENT_REPORTING_OPENAI_API_KEY: "sk-live",
      AGENT_REPORTING_JEV_API_KEY: "jev-live",
      AGENT_REPORTING_OPENAI_MODEL: "unreviewed-model",
    };
    const unpinned = loadReportingConfig(withKeys, base, {
      extraction: null,
      transcription: null,
      jev: null,
    });
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

  it("uses reproducible provider versions with keys and ignores model environment overrides", () => {
    const config = loadReportingConfig(
      {
        ...keys,
        AGENT_REPORTING_OPENAI_API_KEY: "sk-test",
        AGENT_REPORTING_JEV_API_KEY: "jev-test",
        AGENT_REPORTING_OPENAI_MODEL: "floating-alias",
        AGENT_REPORTING_TRANSCRIPTION_MODEL: "floating-transcription",
        AGENT_REPORTING_JEV_MODEL: "jev-latest",
      },
      base
    );
    expect(config?.openai).toMatchObject({
      model: "gpt-4.1-mini-2025-04-14",
      transcriptionModel: "gpt-4o-mini-transcribe-2025-12-15",
    });
    expect(config?.interpretation).toMatchObject({ provider: "jev", model: "jev-1.13.0" });
    expect(loadReportingConfig(keys, base)?.openai).toBeNull();
    expect(loadReportingConfig(keys, base)?.interpretation).toEqual({ provider: "none" });
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
