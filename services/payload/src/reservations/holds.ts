import type { PoolClient } from "pg";
import { ModuleError } from "../modules/security.ts";
import { reservationPool, reservationTransaction } from "./store.ts";

// The caller holds the workspace lock; expiration and its audit event commit together.
export async function expirePaymentHolds(client: PoolClient, workspace: number) {
  const expired = await client.query(`
    WITH expired AS (
      UPDATE reservation_bookings SET status='canceled',version=version+1,updated_at=clock_timestamp()
      WHERE workspace_id=$1 AND status='pending' AND payment_status='unpaid' AND hold_expires_at<=clock_timestamp()
      RETURNING id,hold_expires_at
    ), events AS (
      INSERT INTO reservation_audit(workspace_id,actor_id,action,record_id,data)
      SELECT $1,0,'payment-hold-expired',id,jsonb_build_object('reason','El plazo para pagar venció y el horario se liberó automáticamente.','expiredAt',hold_expires_at)
      FROM expired RETURNING record_id
    ) SELECT count(*)::integer AS count FROM events
  `,[workspace]);
  return expired.rows[0].count as number;
}
export async function expireDuePaymentHolds(limit = 100) {
  const workspaces = await reservationPool.query(`SELECT DISTINCT b.workspace_id FROM reservation_bookings b
    JOIN module_grants g ON g.workspace_id=b.workspace_id AND g.module_id='reservations' AND g.enabled=true
    WHERE b.status='pending' AND b.payment_status='unpaid' AND b.hold_expires_at<=clock_timestamp() ORDER BY b.workspace_id LIMIT $1`,[limit]);
  let count = 0;
  for (const row of workspaces.rows) {
    try { count += await reservationTransaction(row.workspace_id,client=>expirePaymentHolds(client,row.workspace_id)); }
    catch (error) { if (!(error instanceof ModuleError && error.status===403)) throw error; }
  }
  return count;
}
