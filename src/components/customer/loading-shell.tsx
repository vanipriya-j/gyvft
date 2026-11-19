import { LoaderCircle } from "lucide-react";
export function CustomerLoading({
  kind = "list",
  label = "Loading your gifting space",
}: {
  kind?: "home" | "gift" | "list" | "form";
  label?: string;
}) {
  return (
    <div
      className={`app-route-loading app-loading-${kind}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}…</span>
      {kind === "gift" && <div className="app-skeleton app-loading-back" />}
      <div className="app-loading-heading">
        <div>
          <div className="app-skeleton app-loading-title" />
          <div className="app-skeleton app-loading-subtitle" />
        </div>
        <LoaderCircle size={20} className="app-spinner" aria-hidden="true" />
      </div>
      {kind === "home" ? (
        <div className="app-loading-rails">
          {[0, 1, 2].map((n) => (
            <div key={n}>
              <div className="app-skeleton app-loading-rail-title" />
              <div className="app-loading-card">
                <div className="app-skeleton app-loading-media" />
                <div className="app-loading-copy">
                  <div className="app-skeleton app-loading-line" />
                  <div className="app-skeleton app-loading-line short" />
                  <div className="app-skeleton app-loading-action" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : kind === "form" ? (
        <div className="app-loading-form">
          {[0, 1, 2, 3].map((n) => (
            <div
              key={n}
              className={`app-skeleton ${n === 1 ? "app-loading-textarea" : "app-loading-field"}`}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="app-skeleton app-loading-tabs" />
          <div
            className={
              kind === "gift" ? "app-loading-grid" : "app-loading-list"
            }
          >
            {[0, 1, 2].map((n) => (
              <div className="app-loading-panel" key={n}>
                <div className="app-skeleton app-loading-line" />
                <div className="app-skeleton app-loading-line short" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
