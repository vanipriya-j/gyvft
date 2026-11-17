import Link from "next/link";
import styles from "./request.module.css";
export function RequestNavigation({
  id,
  view,
  optionCount,
}: {
  id: string;
  view: string;
  optionCount: number;
}) {
  return (
    <nav className={styles.nav} aria-label="Gift workspace">
      {[
        ["overview", "Overview"],
        ["options", `Options (${optionCount})`],
        ["quote", "Quote & payment"],
        ["activity", "Activity"],
        ["messages", "Messages"],
      ].map(([name, label]) => (
        <Link
          key={name}
          href={`/account/projects/${id}${name === "options" ? "/options" : name === "overview" ? "" : `?view=${name}`}`}
          aria-current={view === name ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
