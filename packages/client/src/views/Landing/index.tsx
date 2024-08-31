import React from "react";

import { Hero } from "@/components/Layout/Hero";
import { Header } from "@/components/Layout/Header";
import { Footer } from "@/components/Layout/Footer";

interface LandingProps {}

const Landing: React.FC<LandingProps> = () => {
  return (
    <>
      <Header />
      <Hero />
      <Footer />
    </>
  );
};

export default Landing;
