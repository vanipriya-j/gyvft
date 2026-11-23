// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FilmButton,
  WorkspacePreview,
} from "@/components/public/customer-homepage-interactions";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  ),
}));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
});
const click = async (element: HTMLElement) => act(async () => element.click());
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent === text,
  )!;

describe("public product preview", () => {
  it("supports keyboard navigation and exposes a panel for every tab", async () => {
    await act(async () => root.render(<WorkspacePreview />));
    for (const tab of document.querySelectorAll('[role="tab"]'))
      expect(
        document.getElementById(tab.getAttribute("aria-controls")!),
      ).not.toBeNull();
    const gifts = button("Your gifts");
    gifts.focus();
    await act(async () =>
      gifts.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(document.activeElement).toBe(button("Occasions"));
    expect(
      document.querySelector('[role="tabpanel"]:not([hidden])')?.textContent,
    ).toContain("Amma’s birthday");
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      ),
    );
    expect(
      document.querySelector('[role="tabpanel"]:not([hidden])')?.textContent,
    ).toContain("Our family");
    await act(async () =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
      ),
    );
    await click(
      document.querySelector<HTMLInputElement>('input[value="keepsake"]')!,
    );
    expect(
      document.querySelector('[aria-live="polite"]')?.textContent,
    ).toContain("A little keepsake selected in this example");
  });
  it("loads each film only on demand inside a named, closable dialog", async () => {
    await act(async () =>
      root.render(
        <>
          <FilmButton>Why GYVFT?</FilmButton>
          <FilmButton film="solution">See how GYVFT helps</FilmButton>
        </>,
      ),
    );
    expect(document.querySelector("video")).toBeNull();
    await click(button("Why GYVFT?"));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("You know the person. Why is finding their gift so hard?");
    expect(document.querySelector("video source")?.getAttribute("src")).toBe(
      "/website-review/gyvft-your-story.mp4",
    );
    await click(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close film"]',
      )!,
    );
    expect(document.querySelector("video")).toBeNull();
    await click(button("See how GYVFT helps"));
    const solution = document.querySelector('[role="dialog"]')!;
    expect(
      document.getElementById(solution.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("GYVFT — for you, your people and your organisation");
    expect(document.querySelector("video source")?.getAttribute("src")).toBe(
      "/website-review/gyvft-how-it-works.mp4",
    );
    expect(document.querySelector("video track")?.getAttribute("kind")).toBe(
      "descriptions",
    );
    expect(document.querySelector("video track")?.getAttribute("label")).toBe(
      "English on-screen text",
    );
    expect(document.querySelector("details")?.textContent).toContain(
      "Bring your people. Bring your next idea.",
    );
    await click(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close film"]',
      )!,
    );
    expect(document.querySelector("video")).toBeNull();
  });
});
