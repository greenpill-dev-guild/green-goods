import assert from "node:assert/strict";
import {test} from "node:test";
import {formatConfidenceBandData} from "./RevenueProjectionChart";

test("formats confidence-band years as chart labels", () => {
  const data = formatConfidenceBandData([
    {year: 1, p10: 100, p25: 200, p50: 300, p75: 400, p90: 500},
    {year: 2, p10: 200, p25: 300, p50: 400, p75: 500, p90: 600},
  ]);

  assert.deepEqual(data, [
    {year: "Y1", p10: 100, p25: 200, p50: 300, p75: 400, p90: 500},
    {year: "Y2", p10: 200, p25: 300, p50: 400, p75: 500, p90: 600},
  ]);
});
