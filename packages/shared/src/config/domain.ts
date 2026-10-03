import type { ComponentType } from "react";
import { RiBookOpenLine, RiPlantLine, RiRecycleLine, RiSunLine } from "@remixicon/react";
import { Domain } from "../types/domain";

export interface DomainStyle {
  icon: ComponentType<{ className?: string }>;
  labelId: string;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
  gradient: {
    from: string;
    to: string;
  };
}

export const DOMAIN_CONFIG: Record<Domain, DomainStyle> = {
  [Domain.SOLAR]: {
    icon: RiSunLine,
    labelId: "app.domain.tab.solar",
    colors: {
      bg: "bg-domain-solar-soft",
      text: "text-domain-solar",
      border: "border-domain-solar/30",
    },
    gradient: {
      from: "from-domain-solar-soft",
      to: "to-domain-solar-soft",
    },
  },
  [Domain.AGRO]: {
    icon: RiPlantLine,
    labelId: "app.domain.tab.agro",
    colors: {
      bg: "bg-domain-agro-soft",
      text: "text-domain-agro",
      border: "border-domain-agro/30",
    },
    gradient: {
      from: "from-domain-agro-soft",
      to: "to-domain-agro-soft",
    },
  },
  [Domain.EDU]: {
    icon: RiBookOpenLine,
    labelId: "app.domain.tab.education",
    colors: {
      bg: "bg-domain-education-soft",
      text: "text-domain-education",
      border: "border-domain-education/30",
    },
    gradient: {
      from: "from-domain-education-soft",
      to: "to-domain-education-soft",
    },
  },
  [Domain.WASTE]: {
    icon: RiRecycleLine,
    labelId: "app.domain.tab.waste",
    colors: {
      bg: "bg-domain-waste-soft",
      text: "text-domain-waste",
      border: "border-domain-waste/30",
    },
    gradient: {
      from: "from-domain-waste-soft",
      to: "to-domain-waste-soft",
    },
  },
};

/** A measure an assessment's outcome can be counted in, with the copy that names it and its unit. */
export interface DomainMetric {
  /** Stored in every assessment that uses the metric, so a key is never renamed. */
  key: string;
  labelId: string;
  unitId: string;
}

/**
 * The metrics each domain offers for an assessment's SMART outcomes. One key
 * can mean different things in two domains, so a metric is looked up within
 * the assessment's own domain.
 */
export const DOMAIN_METRICS: Record<Domain, DomainMetric[]> = {
  [Domain.SOLAR]: [
    {
      key: "kwhGenerated",
      labelId: "app.admin.assessment.strategyKernel.metric.energyGenerated",
      unitId: "app.admin.assessment.strategyKernel.unit.kwh",
    },
    {
      key: "panelsInstalled",
      labelId: "app.admin.assessment.strategyKernel.metric.panelsInstalled",
      unitId: "app.admin.assessment.strategyKernel.unit.panels",
    },
    {
      key: "hubsOnboarded",
      labelId: "app.admin.assessment.strategyKernel.metric.hubsOnboarded",
      unitId: "app.admin.assessment.strategyKernel.unit.hubs",
    },
    {
      key: "batteryCapacityKwh",
      labelId: "app.admin.assessment.strategyKernel.metric.batteryCapacity",
      unitId: "app.admin.assessment.strategyKernel.unit.kwh",
    },
    {
      key: "householdsServed",
      labelId: "app.admin.assessment.strategyKernel.metric.householdsServed",
      unitId: "app.admin.assessment.strategyKernel.unit.households",
    },
  ],
  [Domain.AGRO]: [
    {
      key: "treesPlanted",
      labelId: "app.admin.assessment.strategyKernel.metric.treesPlanted",
      unitId: "app.admin.assessment.strategyKernel.unit.trees",
    },
    {
      key: "areaCoveredHa",
      labelId: "app.admin.assessment.strategyKernel.metric.areaCovered",
      unitId: "app.admin.assessment.strategyKernel.unit.ha",
    },
    {
      key: "yieldKg",
      labelId: "app.admin.assessment.strategyKernel.metric.harvestYield",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "speciesCount",
      labelId: "app.admin.assessment.strategyKernel.metric.speciesDiversity",
      unitId: "app.admin.assessment.strategyKernel.unit.species",
    },
    {
      key: "waterUsageLiters",
      labelId: "app.admin.assessment.strategyKernel.metric.waterUsage",
      unitId: "app.admin.assessment.strategyKernel.unit.liters",
    },
  ],
  [Domain.EDU]: [
    {
      key: "participantsCount",
      labelId: "app.admin.assessment.strategyKernel.metric.participants",
      unitId: "app.admin.assessment.strategyKernel.unit.people",
    },
    {
      key: "sessionsDelivered",
      labelId: "app.admin.assessment.strategyKernel.metric.sessionsDelivered",
      unitId: "app.admin.assessment.strategyKernel.unit.sessions",
    },
    {
      key: "hoursDelivered",
      labelId: "app.admin.assessment.strategyKernel.metric.hoursDelivered",
      unitId: "app.admin.assessment.strategyKernel.unit.hours",
    },
    {
      key: "materialsDistributed",
      labelId: "app.admin.assessment.strategyKernel.metric.materialsDistributed",
      unitId: "app.admin.assessment.strategyKernel.unit.items",
    },
    {
      key: "completionRate",
      labelId: "app.admin.assessment.strategyKernel.metric.completionRate",
      unitId: "app.admin.assessment.strategyKernel.unit.percent",
    },
  ],
  [Domain.WASTE]: [
    {
      key: "wasteCollectedKg",
      labelId: "app.admin.assessment.strategyKernel.metric.wasteCollected",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "areaCleanedM2",
      labelId: "app.admin.assessment.strategyKernel.metric.areaCleaned",
      unitId: "app.admin.assessment.strategyKernel.unit.m2",
    },
    {
      key: "recycledKg",
      labelId: "app.admin.assessment.strategyKernel.metric.materialRecycled",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "compostKg",
      labelId: "app.admin.assessment.strategyKernel.metric.compostProduced",
      unitId: "app.admin.assessment.strategyKernel.unit.kg",
    },
    {
      key: "participantsCount",
      labelId: "app.admin.assessment.strategyKernel.metric.volunteers",
      unitId: "app.admin.assessment.strategyKernel.unit.people",
    },
  ],
};

/** The metric an outcome names, within its assessment's domain, or undefined when the domain has none by that key. */
export function findDomainMetric(domain: number, key: string): DomainMetric | undefined {
  return DOMAIN_METRICS[domain as Domain]?.find((metric) => metric.key === key);
}
