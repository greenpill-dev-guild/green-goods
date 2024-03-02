import React from "react";
import { useParams } from "react-router-dom";

import { useCampaign } from "@/hooks/campaign/useCampaign";
import { CircleLoader } from "@/components/Loader/Circle";

interface CampaignProps {}

const Campaign: React.FC<CampaignProps> = () => {
  const params = useParams<{
    address: string;
  }>();

  const { id, capitals, team, loading, address } = useCampaign(
    params.address ?? ""
  );

  if (!address) {
    return <div>Please Login To View Campaigns</div>;
  }

  if (loading) {
    return (
      <div>
        <CircleLoader />
      </div>
    );
  }

  if (!id) {
    return <div>No Campaign Found</div>;
  }

  return (
    <section className={`relative w-full h-full`}>
      <div>
        <div>
          <img src="" />
          <div>
            <img src="" />
            <img src="" />
          </div>
          <div>
            <p></p>
            <h3></h3>
            <p></p>
            <p></p>
          </div>
          <hr />
          <div>
            <h4></h4>
            <h6></h6>
            <div>
              {capitals.map((capital) => (
                <div />
              ))}
            </div>
            <h6></h6>
            <div>
              {team.map((member) => (
                <div />
              ))}
            </div>
            <h6></h6>
            <div></div>
          </div>
        </div>
      </div>
      <aside></aside>
    </section>
  );
};

export default Campaign;
