import { useMemo } from "react";

import { useGardenAssessments } from "@/hooks/useGardenAssessments";
import type { Garden } from "@/types/garden";

export interface AssessmentSummary {
  averageCarbonTonStock: number | null;
  lastAssessmentDate: Date | null;
  pendingAssessments: number;
  totalAssessments: number;
}

interface UseAssessmentSummaryOptions {
  limit?: number;
}

export function useAssessmentSummary(
  gardens: Garden[],
  { limit = 250 }: UseAssessmentSummaryOptions = {}
) {
  const {
    data: assessments = [],
    isLoading,
    error,
    refetch,
  } = useGardenAssessments(undefined, limit);

  const summary = useMemo<AssessmentSummary>(() => {
    if (!assessments.length) {
      return {
        averageCarbonTonStock: null,
        lastAssessmentDate: null,
        pendingAssessments: gardens.length,
        totalAssessments: 0,
      };
    }

    const stockValues = assessments
      .map((attestation) => attestation.parsed.carbonTonStock)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const averageCarbonTonStock = stockValues.length
      ? Number((stockValues.reduce((sum, value) => sum + value, 0) / stockValues.length).toFixed(2))
      : null;

    const lastAssessment = assessments.reduce((latest, attestation) => {
      return attestation.time > latest ? attestation.time : latest;
    }, 0);

    const assessedGardenRecipients = new Set(
      assessments.map((attestation) => attestation.recipient.toLowerCase())
    );

    const pendingAssessments = gardens.filter((garden) => {
      const key = (garden.id || garden.tokenAddress || "").toLowerCase();
      return key ? !assessedGardenRecipients.has(key) : true;
    }).length;

    return {
      averageCarbonTonStock,
      lastAssessmentDate: lastAssessment ? new Date(lastAssessment * 1000) : null,
      pendingAssessments,
      totalAssessments: assessments.length,
    };
  }, [assessments, gardens]);

  return {
    summary,
    isLoading,
    error,
    refetch,
  };
}
