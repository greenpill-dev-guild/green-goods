import { usePrivy } from "@privy-io/react-auth";
import React from "react";
import { useIntl } from "react-intl";
import { Navigate, useLocation } from "react-router-dom";

import { Splash } from "@/components/Layout/Splash";

type LoginProps = {};

const Login: React.FC<LoginProps> = () => {
  const intl = useIntl();
  const { login, authenticated } = usePrivy();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/home";

  if (authenticated) return <Navigate to={redirectTo} replace />;

  return (
    <Splash login={login} isLoggingIn={false} buttonLabel={intl.messages["app.login"] as string} />
  );
};

export default Login;
