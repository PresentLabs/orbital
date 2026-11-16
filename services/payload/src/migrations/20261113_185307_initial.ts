import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_permissions" AS ENUM('overview', 'profile', 'documents', 'orders', 'customers', 'invoices', 'canvas', 'tasks', 'calendar', 'files', 'analytics', 'pages', 'integrations', 'vault', 'team', 'settings');
  CREATE TYPE "public"."enum_users_job_title" AS ENUM('propietario-tienda', 'gerente-ecommerce', 'gestor-catalogo', 'gestor-pedidos', 'atencion-cliente', 'marketing', 'logistica', 'finanzas');
  CREATE TYPE "public"."enum_users_role" AS ENUM('owner', 'admin', 'editor', 'member', 'viewer');
  CREATE TYPE "public"."enum_workspaces_plan" AS ENUM('starter', 'pro');
  CREATE TYPE "public"."enum_integrations_provider" AS ENUM('woo', 'shopify', 'payload', 'google', 'email', 'whatsapp');
  CREATE TYPE "public"."enum_deliveries_provider" AS ENUM('email', 'whatsapp');
  CREATE TYPE "public"."enum_deliveries_status" AS ENUM('pending', 'sent', 'error');
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('mention', 'message', 'poll');
  CREATE TYPE "public"."enum_files_kind" AS ENUM('documento', 'factura', 'boleta');
  CREATE TABLE "users_permissions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_permissions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"phone" varchar,
  	"avatar_data" varchar,
  	"deleted_at" timestamp(3) with time zone,
  	"job_title" "enum_users_job_title",
  	"role" "enum_users_role" DEFAULT 'member',
  	"disabled" boolean DEFAULT false,
  	"workspace_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "workspaces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"plan" "enum_workspaces_plan" DEFAULT 'starter',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"trash_group" varchar,
  	"workspace_id" integer NOT NULL,
  	"private_owner" varchar,
  	"key" varchar NOT NULL,
  	"workspace_key" varchar NOT NULL,
  	"value" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "integrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"workspace_id" integer NOT NULL,
  	"provider" "enum_integrations_provider" NOT NULL,
  	"workspace_provider" varchar NOT NULL,
  	"credentials" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "deliveries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"workspace_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"provider" "enum_deliveries_provider" NOT NULL,
  	"status" "enum_deliveries_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"workspace_id" integer NOT NULL,
  	"private_owner" varchar,
  	"task_id" varchar NOT NULL,
  	"author_id" integer NOT NULL,
  	"author_name" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_notifications_kind" DEFAULT 'mention',
  	"poll_id" varchar,
  	"author_id" varchar,
  	"author_name" varchar,
  	"workspace_id" integer NOT NULL,
  	"recipient_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"task_id" varchar,
  	"comment_id" varchar,
  	"text" varchar NOT NULL,
  	"read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "polls" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"workspace_id" integer NOT NULL,
  	"author_id" varchar NOT NULL,
  	"question" varchar NOT NULL,
  	"options" jsonb NOT NULL,
  	"recipients" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "poll_votes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"poll_id" varchar NOT NULL,
  	"user_id" varchar NOT NULL,
  	"option" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vault" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"workspace_id" integer NOT NULL,
  	"credentials" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"workspace_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"kind" "enum_files_kind" DEFAULT 'documento' NOT NULL,
  	"order_id" numeric,
  	"folio" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "workspace_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"folder_id" integer,
  	"workspace_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "workspace_folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"workspace_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"key" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"workspaces_id" integer,
  	"documents_id" integer,
  	"integrations_id" integer,
  	"deliveries_id" integer,
  	"comments_id" integer,
  	"notifications_id" integer,
  	"polls_id" integer,
  	"poll_votes_id" integer,
  	"vault_id" integer,
  	"files_id" integer,
  	"workspace_files_id" integer,
  	"workspace_folders_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_permissions" ADD CONSTRAINT "users_permissions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "polls" ADD CONSTRAINT "polls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vault" ADD CONSTRAINT "vault_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_folder_id_workspace_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."workspace_folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workspace_folders" ADD CONSTRAINT "workspace_folders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workspaces_fk" FOREIGN KEY ("workspaces_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_integrations_fk" FOREIGN KEY ("integrations_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_deliveries_fk" FOREIGN KEY ("deliveries_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_polls_fk" FOREIGN KEY ("polls_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_poll_votes_fk" FOREIGN KEY ("poll_votes_id") REFERENCES "public"."poll_votes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vault_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vault"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_files_fk" FOREIGN KEY ("files_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workspace_files_fk" FOREIGN KEY ("workspace_files_id") REFERENCES "public"."workspace_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workspace_folders_fk" FOREIGN KEY ("workspace_folders_id") REFERENCES "public"."workspace_folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_permissions_order_idx" ON "users_permissions" USING btree ("order");
  CREATE INDEX "users_permissions_parent_idx" ON "users_permissions" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");
  CREATE INDEX "users_workspace_idx" ON "users" USING btree ("workspace_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "workspaces_updated_at_idx" ON "workspaces" USING btree ("updated_at");
  CREATE INDEX "workspaces_created_at_idx" ON "workspaces" USING btree ("created_at");
  CREATE INDEX "documents_deleted_at_idx" ON "documents" USING btree ("deleted_at");
  CREATE INDEX "documents_trash_group_idx" ON "documents" USING btree ("trash_group");
  CREATE INDEX "documents_workspace_idx" ON "documents" USING btree ("workspace_id");
  CREATE INDEX "documents_private_owner_idx" ON "documents" USING btree ("private_owner");
  CREATE INDEX "documents_key_idx" ON "documents" USING btree ("key");
  CREATE UNIQUE INDEX "documents_workspace_key_idx" ON "documents" USING btree ("workspace_key");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE INDEX "integrations_workspace_idx" ON "integrations" USING btree ("workspace_id");
  CREATE UNIQUE INDEX "integrations_workspace_provider_idx" ON "integrations" USING btree ("workspace_provider");
  CREATE INDEX "integrations_updated_at_idx" ON "integrations" USING btree ("updated_at");
  CREATE INDEX "integrations_created_at_idx" ON "integrations" USING btree ("created_at");
  CREATE INDEX "deliveries_workspace_idx" ON "deliveries" USING btree ("workspace_id");
  CREATE UNIQUE INDEX "deliveries_key_idx" ON "deliveries" USING btree ("key");
  CREATE INDEX "deliveries_updated_at_idx" ON "deliveries" USING btree ("updated_at");
  CREATE INDEX "deliveries_created_at_idx" ON "deliveries" USING btree ("created_at");
  CREATE INDEX "comments_workspace_idx" ON "comments" USING btree ("workspace_id");
  CREATE INDEX "comments_private_owner_idx" ON "comments" USING btree ("private_owner");
  CREATE INDEX "comments_task_id_idx" ON "comments" USING btree ("task_id");
  CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "comments_rels_order_idx" ON "comments_rels" USING btree ("order");
  CREATE INDEX "comments_rels_parent_idx" ON "comments_rels" USING btree ("parent_id");
  CREATE INDEX "comments_rels_path_idx" ON "comments_rels" USING btree ("path");
  CREATE INDEX "comments_rels_users_id_idx" ON "comments_rels" USING btree ("users_id");
  CREATE INDEX "notifications_workspace_idx" ON "notifications" USING btree ("workspace_id");
  CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");
  CREATE UNIQUE INDEX "notifications_key_idx" ON "notifications" USING btree ("key");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "polls_workspace_idx" ON "polls" USING btree ("workspace_id");
  CREATE INDEX "polls_updated_at_idx" ON "polls" USING btree ("updated_at");
  CREATE INDEX "polls_created_at_idx" ON "polls" USING btree ("created_at");
  CREATE UNIQUE INDEX "poll_votes_key_idx" ON "poll_votes" USING btree ("key");
  CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes" USING btree ("poll_id");
  CREATE INDEX "poll_votes_updated_at_idx" ON "poll_votes" USING btree ("updated_at");
  CREATE INDEX "poll_votes_created_at_idx" ON "poll_votes" USING btree ("created_at");
  CREATE INDEX "vault_deleted_at_idx" ON "vault" USING btree ("deleted_at");
  CREATE INDEX "vault_workspace_idx" ON "vault" USING btree ("workspace_id");
  CREATE INDEX "vault_updated_at_idx" ON "vault" USING btree ("updated_at");
  CREATE INDEX "vault_created_at_idx" ON "vault" USING btree ("created_at");
  CREATE INDEX "files_deleted_at_idx" ON "files" USING btree ("deleted_at");
  CREATE INDEX "files_workspace_idx" ON "files" USING btree ("workspace_id");
  CREATE INDEX "files_updated_at_idx" ON "files" USING btree ("updated_at");
  CREATE INDEX "files_created_at_idx" ON "files" USING btree ("created_at");
  CREATE UNIQUE INDEX "files_filename_idx" ON "files" USING btree ("filename");
  CREATE INDEX "workspace_files_folder_idx" ON "workspace_files" USING btree ("folder_id");
  CREATE INDEX "workspace_files_workspace_idx" ON "workspace_files" USING btree ("workspace_id");
  CREATE INDEX "workspace_files_deleted_at_idx" ON "workspace_files" USING btree ("deleted_at");
  CREATE INDEX "workspace_files_updated_at_idx" ON "workspace_files" USING btree ("updated_at");
  CREATE INDEX "workspace_files_created_at_idx" ON "workspace_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "workspace_files_filename_idx" ON "workspace_files" USING btree ("filename");
  CREATE INDEX "workspace_folders_workspace_idx" ON "workspace_folders" USING btree ("workspace_id");
  CREATE UNIQUE INDEX "workspace_folders_key_idx" ON "workspace_folders" USING btree ("key");
  CREATE INDEX "workspace_folders_updated_at_idx" ON "workspace_folders" USING btree ("updated_at");
  CREATE INDEX "workspace_folders_created_at_idx" ON "workspace_folders" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_workspaces_id_idx" ON "payload_locked_documents_rels" USING btree ("workspaces_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_integrations_id_idx" ON "payload_locked_documents_rels" USING btree ("integrations_id");
  CREATE INDEX "payload_locked_documents_rels_deliveries_id_idx" ON "payload_locked_documents_rels" USING btree ("deliveries_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_polls_id_idx" ON "payload_locked_documents_rels" USING btree ("polls_id");
  CREATE INDEX "payload_locked_documents_rels_poll_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("poll_votes_id");
  CREATE INDEX "payload_locked_documents_rels_vault_id_idx" ON "payload_locked_documents_rels" USING btree ("vault_id");
  CREATE INDEX "payload_locked_documents_rels_files_id_idx" ON "payload_locked_documents_rels" USING btree ("files_id");
  CREATE INDEX "payload_locked_documents_rels_workspace_files_id_idx" ON "payload_locked_documents_rels" USING btree ("workspace_files_id");
  CREATE INDEX "payload_locked_documents_rels_workspace_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("workspace_folders_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_permissions" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "workspaces" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "integrations" CASCADE;
  DROP TABLE "deliveries" CASCADE;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "comments_rels" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "polls" CASCADE;
  DROP TABLE "poll_votes" CASCADE;
  DROP TABLE "vault" CASCADE;
  DROP TABLE "files" CASCADE;
  DROP TABLE "workspace_files" CASCADE;
  DROP TABLE "workspace_folders" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_permissions";
  DROP TYPE "public"."enum_users_job_title";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_workspaces_plan";
  DROP TYPE "public"."enum_integrations_provider";
  DROP TYPE "public"."enum_deliveries_provider";
  DROP TYPE "public"."enum_deliveries_status";
  DROP TYPE "public"."enum_notifications_kind";
  DROP TYPE "public"."enum_files_kind";`)
}
