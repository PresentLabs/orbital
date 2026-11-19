import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "module_grants" (
      "id" serial PRIMARY KEY,
      "workspace_id" integer NOT NULL REFERENCES "workspaces"("id") ON DELETE RESTRICT,
      "module_id" varchar NOT NULL,
      "workspace_key" varchar NOT NULL UNIQUE,
      "enabled" boolean DEFAULT false,
      "changed_by" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "module_grants_workspace_idx" ON "module_grants" ("workspace_id");
    CREATE INDEX "module_grants_updated_at_idx" ON "module_grants" ("updated_at");
    CREATE INDEX "module_grants_created_at_idx" ON "module_grants" ("created_at");
    INSERT INTO "module_grants" ("workspace_id", "module_id", "workspace_key", "enabled", "changed_by")
    SELECT "workspace_id", "module_id", "workspace_key", COALESCE("enabled", false), 'migration'
    FROM "module_installations"
    ON CONFLICT ("workspace_key") DO NOTHING;
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere conservar las concesiones del dueño del SaaS.");
}
