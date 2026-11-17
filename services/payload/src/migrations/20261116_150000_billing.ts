import {
  type MigrateUpArgs,
  type MigrateDownArgs,
  sql,
} from "@payloadcms/db-postgres";
export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
 CREATE TABLE billing_documents (
 id serial PRIMARY KEY, workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 store_key varchar NOT NULL, provider varchar NOT NULL, order_id varchar NOT NULL, refund_id varchar NOT NULL DEFAULT '',
 parent_id integer REFERENCES billing_documents(id) ON DELETE RESTRICT, op_key varchar NOT NULL,
 environment varchar NOT NULL, issuer varchar NOT NULL, type integer NOT NULL CHECK(type IN(33,39,56,61)),
 folio bigint, caf_id integer, amount bigint NOT NULL CHECK(amount>0), snapshot text NOT NULL,
 state varchar NOT NULL DEFAULT 'queued', xml text, xml_hash varchar, ted text, track_id varchar NOT NULL DEFAULT '',
 attempts integer NOT NULL DEFAULT 0, next_run timestamptz NOT NULL DEFAULT now(), last_code varchar NOT NULL DEFAULT '',
 email_state varchar NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,op_key), UNIQUE(issuer,environment,type,folio)
 );
 CREATE INDEX billing_order_idx ON billing_documents(workspace_id,store_key,order_id);
 CREATE INDEX billing_queue_idx ON billing_documents(state,next_run);
 CREATE TABLE billing_cafs (
 id serial PRIMARY KEY, workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
 issuer varchar NOT NULL, environment varchar NOT NULL,type integer NOT NULL,first_folio bigint NOT NULL,last_folio bigint NOT NULL,next_folio bigint NOT NULL,expires date NOT NULL,secret text NOT NULL
 );
 CREATE TABLE billing_events(id bigserial PRIMARY KEY,workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,document_id integer REFERENCES billing_documents(id) ON DELETE RESTRICT,code varchar NOT NULL,detail text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE billing_receivers(workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,store_key varchar NOT NULL,order_id varchar NOT NULL,type integer NOT NULL,receiver text NOT NULL,PRIMARY KEY(workspace_id,store_key,order_id));
 CREATE TABLE billing_sync(workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,store_key varchar NOT NULL,connection_id varchar NOT NULL,activated_at timestamptz NOT NULL DEFAULT now(),cursor varchar,error varchar NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,store_key));
`);
}
export async function down(_args: MigrateDownArgs) {
  throw new Error(
    "Los documentos y folios fiscales no se eliminan al revertir una migración.",
  );
}
