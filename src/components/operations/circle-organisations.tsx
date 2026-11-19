"use client";
import { useState } from "react";
import Link from "@/components/ui/navigation-link";
import type { circleOrganisationDirectory } from "@/lib/customer/circles";
import { OperationsPageHeader } from "./page-header";
type Entry = Awaited<ReturnType<typeof circleOrganisationDirectory>>[number];
export function CircleOrganisations({
  entries,
  busy,
  verify,
}: {
  entries: Entry[] | null;
  busy: boolean;
  verify: (
    id: string,
    details: { state: string; note: string; confirmed: boolean },
  ) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <OperationsPageHeader
        title="Circles & organisations"
        description="Check institutional details before marking an organisation verified."
        meta={
          <Link className="app-button" href="/operations/demo-data/circles">
            Complete demo circles
          </Link>
        }
      />
      <section className="app-panel">
        {!entries ? (
          <p role="status">Loading organisation checks…</p>
        ) : !entries.length ? (
          <p className="app-muted">No institutional circles to review yet.</p>
        ) : (
          entries.map((o) => (
            <article className="circle-recipient" key={String(o.id)}>
              <div className="app-row">
                <div>
                  <h2>{String(o.name)}</h2>
                  <p className="app-note mt-1">
                    {String(o.organisation_name)} · {String(o.domain)}
                  </p>
                  <p className="app-note break-all">
                    Owner: {String(o.owner_email)}
                  </p>
                  <a
                    className="app-button quiet"
                    href={String(o.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Visit website ↗
                  </a>
                </div>
                <div>
                  <span className="app-badge">
                    {String(o.verification_state).replaceAll("_", " ")}
                  </span>
                  {o.is_demo && (
                    <p className="app-note mt-2">Fictional organisation</p>
                  )}
                  {o.archived_at ? (
                    <p className="app-note">Archived</p>
                  ) : (
                    <button
                      className="app-button mt-3"
                      disabled={busy}
                      onClick={() =>
                        setSelected(selected === o.id ? null : String(o.id))
                      }
                    >
                      Review details
                    </button>
                  )}
                </div>
              </div>
              {selected === o.id && (
                <form
                  aria-busy={busy}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      await verify(String(o.id), {
                        state: String(f.get("state")),
                        note: String(f.get("note")),
                        confirmed: f.has("confirmed"),
                      })
                    )
                      setSelected(null);
                  }}
                >
                  <label className="app-label mt-3">
                    Review outcome
                    <select className="app-input" name="state">
                      <option value="needs_review">Needs review</option>
                      {!o.is_demo && <option value="verified">Verified</option>}
                    </select>
                  </label>
                  <label className="app-label mt-3">
                    Check performed
                    <textarea
                      className="app-input"
                      name="note"
                      required
                      minLength={10}
                      maxLength={1000}
                      rows={2}
                      placeholder="Record how you checked the organisation and this owner’s authority."
                    />
                  </label>
                  <label className="app-check mt-3">
                    <input type="checkbox" name="confirmed" required />I checked
                    the organisation details and owner’s authority. A matching
                    domain alone is not verification.
                  </label>
                  <button className="app-button primary mt-4" disabled={busy}>
                    {busy ? "Saving review…" : "Save review"}
                  </button>
                </form>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
