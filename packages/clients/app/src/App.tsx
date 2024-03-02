import { Toaster } from "react-hot-toast";

import { useWeb3 } from "./hooks/providers/web3";
import { usePWA, InstallState } from "./hooks/providers/pwa";

import { Appbar } from "./components/Layout/AppBar";
import { CircleLoader } from "./components/Loader/Circle";
import { OnlyMobile } from "./components/Layout/OnlyMobile";

import Views from "./views";
import { Login } from "./views/Login";
import { ContributionsProvider } from "./hooks/contribution/useContributions";

function App() {
  const web3Props = useWeb3();
  const { installState } = usePWA();
  const isLoggedIn = !!web3Props.connected && !web3Props.authenticating;

  const Onboard: Record<InstallState, React.ReactNode> = {
    idle: (
      <div className="w-screen h-screen pb-20 bg-[#e9e3dd] grid place-items-center z-30 fixed top-0 left-0">
        <CircleLoader />
      </div>
    ),
    installed: isLoggedIn ? (
      <>
        <Appbar />
        <Views />
      </>
    ) : (
      <Login {...web3Props} />
    ),
    prompt: null,
    unsupported: <OnlyMobile />,
  };

  return (
    <ContributionsProvider>
      {Onboard[installState]}
      <Toaster />
    </ContributionsProvider>
  );
}

export default App;
