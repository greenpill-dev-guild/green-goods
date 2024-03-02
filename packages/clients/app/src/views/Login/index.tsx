import React from "react";

import { Web3Props } from "../../hooks/providers/web3";
import { Button } from "../../components/ui/button";

interface LoginProps extends Web3Props {}

export const Login: React.FC<LoginProps> = ({ error, login }) => {
  return (
    <section className={`grid place-items-center h-full w-full gap-3 px-6`}>
      {/* <img
        className="w-64"
        src={`assets/logo-banner-transparent.png`}
        alt="Greenpill"
      /> */}
      <div className={`text-center uppercase`}>
        <h5>Welcome to the</h5>
        <h2>Camp Green</h2>
      </div>
      <div className={`w-full`}>
        <Button onClick={login}>Login</Button>
        <p className="w-full text-red-500 h-10 line-clamp-2 text-center">
          {error}
        </p>
      </div>
    </section>
  );
};
