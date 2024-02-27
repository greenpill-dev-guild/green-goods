// Add Types Here
declare module "*.svg" {
  import * as React from "react";

  export const RC: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;

  const src: string;
  export default src;
}
