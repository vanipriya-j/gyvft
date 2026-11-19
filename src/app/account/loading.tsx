export default function AccountLoading() {
  return (
    <div
      className="app-route-loading"
      role="status"
      aria-label="Loading your gifting space"
      aria-busy="true"
    >
      <p className="text-sm text-muted-text">Opening your gifting space…</p>
      <div className="app-loading-title" />
      <div className="app-loading-grid">
        <div className="app-loading-panel" />
        <div className="app-loading-panel" />
      </div>
    </div>
  );
}
