import sharp from "sharp";
import { createHash } from "node:crypto";
import { ModuleError } from "../modules/security.ts";

export const catalogImageMaxBytes = 4 * 1024 * 1024;
const formats: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp", "image/gif": "gif" };
export async function prepareCatalogImage(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ModuleError("Selecciona una imagen válida.");
  const { mime, data } = input as { mime?: unknown; data?: unknown };
  if (typeof mime !== "string" || !formats[mime] || typeof data !== "string" || !data.length ||
      data.length > 4 * Math.ceil(catalogImageMaxBytes / 3) || (data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(data)))
    throw new ModuleError("Usa una imagen PNG, JPG, WebP o GIF de hasta 4 MB.");
  const original = Buffer.from(data, "base64");
  if (original.toString("base64") !== data) throw new ModuleError("Selecciona una imagen válida.");
  if (!original.length || original.length > catalogImageMaxBytes) throw new ModuleError("La imagen supera los 4 MB.");
  try {
    const image = sharp(original, { animated: false, limitInputPixels: 32_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== formats[mime]) throw new Error("format");
    const { data: bytes, info } = await image.rotate().resize({ width: 960, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (!bytes.length || bytes.length > 512 * 1024) throw new Error("size");
    return { bytes, width: info.width, height: info.height, hash: createHash("sha256").update(original).digest("hex") };
  } catch {
    throw new ModuleError("No pudimos leer la imagen. Prueba con otro archivo PNG, JPG, WebP o GIF.");
  }
}
