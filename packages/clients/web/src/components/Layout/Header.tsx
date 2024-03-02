import React from "react";

// import { Icons } from "@/components/icons"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useWeb3 } from "@/hooks/providers/web3";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface HeaderProps {
  isStarted?: boolean;
}

export const Header: React.FC<HeaderProps> = () => {
  const { address, connected, login, logout } = useWeb3();
  return (
    <header className={`py-4 px-16 flex items-center justify-between`}>
      <h1 className="">GreenCamp</h1>
      <div>
        {connected ? (
          <Popover>
            <PopoverTrigger>
              <Avatar>
                <AvatarImage
                  src="https://github.com/shadcn.png"
                  alt="@shadcn"
                />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent>
              <p>{address}</p>
              <Button variant="default" onClick={logout}>
                Logout
              </Button>
            </PopoverContent>
          </Popover>
        ) : (
          <Button variant="default" onClick={login}>
            Connect
          </Button>
        )}
      </div>
    </header>
  );
};
