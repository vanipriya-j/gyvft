import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  /** Visual height in pixels; width follows the wordmark aspect ratio. */
  height?: number;
  priority?: boolean;
};

const LOGO_SRC = "/images/brand/gyvft-logo.png";
const INTRINSIC_WIDTH = 902;
const INTRINSIC_HEIGHT = 218;

export function BrandLogo({ className, height = 28, priority = false }: BrandLogoProps) {
  const width = Math.round((height * INTRINSIC_WIDTH) / INTRINSIC_HEIGHT);

  return (
    <Image
      alt="GYVFT"
      className={className}
      height={height}
      priority={priority}
      src={LOGO_SRC}
      width={width}
    />
  );
}
