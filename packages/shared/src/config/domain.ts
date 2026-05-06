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
