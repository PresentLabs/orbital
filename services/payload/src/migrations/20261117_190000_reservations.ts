import { sql, type MigrateUpArgs, type MigrateDownArgs } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE reservation_settings (
      workspace_id integer PRIMARY KEY REFERENCES workspaces(id) ON DELETE RESTRICT,
      value jsonb NOT NULL, version integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE reservation_catalog (
      id serial PRIMARY KEY,
      workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      request_key varchar, fingerprint varchar,
      kind varchar NOT NULL CHECK(kind IN ('service','professional','location','resource','customer')),
      name varchar(160) NOT NULL, active boolean NOT NULL DEFAULT true, value jsonb NOT NULL,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(workspace_id,id), UNIQUE(workspace_id,request_key)
    );
    CREATE INDEX reservation_catalog_workspace_idx ON reservation_catalog(workspace_id,kind,active);
    CREATE UNIQUE INDEX reservation_customer_email_idx ON reservation_catalog(workspace_id,lower(value->>'email')) WHERE kind='customer';
    CREATE TABLE reservation_bookings (
      id serial PRIMARY KEY, workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      request_key varchar NOT NULL, fingerprint varchar NOT NULL,
      service_id integer NOT NULL, professional_id integer, location_id integer,
      customer_name varchar(160) NOT NULL, customer_email varchar(254) NOT NULL,
      start_at timestamptz NOT NULL, end_at timestamptz NOT NULL CHECK(end_at>start_at),
      quantity integer NOT NULL CHECK(quantity>0), amount_minor bigint NOT NULL CHECK(amount_minor>=0), currency varchar(3) NOT NULL,
      status varchar NOT NULL CHECK(status IN ('pending','confirmed','canceled','completed','no_show')),
      payment_status varchar NOT NULL CHECK(payment_status IN ('unpaid','paid','partially_paid','refunded','free')),
      details jsonb NOT NULL, created_by integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(workspace_id,service_id) REFERENCES reservation_catalog(workspace_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(workspace_id,professional_id) REFERENCES reservation_catalog(workspace_id,id) ON DELETE RESTRICT,
      FOREIGN KEY(workspace_id,location_id) REFERENCES reservation_catalog(workspace_id,id) ON DELETE RESTRICT,
      UNIQUE(workspace_id,request_key)
    );
    CREATE INDEX reservation_booking_schedule_idx ON reservation_bookings(workspace_id,start_at,end_at);
    CREATE INDEX reservation_booking_professional_idx ON reservation_bookings(workspace_id,professional_id,start_at);
    CREATE TABLE reservation_audit (
      id bigserial PRIMARY KEY, workspace_id integer NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
      actor_id integer NOT NULL, action varchar NOT NULL, record_id integer NOT NULL, data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX reservation_audit_workspace_idx ON reservation_audit(workspace_id,created_at);
  `);
}
export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error("La reversión requiere respaldar reservas, clientes y auditoría.");
}
