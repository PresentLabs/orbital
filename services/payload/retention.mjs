import { getPayload } from "payload";
import { RETENTION_MS } from "./src/retention.ts";
try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile();
} catch {}
const { default: config } = await import("./src/payload.config.ts");
async function purge() {
  const payload = await getPayload({ config });
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  let count = 0;
  for (const collection of ["documents", "files", "workspace-files", "vault", "users"]) {
    let more = true;
    while (more) {
      const rows = await payload.find({
        collection,
        where: {
          and: [
            { deletedAt: { less_than_equal: cutoff } },
            ...(collection === "users"
              ? [{ role: { not_equals: "owner" } }]
              : []),
          ],
        },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      });
      more = rows.docs.length === 200;
      for (const row of rows.docs) {
        if (collection === "users" && row.role === "owner") continue;
        if (collection === "documents" && row.key.startsWith("tasks:"))
          for (const related of ["comments", "notifications"])
            await payload.delete({
              collection: related,
              where: {
                and: [
                  {
                    workspace: {
                      equals:
                        typeof row.workspace === "object"
                          ? row.workspace.id
                          : row.workspace,
                    },
                  },
                  { taskId: { equals: row.key.slice(6) } },
                ],
              },
              overrideAccess: true,
            });
        await payload.delete({ collection, id: row.id, overrideAccess: true });
        count++;
      }
    }
  }
  return count;
}
let busy = false;
async function run() {
  if (busy) return;
  busy = true;
  try {
    const count = await purge();
    if (count)
      console.log("Papelera: eliminados " + count + " elementos vencidos.");
  } catch {
    console.error(
      "Papelera: no se pudo comprobar la retención; se reintentará.",
    );
  } finally {
    busy = false;
  }
}
await run();
if (process.argv.includes("--once")) process.exit(0);
setInterval(run, 60000);
