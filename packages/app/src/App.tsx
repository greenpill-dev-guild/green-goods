import { Toaster } from "react-hot-toast";

import { useWeb3 } from "@/hooks/providers/web3";
import { usePWA, InstallState } from "@/hooks/providers/pwa";
import { CampaignsProvider } from "@/hooks/campaign/useCampaigns";
import { ContributionsProvider } from "@/hooks/work/useContributions";

import Views from "@/views";
import { Login } from "@/views/Login";

import { Appbar } from "@/components/Layout/AppBar";
import { CircleLoader } from "@/components/Loader/Circle";
import { OnlyMobile } from "@/components/Layout/OnlyMobile";

function App() {
  const web3Props = useWeb3();
  const { installState } = usePWA();
  const isLoggedIn = !!web3Props.address;

  const Onboard: Record<InstallState, React.ReactNode> = {
    idle: (
      <div className="w-screen h-screen pb-20 bg-[#e9e3dd] grid place-items-center z-30 fixed top-0 left-0">
        <CircleLoader />
      </div>
    ),
    installed: !isLoggedIn ? (
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
    <CampaignsProvider>
      <ContributionsProvider>
        {Onboard[installState]}
        <Toaster />
      </ContributionsProvider>
    </CampaignsProvider>
  );
}

export default App;
