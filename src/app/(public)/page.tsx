import { Hero } from "@/components/public/Hero";
import {
  StoriesPreviewSection,
  WhyGyvftPreviewSection,
} from "@/components/public/portfolio-previews";
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
      <WhyGyvftPreviewSection />
      <StoriesPreviewSection />
      <ForOrganisationsSection />
      <HowItWorksSection />
      <FinalCtaSection />
    </>
  );
}
