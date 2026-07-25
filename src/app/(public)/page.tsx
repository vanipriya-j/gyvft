import { Hero } from "@/components/public/Hero";
import {
  FinalCtaSection,
  ForOrganisationsSection,
  HowItWorksSection,
  TellUsYourStorySection,
  VisualExamplesSection,
  WhatStoryCanBecomeSection,
} from "@/components/public/sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhatStoryCanBecomeSection />
      <VisualExamplesSection />
      <TellUsYourStorySection />
      <ForOrganisationsSection />
      <HowItWorksSection />
      <FinalCtaSection />
    </>
  );
}
