import React from "react";
import { useParams } from "react-router-dom";

import { useContribution } from "../../hooks/contribution/useContribution";

interface ContributionProps {}

const Contribution: React.FC<ContributionProps> = () => {
  const params = useParams<{
    id: string;
  }>();

  const {
    // cammpaignAddrs,
    // capitals,
    // created_at,
    // description,
    // proof,
    // id,
    // status,
    // title,
    // user,
    // value,
  } = useContribution(params.id ?? "");

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
              {/* {capitals.map((capital) => (
                <div />
              ))} */}
            </div>
            <h6></h6>
            <div>
              {/* {team.map((member) => (
                <div />
              ))} */}
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

export default Contribution;
