import assert from "node:assert/strict";
import test from "node:test";

import { formatTestChurnSummary, summarizeTestChurn } from "./summarize-test-churn.mjs";

test("summarizes source/test line churn and added/deleted files without a quota", () => {
  const numstat = [
    "5\t0\tpackages/shared/src/hooks/useExample.ts",
    "2\t1\tpackages/shared/src/hooks/useAnother.ts",
    "3\t4\tpackages/shared/src/hooks/useAnother.test.ts",
    "0\t7\tpackages/client/src/__tests__/old.test.tsx",
    "9\t0\tdocs/docs/intro.md",
  ].join("\0") + "\0";
  const nameStatus = [
    "A", "packages/shared/src/hooks/useExample.ts",
    "M", "packages/shared/src/hooks/useAnother.ts",
    "M", "packages/shared/src/hooks/useAnother.test.ts",
    "D", "packages/client/src/__tests__/old.test.tsx",
    "A", "docs/docs/intro.md",
  ].join("\0") + "\0";

  const result = summarizeTestChurn(numstat, nameStatus);
  assert.deepEqual(result.source, { added: 7, deleted: 1, filesAdded: 1, filesDeleted: 0 });
  assert.deepEqual(result.test, { added: 3, deleted: 11, filesAdded: 0, filesDeleted: 1 });
  assert.deepEqual(result.other, { filesAdded: 1, filesDeleted: 0 });
  assert.match(formatTestChurnSummary(result), /Test\/source changed-line ratio: 1\.75/);
  assert.doesNotMatch(formatTestChurnSummary(result), /threshold|fail/i);
});

test("zero-source and binary changes produce an honest unavailable ratio", () => {
  const result = summarizeTestChurn(
    "2\t0\tpackages/admin/src/views/Page.test.tsx\0-\t-\tpackages/shared/src/logo.png\0",
    "A\0packages/admin/src/views/Page.test.tsx\0A\0packages/shared/src/logo.png\0",
  );
  assert.deepEqual(result.source, { added: 0, deleted: 0, filesAdded: 0, filesDeleted: 0 });
  assert.deepEqual(result.test, { added: 2, deleted: 0, filesAdded: 1, filesDeleted: 0 });
  assert.match(formatTestChurnSummary(result), /Test\/source changed-line ratio: n\/a \(no source lines changed; 2 test lines changed\)/);
});
