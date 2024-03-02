import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";

export interface CampaignCardProps extends Campaign {}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  capitals,
  title,
  description,
  logo,
  banner,
}) => {
  return (
    <Card className="w-[350px]">
      {/* <div>
        <img src={banner} />
        <img src={logo} />
      </div> */}
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div>
          {capitals.map((capital) => (
            <Badge>{capital}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
      <CardFooter className="flex justify-between"></CardFooter>
    </Card>
  );
};
