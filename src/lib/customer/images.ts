export function validImage(bytes: Buffer, mime: string) {
  if (bytes.length < 12 || bytes.length > 2 * 1024 * 1024) return false;
  return mime === "image/png"
    ? bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/webp"
        ? bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP"
        : false;
}
