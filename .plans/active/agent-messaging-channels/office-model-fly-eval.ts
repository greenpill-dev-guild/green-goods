import { runMediaModelEvaluation } from "../../../packages/agent/src/__tests__/reporting/driver/media-model-evaluation";

// Synthetic evidence only. The provider key is read in memory and never included in the result.
const report = await runMediaModelEvaluation(process.env, fetch, undefined, {
  caseIds: ["docx-converted-correction", "xlsx-converted-preview"],
});
console.log(JSON.stringify({ check: "office-model-evaluation", ...report }));
process.exitCode = report.qualityPassed && report.casesEvaluated === 2 ? 0 : 1;
