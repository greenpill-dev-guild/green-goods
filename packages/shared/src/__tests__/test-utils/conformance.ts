import { describe, it } from "vitest";

export interface NamedConformanceCase {
  name: string;
}

export interface ConformanceLaw<TCase extends NamedConformanceCase> {
  name: string;
  applicable?: (testCase: TCase) => true | string;
  verify: (testCase: TCase) => void | Promise<void>;
}

/**
 * Expands the same law across every implementation case. Returning a string
 * from `applicable` records an explicit non-applicable row and its reason.
 */
export function describeConformance<TCase extends NamedConformanceCase>(
  title: string,
  cases: readonly TCase[],
  laws: readonly ConformanceLaw<TCase>[]
): void {
  describe(title, () => {
    for (const law of laws) {
      const rows = cases.map((testCase) => ({
        caseName: testCase.name,
        testCase,
        applicability: law.applicable?.(testCase) ?? true,
      }));
      const applicableRows = rows.filter((row) => row.applicability === true);
      const nonApplicableRows = rows
        .filter((row) => row.applicability !== true)
        .map((row) => ({ ...row, reason: row.applicability }));

      if (applicableRows.length > 0) {
        it.each(applicableRows)(`${law.name} — $caseName`, async ({ testCase }) => {
          await law.verify(testCase);
        });
      }

      if (nonApplicableRows.length > 0) {
        it.skip.each(nonApplicableRows)(`${law.name} — $caseName (n/a: $reason)`, () => undefined);
      }
    }
  });
}
