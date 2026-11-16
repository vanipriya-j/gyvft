import "server-only";
import { getSql } from "@/lib/database/client";
import type { Occasion, PendingApproval } from "./dashboard-model";
export async function dashboardExtrasFor(accountId: string) {
  const sql = getSql();
  let setupRequired = false;
  async function optional<T>(
    query: PromiseLike<T[]>,
    fallback: T[],
  ): Promise<T[]> {
    try {
      return await query;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : null;
      if (code === "42P01" || code === "42703") {
        setupRequired = true;
        return fallback;
      }
      throw error;
    }
  }
  const [occasions, saved, approvals, mockups] = await Promise.all([
    optional(
      sql<
        Occasion[]
      >`SELECT id,title,occasion_date::text,repeats_annually,photo_data IS NOT NULL AS has_photo FROM gyvft_customer_occasions WHERE account_id=${accountId}::uuid ORDER BY occasion_date`,
      [],
    ),
    optional(
      sql<
        { story_slug: string }[]
      >`SELECT story_slug FROM gyvft_customer_saved_ideas WHERE account_id=${accountId}::uuid ORDER BY created_at DESC`,
      [],
    ),
    optional(
      sql<
        PendingApproval[]
      >`SELECT a.id,a.project_id,p.title AS project_title,a.title,a.kind,a.version FROM customer_project_approvals a JOIN customer_projects p ON p.id=a.project_id WHERE p.customer_account_id=${accountId}::uuid AND a.status='pending' AND NOT EXISTS (SELECT 1 FROM customer_project_approvals n WHERE n.project_id=a.project_id AND n.kind=a.kind AND n.version>a.version) ORDER BY a.created_at DESC`,
      [],
    ),
    optional(
      sql<
        {
          id: string;
          project_id: string;
          title: string;
          kind: string;
          version: number;
        }[]
      >`SELECT DISTINCT ON (a.project_id) a.id,a.project_id,a.title,a.kind,a.version FROM customer_project_approvals a JOIN customer_projects p ON p.id=a.project_id WHERE p.customer_account_id=${accountId}::uuid AND a.image_data IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer_project_approvals n WHERE n.project_id=a.project_id AND n.kind=a.kind AND n.version>a.version) ORDER BY a.project_id,CASE WHEN a.kind='design' THEN 0 ELSE 1 END,a.version DESC`,
      [],
    ),
  ]);
  return {
    mockups,
    occasions,
    savedSlugs: saved.map((s) => s.story_slug),
    approvals,
    setupRequired,
  };
}
