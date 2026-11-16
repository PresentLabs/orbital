// Run from this directory with: node --env-file=.env --experimental-strip-types reminders.mjs --send
// Without --send, the command only counts eligible deliveries and sends nothing.
import { getPayload } from "payload";
import config from "./src/payload.config.ts";
import { createHash, webcrypto } from "node:crypto";
const live = process.argv.includes("--send");
const payload = await getPayload({ config });
const secret = process.env.INTEGRATIONS_SECRET || "";
if (secret.length < 32)
  throw new Error(
    "INTEGRATIONS_SECRET must match the Astro server and contain at least 32 characters",
  );
async function decrypt(value) {
  const bytes = Buffer.from(value, "base64");
  const key = await webcrypto.subtle.importKey(
    "raw",
    createHash("sha256").update(secret).digest(),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plain = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.subarray(0, 12) },
    key,
    bytes.subarray(12),
  );
  return JSON.parse(Buffer.from(plain).toString());
}
let page = 1,
  eligible = 0,
  sent = 0,
  failed = 0;
try {
  while (true) {
    const batch = await payload.find({
      collection: "documents",
      where: {
        and: [
          { key: { contains: "tasks:" } },
          { privateOwner: { exists: false } },
        ],
      },
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    });
    for (const doc of batch.docs) {
      const task = doc.value;
      if (!task?.due || task.status === "done") continue;
      const workspace =
        typeof doc.workspace === "object" ? doc.workspace.id : doc.workspace;
      const settings = await payload.find({
        collection: "documents",
        where: {
          and: [
            { workspace: { equals: workspace } },
            { key: { equals: "settings" } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const timezone = settings.docs[0]?.value?.timezone || "America/Santiago";
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      if (task.due > today) continue;
      const connections = await payload.find({
        collection: "integrations",
        where: {
          and: [
            { workspace: { equals: workspace } },
            { provider: { in: ["email", "whatsapp"] } },
          ],
        },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      });
      for (const connection of connections.docs) {
        const key = `${workspace}:${task.id}:${today}:${connection.provider}`;
        const existing = await payload.find({
          collection: "deliveries",
          where: { key: { equals: key } },
          limit: 1,
          overrideAccess: true,
        });
        if (existing.docs.length) continue;
        eligible++;
        if (!live) continue;
        let delivery;
        try {
          delivery = await payload.create({
            collection: "deliveries",
            data: {
              workspace,
              key,
              status: "pending",
              provider: connection.provider,
            },
            overrideAccess: true,
          });
        } catch {
          continue;
        }
        try {
          const c = await decrypt(connection.credentials);
          let response;
          if (connection.provider === "email") {
            response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + c.token,
                "Content-Type": "application/json",
                "Idempotency-Key": createHash("sha256")
                  .update(key)
                  .digest("hex"),
              },
              body: JSON.stringify({
                from: c.from,
                to: [c.to],
                subject: "Tu próximo paso: " + task.title,
                text: `Tienes una tarea pendiente en Órbita.\n\n${task.title}\nDeadline: ${task.due}\nProyecto: ${task.project || "Mi negocio"}\n\nUn paso a la vez también es avanzar.`,
              }),
              signal: AbortSignal.timeout(15000),
            });
          } else {
            const version = process.env.WHATSAPP_GRAPH_VERSION;
            if (!/^v\d+\.0$/.test(version || ""))
              throw new Error("WHATSAPP_GRAPH_VERSION must be configured");
            if (!/^\d+$/.test(c.phoneId)) throw new Error("Invalid phone ID");
            response = await fetch(
              `https://graph.facebook.com/${version}/${c.phoneId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: "Bearer " + c.token,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: c.to,
                  type: "template",
                  template: {
                    name: c.template,
                    language: { code: c.language || "es" },
                    components: [
                      {
                        type: "body",
                        parameters: [
                          {
                            type: "text",
                            text: String(task.title).slice(0, 140),
                          },
                        ],
                      },
                    ],
                  },
                }),
                signal: AbortSignal.timeout(15000),
              },
            );
          }
          if (!response.ok)
            throw new Error("Provider returned " + response.status);
          await payload.update({
            collection: "deliveries",
            id: delivery.id,
            data: { status: "sent" },
            overrideAccess: true,
          });
          sent++;
        } catch {
          await payload.update({
            collection: "deliveries",
            id: delivery.id,
            data: { status: "error" },
            overrideAccess: true,
          });
          failed++;
        }
      }
    }
    if (!batch.hasNextPage) break;
    page++;
  }
  console.log(
    JSON.stringify({ mode: live ? "send" : "dry-run", eligible, sent, failed }),
  );
} finally {
  await payload.destroy();
}
