import sharp from "sharp";
export async function optimizeWorkspaceImage(file: {
  data: Buffer;
  name: string;
  mimetype: string;
  size: number;
}) {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.mimetype,
    )
  )
    return file;
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw Error("La imagen debe pesar hasta 20 MB.");
  const input = sharp(file.data, {
      animated: true,
      limitInputPixels: 64_000_000,
      failOn: "error",
    }),
    meta = await input.metadata();
  if (!["png", "jpeg", "webp", "gif"].includes(meta.format || ""))
    throw Error("La imagen no es compatible.");
  const frameHeight = meta.pageHeight || meta.height || 0,
    width = meta.width || 0;
  const resized = Math.max(width, frameHeight) > 1600;
  const data = await input
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ lossless: true, effort: 5 })
    .toBuffer();
  // Never replace a smaller original unless resizing or orientation requires it.
  if (
    !resized &&
    (!meta.orientation || meta.orientation === 1) &&
    data.length >= file.size
  )
    return file;
  return {
    ...file,
    data,
    size: data.length,
    name: file.name.replace(/\.[^.]+$/, "") + ".webp",
    mimetype: "image/webp",
  };
}
