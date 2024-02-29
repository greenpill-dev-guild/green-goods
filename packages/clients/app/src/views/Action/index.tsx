import React from "react";

import { ActionDataProps } from "../../hooks/views/useAction";

interface ActionProps extends ActionDataProps {}

const Action: React.FC<ActionProps> = ({}) => {
  return (
    <section className="flex flex-col w-full h-full items-center gap-3 px-6 text-center"></section>
  );
};

export default Action;
