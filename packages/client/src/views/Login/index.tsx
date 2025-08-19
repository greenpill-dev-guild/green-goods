import React from "react";
import { useIntl } from "react-intl";
import { Navigate, useLocation } from "react-router-dom";

import { Splash } from "@/components/Layout/Splash";
import { useUser } from "@/providers/user";

type LoginProps = {};

const Login: React.FC<LoginProps> = () => {
  const intl = useIntl();
  const location = useLocation();
  const { login, authenticated } = useUser();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/home";

  // Only redirect once authenticated AND smart account is available to avoid bouncing
  if (authenticated) return <Navigate to={redirectTo} replace />;

  return (
    <Splash login={login} isLoggingIn={false} buttonLabel={intl.messages["app.login"] as string} />
  );
};

export default Login;
