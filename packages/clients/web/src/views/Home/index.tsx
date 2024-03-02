import React from "react";
// Ensure the import path matches the location of the CampaignCard component
import { CampaignCard } from "@/components/Campaign/Card";

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  // Example data to pass to CampaignCard - adjust according to your data structure
  const campaignData = {
    id: "1",
    title: "Campaign 1",
    description: "Description 1",
    capitals: ["Cultural", "Intellectual", "Social"],
    created_at: "2021-08-01",
    team: ["afo-wefa.eth", "0xwildhare.eth"],
    details:
      "https://drive.google.com/file/d/10tHbt9sDKN1GdE2IQZ4Mu2c0YAQg56lr/view?usp=sharing",
    creator: "afo-wefa.eth",
    hypercertID: 1,
    end_date: "2021-08-31",
    start_date: "2021-08-01",
    logo: "https://source.unsplash.com/random/200x200",
    banner: "https://source.unsplash.com/random/800x200",
  };

  return (
    <section className="relative w-full h-full">
      <CampaignCard 
        capitals={campaignData.capitals}
        title={campaignData.title}
        description={campaignData.description}
        logo={campaignData.logo}
        banner={campaignData.banner}
      />
    </section>
  );
};

export default Home;
