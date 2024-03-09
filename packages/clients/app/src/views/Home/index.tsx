import React from "react";

import { HomeDataProps } from "@/hooks/views/useHome";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface HomeProps extends HomeDataProps {}

const Home: React.FC<HomeProps> = ({}) => {
  return (
    <div className={`relative w-full h-full flex flex-col gap-8`}>
      <section>
        <h4>Contributions</h4>
        <Carousel className={`relative w-full h-full`}>
          <CarouselContent>
            {Array.from({ length: 5 }).map((_, index) => (
              <CarouselItem key={index}>
                <div className="p-1">{index}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </section>
      <section>
        <h4>Campaigns</h4>
        <Carousel className={`relative w-full h-full`}>
          <CarouselContent>
            {Array.from({ length: 5 }).map((_, index) => (
              <CarouselItem key={index}>
                <div className="p-1">{index}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </section>
    </div>
  );
};

export default Home;
