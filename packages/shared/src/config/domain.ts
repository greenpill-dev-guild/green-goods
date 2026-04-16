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
      bg: "bg-warning-lighter",
      text: "text-warning-dark",
      border: "border-warning-light",
    },
    gradient: {
      from: "from-yellow-100",
      to: "to-yellow-50",
    },
  },
  [Domain.AGRO]: {
    icon: RiPlantLine,
    labelId: "app.domain.tab.agro",
    colors: {
      bg: "bg-success-lighter",
      text: "text-success-dark",
      border: "border-success-light",
    },
    gradient: {
      from: "from-green-100",
      to: "to-green-50",
    },
  },
  [Domain.EDU]: {
    icon: RiBookOpenLine,
    labelId: "app.domain.tab.education",
    colors: {
      bg: "bg-information-lighter",
      text: "text-information-dark",
      border: "border-information-light",
    },
    gradient: {
      from: "from-blue-100",
      to: "to-blue-50",
    },
  },
  [Domain.WASTE]: {
    icon: RiRecycleLine,
    labelId: "app.domain.tab.waste",
    colors: {
      bg: "bg-warning-lighter",
      text: "text-warning-dark",
      border: "border-warning-light",
    },
    gradient: {
      from: "from-orange-100",
      to: "to-orange-50",
    },
  },
};
