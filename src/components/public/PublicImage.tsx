import Image from "next/image";
import { publicAssetExists } from "@/lib/public-asset";
import type { PublicMediaImage } from "@/config/public-media";
import { cn } from "@/lib/utils/cn";

type PublicImageProps = {
  image: PublicMediaImage;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
};

/**
 * Server-only image that prefers the gyvft path and falls back to a known
 * legacy asset when the new file is not yet on disk.
 */
export function PublicImage({ image, className, fill = true, priority, sizes }: PublicImageProps) {
  const src =
    publicAssetExists(image.src)
      ? image.src
      : image.fallbackSrc && publicAssetExists(image.fallbackSrc)
        ? image.fallbackSrc
        : image.src;

  if (fill) {
    return (
      <Image
        alt={image.alt}
        className={cn("object-cover", className)}
        fill
        priority={priority}
        sizes={sizes}
        src={src}
      />
    );
  }

  return (
    <Image
      alt={image.alt}
      className={className}
      height={800}
      priority={priority}
      sizes={sizes}
      src={src}
      width={1200}
    />
  );
}
