import { type MigrateUpArgs, type MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "workspaces" ADD COLUMN "next_payment_at" timestamp(3) with time zone;
    ALTER TABLE "workspaces" ADD COLUMN "billing_status" varchar DEFAULT 'trial';
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere respaldar las fechas y estados de suscripción antes de eliminar columnas.");
}
