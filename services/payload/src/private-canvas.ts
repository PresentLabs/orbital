import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

type RecordScope = { workspace: string; key: string; owner: string };
type Sealed = { canvasCipher: "aes-256-gcm-v1"; iv: string; tag: string; data: string };
export const privateCanvasKey = (key: string) => /^(spaces|nodes|edges|pages|tasks|boards):/.test(key);
export const isSealedCanvas = (value: unknown): value is Sealed =>
  !!value && typeof value === "object" && "canvasCipher" in value && value.canvasCipher === "aes-256-gcm-v1";

function keyFor(secret: string, scope: RecordScope) {
  if (secret.length < 32) throw new Error("Configura PRIVATE_CANVAS_SECRET o PAYLOAD_SECRET con al menos 32 caracteres.");
  return Buffer.from(hkdfSync("sha256", secret, JSON.stringify([scope.workspace, scope.owner]), "orbita/private-canvas/v1", 32));
}
const aad = (scope: RecordScope) => Buffer.from(JSON.stringify([scope.workspace, scope.owner, scope.key]));

export function sealCanvas(value: unknown, scope: RecordScope, secret: string): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret, scope), iv);
  cipher.setAAD(aad(scope));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { canvasCipher: "aes-256-gcm-v1", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}
export function unsealCanvas(value: Sealed, scope: RecordScope, secret: string) {
  const cipher = createDecipheriv("aes-256-gcm", keyFor(secret, scope), Buffer.from(value.iv, "base64"));
  cipher.setAAD(aad(scope));
  cipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data, "base64")), cipher.final()]).toString("utf8"));
}
