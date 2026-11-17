"use client";
/* eslint-disable @next/next/no-img-element -- Private previews require the customer's session cookie. */
import Image from "next/image";
import { useState } from "react";
import styles from "./request.module.css";
export function RequestVisual({
  src,
  alt,
  label,
  contain = false,
}: {
  src: string | null;
  alt: string;
  label: string;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={styles.visual}>
      {src && !failed ? (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${alt}`}
        >
          <img
            src={src}
            alt={alt}
            style={{ objectFit: contain ? "contain" : "cover" }}
            onError={() => setFailed(true)}
            ref={(node) => {
              if (node?.complete && !node.naturalWidth) setFailed(true);
            }}
          />
        </a>
      ) : (
        <Image
          src="/images/gyvft/homepage/02-gifts-keepsakes.png"
          alt="Gifting inspiration: a thoughtful gift shared with a loved one"
          fill
          sizes="(max-width: 650px) 100vw, 55vw"
        />
      )}
      <figcaption>
        {failed ? "Preview unavailable · message the team for help" : label}
      </figcaption>
    </figure>
  );
}
