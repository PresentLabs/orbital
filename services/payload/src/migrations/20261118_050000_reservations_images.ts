import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE reservation_catalog_images (
      catalog_id integer PRIMARY KEY,
      workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 524288),
      width integer NOT NULL CHECK(width BETWEEN 1 AND 960),
      height integer NOT NULL CHECK(height BETWEEN 1 AND 640),
      updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(workspace_id,catalog_id) REFERENCES reservation_catalog(workspace_id,id) ON DELETE CASCADE
    );
    CREATE INDEX reservation_catalog_images_workspace_idx ON reservation_catalog_images(workspace_id);
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere respaldar las imágenes del catálogo.");
}
