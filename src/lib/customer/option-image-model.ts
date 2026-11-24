export const MAX_OPTION_IMAGES = 6;
/** Six inline previews fit the existing API and hosting request-size limits. */
export const MAX_OPTION_PREVIEW_BYTES = 320 * 1024;
export type OptionImage = {
  id: string;
  kind: "gift-option" | "gift-option-image";
  position: number;
};

export function optionGallery(option: {
  id: string;
  has_image: boolean;
  images?: OptionImage[];
}): OptionImage[] {
  if (!option.has_image) return [];
  return [
    { id: option.id, kind: "gift-option", position: 1 },
    ...(option.images || [])
      .filter((image) => image.kind === "gift-option-image")
      .sort((a, b) => a.position - b.position),
  ];
}
