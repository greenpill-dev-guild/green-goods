import { usePrivy } from "@privy-io/react-auth";
import type React from "react";
import { useIntl } from "react-intl";

import { Splash } from "@/components/Layout/Splash";

type LoginProps = {};

const Login: React.FC<LoginProps> = () => {
  const intl = useIntl();
  const { login } = usePrivy();

  return (
    <Splash login={login} isLoggingIn={false} buttonLabel={intl.messages["app.login"] as string} />
  );
};

export default Login;
