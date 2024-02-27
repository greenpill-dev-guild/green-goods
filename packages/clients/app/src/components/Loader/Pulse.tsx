import React from "react";
import { css } from "@emotion/react";
import { a, config, useSpring } from "@react-spring/web";

export const PulseLoader: React.FC = () => {
  const spring = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { ...config.default, clamp: true },
  });

  return (
    <a.span
      style={spring}
      css={css`
        width: 32px;
        height: 32px;
        position: relative;
        border-radius: 50%;
        color: #ff3d00;
        animation: fill 1s ease-in infinite alternate;

        &::before,
        &::after {
          content: "";
          position: absolute;
          height: 100%;
          width: 100%;
          border-radius: 50%;
          left: 48px;
          top: 0;
          animation: fill 0.9s ease-in infinite alternate;
        }

        &::after {
          left: auto;
          right: 48px;
          animation-duration: 1.1s;
        }

        @keyframes fill {
          0% {
            box-shadow: 0 0 0 2px inset;
          }
          100% {
            box-shadow: 0 0 0 10px inset;
          }
        }
      `}
    ></a.span>
  );
};
