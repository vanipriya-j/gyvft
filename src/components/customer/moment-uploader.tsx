"use client";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadOneGiftPhoto } from "@/app/account/journey-actions";
export function MomentUploader({ projectId }: { projectId: string }) {
  const hydrated = useHydrated();
  const router = useRouter(),
    lock = useRef(false),
    resume = useRef<{
      fingerprint: string;
      ids: string[];
      done: number;
    } | null>(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget,
      data = new FormData(form),
      files = data
        .getAll("photos")
        .filter((f): f is File => f instanceof File && f.size > 0);
    if (
      !files.length ||
      files.length > 6 ||
      files.some(
        (f) =>
          f.size > 2 * 1024 * 1024 ||
          !["image/png", "image/jpeg", "image/webp"].includes(f.type),
      )
    ) {
      setError("Choose up to six PNG, JPEG or WebP photos under 2 MB each.");
      return;
    }
    const fingerprint = JSON.stringify([
      files.map((f) => [f.name, f.size, f.lastModified]),
      data.get("caption"),
      data.get("kind"),
      data.has("public_permission"),
    ]);
    if (resume.current?.fingerprint !== fingerprint)
      resume.current = {
        fingerprint,
        ids: files.map(() => crypto.randomUUID()),
        done: 0,
      };
    const plan = resume.current;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      for (let i = plan.done; i < files.length; i++) {
        setProgress(`Saving photo ${i + 1} of ${files.length}…`);
        const single = new FormData();
        for (const key of ["caption", "kind", "rights", "public_permission"])
          if (data.has(key)) single.set(key, data.get(key)!);
        single.set("photo", files[i]);
        const result = await uploadOneGiftPhoto(projectId, plan.ids[i], single);
        if (!result.ok) {
          setError(
            `${plan.done} of ${files.length} photos saved. ${result.message} Retry to continue; saved photos won’t be duplicated.`,
          );
          return;
        }
        plan.done = i + 1;
      }
      setProgress(
        `${files.length} ${files.length === 1 ? "photo" : "photos"} saved.`,
      );
      resume.current = null;
      form.reset();
      router.refresh();
    } catch {
      setError(
        "The upload could not be confirmed. Retry to continue without duplicating confirmed photos.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void save(event)}>
      <fieldset disabled={busy || !hydrated}>
        <label className="app-label">
          Photos (up to six, 2 MB each)
          <input
            className="app-input"
            name="photos"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            required
          />
        </label>
        <label className="app-label">
          What’s happening?
          <select className="app-input" name="kind">
            {[
              "Gift distribution",
              "Someone using their gift",
              "Unwrapping",
              "The celebration",
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="app-label">
          Caption
          <textarea className="app-input" name="caption" maxLength={500} />
        </label>
        <label className="app-check">
          <input type="checkbox" name="rights" required />I have permission from
          the people shown to share these photos with Aarla.
        </label>
        <label className="app-check">
          <input type="checkbox" name="public_permission" />
          Aarla may also feature these photos and captions publicly.
        </label>
        <button className="app-button primary mt-4">
          {busy
            ? "Saving photos…"
            : error
              ? "Retry photo upload"
              : "Save photos"}
        </button>
      </fieldset>
      <p role="status" className="app-success mt-3">
        {progress}
      </p>
      {error && (
        <p role="alert" className="app-alert mt-2">
          {error}
        </p>
      )}
      <p className="app-note">
        Private by default. Each photo keeps its own permission, which you can
        withdraw without deleting the private copy.
      </p>
    </form>
  );
}
