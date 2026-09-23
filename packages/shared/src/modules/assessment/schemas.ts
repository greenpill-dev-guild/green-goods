import type { EASConfig } from "../../config/blockchain";
import { isZeroBytes32 } from "../../utils/blockchain/bytes";

/** Keep historical schemas when adding a version; newest registered schema comes first. */
export function getAssessmentSchemas(config: Pick<EASConfig, "ASSESSMENT" | "ASSESSMENT_V3">) {
  const schemas = [
    { ...config.ASSESSMENT_V3, version: 3 as const },
    { ...config.ASSESSMENT, version: 2 as const },
  ];
  return schemas.filter(
    (schema, index) =>
      !isZeroBytes32(schema.uid) &&
      schemas.findIndex((candidate) => candidate.uid === schema.uid) === index
  );
}
