import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE module_grant_events (
      id bigserial PRIMARY KEY,
      workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      module_id varchar NOT NULL, actor_id integer NOT NULL,
      enabled_before boolean NOT NULL, enabled_after boolean NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX module_grant_events_workspace_idx ON module_grant_events(workspace_id,created_at);
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere conservar la auditoría de activación.");
}
