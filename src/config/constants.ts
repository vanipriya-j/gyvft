export const APP_NAME = "GYVFT";
export const APP_TAGLINE = "Your story. Our telling.";

export const OPPORTUNITY_STAGES = [
  "new",
  "reviewing",
  "contacted",
  "discovery_scheduled",
  "story_discovery",
  "concept_development",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "archived",
] as const;

export const INTENT_TYPES = [
  "story_opportunity",
  "merch_partnership_opportunity",
  "brief_upload",
  "discovery_request",
] as const;

export const USER_ROLES = ["owner", "admin", "contributor"] as const;

export const STORY_CATEGORIES = [
  "Milestones",
  "People",
  "Culture and heritage",
  "Celebrations",
  "Institutions",
  "Brands and products",
  "Communities",
  "Events",
] as const;

export const STORY_OUTPUTS = [
  "Books and publications",
  "Films and digital narratives",
  "Illustrated keepsakes",
  "Merchandise collections",
  "Event experiences",
  "Installations",
  "Memory walls",
  "Cultural and institutional archives",
] as const;

export const OCCASION_TYPES = [
  "Birthday",
  "Anniversary",
  "Wedding",
  "Memorial",
  "Retirement",
  "Founding anniversary",
  "Institutional milestone",
  "Brand launch",
  "Festival",
  "Conference or event",
  "Other",
] as const;

export const AUDIENCE_OPTIONS = [
  "Family",
  "Employees",
  "Customers",
  "Partners",
  "Alumni",
  "Community",
  "Public",
  "Leadership",
  "Other",
] as const;

export const FORMAT_OPTIONS = [
  "Book",
  "Film",
  "Illustrated keepsake",
  "Merchandise",
  "Installation",
  "Archive",
  "Event experience",
  "Memory wall",
  "Not sure yet",
] as const;

export const MERCH_REQUIREMENT_TYPES = [
  "Employee onboarding kits",
  "Recognition and milestone merchandise",
  "Events and conferences",
  "Customer and partner experiences",
  "Festival collections",
  "Brand merchandise",
  "Founder and leadership milestones",
  "Books and publications",
  "Institutional anniversaries",
  "Custom storytelling projects",
] as const;

export const ALLOWED_BRIEF_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ALLOWED_BRIEF_EXTENSIONS = ["pdf", "docx", "png", "jpg", "jpeg", "webp"] as const;

export const OPENAI_MODEL_ALLOWLIST = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
] as const;

export const AI_PROMPT_VERSION = "gyvft-summary-v1";

export const WEBHOOK_EVENTS = [
  "opportunity.created",
  "opportunity.updated",
  "opportunity.stage_changed",
  "opportunity.won",
  "opportunity.lost",
  "contact.created",
  "organisation.created",
  "task.created",
  "task.completed",
  "form.submitted",
] as const;

export const PUBLIC_EVENT_NAMES = [
  "page_view",
  "cta_clicked",
  "story_form_started",
  "story_step_viewed",
  "story_step_completed",
  "story_step_back",
  "story_form_reviewed",
  "story_form_error",
  "story_form_submitted",
  "partner_page_viewed",
  "partner_form_started",
  "partner_step_completed",
  "partner_form_submitted",
  "brief_upload_started",
  "brief_upload_completed",
  "brief_upload_failed",
  "discovery_form_started",
  "discovery_requested",
  "whatsapp_clicked",
  "email_clicked",
  "landing_page_viewed",
] as const;

export const RESERVED_SLUGS = [
  "studio",
  "api",
  "tell-your-story",
  "for-organisations",
  "become-a-merch-partner",
  "upload-a-brief",
  "book-a-discovery",
  "thank-you",
  "privacy",
  "cookies",
  "terms",
  "l",
  "login",
] as const;

export const STORAGE_BUCKET_BRIEFS = "opportunity-briefs";
export const SIGNED_URL_EXPIRES_SECONDS = 60 * 5;
