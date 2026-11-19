import Link from "@/components/ui/navigation-link";
import { GiftSectionSelect } from "./journey-controls";
export function RequestNavigation({
  id,
  view,
  optionCount,
}: {
  id: string;
  view: string;
  optionCount: number;
}) {
  const sections = [
    ["overview", "Overview"],
    ["brief", "Brief"],
    ["options", `Options (${optionCount})`],
    ["quote", "Quote & pay"],
    ["design", "Design"],
    ["delivery", "Delivery"],
    ["moments", "Moments"],
    ["messages", "Messages"],
    ["activity", "Activity"],
  ].map(([key, label]) => ({
    id: key,
    label,
    href: `/account/projects/${id}${key === "options" ? "/options" : key === "overview" ? "" : `?view=${key}`}`,
  }));
  return (
    <>
      <nav className="app-tabs" aria-label="Gift sections">
        {sections.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            aria-current={view === s.id ? "page" : undefined}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <GiftSectionSelect value={view} sections={sections} />
    </>
  );
}
