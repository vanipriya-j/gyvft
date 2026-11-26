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

/** Private screens do database work. Fetch them when opened, not merely visible. */
export default function NavigationLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  const pathname =
    typeof props.href === "string" ? props.href : props.href.pathname || "";
  const relative = !pathname.startsWith("/") && !/^https?:\/\//.test(pathname);
  const privatePage =
    relative || /^\/(account|operations|studio|setup)(\/|\?|$)/.test(pathname);
  return (
    <Link
      {...props}
      prefetch={props.prefetch ?? (privatePage ? false : undefined)}
    >
      {children}
      <NavigationFeedback />
    </Link>
  );
}
