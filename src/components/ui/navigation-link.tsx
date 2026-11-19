"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        hidden
        aria-hidden="true"
        className="navigation-feedback-marker"
        data-pending={pending}
      />
      {pending &&
        createPortal(
          <span
            className="navigation-feedback"
            data-pending="true"
            role="status"
            aria-label="Opening page"
          >
            <span className="sr-only">Opening page…</span>
          </span>,
          document.body,
        )}
    </>
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
