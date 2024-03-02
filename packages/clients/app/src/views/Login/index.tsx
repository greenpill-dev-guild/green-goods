import React from "react";

import { Web3Props } from "../../hooks/providers/web3";
import { Button } from "../../components/ui/button";

interface LoginProps extends Web3Props {}

export const Login: React.FC<LoginProps> = ({ error, login }) => {
  return (
    <section
      className={`grid place-items-center h-full w-full gap-3 px-6 bg-[]`}
    >
      <div className="flex flex-col gap-12">
        <div className={`text-center uppercase`}>
          <h5>Welcome To</h5>
          <h2>Camp Green</h2>
        </div>
        <img
          className="w-screen"
          src={`https://bafybeif4rv4cjeuzx3daq5yqpjiy2y5dqgfl3pjlsnghzmsoaih35erpdu.ipfs.dweb.link/`}
          alt="Camp Green"
        />
        <Button onClick={login} className="w-full">
          Login
        </Button>
      </div>
    </section>
  );
};
