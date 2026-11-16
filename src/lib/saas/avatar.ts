export function squareCrop(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw Error("La imagen no tiene un tamaño válido.");
  const side = Math.min(width, height);
  return { x: (width - side) / 2, y: (height - side) / 2, side, size: 256 };
}
export async function prepareAvatar(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw Error("Elige una foto PNG, JPG o WebP de hasta 15 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const crop = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = crop.size;
    const context = canvas.getContext("2d");
    if (!context) throw Error("No pudimos preparar la foto.");
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.side,
      crop.side,
      0,
      0,
      crop.size,
      crop.size,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error("No pudimos comprimir la imagen.")),
        "image/webp",
        0.82,
      ),
    );
    if (blob.size > 250000)
      throw Error("No pudimos reducir la foto. Prueba otra imagen.");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error("No pudimos leer la foto."));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
  }
}
