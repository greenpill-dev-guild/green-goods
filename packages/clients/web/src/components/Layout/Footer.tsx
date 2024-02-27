import React from "react";
import { useAccount, useEnsName } from "wagmi";

import { RC as TwitterIcon } from "../../assets/twitter.svg";
import { RC as UpArrowIcon } from "../../assets/up-arrow.svg";

interface FooterProps {
  isStarted: boolean;
  disconnect: () => void;
}

export const Footer: React.FC<FooterProps> = ({ isStarted, disconnect }) => {
  const { address } = useAccount();
  const { data: name } = useEnsName();

  return (
    <footer
      className={`${
        isStarted ? "text-white" : ""
      } xs:fixed xs:z-20 xs:bottom-0 xs:left-0 w-full`}
    >
      <div className="max-w-screen-2xl mx-auto xs:py-4 md:py-8 flex items-center justify-between gap-4 w-full px-6 md:px-12">
        <div className="dropdown dropdown-top">
          <label
            tabIndex={0}
            className="cursor-pointer flex gap-1 items-center"
          >
            {isStarted ? (
              <>
                <UpArrowIcon
                  className={`${isStarted ? "stroke-white" : ""} `}
                />
                <span className="font-medium text-xs xs:text-sm sm:text-base ">
                  {name || address}
                </span>
              </>
            ) : null}
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content z-[1] p-2 bg-stone-100 text-stone-900 font-medium capitalize shadow rounded-sm w-fit"
          >
            <li>
              <button
                onClick={(e) => {
                  disconnect();
                  e.currentTarget.blur();
                }}
              >
                Disconnect Wallet
              </button>
            </li>
          </ul>
        </div>
        <a
          className="w-10 h-10 flex justify-end items-center"
          href="https://twitter.com/syndotart"
          target="_blank"
        >
          <TwitterIcon
            className={`${
              isStarted ? "fill-white" : ""
            } cursor-pointer opacity-80 hover:opacity-100 transform-gpu transition-opacity duration-200 ease-in-out`}
          />
        </a>
      </div>
    </footer>
  );
};
