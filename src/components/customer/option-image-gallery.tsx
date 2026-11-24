"use client";
/* eslint-disable @next/next/no-img-element -- Owned private assets must bypass image optimisation. */
import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Maximize2 } from "lucide-react";
import { optionGallery } from "@/lib/customer/option-image-model";
import type { GiftOption } from "@/lib/customer/gift-workspace-model";

export function OptionImageGallery({
  option,
}: {
  option: Pick<GiftOption, "id" | "title" | "has_image" | "images">;
}) {
  const images = optionGallery(option);
  const [selected, setSelected] = useState(0),
    [open, setOpen] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(-Infinity);
  const opener = useRef<HTMLButtonElement>(null);
  if (!images.length) return null;
  const index = Math.min(selected, images.length - 1),
    image = images[index];
  const source = (i: number) =>
    `/api/customer-assets/${images[i].kind}/${images[i].id}`;
  const change = (delta: number) =>
    setSelected((index + delta + images.length) % images.length);
  const controls = (large = false) =>
    images.length > 1 ? (
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="app-button min-h-11 min-w-11"
          aria-label="Previous image"
          onClick={() => change(-1)}
        >
          <ArrowLeft size={17} />
        </button>
        <span
          className={large ? "text-sm" : "text-xs text-muted-text"}
          aria-live="polite"
        >
          Image {index + 1} of {images.length}
        </span>
        <button
          type="button"
          className="app-button min-h-11 min-w-11"
          aria-label="Next image"
          onClick={() => change(1)}
        >
          <ArrowRight size={17} />
        </button>
      </div>
    ) : null;
  return (
    <div
      role="group"
      aria-label={`Images for ${option.title}`}
      onKeyDown={(e) => {
        if (
          images.length > 1 &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight")
        ) {
          e.preventDefault();
          change(e.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <button
        ref={opener}
        type="button"
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-surface"
        aria-label={`Enlarge ${option.title}, image ${index + 1} of ${images.length}`}
        onClick={() => {
          if (performance.now() - swipedAt.current > 400) setOpen(true);
        }}
        style={{ touchAction: "pan-y pinch-zoom" }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          const end = e.changedTouches[0];
          if (start && end) {
            const dx = end.clientX - start.x,
              dy = end.clientY - start.y;
            if (
              Math.abs(dx) > 60 &&
              Math.abs(dx) > Math.abs(dy) * 1.5 &&
              images.length > 1
            ) {
              swipedAt.current = performance.now();
              change(dx < 0 ? 1 : -1);
            }
          }
        }}
      >
        <img
          key={image.id}
          src={source(index)}
          alt={`${option.title} — image ${index + 1} of ${images.length}`}
          className="h-full w-full object-contain"
          loading="lazy"
        />
        <span
          className="absolute bottom-2 right-2 rounded-md bg-paper/95 p-2"
          aria-hidden="true"
        >
          <Maximize2 size={16} />
        </span>
      </button>
      {controls()}
      {images.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Choose an image">
          {images.map((item, n) => (
            <button
              key={item.id}
              type="button"
              className={`h-12 w-12 overflow-hidden rounded-md border-2 bg-paper ${n === index ? "border-olive" : "border-border"}`}
              aria-label={`${n === 0 ? "Cover image" : "Image " + (n + 1)} for ${option.title}`}
              aria-pressed={n === index}
              onClick={() => setSelected(n)}
            >
              <img
                src={source(n)}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="app-dialog-overlay" />
          <Dialog.Content
            className="app-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus({ preventScroll: true });
            }}
            onKeyDown={(e) => {
              if (
                images.length > 1 &&
                (e.key === "ArrowLeft" || e.key === "ArrowRight")
              ) {
                e.preventDefault();
                e.stopPropagation();
                change(e.key === "ArrowLeft" ? -1 : 1);
              }
            }}
          >
            <Dialog.Title>{option.title}</Dialog.Title>
            <Dialog.Description>
              Image {index + 1} of {images.length}
              {images.length > 1
                ? ". Use the arrows to browse this option."
                : "."}
            </Dialog.Description>
            <img
              src={source(index)}
              alt={`${option.title} — image ${index + 1}`}
              className="mt-3 max-h-[65vh] w-full object-contain"
            />
            {controls(true)}
            <Dialog.Close className="app-button mt-4 min-h-11">
              Close images
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
