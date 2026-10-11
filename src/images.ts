export interface ImageType {
  mime: string;
  ext: string;
}

/** Dateityp anhand der ersten Bytes bestimmen. Der vom Client gemeldete Typ wird nie geglaubt. */
export function sniffImage(b: Uint8Array): ImageType | null {
  const startsWith = (...bytes: number[]) => bytes.every((v, i) => b[i] === v);
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: 'image/png', ext: 'png' };
  if (startsWith(0xff, 0xd8, 0xff)) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(0x47, 0x49, 0x46, 0x38) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return { mime: 'image/gif', ext: 'gif' };
  if (startsWith(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
export const IMAGE_FILE = /^img-\d\.(png|jpg|webp|gif)$/;
