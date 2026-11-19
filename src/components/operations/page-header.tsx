import type { ReactNode } from "react";

/** One frame for every Operations area; content panels start below the title. */
export function OperationsPageHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <header className="ops-page-header">
      <div className="ops-page-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta && <div className="ops-page-meta">{meta}</div>}
    </header>
  );
}
