import React from "react";
import { Outlet, useNavigate } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { HomeDataProps } from "@/hooks/views/useHome";

interface HomeProps extends HomeDataProps {}

const Home: React.FC<HomeProps> = ({ confirmationMap, contributions }) => {
  const navigate = useNavigate();

  return (
    <section className={`relative w-full h-full`}>
      <ul className="flex flex-col gap-4 px-4 py-12 h-full overflow-y-scroll">
        {contributions.map((contribution, index) => {
          const confirmation = confirmationMap[contribution.id];
          return (
            <li key={index}>
              <Card onClick={() => navigate(`${contribution.id}`)}>
                <img src={contribution.proof[0]} alt="" />
                <div className="px-4 py-4">
                  <div>{contribution.title}</div>
                  <div>{contribution.description}</div>
                  <div>{contribution.value}</div>
                  <div>
                    {confirmation
                      ? confirmation.approval
                        ? "Approved"
                        : "Rejected"
                      : "Pending"}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Outlet />
    </section>
  );
};

export default Home;
