import React from "react";
import { usePrivy } from "@privy-io/react-auth";

import { Splash } from "@/components/Layout/Splash";

interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
  const { login } = usePrivy();

  return <Splash login={login} isLoggingIn={false} buttonLabel="Login" />;
};

export default Login;
