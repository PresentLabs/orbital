import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE reservation_catalog DROP CONSTRAINT reservation_catalog_kind_check;
    ALTER TABLE reservation_catalog ADD CONSTRAINT reservation_catalog_kind_check
      CHECK(kind IN ('service','professional','location','resource','customer','category'));
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere conservar las categorías y sus asignaciones.");
}
