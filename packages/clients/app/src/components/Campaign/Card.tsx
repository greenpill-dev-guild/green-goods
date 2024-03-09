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
  // id,
  // created_at,
  banner,
}) => {
  return (
    <Card className="w-[350px]">
      <img src={banner} />
      <CardHeader className="px-6">
        <CardTitle>{title}</CardTitle>
        <div>
          {capitals.map((capital) => (
            <Badge>{capital}</Badge>
          ))}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>Content</CardContent>
      <CardFooter className="flex justify-between"></CardFooter>
    </Card>
  );
};
