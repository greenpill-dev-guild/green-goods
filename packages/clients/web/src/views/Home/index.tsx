import React from "react";
// Ensure the import path matches the location of the CampaignCard component
// import { CampaignCard } from "@/components/Campaign/Card";

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  // Example data to pass to CampaignCard - adjust according to your data structure

  return (
    <section className="relative w-full h-full">
      {/* <CampaignCard 
        capitals={campaignData.capitals}
        title={campaignData.title}
        description={campaignData.description}
        logo={campaignData.logo}
        banner={campaignData.banner}
      /> */}
    </section>
  );
};

export default Home;
