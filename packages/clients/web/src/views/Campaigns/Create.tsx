import React from "react";

import { CampaignsDataProps } from "../../hooks/views/useCampaigns";
import { useCampaignCreator } from "../../hooks/campaign/useCampaignCreator";

interface CampaignCreateProps extends CampaignsDataProps {}

const CampaignCreate: React.FC<CampaignCreateProps> = ({}) => {
  const {} = useCampaignCreator();

  return <section className={`relative w-full h-full`}></section>;
};

export default CampaignCreate;
