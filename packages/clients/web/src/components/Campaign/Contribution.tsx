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
import { Button } from "../ui/button";

export interface ContributionCardProps extends Contribution {}

export const ContributionCard: React.FC<ContributionCardProps> = ({
  capitals,
  title,
  description,
  // logo,
  // banner,
}) => {
  return (
    <Card className="w-[350px]">
      <img src={"banner"} />
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
      <CardFooter className="flex justify-between">
        <Button>Reject</Button>
        <Button>Approve</Button>
      </CardFooter>
    </Card>
  );
};
