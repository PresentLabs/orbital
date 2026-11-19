import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE reservation_bookings ADD COLUMN hold_expires_at timestamptz;
    CREATE INDEX reservation_payment_holds_idx ON reservation_bookings(workspace_id,hold_expires_at)
      WHERE status='pending' AND payment_status='unpaid';
    -- Existing unpaid holds receive a fresh grace period instead of expiring during migration.
    UPDATE reservation_bookings SET hold_expires_at=clock_timestamp()+interval '15 minutes'
      WHERE status='pending' AND payment_status='unpaid';
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere conservar los vencimientos e historial de retenciones.");
}
