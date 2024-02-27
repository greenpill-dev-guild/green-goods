import React from "react";
import { css } from "@emotion/react";
import { a, config, useSpring } from "@react-spring/web";

export const WaveLoader: React.FC = () => {
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
        position: relative;
        display: flex;

        &:before,
        &:after {
          content: "";
          width: 15px;
          height: 15px;
          display: inline-block;
          position: relative;
          margin: 0 5px;
          border-radius: 50%;
          color: #fff;
          background: currentColor;
          box-shadow: 50px 0, -50px 0;
          animation: left 1s infinite ease-in-out;
        }
        &:after {
          color: #171d1d;
          animation: right 1.1s infinite ease-in-out;
        }

        @keyframes right {
          0%,
          100% {
            transform: translateY(-10px);
          }
          50% {
            transform: translateY(10px);
          }
        }

        @keyframes left {
          0%,
          100% {
            transform: translateY(10px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}
    ></a.span>
  );
};
