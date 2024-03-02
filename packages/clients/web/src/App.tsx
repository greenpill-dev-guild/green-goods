import { Toaster } from "@/components/ui/sonner";

import Views from "./views";
import { Header } from "./components/Layout/Header";
import { CampaignsProvider } from "./hooks/campaign/useCampaigns";

function App() {
  return (
    <CampaignsProvider>
      <Header />
      <Views />
      <Toaster />
    </CampaignsProvider>
  );
}

export default App;
