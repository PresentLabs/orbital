import { Pool, type PoolClient } from "pg";
import { ModuleError } from "../modules/security.ts";

export const reservationPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

export async function reservationTransaction<T>(workspace: number, fn: (client: PoolClient) => Promise<T>) {
  const client = await reservationPool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id FROM workspaces WHERE id=$1 FOR UPDATE", [workspace]);
    if (!found.rows[0]) throw new ModuleError("Negocio no válido.", 404);
    const grant = await client.query(
      "SELECT enabled FROM module_grants WHERE workspace_id=$1 AND module_id='reservations'", [workspace],
    );
    if (!grant.rows[0]?.enabled) throw new ModuleError("Agendamiento no está activo para este negocio.", 403);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
export async function audit(client: PoolClient, workspace: number, actor: number, action: string, recordId: number, data: unknown) {
  await client.query(
    "INSERT INTO reservation_audit(workspace_id,actor_id,action,record_id,data) VALUES($1,$2,$3,$4,$5)",
    [workspace, actor, action, recordId, JSON.stringify(data)],
  );
}
