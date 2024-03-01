import React from "react";

import { ContributeDataProps } from "../../hooks/views/useContribute";

interface ContributeProps extends ContributeDataProps {}

const Contribute: React.FC<ContributeProps> = ({}) => {
  return (
    <section className="flex flex-col w-full h-full items-center gap-3 px-6 text-center"></section>
  );
};

export default Contribute;
