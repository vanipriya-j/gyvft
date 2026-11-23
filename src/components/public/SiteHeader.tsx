"use client";

import Link from "@/components/ui/navigation-link";
import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/public/BrandLogo";
import styles from "./site-navigation.module.css";

const nav = [
  { href: "/#your-space", label: "Your GYVFT space" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/stories", label: "Gift stories" },
  { href: "/for-organisations", label: "For teams" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  return (
    <header
      className={styles.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <a className={styles.skipLink} href="#public-content">
        Skip to content
      </a>
      <nav aria-label="Primary navigation" className={styles.navigation}>
        <Link
          className={styles.logo}
          href="/"
          aria-label="GYVFT home"
          onClick={() => setMenuOpen(false)}
        >
          <BrandLogo height={28} priority />
        </Link>
        <div className={styles.desktopLinks}>
          {nav.map((item) => (
            <Link className={styles.navLink} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className={styles.accountActions}>
          <Link
            href="/account/login"
            className={styles.signIn}
            onClick={() => setMenuOpen(false)}
          >
            Sign in
          </Link>
          <Link
            href="/account/login?mode=signup"
            className={styles.createAccount}
            onClick={() => setMenuOpen(false)}
          >
            Create account
          </Link>
          <button
            ref={menuButton}
            type="button"
            className={styles.menuToggle}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X size={22} aria-hidden="true" />
            ) : (
              <Menu size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>
      <div
        className={styles.mobileMenu}
        id="public-mobile-menu"
        hidden={!menuOpen}
      >
        {nav.map((item) => (
          <Link
            className={styles.navLink}
            href={item.href}
            key={item.href}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
