"use client";
import { useState } from "react";
import { Download, LoaderCircle, Paperclip } from "lucide-react";
import type { RequirementAttachment } from "@/lib/customer/operations-intake-model";
export function RequirementAttachments({
  files,
  load,
}: {
  files: RequirementAttachment[];
  load?: (id: string) => Promise<Response>;
}) {
  const [busy, setBusy] = useState<string | null>(null),
    [message, setMessage] = useState("");
  if (!files.length) return null;
  async function download(file: RequirementAttachment) {
    if (busy || !load) return;
    setBusy(file.id);
    setMessage("");
    try {
      const response = await load(file.id);
      if (!response.ok)
        throw Error(
          "This attachment could not be downloaded. Please try again.",
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Attachment unavailable.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section
      className="mt-5 border-t border-border pt-4"
      aria-label="Requirement attachments"
    >
      <h3 className="flex items-center gap-2 font-medium">
        <Paperclip size={16} />
        Requirement attachments
      </h3>
      <p className="app-note mt-2">
        These files are shared with the customer on this request.
      </p>
      <ul className="mt-2 divide-y divide-border">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div className="min-w-0">
              <p className="break-words text-sm">{file.filename}</p>
              <p className="app-note">
                {file.mime_type === "application/pdf" ? "PDF" : "Image"} ·{" "}
                {Math.ceil(file.size / 1024)} KB
              </p>
            </div>
            {load ? (
              <button
                type="button"
                className="app-button min-h-11"
                disabled={!!busy}
                onClick={() => void download(file)}
              >
                {busy === file.id ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                Download<span className="sr-only"> {file.filename}</span>
              </button>
            ) : (
              <a
                className="app-button min-h-11"
                href={`/api/customer-assets/requirement/${file.id}`}
              >
                <Download size={16} />
                Download<span className="sr-only"> {file.filename}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      <p role="status" className="app-note min-h-5">
        {message}
      </p>
    </section>
  );
}
