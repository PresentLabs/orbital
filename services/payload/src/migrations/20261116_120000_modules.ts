import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres';
export async function up({db}: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "module_installations" (
      "id" serial PRIMARY KEY NOT NULL,
      "workspace_id" integer NOT NULL REFERENCES "workspaces"("id") ON DELETE RESTRICT,
      "module_id" varchar NOT NULL,
      "workspace_key" varchar NOT NULL,
      "version" varchar NOT NULL,
      "enabled" boolean DEFAULT false,
      "credentials" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "module_installations_workspace_idx" ON "module_installations" ("workspace_id");
    CREATE UNIQUE INDEX "module_installations_workspace_key_idx" ON "module_installations" ("workspace_key");
    CREATE INDEX "module_installations_updated_at_idx" ON "module_installations" ("updated_at");
    CREATE INDEX "module_installations_created_at_idx" ON "module_installations" ("created_at");
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('La reversión automática eliminaría las conexiones del módulo. Respalda y migra explícitamente los datos antes de revertir.');
}
