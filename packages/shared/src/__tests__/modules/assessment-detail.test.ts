import { describe, expect, it, vi } from "vitest";
import { readAssessmentDetail } from "../../modules/assessment/assessment-detail";
import { CynefinPhase } from "../../types/domain";

const CONFIG_CID = "bafy-config";
const METRICS_CID = "bafy-metrics";

// The two files Create Assessment uploads: a config that names the metrics file
// and the evidence, and the metrics file that holds the strategy kernel.
const config = {
  assessmentType: "domain-2",
  capitals: [],
  metricsCid: METRICS_CID,
  evidenceMediaCids: ["bafy-photo", "bafy-report"],
  reportDocuments: [],
  impactAttestations: [],
  tags: [],
};
const metrics = {
  diagnosis: "Compacted soil is limiting water retention.",
  smartOutcomes: [
    { description: "Restore the north field", metric: "areaCovered", target: 20 },
    { description: "Run soil workshops", metric: "sessionsDelivered", target: 0 },
  ],
  cynefinPhase: 2,
  domain: 2,
  selectedActionUIDs: ["42161-15", "42161-12"],
  sdgTargets: [2, 13],
};

function storedFiles(files: Record<string, unknown>) {
  return vi.fn(async (cid: string, _options?: { signal?: AbortSignal }) => {
    if (!(cid in files)) throw new Error(`gateway could not read ${cid}`);
    return files[cid];
  });
}

describe("readAssessmentDetail", () => {
  it("follows the config to the metrics file and returns the strategy kernel with the evidence", async () => {
    const readJson = storedFiles({ [CONFIG_CID]: config, [METRICS_CID]: metrics });

    await expect(readAssessmentDetail(CONFIG_CID, { readJson })).resolves.toEqual({
      diagnosis: "Compacted soil is limiting water retention.",
      smartOutcomes: metrics.smartOutcomes,
      cynefinPhase: CynefinPhase.COMPLEX,
      selectedActionUIDs: ["42161-15", "42161-12"],
      sdgTargets: [2, 13],
      evidenceCids: ["bafy-photo", "bafy-report"],
    });
    expect(readJson.mock.calls.map(([cid]) => cid)).toEqual([CONFIG_CID, METRICS_CID]);
  });

  // A failed read is not an empty assessment: the reader must be told the detail
  // could not be loaded, not shown "no outcomes recorded".
  it.each([
    ["the config cannot be read", {}],
    ["the metrics file cannot be read", { [CONFIG_CID]: config }],
    ["the config is not an object", { [CONFIG_CID]: "not json", [METRICS_CID]: metrics }],
    ["the config names no metrics file", { [CONFIG_CID]: { ...config, metricsCid: "" } }],
    ["the metrics file is not an object", { [CONFIG_CID]: config, [METRICS_CID]: [metrics] }],
  ])("rejects when %s", async (_label, files) => {
    await expect(
      readAssessmentDetail(CONFIG_CID, { readJson: storedFiles(files) })
    ).rejects.toThrow();
  });

  it("keeps what is well formed in a kernel that is partly malformed", async () => {
    const readJson = storedFiles({
      [CONFIG_CID]: { ...config, evidenceMediaCids: ["bafy-photo", 7, ""] },
      [METRICS_CID]: {
        diagnosis: 42,
        smartOutcomes: [
          { description: "Plant the hedge", metric: "treesPlanted", target: "120" },
          { description: "", metric: "", target: 5 },
          "not an outcome",
        ],
        cynefinPhase: 9,
        selectedActionUIDs: ["42161-3", null],
        sdgTargets: [15, 15, 0, 18, "4"],
      },
    });

    await expect(readAssessmentDetail(CONFIG_CID, { readJson })).resolves.toEqual({
      diagnosis: "",
      smartOutcomes: [{ description: "Plant the hedge", metric: "treesPlanted", target: 120 }],
      // A value outside the four phases names no phase rather than a wrong one.
      cynefinPhase: null,
      selectedActionUIDs: ["42161-3"],
      sdgTargets: [15, 4],
      evidenceCids: ["bafy-photo"],
    });
  });

  // Number(true) is 1 and Number([7]) is 7. A file that holds either where a
  // number belongs recorded no number, and must not read as a target or an SDG.
  it("reads only a number, or a string that spells one, as a number", async () => {
    const readJson = storedFiles({
      [CONFIG_CID]: config,
      [METRICS_CID]: {
        ...metrics,
        smartOutcomes: [
          { description: "Restore the north field", metric: "areaCovered", target: true },
          { description: "Run soil workshops", metric: "sessionsDelivered", target: [6] },
          { description: "Plant the hedge", metric: "treesPlanted", target: " 120 " },
        ],
        sdgTargets: [true, [7], null, "", "13", 2],
      },
    });

    const read = await readAssessmentDetail(CONFIG_CID, { readJson });

    expect(read.smartOutcomes.map((outcome) => outcome.target)).toEqual([0, 0, 120]);
    expect(read.sdgTargets).toEqual([13, 2]);
  });

  it("hands the caller's abort signal to both reads", async () => {
    const readJson = storedFiles({ [CONFIG_CID]: config, [METRICS_CID]: metrics });
    const { signal } = new AbortController();

    await readAssessmentDetail(CONFIG_CID, { readJson, signal });

    expect(readJson.mock.calls.map(([, options]) => options?.signal)).toEqual([signal, signal]);
  });

  // A gateway asked for a file nobody pins does not answer "not found", it hangs.
  // Left to the half minute a media file is allowed, each retry holds the reader
  // on a placeholder for that long before the detail is called unavailable.
  it("gives up on a gateway that never answers within eight seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("The read was aborted", "AbortError"))
            );
          })
      )
    );
    try {
      const outcome = readAssessmentDetail(
        "bafkreie52tyl2zkjd27vvhrdvsyt4fahrnvknmxe7k465z73ccbg3i26mq"
      ).then(
        () => "read",
        (error: Error) => error.message
      );

      await vi.advanceTimersByTimeAsync(8_000);

      await expect(Promise.race([outcome, Promise.resolve("still waiting")])).resolves.toMatch(
        /timed out/
      );
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
