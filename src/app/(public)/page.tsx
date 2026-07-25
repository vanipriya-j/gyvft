import { Hero } from "@/components/public/Hero";
import {
  FinalCtaSection,
  ForOrganisationsSection,
  HowItWorksSection,
  StoryTransformationSection,
  StoryWorldsSection,
  WhatStoryCanBecomeSection,
} from "@/components/public/sections";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhatStoryCanBecomeSection />
      <StoryWorldsSection />
      <StoryTransformationSection />
      <ForOrganisationsSection />
      <HowItWorksSection />
      <FinalCtaSection />
    </>
  );
}
