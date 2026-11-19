"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return (
    <span
      className="navigation-feedback"
      data-pending={pending}
      role={pending ? "status" : undefined}
      aria-label={pending ? "Opening page" : undefined}
    />
  );
}

/** Keep native Link semantics and prefetching, with immediate click feedback. */
export default function NavigationLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <NavigationFeedback />
    </Link>
  );
}
