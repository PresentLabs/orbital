import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeWorkspaceImage } from "../src/image-optimization.ts";
async function file(width, height) {
  const data = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 110, g: 0, b: 254, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  return {
    data,
    name: "captura.png",
    size: data.length,
    mimetype: "image/png",
  };
}
test("images keep aspect ratio, fit within 1600 pixels and retain alpha", async () => {
  for (const [w, h, ow, oh] of [
    [2400, 1200, 1600, 800],
    [800, 2400, 533, 1600],
    [900, 600, 900, 600],
  ]) {
    const input = await file(w, h),
      out = await optimizeWorkspaceImage(input),
      meta = await sharp(out.data).metadata();
    assert.equal(meta.width, ow);
    assert.equal(meta.height, oh);
    assert.equal(meta.hasAlpha, true);
    assert.ok(out.size === out.data.length);
  }
});
test("lossless compression preserves decoded pixels when no resize is needed", async () => {
  const input = await file(300, 200),
    out = await optimizeWorkspaceImage(input);
  assert.deepEqual(
    await sharp(out.data).raw().toBuffer(),
    await sharp(input.data).raw().toBuffer(),
  );
  assert.ok(out.size <= input.size);
});
test("non-image resources remain unchanged and invalid images are rejected", async () => {
  const doc = {
    data: Buffer.from("example"),
    name: "example.txt",
    mimetype: "text/plain",
    size: 7,
  };
  assert.equal(await optimizeWorkspaceImage(doc), doc);
  await assert.rejects(() =>
    optimizeWorkspaceImage({ ...doc, mimetype: "image/png" }),
  );
});
test("animated images keep every frame while resizing", async () => {
  const width = 2000,
    height = 1000,
    raw = Buffer.alloc(width * height * 2 * 4);
  for (let p = 0; p < width * height * 2; p++) {
    raw[p * 4 + (p < width * height ? 0 : 2)] = 255;
    raw[p * 4 + 3] = 255;
  }
  const data = await sharp(raw, {
    raw: { width, height: height * 2, pageHeight: height, channels: 4 },
  })
    .gif({ delay: [100, 100], loop: 0 })
    .toBuffer();
  const input = {
      data,
      name: "animacion.gif",
      mimetype: "image/gif",
      size: data.length,
    },
    out = await optimizeWorkspaceImage(input),
    meta = await sharp(out.data, { animated: true }).metadata();
  assert.equal(meta.width, 1600);
  assert.equal(meta.pageHeight, 800);
  assert.equal(meta.pages, 2);
});
