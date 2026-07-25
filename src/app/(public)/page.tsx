import { EditorialCtaSection, HowItWorksSection, StoryCategoriesSection, StoryOutputsSection } from "@/components/public/sections";
import { Hero } from "@/components/public/Hero";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StoryCategoriesSection />
      <StoryOutputsSection />
      <HowItWorksSection />
      <EditorialCtaSection />
    </>
  );
}
