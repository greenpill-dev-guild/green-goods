import React from "react";
import { useParams } from "react-router-dom";

import { useCampaign } from "@/hooks/campaign/useCampaign";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";

interface CampaignViewerProps {}

const CampaignViewer: React.FC<CampaignViewerProps> = () => {
  const params = useParams<{
    id: string;
  }>();

  console.log(params.id);

  const {
    // cammpaignAddrs,
    capitals,
    // created_at,
    description,
    // proof,
    // id,
    // status,
    title,
    // user,
    // value,
  } = useCampaign(params.id ?? "");

  return (
    <Card className={`relative w-full h-full`}>
      <CardHeader className="px-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {capitals.map((capital) => (
          <Badge>{capital}</Badge>
        ))}
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
      </CardContent>
      <CardFooter>Footer</CardFooter>{" "}
    </Card>
  );
};

export default CampaignViewer;
