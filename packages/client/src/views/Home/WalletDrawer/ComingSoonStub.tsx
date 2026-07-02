import { RiTimeLine } from "@remixicon/react";
import React from "react";
import { EmptyState } from "@/components/Communication";

interface ComingSoonStubProps {
  tabName: string;
  /** One-line promise of what's coming. */
  description?: string;
  /** Icon matching the tab's own identity; defaults to a clock. */
  icon?: React.ReactNode;
}

export const ComingSoonStub: React.FC<ComingSoonStubProps> = ({ tabName, description, icon }) => (
  <div className="p-4">
    <EmptyState icon={icon ?? <RiTimeLine />} title={tabName} description={description} />
  </div>
);
