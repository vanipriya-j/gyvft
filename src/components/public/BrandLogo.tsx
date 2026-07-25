import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  /** Visual height in pixels; width follows the wordmark aspect ratio. */
  height?: number;
  priority?: boolean;
};

/** Master brand asset uploaded at public/images/brand/GYVFT_3x.png */
const LOGO_SRC = "/images/brand/GYVFT_3x.png";
/** Content bbox aspect inside the square master (wordmark band). */
const INTRINSIC_WIDTH = 1275;
const INTRINSIC_HEIGHT = 312;

export function BrandLogo({ className, height = 28, priority = false }: BrandLogoProps) {
  const width = Math.round((height * INTRINSIC_WIDTH) / INTRINSIC_HEIGHT);

  return (
    <Image
      alt="GYVFT"
      className={`object-cover object-center ${className ?? ""}`.trim()}
      height={height}
      priority={priority}
      src={LOGO_SRC}
      width={width}
    />
  );
}
