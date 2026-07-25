import type {
  INTENT_TYPES,
  OPPORTUNITY_STAGES,
  USER_ROLES,
  WEBHOOK_EVENTS,
} from "@/config/constants";

export type UserRole = (typeof USER_ROLES)[number];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type IntentType = (typeof INTENT_TYPES)[number];
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number];

export type PriorityLevel = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type LandingPageStatus = "draft" | "published" | "archived";
export type IntegrationStatus =
  | "not_configured"
  | "configured"
  | "connected"
  | "error"
  | "disabled";
export type RelationshipType = "one_off" | "recurring" | "unknown";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Organisation = {
  id: string;
  name: string;
  normalised_name: string;
  type: string | null;
  website: string | null;
  industry: string | null;
  primary_city: string | null;
  relationship_status: string;
  notes: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Contact = {
  id: string;
  organisation_id: string | null;
  full_name: string;
  email: string | null;
  normalised_email: string | null;
  phone: string | null;
  normalised_phone: string | null;
  designation: string | null;
  preferred_contact_method: string | null;
  source: string | null;
  communication_consent: boolean;
  marketing_consent: boolean;
  consent_version: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Opportunity = {
  id: string;
  story_title: string | null;
  intent_type: IntentType;
  relationship_type: RelationshipType;
  stage: OpportunityStage;
  priority: PriorityLevel;
  source: string;
  campaign_id: string | null;
  contact_id: string | null;
  organisation_id: string | null;
  assigned_user_id: string | null;
  occasion_type: string | null;
  occasion_other: string | null;
  target_date: string | null;
  target_date_precision: string | null;
  quantity_range: string | null;
  budget_range: string | null;
  currency: string;
  estimated_value: string | null;
  confirmed_value: string | null;
  expected_start_date: string | null;
  primary_city: string | null;
  multiple_locations: boolean;
  location_notes: string | null;
  lost_reason: string | null;
  lost_notes: string | null;
  competitor: string | null;
  revisit_date: string | null;
  form_key: string | null;
  idempotency_key: string | null;
  attribution_id: string | null;
  ai_summary_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AiSummary = {
  storyTitle: string;
  storySummary: string;
  whyItMatters: string;
  peopleOrOrganisations: string[];
  occasion: string;
  audiences: string[];
  emotionalIntent: string[];
  keyThemes: string[];
  constraints: string[];
  suggestedDirections: Array<{ title: string; format: string; reason: string }>;
  recommendedNextAction: string;
};

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  version: string;
  updatedAt: string;
};

export type AttributionSnapshot = {
  anonymousVisitorId: string;
  sessionId: string;
  firstTouchSource?: string | null;
  firstTouchMedium?: string | null;
  firstTouchCampaign?: string | null;
  firstTouchContent?: string | null;
  firstTouchTerm?: string | null;
  firstTouchLandingPage?: string | null;
  firstTouchReferrer?: string | null;
  lastTouchSource?: string | null;
  lastTouchMedium?: string | null;
  lastTouchCampaign?: string | null;
  lastTouchContent?: string | null;
  lastTouchTerm?: string | null;
  lastTouchLandingPage?: string | null;
  deviceCategory?: string | null;
};
