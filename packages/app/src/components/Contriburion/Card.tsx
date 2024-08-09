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
      <CardHeader className="px-6">
        <CardTitle>{title}</CardTitle>
        <div>
          {capitals.map((capital) => (
            <Badge>{capital}</Badge>
          ))}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-between"></CardFooter>
    </Card>
  );
};
