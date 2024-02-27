import React from "react";

import { ExploreDataProps } from "../../hooks/views/useExplore";

interface ExploreProps extends ExploreDataProps {}

const Explore: React.FC<ExploreProps> = ({}) => {
  return (
    <section className="flex flex-col w-full h-full items-center gap-3 px-6 text-center"></section>
  );
};

export default Explore;
