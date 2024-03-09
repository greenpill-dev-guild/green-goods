import React from "react";
import { useParams } from "react-router-dom";

import { useContribution } from "@/hooks/contribution/useContribution";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";

interface ContributionViewerProps {}

const ContributionViewer: React.FC<ContributionViewerProps> = () => {
  const params = useParams<{
    id: string;
  }>();

  console.log(params.id);

  const {
    // cammpaignAddrs,
    capitals,
    // created_at,
    description,
    proof,
    id,
    // status,
    title,
    // user,
    // value,
  } = useContribution(params.id ?? "");

  return (
    <Card className={`relative w-full h-full`}>
      <div>
        <div>
          {proof?.length && <img src={proof[0]} />}
          <CardHeader className="px-6">
            <CardTitle>{title}</CardTitle>
            <div>
              {capitals.map((capital) => (
                <Badge>{capital}</Badge>
              ))}
            </div>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <div>
            <img src="" />
            <img src="" />
          </div>
          <div>
            <p>{id}</p>
            <h3></h3>
            <p>{title}</p>
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
    </Card>
  );
};

export default ContributionViewer;
