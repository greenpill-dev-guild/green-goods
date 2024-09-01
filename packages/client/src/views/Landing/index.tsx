import React from "react";

import { usePWA } from "@/providers/PWAProvider";

import { Hero } from "@/components/Layout/Hero";
import { Header } from "@/components/Layout/Header";
import { Footer } from "@/components/Layout/Footer";

interface LandingProps {}

const Landing: React.FC<LandingProps> = () => {
  const { isMobile } = usePWA();
  return (
    <>
      <Header />
      <Hero />
      {!isMobile && <Footer />}
    </>
  );
};

export default Landing;
