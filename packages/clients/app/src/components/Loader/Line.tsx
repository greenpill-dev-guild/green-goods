import React from "react";
import { css } from "@emotion/react";
import { a, config, useSpring } from "@react-spring/web";

export const LineLoader: React.FC = () => {
  const spring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { ...config.default, clamp: true },
  });

  return (
    <a.span
      // className="relative h-12 w-12"
      style={spring}
      css={css`
        &,
        &:before,
        &:after {
          border-radius: 50%;
          width: 2.5em;
          height: 2.5em;
          animation-fill-mode: both;
          animation: bblFadInOut 1.8s infinite ease-in-out;
        }

        color: #fff;
        font-size: 7px;
        position: relative;
        text-indent: -9999em;
        transform: translateZ(0);
        animation-delay: -0.16s;

        &:before,
        &:after {
          content: "";
          position: absolute;
          top: 0;
        }
        &:before {
          left: -3.5em;
          animation-delay: -0.32s;
        }
        &:after {
          left: 3.5em;
        }

        @keyframes bblFadInOut {
          0%,
          80%,
          100% {
            box-shadow: 0 2.5em 0 -1.3em;
          }
          40% {
            box-shadow: 0 2.5em 0 0;
          }
        }
      `}
    ></a.span>
  );
};
