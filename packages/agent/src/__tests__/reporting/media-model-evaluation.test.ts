import { describe, expect, it, vi } from "vitest";
import type { DocumentTools } from "../../services/reporting/media/documents";
import { LocalToolError } from "../../services/reporting/media/subprocess";
import { readWorkbook, tableText } from "../../services/reporting/media/tables";
import { createMediaEvaluationCases } from "./driver/media-fixtures";
import { runMediaModelEvaluation } from "./driver/media-model-evaluation";

const env = { AGENT_REPORTING_OPENAI_API_KEY: "eval-secret-openai" };
interface ModelRequest {
  model: string;
  input: Array<{ content: Array<Record<string, string>> }>;
}
// The unit lane supplies page inspection only. Conversion is never simulated as real proof.
const tools: DocumentTools = {
  inspectPdf: async (bytes) => ({
    ok: true,
    pages: /\/Count 2\b/.test(Buffer.from(bytes).toString()) ? 2 : 1,
  }),
  convertToPdf: async () => {
    throw new LocalToolError("unavailable");
  },
};

function provider(
  options: {
    wrongPage?: boolean;
    inventedCount?: boolean;
    correctionStale?: boolean;
    formulaCell?: boolean;
    fail?: boolean;
    unexpectedModel?: boolean;
  } = {}
) {
  const outputs = [
    { value: 4 },
    null,
    { value: 4 },
    { value: 8, page: options.wrongPage ? 1 : 2, original: "8 seedlings" },
    { value: options.correctionStale ? 12 : 8, page: 2, original: "8 seedlings" },
    { value: 999, sumRange: "csv!B2:B3" },
    { value: 999, cell: "csv!B3" },
    options.formulaCell
      ? { value: 999, cell: "Planting!B4" }
      : { value: 999, sumRange: "Planting!B2:B3" },
    { value: 8, original: "8 seedlings" },
  ];
  const requests: ModelRequest[] = [];
  const fetchStub = (async (url, init) => {
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init?.body)) as ModelRequest;
    const index = requests.length;
    requests.push(body);
    if (options.fail)
      return Response.json(
        { error: "eval-secret-openai private request details" },
        { status: 429 }
      );
    const output = outputs[index];
    if (output === undefined) throw new Error("Unbounded provider calls");
    return Response.json({
      model: options.unexpectedModel ? "eval-secret-openai" : body.model,
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                observations: ["Synthetic fixture read"],
                uncertain: output ? [] : ["Count is obscured and was not recorded"],
                facts: output
                  ? [
                      {
                        field: "details.seedlings",
                        page: null,
                        cell: null,
                        sumRange: null,
                        original: null,
                        unit: "seedlings",
                        ...output,
                        ...(options.inventedCount && index === 0 ? { value: 999 } : {}),
                      },
                    ]
                  : [],
              }),
            },
          ],
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 100,
        input_tokens_details: { cached_tokens: 200 },
      },
    });
  }) as typeof fetch;
  return { fetchStub, requests };
}

describe("synthetic media model acceptance", () => {
  it("refuses missing credentials before preparing fixtures or sending provider requests", async () => {
    const call = vi.fn();
    const inspect = vi.fn();
    await expect(
      runMediaModelEvaluation({}, call as unknown as typeof fetch, {
        ...tools,
        inspectPdf: inspect,
      })
    ).rejects.toThrow("Missing provider credentials: AGENT_REPORTING_OPENAI_API_KEY");
    expect(call).not.toHaveBeenCalled();
    expect(inspect).not.toHaveBeenCalled();
  });

  it("grades nine actual adapter calls, anchors table values to cells, and records two honest Office gaps", async () => {
    const { fetchStub, requests } = provider();
    const report = await runMediaModelEvaluation(env, fetchStub, tools);
    expect(report).toMatchObject({
      dataset: "synthetic-media-v1",
      casesPlanned: 11,
      casesEvaluated: 9,
      calls: 9,
      qualityPassed: true,
      coverageComplete: false,
    });
    expect(
      report.samples.filter((sample) => sample.state === "skipped").map((sample) => sample.caseId)
    ).toEqual(["docx-converted-correction", "xlsx-converted-preview"]);
    expect(
      report.samples
        .slice(0, 9)
        .every((sample) => sample.checks?.sourceProvenance && sample.checks.noInventedTotals)
    ).toBe(true);
    expect(report.openaiEstimatedUsd).toBeCloseTo(0.0045, 8);
    expect(report.costCoverage.measuredOpenaiCalls).toBe(9);
    const content = (index: number) => requests[index]!.input[1].content;
    expect(content(0)[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(content(3)[1].file_data).toMatch(/^data:application\/pdf;base64,/);
    expect(JSON.parse(content(3)[0].text).pages).toBe(2);
    expect(content(7)[1].text).toContain("Planting!B4\t999\t(formula)");
    expect(JSON.stringify(content(7))).not.toMatch(/PRIVATE_HIDDEN_MARKER|10000/);
    expect(content(8)[1].filename).toBe("synthetic.docx");
    expect(JSON.parse(content(8)[0].text).pages).toBeNull();
    expect(JSON.stringify(report)).not.toContain("eval-secret");
  });

  it.each([
    [{ wrongPage: true }, "pdf-page-provenance", "sourceProvenance"],
    [{ inventedCount: true }, "image-visible-count", "noInventedTotals"],
    [{ correctionStale: true }, "pdf-correction", "expectedValues"],
    [{ formulaCell: true }, "xlsx-hidden-and-cached-total", "sourceProvenance"],
  ] as const)("rejects schema-valid answers with an incorrect source, total or superseded count: %s", async (options, caseId, failedCheck) => {
    const report = await runMediaModelEvaluation(env, provider(options).fetchStub, tools);
    expect(report.qualityPassed).toBe(false);
    const sample = report.samples.find((item) => item.caseId === caseId);
    expect(sample).toMatchObject({ adapterValid: true, expectationsMet: false, failure: null });
    expect(sample?.checks?.[failedCheck]).toBe(false);
    if (caseId === "image-visible-count")
      expect(sample?.diagnostics?.instructionValueFacts).toBe(1);
  });

  it("redacts failed-provider bodies and unexpected model names while retaining typed metrics", async () => {
    const failed = await runMediaModelEvaluation(env, provider({ fail: true }).fetchStub, tools);
    expect(failed).toMatchObject({ qualityPassed: false, calls: 9, openaiEstimatedUsd: null });
    expect(failed.samples.slice(0, 9).every((sample) => sample.failure === "provider_error")).toBe(
      true
    );
    const wrongModel = await runMediaModelEvaluation(
      env,
      provider({ unexpectedModel: true }).fetchStub,
      tools
    );
    expect(wrongModel.qualityPassed).toBe(false);
    expect(wrongModel.samples[0]?.returnedModel).toBe("unexpected_model");
    expect(JSON.stringify([failed, wrongModel])).not.toContain("eval-secret");
  });

  it("stops unreadable PDFs before requests and fails required coverage instead of treating them as optional", async () => {
    const { fetchStub } = provider();
    const report = await runMediaModelEvaluation(env, fetchStub, {
      ...tools,
      inspectPdf: async () => ({ ok: false, reason: "unreadable" }),
    });
    expect(report.qualityPassed).toBe(false);
    expect(report.calls).toBe(7);
    const pdfs = report.samples.filter((sample) => sample.inputFormat === "pdf");
    expect(
      pdfs.every(
        (sample) =>
          sample.state === "failed_preflight" &&
          sample.failure === "preflight_failed" &&
          sample.checks === null
      )
    ).toBe(true);
  });

  it("generates parseable XLSX fixtures whose visible model text excludes real hidden rows and sheets", async () => {
    const examples = await createMediaEvaluationCases();
    expect(new Set(examples.map((example) => example.id)).size).toBe(11);
    const xlsx = examples.find((example) => example.id === "xlsx-hidden-and-cached-total")!;
    const parsed = await readWorkbook(xlsx.bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("Workbook fixture unreadable");
    expect(parsed.table.excluded).toEqual({
      hiddenSheets: ["Hidden"],
      hiddenRows: 1,
      hiddenColumns: 0,
    });
    expect(tableText(parsed.table).text).not.toContain("PRIVATE_HIDDEN_MARKER");
    expect(parsed.table.cells.find((cell) => cell.ref === "B4")).toMatchObject({
      value: 999,
      formula: true,
    });
  });

  it("keeps generated file bytes stable when the wall clock changes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
      const first = await createMediaEvaluationCases();
      vi.setSystemTime(new Date("2026-10-03T11:00:00Z"));
      const second = await createMediaEvaluationCases();
      expect(first.map((example) => Buffer.from(example.bytes).toString("base64"))).toEqual(
        second.map((example) => Buffer.from(example.bytes).toString("base64"))
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds a selected rerun to known fixture IDs and never presents selected proof as complete coverage", async () => {
    const { fetchStub, requests } = provider();
    const selected = await runMediaModelEvaluation(env, fetchStub, tools, {
      caseIds: ["image-visible-count"],
    });
    expect(selected).toMatchObject({
      selection: ["image-visible-count"],
      casesInDataset: 11,
      casesPlanned: 1,
      calls: 1,
      qualityPassed: true,
      coverageComplete: false,
    });
    expect(requests).toHaveLength(1);
    const call = vi.fn();
    await expect(
      runMediaModelEvaluation(env, call as unknown as typeof fetch, tools, { caseIds: ["unknown"] })
    ).rejects.toThrow("Unknown media evaluation case");
    expect(call).not.toHaveBeenCalled();
  });
});
