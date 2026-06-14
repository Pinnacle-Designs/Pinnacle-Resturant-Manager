const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function matchesDeclaredImageType(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;

  if (mime === "image/jpeg") {
    return (
      buffer[0] === JPEG_MAGIC[0] &&
      buffer[1] === JPEG_MAGIC[1] &&
      buffer[2] === JPEG_MAGIC[2]
    );
  }

  if (mime === "image/png") {
    return PNG_MAGIC.every((byte, index) => buffer[index] === byte);
  }

  if (mime === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}
