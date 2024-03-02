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

export interface ContributionCardProps extends Contribution {}

export const ContributionCard: React.FC<ContributionCardProps> = ({
  capitals,
  title,
  description,
  cammpaignAddrs,
  id,
  proof,
  status,
  user,
  created_at,
  value,
}) => {
  return (
    <Card className="w-[350px]">
      <img src={proof[0]} />
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
