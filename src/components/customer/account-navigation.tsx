"use client";
import Link from "@/components/ui/navigation-link";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Gift,
  House,
  Users,
  UserRound,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/public/BrandLogo";
import { signOut } from "@/app/account/actions";
export function AccountNavigation({ email }: { email: string | null }) {
  const profile = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (profile.current && !profile.current.contains(event.target as Node))
        profile.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const path = usePathname(),
    params = useSearchParams(),
    view = params.get("view") || "home";
  const signedIn = !!email && !path.startsWith("/account/login");
  const links = [
    { id: "home", label: "Home", icon: House },
    { id: "requests", label: "My gifts", icon: Gift },
    { id: "occasions", label: "Occasions", icon: CalendarDays },
    { id: "circles", label: "Circles", icon: Users },
    { id: "rewards", label: "Rewards", icon: Sparkles },
  ];
  return (
    <>
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-4 md:h-[72px] md:px-6">
          <Link href="/" aria-label="GYVFT home">
            <BrandLogo height={28} className="h-7 w-[115px]" />
          </Link>
          {signedIn ? (
            <>
              <nav
                aria-label="Main navigation"
                className="ml-auto hidden items-center gap-6 md:flex"
              >
                {links.map((l) => (
                  <Link
                    key={l.id}
                    href={
                      l.id === "home"
                        ? "/account"
                        : l.id === "requests"
                          ? "/account/gifts"
                          : l.id === "occasions"
                            ? "/account/occasions"
                            : l.id === "circles"
                              ? "/account/circles"
                              : l.id === "rewards"
                                ? "/account/rewards"
                                : `/account?view=${l.id}`
                    }
                    aria-current={
                      (
                        l.id === "profile"
                          ? path.startsWith("/account/profile") ||
                            path.startsWith("/account/people")
                          : l.id === "requests"
                            ? path.startsWith("/account/gifts") ||
                              path.startsWith("/account/projects")
                            : l.id === "occasions"
                              ? path.startsWith("/account/occasions")
                              : l.id === "circles"
                                ? path.startsWith("/account/circles")
                                : l.id === "rewards"
                                  ? path.startsWith("/account/rewards")
                                  : path === "/account" && view === l.id
                      )
                        ? "page"
                        : undefined
                    }
                    className={`border-b-2 py-2 text-sm ${(l.id === "profile" ? path.startsWith("/account/profile") || path.startsWith("/account/people") : l.id === "requests" ? path.startsWith("/account/gifts") || path.startsWith("/account/projects") : l.id === "occasions" ? path.startsWith("/account/occasions") : l.id === "circles" ? path.startsWith("/account/circles") : l.id === "rewards" ? path.startsWith("/account/rewards") : path === "/account" && view === l.id) ? "border-b-2 border-olive-dark text-olive-dark" : "border-transparent text-muted-text"}`}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <details
                ref={profile}
                className="relative"
                onKeyDown={(e) => {
                  if (e.key === "Escape" && profile.current) {
                    profile.current.open = false;
                    profile.current.querySelector("summary")?.focus();
                  }
                }}
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest("a,button") &&
                    profile.current
                  )
                    profile.current.open = false;
                }}
              >
                <summary
                  aria-label="Your account"
                  className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-surface text-olive-dark [&::-webkit-details-marker]:hidden"
                >
                  <UserRound size={18} />
                </summary>
                <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-paper p-3 shadow-lg">
                  <p className="mb-2 break-all border-b border-border px-2 pb-3 text-xs text-muted-text">
                    {email}
                  </p>
                  <Link
                    className="block rounded-lg px-2 py-2.5 text-sm hover:bg-surface"
                    href="/account/profile"
                  >
                    About me
                  </Link>
                  <Link
                    className="block rounded-lg px-2 py-2.5 text-sm hover:bg-surface"
                    href="/account/people"
                  >
                    Your people
                  </Link>
                  <Link
                    className="block rounded-lg px-2 py-2.5 text-sm hover:bg-surface"
                    href="/account?view=saved"
                  >
                    Your saved ideas
                  </Link>
                  <Link
                    className="block rounded-lg px-2 py-2.5 text-sm hover:bg-surface"
                    href="/account?view=payments"
                  >
                    Payments & receipts
                  </Link>
                  <Link
                    className="block rounded-lg px-2 py-2.5 text-sm hover:bg-surface"
                    href="/account?view=occasions"
                  >
                    Your occasions
                  </Link>
                  <form action={signOut}>
                    <button className="w-full rounded-lg px-2 py-2.5 text-left text-sm hover:bg-surface">
                      Sign out
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <nav
              className="flex gap-5 text-sm"
              aria-label="Customer navigation"
            >
              <Link href="/account">My GYVFT</Link>
              <Link href="/account/gifts/new">Start a new story</Link>
            </nav>
          )}
        </div>
      </header>
      {signedIn && (
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-40 order-last flex items-center justify-around border-t border-border bg-paper px-2 py-1 md:hidden"
        >
          {[...links].map((l) => (
            <Link
              key={l.id}
              href={
                l.id === "profile"
                  ? "/account/profile"
                  : l.id === "home"
                    ? "/account"
                    : l.id === "requests"
                      ? "/account/gifts"
                      : l.id === "occasions"
                        ? "/account/occasions"
                        : l.id === "circles"
                          ? "/account/circles"
                          : l.id === "rewards"
                            ? "/account/rewards"
                            : `/account?view=${l.id}`
              }
              aria-current={
                (
                  l.id === "profile"
                    ? path.startsWith("/account/profile") ||
                      path.startsWith("/account/people")
                    : l.id === "requests"
                      ? path.startsWith("/account/gifts") ||
                        path.startsWith("/account/projects")
                      : l.id === "occasions"
                        ? path.startsWith("/account/occasions")
                        : l.id === "circles"
                          ? path.startsWith("/account/circles")
                          : l.id === "rewards"
                            ? path.startsWith("/account/rewards")
                            : path === "/account" && view === l.id
                )
                  ? "page"
                  : undefined
              }
              className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] ${(l.id === "profile" ? path.startsWith("/account/profile") || path.startsWith("/account/people") : l.id === "requests" ? path.startsWith("/account/gifts") || path.startsWith("/account/projects") : l.id === "occasions" ? path.startsWith("/account/occasions") : l.id === "circles" ? path.startsWith("/account/circles") : l.id === "rewards" ? path.startsWith("/account/rewards") : path === "/account" && view === l.id) ? "text-olive-dark" : "border-transparent text-muted-text"}`}
            >
              <l.icon size={18} />
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
