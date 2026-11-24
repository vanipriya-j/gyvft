"use client";
import { MAX_OPTION_PREVIEW_BYTES } from "./option-image-model";

export type PreparedOptionImage = {
  key: string;
  name: string;
  mime: string;
  data: string;
};

export async function prepareOptionImage(
  file: File,
): Promise<PreparedOptionImage> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  )
    throw Error("Choose PNG, JPEG or WebP images under 10 MB each.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw Error(`${file.name} could not be opened. Choose another image.`);
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error(`${file.name} could not be opened.`);
    let blob: Blob | null = null;
    for (const maxSide of [1600, 1280, 1024, 800]) {
      const scale = Math.min(
        1,
        maxSide / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw Error(
          "Images could not be prepared in this browser. Try another browser.",
        );
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.76, 0.64]) {
        blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", quality),
        );
        if (blob && blob.size <= MAX_OPTION_PREVIEW_BYTES) break;
      }
      if (blob && blob.size <= MAX_OPTION_PREVIEW_BYTES) break;
    }
    if (!blob || blob.size > MAX_OPTION_PREVIEW_BYTES)
      throw Error(
        `${file.name} is too detailed to prepare. Try a smaller version.`,
      );
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(Error(`${file.name} could not be read.`));
      reader.readAsDataURL(blob);
    });
    return { key: crypto.randomUUID(), name: file.name, mime: blob.type, data };
  } finally {
    URL.revokeObjectURL(url);
  }
}
